import React, { useState, useMemo, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Layers, CheckCircle2, AlertTriangle, Link2, Play, DollarSign, Search, X, BellRing, Trash2, Loader2, RefreshCw, Camera, ArrowRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useFilial } from "@/contexts/FilialContext";
import { playMaterialDisponivelSound, speakMaterialDisponivel } from "@/lib/sounds";
import { useTolerancias } from "@/hooks/useTolerancias";
import { validarBobina } from "@/lib/bobinaValidation";
import BloqueioBobinaDialog from "@/components/bobinas/BloqueioBobinaDialog";

function normalizeEspessura(val) {
  if (!val) return "";
  return String(val).replace(/\s/g, "").replace(".", ",");
}

export default function OPSemMaterialTab() {
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [vinculando, setVinculando] = useState(null); // { tipo: 'desb'|'maq', id, entidade }
  const [bloqueio, setBloqueio] = useState({ open: false, motivos: [], titulo: "" });
  const { data: tolerancias = [] } = useTolerancias();

  // OPs aguardando material — Desbobinadeira
  const { data: opsDesb = [], isLoading: loadingDesb } = useQuery({
    queryKey: ["ops-sem-material-desb", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({
      unidade: filialAtiva, status: "aguardando_material"
    }, "-data", 200),
    refetchInterval: 15000,
  });

  // OPs aguardando material — Máquinas CD
  const { data: opsMaq = [], isLoading: loadingMaq } = useQuery({
    queryKey: ["ops-sem-material-maq", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({
      unidade: filialAtiva, status: "aguardando_material"
    }, "-data", 200),
    refetchInterval: 15000,
  });

  // Bobinas em estoque CD
  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-cd-disponiveis", filialAtiva],
    queryFn: () => base44.entities.Bobina.filter({
      setor: "corte_dobra", arquivada: false, unidade: filialAtiva
    }),
    refetchInterval: 30000,
  });

  // Chapas disponíveis
  const { data: chapas = [] } = useQuery({
    queryKey: ["chapas-cd-disponiveis-sem-material", filialAtiva],
    queryFn: () => base44.entities.ChapaCD.filter({ unidade: filialAtiva }),
    refetchInterval: 30000,
  });

  // OPs da Desbobinadeira que produzem chapas para ESTOQUE — para linkar com OPs de Guilhotina/Dobradeira sem material
  const { data: opsDesbEstoque = [] } = useQuery({
    queryKey: ["ops-desbobinadeira-estoque-link", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva, destino: "estoque" }, "-data", 200),
    refetchInterval: 15000,
  });

  // Normaliza espessura de uma OP da Desbobinadeira (espessura_utilizada > material_espessura > parse da descrição)
  function espessuraDesb(d) {
    let esp = normalizeEspessura(d.espessura_utilizada) || normalizeEspessura(d.material_espessura);
    if (!esp && d.bobina_descricao) {
      const m = d.bobina_descricao.match(/(\d+[.,]?\d*)\s*mm/i);
      if (m) esp = normalizeEspessura(m[1]);
    }
    return esp;
  }

  const desbEmProducao = useMemo(
    () => opsDesbEstoque.filter(d => ["pendente", "em_producao", "pausado"].includes(d.status)),
    [opsDesbEstoque]
  );
  const desbFinalizadas = useMemo(
    () => opsDesbEstoque.filter(d => d.status === "finalizado"),
    [opsDesbEstoque]
  );

  // Retorna { emProd, prontas } — OPs da Desbobinadeira que estão produzindo / produziram a chapa que esta OP de Guilhotina/Dobradeira precisa
  const desbobinadeiraLinkPara = (op) => {
    if (op._tipo !== "maq") return null;
    const esp = normalizeEspessura(op.material_espessura);
    if (!esp) return null;
    return {
      emProd: desbEmProducao.filter(d => espessuraDesb(d) === esp),
      prontas: desbFinalizadas.filter(d => espessuraDesb(d) === esp && d.foto_finalizacao_url),
    };
  };

  // Verifica compatibilidade de material
  const checkDisponibilidade = (op, isDesb) => {
    const espessura = normalizeEspessura(op.material_espessura);
    const cor = (op.material_cor || "").trim().toLowerCase();

    if (isDesb) {
      // Para Desbobinadeira: procurar bobina com espessura e cor compatíveis
      return bobinas.filter(b => {
        const bEsp = normalizeEspessura(b.chapa) || normalizeEspessura(b.espessura_utilizada);
        const bEspAlt = (b.espessura_utilizada || "").split("/").map(s => normalizeEspessura(s));
        const espMatch = bEsp === espessura || bEspAlt.includes(espessura);
        const corMatch = !cor || (b.cor || "").trim().toLowerCase().includes(cor) || cor.includes((b.cor || "").trim().toLowerCase());
        return espMatch && corMatch && !b.arquivada;
      });
    } else {
      // Para Guilhotina/Dobradeira: procurar chapa com espessura compatível
      return chapas.filter(c => {
        const cEsp = normalizeEspessura(c.espessura_mm);
        const cEspBobina = normalizeEspessura((c.bobina_descricao || "").match(/[\d,]+mm/)?.[0]?.replace("mm", ""));
        const espMatch = cEsp === espessura || cEspBobina === espessura;
        const statusOk = c.status === "disponivel" || c.status === "parcial";
        return espMatch && statusOk;
      });
    }
  };

  // Liberar para produção
  const liberarMutation = useMutation({
    mutationFn: async ({ tipo, id, material_id, material_descricao, entidade }) => {
      const updates = {
        status: "pendente",
        material_em_falta: false,
      };
      if (tipo === "desb") {
        updates.bobina_id = material_id;
        updates.bobina_descricao = material_descricao;
        await base44.entities.OrdemDesbobinadeira.update(id, updates);
      } else {
        if (entidade === "chapa") {
          updates.chapa_cd_id = material_id;
          updates.chapa_descricao = material_descricao;
          updates.chapa_origem = "chaparia";
        } else {
          updates.bobina_id = material_id;
          updates.bobina_descricao = material_descricao;
          updates.chapa_origem = "direto";
        }
        await base44.entities.OrdemMaquinaCD.update(id, updates);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-sem-material-desb"] });
      queryClient.invalidateQueries({ queryKey: ["ops-sem-material-maq"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
      setVinculando(null);
      toast.success("OP liberada para produção!");
    },
    onError: (err) => toast.error("Erro ao liberar: " + err.message),
  });

  // Lista unificada
  const listaUnificada = useMemo(() => {
    const items = [
      ...opsDesb.map(o => ({ ...o, _tipo: "desb", _entidade: "bobina" })),
      ...opsMaq.map(o => ({ ...o, _tipo: "maq", _entidade: o.maquina?.includes("CORTE") || o.maquina?.includes("DOBRA") ? "chapa" : "bobina" })),
    ];
    if (!busca.trim()) return items;
    const q = busca.toLowerCase();
    return items.filter(o =>
      (o.numero_pedido || "").toLowerCase().includes(q) ||
      (o.cliente || "").toLowerCase().includes(q) ||
      (o.material_espessura || "").toLowerCase().includes(q) ||
      (o.material_cor || "").toLowerCase().includes(q)
    );
  }, [opsDesb, opsMaq, busca]);

  // Detecta quando material fica disponível e dispara alerta TOP
  const prevDisponiveisRef = useRef(null);
  const opsComMaterial = useMemo(() => {
    return listaUnificada.filter(op => {
      const isDesb = op._tipo === "desb";
      return checkDisponibilidade(op, isDesb).length > 0;
    });
  }, [listaUnificada, bobinas, chapas]);

  useEffect(() => {
    const currentDisponiveis = new Set(opsComMaterial.map(op => op.id));
    if (prevDisponiveisRef.current !== null) {
      const novos = [...currentDisponiveis].filter(id => !prevDisponiveisRef.current.has(id));
      if (novos.length > 0) {
        const novasOps = opsComMaterial.filter(op => novos.includes(op.id));
        const maquina = novasOps[0]?._tipo === "desb" ? "Desbobinadeira" : novasOps[0]?.maquina;
        playMaterialDisponivelSound();
        speakMaterialDisponivel(maquina);
        toast.success(
          `🔔 MATERIAL DISPONÍVEL! ${novos.length} OP(s) pronta(s) para liberar — ${maquina}`,
          { duration: 10000 }
        );
      }
    }
    prevDisponiveisRef.current = currentDisponiveis;
  }, [opsComMaterial]);

  // Detecta quando uma Desbobinadeira FINALIZA a chapa que uma OP de Guilhotina/Dobradeira está esperando → notifica com foto
  const prevFinalizadasRef = useRef(null);
  useEffect(() => {
    // Só notifica se houver OPs de Guilhotina/Dobradeira aguardando material (que precisam de chapa)
    if (opsMaq.length === 0) {
      prevFinalizadasRef.current = new Set(desbFinalizadas.map(d => d.id));
      return;
    }
    const espEsperadas = new Set(opsMaq.map(o => normalizeEspessura(o.material_espessura)).filter(Boolean));
    const finalizadasRelevantes = desbFinalizadas.filter(d => espEsperadas.has(espessuraDesb(d)));
    const currentIds = new Set(finalizadasRelevantes.map(d => d.id));
    if (prevFinalizadasRef.current !== null) {
      const novos = [...currentIds].filter(id => !prevFinalizadasRef.current.has(id));
      if (novos.length > 0) {
        const nova = finalizadasRelevantes.find(d => d.id === novos[0]);
        playMaterialDisponivelSound();
        speakMaterialDisponivel("Desbobinadeira");
        toast.success("✅ CHAPA DESBOBINADA E DISPONÍVEL!", {
          description: `A chapa ${espessuraDesb(nova) || ""}mm foi produzida na Desbobinadeira e já está no estoque da Chaparia. Libere a OP!`,
          duration: 12000,
        });
      }
    }
    prevFinalizadasRef.current = currentIds;
  }, [desbFinalizadas, opsMaq]);

  // Excluir OP
  const excluirMutation = useMutation({
    mutationFn: async ({ tipo, id }) => {
      if (tipo === "desb") {
        await base44.entities.OrdemDesbobinadeira.delete(id);
      } else {
        await base44.entities.OrdemMaquinaCD.delete(id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ops-sem-material-desb"] });
      queryClient.invalidateQueries({ queryKey: ["ops-sem-material-maq"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
      toast.success("OP excluída com sucesso!");
    },
    onError: (err) => toast.error("Erro ao excluir: " + err.message),
  });

  const isLoading = loadingDesb || loadingMaq;

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (listaUnificada.length === 0 && !busca) {
    return (
      <div className="bg-card border border-border rounded-xl p-8 flex flex-col items-center gap-3 text-center">
        <Package className="w-12 h-12 text-muted-foreground/20" />
        <p className="font-semibold text-lg">Nenhuma OP aguardando material</p>
        <p className="text-sm text-muted-foreground">OPs marcadas como "Material em falta" aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Banner TOP — Material disponível */}
      {opsComMaterial.length > 0 && (
        <div className="relative overflow-hidden rounded-xl border-2 border-green-500 bg-gradient-to-r from-green-500 to-emerald-600 p-4 text-white shadow-lg">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <BellRing className="w-6 h-6 animate-pulse" />
              <span className="font-bold text-lg">MATERIAL DISPONÍVEL!</span>
            </div>
            <span className="text-sm bg-white/20 rounded-full px-3 py-0.5 font-semibold">
              {opsComMaterial.length} OP(s) pronta(s) para liberar
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {opsComMaterial.map(op => {
              const maquina = op._tipo === "desb" ? "Desbobinadeira" : op.maquina;
              return (
                <span key={op.id} className="text-xs bg-white/25 rounded-lg px-2 py-1 font-medium">
                  {maquina} {op.numero_pedido ? `#${op.numero_pedido}` : ""} — {op.quantidade} {op._tipo === "desb" ? "chapas" : "peças"}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Banner — Chapa em produção na Desbobinadeira */}
      {(() => {
        const aguardandoDesb = listaUnificada.filter(op => desbobinadeiraLinkPara(op)?.emProd?.length > 0);
        if (aguardandoDesb.length === 0) return null;
        return (
          <div className="relative overflow-hidden rounded-xl border-2 border-blue-400 bg-gradient-to-r from-blue-500 to-indigo-600 p-4 text-white shadow-lg">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-6 h-6 animate-spin" style={{ animationDuration: "2.5s" }} />
                <span className="font-bold text-lg">CHAPA EM PRODUÇÃO NA DESBOBINADEIRA *</span>
              </div>
              <span className="text-sm bg-white/20 rounded-full px-3 py-0.5 font-semibold">
                {aguardandoDesb.length} OP(s) aguardando chapa
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {aguardandoDesb.map(op => (
                <span key={op.id} className="text-xs bg-white/25 rounded-lg px-2 py-1 font-medium flex items-center gap-1">
                  {op.maquina} {op.numero_pedido ? `#${op.numero_pedido}` : ""} — {op.material_espessura || "?"}mm
                  <ArrowRight className="w-3 h-3" />
                  <span className="font-mono">{desbobinadeiraLinkPara(op).emProd.length} OP(s) Desb.</span>
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            OP sem Material
          </h2>
          <Badge className="bg-amber-100 text-amber-700 border-amber-200">{listaUnificada.length} OP(s)</Badge>
        </div>
        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por pedido, cliente, espessura..."
            className="h-9 pl-8 pr-8 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-64"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {listaUnificada.map(op => {
          const isDesb = op._tipo === "desb";
          const materiaisCompativeis = checkDisponibilidade(op, isDesb);
          // Trava Odoo — filtra bobinas por espessura/origem exigidas (apenas Desbobinadeira)
          const reqOdoo = isDesb ? { espessuraExigida: op.espessura_exigida, origemExigida: op.origem_exigida, tolerancias } : null;
          const temReqOdoo = reqOdoo && (reqOdoo.espessuraExigida || (reqOdoo.origemExigida && reqOdoo.origemExigida !== "ambas"));
          const materiaisFiltrados = temReqOdoo ? materiaisCompativeis.filter(b => validarBobina(b, reqOdoo).ok) : materiaisCompativeis;
          const temMaterial = materiaisFiltrados.length > 0;
          const isVinculando = vinculando?.id === op.id;
          const desbLink = desbobinadeiraLinkPara(op);
          const desbEmProd = desbLink?.emProd?.length > 0;
          const desbPronta = desbLink?.prontas?.length > 0;

          return (
            <div key={op.id} className={`bg-card border-2 rounded-xl p-4 ${temMaterial ? "border-green-400" : "border-amber-300"}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                {/* Info da OP */}
                <div className="flex-1 min-w-[200px]">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge className={isDesb ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-purple-100 text-purple-700 border-purple-200"}>
                      {isDesb ? "Desbobinadeira" : op.maquina}
                    </Badge>
                    {desbEmProd && (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-300 gap-1 animate-pulse" title="Há uma Desbobinadeira produzindo esta chapa para o estoque">
                        <RefreshCw className="w-3 h-3" /> Chapa em produção *
                      </Badge>
                    )}
                    {desbPronta && !temMaterial && (
                      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 gap-1" title="Chapa desbobinada e disponível na Chaparia">
                        <CheckCircle2 className="w-3 h-3" /> Chapa pronta *
                      </Badge>
                    )}
                    {op.destino === "pedido_direto" && (
                      <Badge className="bg-blue-100 text-blue-700 border-blue-200">Pedido Direto</Badge>
                    )}
                    {op.destino === "estoque" && (
                      <Badge className="bg-orange-100 text-orange-700 border-orange-200">Estoque</Badge>
                    )}
                    {op.numero_pedido && <span className="text-sm font-mono text-muted-foreground">#{op.numero_pedido}</span>}
                    {op.cliente && <span className="text-sm text-muted-foreground">{op.cliente}</span>}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs mt-2">
                    <div>
                      <span className="text-muted-foreground">Espessura:</span>
                      <p className="font-bold">{op.material_espessura || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Cor:</span>
                      <p className="font-bold">{op.material_cor || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Qtd:</span>
                      <p className="font-bold">{op.quantidade || 0} {isDesb ? "chapas" : "peças"}</p>
                    </div>
                    {op.comprimento_mm && (
                      <div>
                        <span className="text-muted-foreground">Corte:</span>
                        <p className="font-bold">{op.comprimento_mm}mm</p>
                      </div>
                    )}
                  </div>
                  {op.valor_pago_cliente > 0 && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-green-600">
                      <DollarSign className="w-3 h-3" />
                      <span className="font-semibold">Valor pago: {op.valor_pago_cliente.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                    </div>
                  )}
                  {op.observacoes && (
                    <p className="text-xs text-muted-foreground mt-2 italic">"{op.observacoes}"</p>
                  )}
                </div>

                {/* Indicador de disponibilidade */}
                <div className="flex flex-col items-end gap-2">
                  {temMaterial ? (
                    <Badge className="bg-green-100 text-green-700 border-green-300 gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Disponível ({materiaisFiltrados.length})
                    </Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-700 border-amber-300 gap-1">
                      <AlertTriangle className="w-3 h-3" /> Sem estoque
                    </Badge>
                  )}

                  <div className="flex items-center gap-2">
                    {temMaterial && !isVinculando && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1" onClick={() => setVinculando({ tipo: op._tipo, id: op.id, entidade: op._entidade })}>
                        <Link2 className="w-3 h-3" /> Vincular e Liberar
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                      disabled={excluirMutation.isPending && excluirMutation.variables?.id === op.id}
                      onClick={() => {
                        if (confirm("Excluir esta OP? Esta ação não pode ser desfeita.")) {
                          excluirMutation.mutate({ tipo: op._tipo, id: op.id });
                        }
                      }}
                    >
                      {excluirMutation.isPending && excluirMutation.variables?.id === op.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Link com a Desbobinadeira — chapa em produção / pronta */}
              {desbLink && (desbEmProd || desbPronta) && (
                <div className="mt-3 border-t border-border pt-3 space-y-2">
                  {desbLink.emProd.map(d => (
                    <div key={d.id} className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <RefreshCw className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5 animate-spin" style={{ animationDuration: "2.5s" }} />
                      <div className="text-xs text-blue-800 flex-1">
                        <p className="font-bold flex items-center gap-1">
                          Chapa {espessuraDesb(d) || ""}mm sendo desbobinada
                          <span className="text-blue-500 font-mono">· OP {d.id?.slice(-5)}</span>
                        </p>
                        <p className="text-blue-700">
                          Status: <strong>{d.status === "em_producao" ? "Em produção" : d.status === "pendente" ? "Aguardando início" : "Pausada"}</strong>
                          {d.quantidade ? ` · ${d.quantidade} chapas` : ""}
                          {d.bobina_descricao ? ` · ${d.bobina_descricao}` : ""}
                        </p>
                        <p className="text-blue-500 mt-0.5">Quando finalizar, a chapa entra automaticamente no estoque da Chaparia e esta OP será liberada.</p>
                      </div>
                    </div>
                  ))}
                  {desbLink.prontas.map(d => (
                    <div key={d.id} className="flex items-start gap-2 bg-emerald-50 border border-emerald-300 rounded-lg px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div className="text-xs text-emerald-800 flex-1">
                        <p className="font-bold">Chapa {espessuraDesb(d) || ""}mm desbobinada e disponível na Chaparia!</p>
                        <p className="text-emerald-700">Produzida pela OP {d.id?.slice(-5)} · {d.quantidade || 0} chapas cortadas.</p>
                      </div>
                      {d.foto_finalizacao_url && (
                        <a href={d.foto_finalizacao_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                          <img src={d.foto_finalizacao_url} alt="Chapa desbobinada" className="w-16 h-16 object-cover rounded-md border-2 border-emerald-400 hover:scale-105 transition-transform" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Painel de vinculação */}
              {isVinculando && (
                <div className="mt-3 border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Selecionar material disponível:</p>
                  <Select onValueChange={matId => {
                    const mat = materiaisFiltrados.find(m => m.id === matId);
                    if (!mat) return;
                    // Trava de segurança Odoo — bloqueia bobina incompatível
                    if (isDesb) {
                      const res = validarBobina(mat, { espessuraExigida: op.espessura_exigida, origemExigida: op.origem_exigida, tolerancias });
                      if (!res.ok) {
                        setBloqueio({ open: true, titulo: "Espessura da bobina incompatível com o pedido Odoo!", motivos: [res.detail] });
                        return;
                      }
                    }
                    const desc = isDesb
                      ? `[${mat.codigo || "—"}] ${mat.chapa || mat.espessura_utilizada || ""} — ${mat.cor || ""}`
                      : `[${mat.codigo || "—"}] ${mat.bobina_descricao || ""} — ${mat.comprimento_mm || ""}mm`;
                    liberarMutation.mutate({
                      tipo: op._tipo,
                      id: op.id,
                      material_id: matId,
                      material_descricao: desc,
                      entidade: op._entidade,
                    });
                  }}>
                    <SelectTrigger><SelectValue placeholder={`Selecione ${op._entidade === "chapa" ? "a chapa" : "a bobina"}...`} /></SelectTrigger>
                    <SelectContent className="max-h-56">
                      {materiaisFiltrados.map(m => (
                        <SelectItem key={m.id} value={m.id}>
                          {isDesb ? (
                            <>
                              <span className="font-mono font-bold text-sm">{m.codigo || "—"}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{m.chapa || m.espessura_utilizada}mm</span>
                              {m.cor && <span className="text-blue-600 ml-1 text-xs">{m.cor}</span>}
                              <span className="text-muted-foreground ml-2 text-xs">{m.peso_kg}kg</span>
                            </>
                          ) : (
                            <>
                              <span className="font-mono font-bold text-sm">{m.codigo || "—"}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{m.bobina_descricao || "—"}</span>
                              <span className="text-muted-foreground ml-2 text-xs">{m.comprimento_mm}mm</span>
                              <span className="text-green-600 ml-2 text-xs">{m.quantidade_disponivel}pç</span>
                            </>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="sm" onClick={() => setVinculando(null)}>Cancelar</Button>
                </div>
              )}

              {liberarMutation.isPending && vinculando?.id === op.id && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-muted border-t-orange-500 rounded-full animate-spin" />
                  Liberando...
                </p>
              )}
            </div>
          );
        })}
      </div>

      <BloqueioBobinaDialog
        open={bloqueio.open}
        onOpenChange={(v) => setBloqueio((b) => ({ ...b, open: v }))}
        titulo={bloqueio.titulo}
        motivos={bloqueio.motivos}
      />
    </div>
  );
}