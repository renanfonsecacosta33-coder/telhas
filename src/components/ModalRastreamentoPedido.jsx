import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Pause, 
  Truck, 
  Factory, 
  Scissors, 
  ExternalLink, 
  Eye, 
  Image as ImageIcon, 
  Layers, 
  Calendar, 
  User, 
  Building2, 
  FileText,
  ChevronRight,
  ArrowRight,
  Package,
  Sparkles,
  Inbox
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// Mapa de rotas diretas para máquinas
const MAQUINA_ROTA_MAP = {
  // Telhas
  "TP - 25": "/maquina/tp25",
  "TP - 40": "/maquina/tp40",
  "ONDULADA": "/maquina/ondulada",
  "COLONIAL": "/maquina/colonial",
  "BANDEJA": "/maquina/bandeja",
  "DESBOBINADOR": "/maquina/desbobinador",
  "CUMEEIRA": "/maquina/cumeeira",
  "COLAGEM": "/maquina/colagem",

  // Corte & Dobra
  "CORTE 3M": "/corte-dobra/maquina/corte-3m",
  "CORTE 6M": "/corte-dobra/maquina/corte-6m",
  "DOBRA 3M": "/corte-dobra/maquina/dobra-3m",
  "DOBRA FUNDO 6M": "/corte-dobra/maquina/dobra-fundo-6m",
  "DOBRA INICIO 6M": "/corte-dobra/maquina/dobra-inicio-6m",
  "PERFILADEIRA": "/corte-dobra/maquina/perfiladeira",
  "DESBOBINADEIRA 01": "/corte-dobra/maquina/desbobinadeira-1",
  "DESBOBINADEIRA 02": "/corte-dobra/maquina/desbobinadeira-2",
  "DESBOBINADEIRA": "/corte-dobra/maquina/desbobinadeira",
};

export default function ModalRastreamentoPedido({ numeroPedido, open, onOpenChange }) {
  const navigate = useNavigate();
  const [fotoModalUrl, setFotoModalUrl] = useState(null);

  const numLimpo = String(numeroPedido || "").replace(/^#/, "").trim();

  // 1. Busca Pedido Odoo / PCP
  const { data: pedidoOdoo, isLoading: loadingOdoo } = useQuery({
    queryKey: ["tracking-pedido-odoo", numLimpo],
    queryFn: async () => {
      if (!numLimpo) return null;
      try {
        const res = await base44.entities.PedidoOdoo.filter({ numero_pedido: numLimpo });
        if (res && res.length > 0) return res[0];
        // Tenta também com prefixo SO-
        const resSO = await base44.entities.PedidoOdoo.filter({ numero_pedido: `SO-${numLimpo}` });
        if (resSO && resSO.length > 0) return resSO[0];
      } catch (e) {
        console.warn("Erro ao buscar PedidoOdoo para rastreamento:", e);
      }
      return null;
    },
    enabled: open && Boolean(numLimpo),
  });

  // 2. Busca Ordens de Telhas
  const { data: ordensTelhas = [], isLoading: loadingTelhas } = useQuery({
    queryKey: ["tracking-ordens-telhas", numLimpo],
    queryFn: async () => {
      if (!numLimpo) return [];
      try {
        const ordens = await base44.entities.Pedido.filter({ numero_pedido: numLimpo });
        return Array.isArray(ordens) ? ordens : [];
      } catch (e) {
        console.warn("Erro ao buscar Pedidos de Telhas:", e);
        return [];
      }
    },
    enabled: open && Boolean(numLimpo),
  });

  // 3. Busca Ordens de Corte & Dobra / Perfiladeiras
  const { data: ordensCD = [], isLoading: loadingCD } = useQuery({
    queryKey: ["tracking-ordens-cd", numLimpo],
    queryFn: async () => {
      if (!numLimpo) return [];
      try {
        const ordens = await base44.entities.OrdemMaquinaCD.filter({ numero_pedido: numLimpo });
        return Array.isArray(ordens) ? ordens : [];
      } catch (e) {
        console.warn("Erro ao buscar Ordens CD:", e);
        return [];
      }
    },
    enabled: open && Boolean(numLimpo),
  });

  // 4. Busca Ordens de Desbobinadeira
  const { data: ordensDesb = [], isLoading: loadingDesb } = useQuery({
    queryKey: ["tracking-ordens-desb", numLimpo],
    queryFn: async () => {
      if (!numLimpo) return [];
      try {
        const ordens = await base44.entities.OrdemDesbobinadeira.filter({ numero_pedido: numLimpo });
        return Array.isArray(ordens) ? ordens : [];
      } catch (e) {
        console.warn("Erro ao buscar Ordens Desbobinadeira:", e);
        return [];
      }
    },
    enabled: open && Boolean(numLimpo),
  });

  // 5. Busca Carga / Expedição vinculada
  const { data: cargaVinculada, isLoading: loadingCarga } = useQuery({
    queryKey: ["tracking-carga", numLimpo],
    queryFn: async () => {
      if (!numLimpo) return null;
      try {
        const cargas = await base44.entities.Carga.filter({}, "-created_date", 100);
        if (Array.isArray(cargas)) {
          const encontrada = cargas.find(c => {
            if (Array.isArray(c.pedidos)) {
              return c.pedidos.some(p => String(p).includes(numLimpo));
            }
            if (typeof c.pedidos_json === "string") {
              return c.pedidos_json.includes(numLimpo);
            }
            return false;
          });
          return encontrada || null;
        }
      } catch (e) {
        console.warn("Erro ao buscar Carga:", e);
      }
      return null;
    },
    enabled: open && Boolean(numLimpo),
  });

  const isLoading = loadingOdoo || loadingTelhas || loadingCD || loadingDesb || loadingCarga;

  // Unifica todas as ordens de fabricação para métricas
  const todasOrdens = [
    ...ordensTelhas.map(o => ({ ...o, setor: "Telhas", tipo: o.produto || "Telha", maquinaNome: o.maquina })),
    ...ordensCD.map(o => ({ ...o, setor: "C&D", tipo: o.tipo_peca || "Perfil/Chapa", maquinaNome: o.maquina })),
    ...ordensDesb.map(o => ({ ...o, setor: "Desbobinamento", tipo: "Desbobinamento", maquinaNome: o.maquina || "DESBOBINADEIRA" }))
  ];

  const totalItens = todasOrdens.length;
  const itensFinalizados = todasOrdens.filter(o => o.status === "finalizado").length;
  const itensEmProducao = todasOrdens.filter(o => o.status === "em_producao").length;
  const itensPausados = todasOrdens.filter(o => o.status === "pausado").length;
  const percentualConcluido = totalItens > 0 ? Math.round((itensFinalizados / totalItens) * 100) : (pedidoOdoo?.percentual_concluido || 0);

  // Determinar Etapa Atual Geral do Pedido
  let etapaAtual = {
    nome: "PCP — Fila Aguardando Distribuição",
    cor: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-800",
    icone: Inbox,
    fase: 1
  };

  if (cargaVinculada) {
    if (cargaVinculada.status === "entregue") {
      etapaAtual = {
        nome: "Entregue ao Cliente",
        cor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
        icone: CheckCircle2,
        fase: 4
      };
    } else if (cargaVinculada.status === "em_rota") {
      etapaAtual = {
        nome: "Em Rota de Entrega",
        cor: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800",
        icone: Truck,
        fase: 4
      };
    } else {
      etapaAtual = {
        nome: "Logística / Expedição (Em Carregamento)",
        cor: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-300 dark:border-teal-800",
        icone: Truck,
        fase: 4
      };
    }
  } else if (totalItens > 0 && itensFinalizados === totalItens) {
    etapaAtual = {
      nome: "Produção Concluída — Aguardando Expedição",
      cor: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800",
      icone: CheckCircle2,
      fase: 3
    };
  } else if (itensEmProducao > 0) {
    const maqAtiva = todasOrdens.find(o => o.status === "em_producao")?.maquinaNome || "Máquinas";
    etapaAtual = {
      nome: `Em Produção na Máquina (${maqAtiva})`,
      cor: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-300 dark:border-orange-800",
      icone: Play,
      fase: 2
    };
  } else if (totalItens > 0) {
    etapaAtual = {
      nome: "Distribuído às Máquinas (Aguardando Início)",
      cor: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-300 dark:border-indigo-800",
      icone: Clock,
      fase: 2
    };
  }

  // Anexos e Croquis disponíveis do Odoo
  const anexosOdoo = [
    pedidoOdoo?.foto_pedido_url,
    pedidoOdoo?.anexo_1_url,
    pedidoOdoo?.anexo_2_url,
    pedidoOdoo?.anexo_3_url,
    pedidoOdoo?.anexo_4_url,
    pedidoOdoo?.anexo_5_url,
    pedidoOdoo?.anexo_6_url,
    pedidoOdoo?.anexo_7_url,
    pedidoOdoo?.anexo_8_url,
    pedidoOdoo?.anexo_9_url,
    pedidoOdoo?.anexo_10_url,
  ].filter(Boolean);

  const clienteNome = pedidoOdoo?.cliente_nome || todasOrdens[0]?.cliente || "Cliente não informado";
  const vendedorNome = pedidoOdoo?.vendedor_nome || todasOrdens[0]?.vendedor || "Vendedor não informado";
  const filialNome = pedidoOdoo?.unidade || todasOrdens[0]?.unidade || "Matriz AJL";

  const handleIrParaMaquina = (maquinaNome, ordem = null) => {
    const maqNorm = String(maquinaNome || "").trim();
    let rotaBase = MAQUINA_ROTA_MAP[maqNorm];
    if (!rotaBase) {
      const u = maqNorm.toUpperCase();
      if (u.includes("TP") && u.includes("25")) rotaBase = "/maquina/tp25";
      else if (u.includes("TP") && u.includes("40")) rotaBase = "/maquina/tp40";
      else if (u.includes("COLONIAL")) rotaBase = "/maquina/colonial";
      else if (u.includes("ONDULADA")) rotaBase = "/maquina/ondulada";
      else if (u.includes("BANDEJA")) rotaBase = "/maquina/bandeja";
      else if (u.includes("COLAGEM")) rotaBase = "/maquina/colagem";
      else if (u.includes("CUMEEIRA")) rotaBase = "/maquina/cumeeira";
      else if (u.includes("DESBOBINADOR")) rotaBase = "/maquina/desbobinador";
      else if (u.includes("CORTE") || u.includes("DOBRA") || u.includes("PERFILADEIRA")) rotaBase = "/corte-dobra/producao";
      else rotaBase = "/maquina/tp40";
    }

    const params = new URLSearchParams();
    if (ordem?.id) params.set("focarId", ordem.id);
    const numPed = ordem?.numero_pedido || numLimpo || numeroPedido;
    if (numPed) params.set("focarPedido", numPed);
    const dataAlvo = ordem?.data || ordem?.data_producao || ordem?.data_entrega || ordem?.data_perfilacao;
    if (dataAlvo) params.set("data", dataAlvo);

    onOpenChange(false);
    navigate(`${rotaBase}?${params.toString()}`);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "finalizado":
        return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-300 text-[10px] gap-1"><CheckCircle2 className="w-3 h-3" /> Finalizado</Badge>;
      case "em_producao":
        return <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-300 text-[10px] gap-1 animate-pulse"><Play className="w-3 h-3" /> Em Produção</Badge>;
      case "pausado":
        return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 text-[10px] gap-1"><Pause className="w-3 h-3" /> Pausado</Badge>;
      case "aguardando_colagem":
        return <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-300 text-[10px] gap-1">Aguardando Colagem</Badge>;
      case "aguardando_material":
        return <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-300 text-[10px] gap-1"><AlertCircle className="w-3 h-3" /> Falta Material</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground text-[10px] gap-1"><Clock className="w-3 h-3" /> Na Fila / Pendente</Badge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-border bg-background shadow-2xl rounded-2xl">
          {/* Topo do Modal com Header Gradiente */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6 border-b border-slate-700/60 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/40">
                    PEDIDO #{numLimpo}
                  </span>
                  {pedidoOdoo?.numero_oc && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      OC: {pedidoOdoo.numero_oc}
                    </span>
                  )}
                  <Badge className={`text-xs font-bold border ${etapaAtual.cor}`}>
                    <etapaAtual.icone className="w-3.5 h-3.5 mr-1.5" />
                    {etapaAtual.nome}
                  </Badge>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <span>{clienteNome}</span>
                </h2>
                <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap pt-0.5">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-slate-400" /> Vendedor: <strong>{vendedorNome}</strong>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" /> Filial: <strong>{filialNome}</strong>
                  </span>
                  {pedidoOdoo?.data_entrega && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-orange-400" /> Previsão: <strong>{pedidoOdoo.data_entrega}</strong>
                    </span>
                  )}
                </div>
              </div>

              {/* Card de Progresso Geral */}
              <div className="bg-slate-800/80 border border-slate-700 p-3 rounded-xl min-w-[160px] text-center shrink-0">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">
                  Progresso Fabril
                </span>
                <div className="text-2xl font-black text-white flex items-center justify-center gap-1">
                  <span>{percentualConcluido}%</span>
                  {percentualConcluido === 100 && <Sparkles className="w-4 h-4 text-emerald-400" />}
                </div>
                <div className="w-full bg-slate-700 h-2 rounded-full mt-1.5 overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-emerald-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${percentualConcluido}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-400 block mt-1">
                  {itensFinalizados} de {totalItens} itens prontos
                </span>
              </div>
            </div>

            {/* Stepper Visual de Rastreamento (Linha do Tempo) */}
            <div className="grid grid-cols-4 gap-2 mt-5 pt-4 border-t border-slate-700/60 text-center">
              <div className={`p-2 rounded-lg border transition-all ${etapaAtual.fase >= 1 ? "bg-primary/20 border-primary text-white" : "bg-slate-800/40 border-slate-700/50 text-slate-400"}`}>
                <Inbox className="w-4 h-4 mx-auto mb-1 text-primary" />
                <span className="text-[11px] font-bold block">1. PCP</span>
                <span className="text-[9px] opacity-80 hidden sm:block">Entrada Odoo</span>
              </div>
              <div className={`p-2 rounded-lg border transition-all ${etapaAtual.fase >= 2 ? "bg-orange-500/20 border-orange-500 text-white" : "bg-slate-800/40 border-slate-700/50 text-slate-400"}`}>
                <Factory className="w-4 h-4 mx-auto mb-1 text-orange-400" />
                <span className="text-[11px] font-bold block">2. Máquinas</span>
                <span className="text-[9px] opacity-80 hidden sm:block">Fila de Produção</span>
              </div>
              <div className={`p-2 rounded-lg border transition-all ${etapaAtual.fase >= 3 ? "bg-emerald-500/20 border-emerald-500 text-white" : "bg-slate-800/40 border-slate-700/50 text-slate-400"}`}>
                <CheckCircle2 className="w-4 h-4 mx-auto mb-1 text-emerald-400" />
                <span className="text-[11px] font-bold block">3. Fabricado</span>
                <span className="text-[9px] opacity-80 hidden sm:block">100% Produzido</span>
              </div>
              <div className={`p-2 rounded-lg border transition-all ${etapaAtual.fase >= 4 ? "bg-teal-500/20 border-teal-500 text-white" : "bg-slate-800/40 border-slate-700/50 text-slate-400"}`}>
                <Truck className="w-4 h-4 mx-auto mb-1 text-teal-400" />
                <span className="text-[11px] font-bold block">4. Expedição</span>
                <span className="text-[9px] opacity-80 hidden sm:block">Carga & Entrega</span>
              </div>
            </div>
          </div>

          {/* Corpo do Modal com Detalhes dos Itens por Máquina */}
          <div className="p-4 sm:p-6 space-y-6">
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-3 border-muted border-t-primary rounded-full animate-spin" />
                <span className="text-sm">Rastreando etapas do pedido #{numLimpo}...</span>
              </div>
            ) : totalItens === 0 && !pedidoOdoo ? (
              <div className="py-10 text-center text-muted-foreground space-y-2">
                <AlertCircle className="w-10 h-10 mx-auto text-amber-500" />
                <p className="font-semibold text-foreground">Nenhuma ordem encontrada para o Pedido #{numLimpo}</p>
                <p className="text-xs">Verifique se o número do pedido está correto ou se ele ainda está sendo sincronizado pelo Odoo.</p>
              </div>
            ) : (
              <>
                {/* 1. SEÇÃO LOGÍSTICA / CARGA (SE HOUVER) */}
                {cargaVinculada && (
                  <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/20 p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
                        <Truck className="w-4 h-4 text-teal-600" /> Expedição & Logística Atribuída
                      </span>
                      <Badge className="bg-teal-600 text-white text-[10px]">
                        Carga #{cargaVinculada.numero_carga || cargaVinculada.id}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Motorista:</span>
                        <strong className="text-foreground">{cargaVinculada.motorista || "Não definido"}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Placa / Veículo:</span>
                        <strong className="text-foreground">{cargaVinculada.placa || "—"}</strong>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Status do Carregamento:</span>
                        <strong className="text-foreground capitalize">{cargaVinculada.status || "Em preparação"}</strong>
                      </div>
                      <div className="flex items-end justify-start sm:justify-end">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-7 text-xs border-teal-300 text-teal-700 dark:text-teal-300 hover:bg-teal-100"
                          onClick={() => {
                            onOpenChange(false);
                            navigate("/expedicao");
                          }}
                        >
                          Ver na Logística <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. ITENS NA FÁBRICA DE TELHAS */}
                {ordensTelhas.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                        <Factory className="w-4 h-4 text-blue-500" />
                        Fábrica de Telhas ({ordensTelhas.length} {ordensTelhas.length === 1 ? "item" : "itens"})
                      </h3>
                    </div>
                    <div className="grid gap-2.5">
                      {ordensTelhas.map(ordem => (
                        <div 
                          key={ordem.id} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-foreground">
                                {ordem.produto || "Telha"} {ordem.modelo ? `— ${ordem.modelo}` : ""}
                              </span>
                              {getStatusBadge(ordem.status)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span>Máquina: <strong className="text-foreground">{ordem.maquina}</strong></span>
                              <span>Quantidade: <strong className="text-foreground">{ordem.quantidade || 0} pçs</strong></span>
                              {ordem.comprimento_m && <span>Comprimento: <strong className="text-foreground">{ordem.comprimento_m}m</strong></span>}
                              {ordem.espessura && <span>Espessura: <strong className="text-foreground">{ordem.espessura}</strong></span>}
                              {ordem.cor && <span>Cor: <strong className="text-foreground">{ordem.cor}</strong></span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {ordem.foto_finalizacao_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => setFotoModalUrl(ordem.foto_finalizacao_url)}
                              >
                                <Eye className="w-3.5 h-3.5" /> Foto Peça
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold cursor-pointer"
                              onClick={() => handleIrParaMaquina(ordem.maquina, ordem)}
                            >
                              <span>Ir para {ordem.maquina}</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. ITENS NO CORTE & DOBRA / PERFILADEIRA */}
                {ordensCD.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                        <Scissors className="w-4 h-4 text-orange-500" />
                        Corte & Dobra / Perfiladeiras ({ordensCD.length} {ordensCD.length === 1 ? "item" : "itens"})
                      </h3>
                    </div>
                    <div className="grid gap-2.5">
                      {ordensCD.map(ordem => (
                        <div 
                          key={ordem.id} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-all gap-3"
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-foreground">
                                {ordem.tipo_peca || "Peça / Perfil"}
                              </span>
                              {getStatusBadge(ordem.status)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span>Máquina: <strong className="text-foreground">{ordem.maquina}</strong></span>
                              <span>Quantidade: <strong className="text-foreground">{ordem.quantidade || 0} pçs</strong></span>
                              {ordem.dimensoes_livres && <span>Dimensões: <strong className="text-foreground">{ordem.dimensoes_livres}</strong></span>}
                              {ordem.peso_kg && <span>Peso: <strong className="text-foreground">{ordem.peso_kg} kg</strong></span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                            {ordem.foto_finalizacao_url && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                                onClick={() => setFotoModalUrl(ordem.foto_finalizacao_url)}
                              >
                                <Eye className="w-3.5 h-3.5" /> Foto Peça
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-8 text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-semibold cursor-pointer"
                              onClick={() => handleIrParaMaquina(ordem.maquina, ordem)}
                            >
                              <span>Ir para {ordem.maquina}</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. ITENS EM DESBOBINAMENTO */}
                {ordensDesb.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4 text-orange-600" />
                      Desbobinadeiras ({ordensDesb.length} {ordensDesb.length === 1 ? "item" : "itens"})
                    </h3>
                    <div className="grid gap-2.5">
                      {ordensDesb.map(ordem => (
                        <div key={ordem.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card gap-2">
                          <div className="text-xs space-y-0.5">
                            <span className="font-bold text-foreground block">Desbobinamento Bobina {ordem.bobina_codigo || ""}</span>
                            <span className="text-muted-foreground">{ordem.comprimento_mm ? `${ordem.comprimento_mm}mm` : ""} · {ordem.quantidade || 0} chapas</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {getStatusBadge(ordem.status)}
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="h-8 text-xs gap-1"
                              onClick={() => handleIrParaMaquina(ordem.maquina || "DESBOBINADEIRA 01", ordem)}
                            >
                              Ver Máquina <ExternalLink className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. SEÇÃO DE CROQUIS E ANEXOS TÉCNICOS (ODOO) */}
                {anexosOdoo.length > 0 && (
                  <div className="pt-2 space-y-2 border-t border-border">
                    <span className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <ImageIcon className="w-3.5 h-3.5" />
                      Croquis Técnicos & Anexos do Pedido ({anexosOdoo.length})
                    </span>
                    <div className="flex items-center gap-3 overflow-x-auto pb-2">
                      {anexosOdoo.map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFotoModalUrl(url)}
                          className="w-20 h-20 rounded-xl border border-border bg-muted/40 overflow-hidden relative group shrink-0 hover:border-primary transition-all cursor-pointer"
                        >
                          <img src={url} alt={`Anexo ${idx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                            Ver
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Zoom da Foto */}
      {fotoModalUrl && (
        <Dialog open={Boolean(fotoModalUrl)} onOpenChange={() => setFotoModalUrl(null)}>
          <DialogContent className="max-w-3xl p-2 bg-slate-950 border-slate-800 text-white">
            <div className="max-h-[80vh] flex items-center justify-center overflow-hidden rounded-xl">
              <img src={fotoModalUrl} alt="Visualização da foto/anexo" className="max-h-[75vh] w-auto object-contain rounded-lg" />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
