import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import {
  Play, CheckCircle2, Inbox, Factory, Calendar, User, Loader2, Plus,
  AlertTriangle, Star, CalendarClock, Clock, Search, ArrowUpDown, Flame,
  Store, Building2, Layers
} from "lucide-react";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";
import CroquiThumb from "@/components/pcp/CroquiThumb";
import {
  getItens, itensPorGrupo, computePercentual, computePercentualGrupo,
  buildItensJson, statusPcpPorPercentual, STATUS_ITEM, saoPedidosIguais,
  localizarOpDoItem
} from "@/lib/pedidoOdooHelper";
import { formatDataBR, slaDiasPorCategoria, diasUteisRestantes } from "@/lib/sla";
import { urgenciaPrazo } from "@/lib/prazoUrgencia";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import AlterarPrazoFabrilDialog from "@/components/pcp/AlterarPrazoFabrilDialog";
import { notificarStatus } from "@/lib/biNotificador";
import { useFilial } from "@/contexts/FilialContext";
import FiltrosDataPCPBar from "@/components/pcp/FiltrosDataPCPBar";
import LocalizacaoStatusHero from "@/components/pcp/LocalizacaoStatusHero";
import {
  extrairDataISO,
  calcularIntervaloPreset,
  obterDataCampoPedido,
  ordenarPedidosPCP
} from "@/lib/filtroDataHelper";

export default function FilaPCPTelhas({ onNovaOrdem }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [atualizando, setAtualizando] = useState(null);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroUrgencia, setFiltroUrgencia] = useState("todos"); // "todos" | "mais_atrasados" | "hoje_amanha" | "prioritarios"
  const [ordenacao, setOrdenacao] = useState("mais_atrasados"); // "mais_atrasados" | "urgencia_sla" | "data_entrega_asc" | "data_entrada_desc" | "data_entrada_asc"
  const [filtroDataCampo, setFiltroDataCampo] = useState("data_recebimento"); // "data_recebimento" | "data_entrega" | "data_previsao_fabrica"
  const [filtroDataPreset, setFiltroDataPreset] = useState("todas");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [pedidoPrazoModal, setPedidoPrazoModal] = useState(null);

  const filialCtx = useFilial();
  const filialAtiva = filialCtx?.filialAtiva;

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-odoo-telhas"],
    queryFn: () => base44.entities.PedidoOdoo.list("-data_recebimento", 200),
    refetchInterval: 10000
  });

  // Consulta as Ordens de Produção reais nas máquinas da fábrica
  const { data: pedidosProducao = [] } = useQuery({
    queryKey: ["pedidos-producao-todos"],
    queryFn: () => base44.entities.Pedido.list("-data", 500),
    refetchInterval: 10000
  });

  // 1. Filtragem base da filial e dos itens do setor de Telhas
  const filaBase = useMemo(() => {
    return pedidos
      .filter(p => ["distribuido", "em_producao"].includes(p.status_pcp))
      .filter(p => !filialAtiva || filialAtiva === "todas" || (p.unidade || "Matriz AJL") === filialAtiva)
      .filter(p => {
        const telhas = itensPorGrupo(getItens(p), "telha");
        if (telhas.length === 0) return false;
        const algumItemTemDistribuido = telhas.some(i => i.distribuido === true || i.distribuido === false);
        return telhas.some(it => {
          if (it.status === "em_producao" || it.status === "concluido") return true;
          if (algumItemTemDistribuido) {
            return it.distribuido === true || it.status === "distribuido";
          }
          if (it.distribuido === false) return false;
          return ["distribuido", "em_producao"].includes(p.status_pcp);
        });
      });
  }, [pedidos, filialAtiva]);

  // Contadores executivos de prazo para os botões de filtro rápido
  const contadores = useMemo(() => {
    let atrasados = 0;
    let hojeAmanha = 0;
    let prioritarios = 0;

    filaBase.forEach(p => {
      if (p.prioridade) prioritarios++;
      const dataAlvo = p.data_previsao_fabrica || p.data_entrega;
      const d = diasUteisRestantes(dataAlvo);
      if (d != null && !isNaN(d)) {
        if (d < 0) atrasados++;
        else if (d <= 1) hojeAmanha++;
      }
    });

    return {
      total: filaBase.length,
      atrasados,
      hojeAmanha,
      prioritarios
    };
  }, [filaBase]);

  // Handlers de Preset e Limpeza
  const handleSelectPreset = (presetId) => {
    setFiltroDataPreset(presetId);
    if (presetId === "todas") {
      setDataInicio("");
      setDataFim("");
    } else {
      const { inicio, fim } = calcularIntervaloPreset(presetId);
      setDataInicio(inicio);
      setDataFim(fim);
    }
  };

  const handleLimparFiltros = () => {
    setTermoBusca("");
    setFiltroUrgencia("todos");
    setOrdenacao("mais_atrasados");
    setFiltroDataCampo("data_recebimento");
    setFiltroDataPreset("todas");
    setDataInicio("");
    setDataFim("");
  };

  // 2. Aplicação de busca, filtros de urgência e filtro de período de datas
  const filaFiltrada = useMemo(() => {
    let lista = [...filaBase];

    // Busca textual
    if (termoBusca.trim()) {
      const q = termoBusca.toLowerCase().trim();
      lista = lista.filter(p => {
        const num = String(p.numero_pedido || "").toLowerCase();
        const ofNome = String(p.of_nome || "").toLowerCase();
        const cliente = String(p.cliente_nome || "").toLowerCase();
        const vendedor = String(p.vendedor_nome || "").toLowerCase();
        const itens = String(p.itens_json || "").toLowerCase();
        return num.includes(q) || ofNome.includes(q) || cliente.includes(q) || vendedor.includes(q) || itens.includes(q);
      });
    }

    // Filtros de urgência
    if (filtroUrgencia === "mais_atrasados") {
      lista = lista.filter(p => {
        const d = diasUteisRestantes(p.data_previsao_fabrica || p.data_entrega);
        return d != null && d < 0;
      });
    } else if (filtroUrgencia === "hoje_amanha") {
      lista = lista.filter(p => {
        const d = diasUteisRestantes(p.data_previsao_fabrica || p.data_entrega);
        return d != null && (d === 0 || d === 1);
      });
    } else if (filtroUrgencia === "prioritarios") {
      lista = lista.filter(p => Boolean(p.prioridade));
    }

    // Filtro por período de datas (Data X até Data Y)
    if (dataInicio || dataFim) {
      lista = lista.filter(p => {
        const valData = obterDataCampoPedido(p, filtroDataCampo);
        const dataIso = extrairDataISO(valData);
        if (!dataIso) return false;
        if (dataInicio && dataIso < dataInicio) return false;
        if (dataFim && dataIso > dataFim) return false;
        return true;
      });
    }

    // 3. Ordenação inteligente
    return ordenarPedidosPCP(lista, ordenacao);
  }, [filaBase, termoBusca, filtroUrgencia, ordenacao, filtroDataCampo, dataInicio, dataFim]);

  const handleAtualizar = async (pedido, idx, updates) => {
    setAtualizando(`${pedido.id}-${idx}`);
    try {
      const itens = getItens(pedido);
      itens[idx] = { ...itens[idx], ...updates };
      const percentual = computePercentual(itens);
      const status_pcp = statusPcpPorPercentual(percentual, pedido.status_pcp);
      await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: buildItensJson(itens),
        percentual_concluido: percentual,
        status_pcp
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
    } catch (e) {
      toast({ title: "Erro ao atualizar item", description: e.message, variant: "destructive" });
    } finally {
      setAtualizando(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin text-orange-500" /> Carregando fila PCP de Telhas...
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
      {/* ══════════════ CABEÇALHO EXECUTIVO E BARRA AVANÇADA DE FILTROS PCP ══════════════ */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Factory className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Fila PCP — Aguardando Produção (Telhas)
              </h2>
              <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30 font-bold text-xs">
                {contadores.total} pedido(s)
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Ordens distribuídas pelo PCP com controle de prazo de entrega, pesquisa e filtros de data
            </p>
          </div>
        </div>

        <FiltrosDataPCPBar
          termoBusca={termoBusca}
          onBuscaChange={setTermoBusca}
          placeholderBusca="Buscar pedido, OF, cliente, vendedor, telha..."
          filtroDataCampo={filtroDataCampo}
          onDataCampoChange={setFiltroDataCampo}
          filtroDataPreset={filtroDataPreset}
          onSelectPreset={handleSelectPreset}
          dataInicio={dataInicio}
          onDataInicioChange={setDataInicio}
          dataFim={dataFim}
          onDataFimChange={setDataFim}
          onLimparFiltros={handleLimparFiltros}
          filtroUrgencia={filtroUrgencia}
          onFiltroUrgenciaChange={setFiltroUrgencia}
          ordenacao={ordenacao}
          onOrdenacaoChange={setOrdenacao}
          contadores={contadores}
        />
      </div>

      {/* ══════════════ LISTA DE PEDIDOS DA FILA ══════════════ */}
      {filaFiltrada.length === 0 ? (
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <Inbox className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            Nenhum pedido encontrado com os filtros atuais
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm">
            {filtroUrgencia !== "todos" || dataInicio || dataFim || termoBusca
              ? "Experimente limpar os filtros ou alterar o intervalo de datas."
              : "Não há ordens distribuídas aguardando produção neste momento."}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filaFiltrada.map(pedido => {
            const itens = getItens(pedido);
            const telhas = itensPorGrupo(itens, "telha");

            // Busca se existe Ordem de Produção real criada para este pedido na fábrica
            const opsDoPedido = pedidosProducao.filter(op => {
              if (!op.numero_pedido || String(op.status || "").toLowerCase() === "cancelado") return false;
              if (op.pedido_odoo_id && pedido?.id) {
                return op.pedido_odoo_id === pedido.id;
              }
              if (pedido?.of_odoo_id && op.of_odoo_id) {
                return String(op.of_odoo_id).trim().toUpperCase() === String(pedido.of_odoo_id).trim().toUpperCase();
              }
              if (op.pedido_odoo_id || op.of_odoo_id) return false;
              return saoPedidosIguais(op.numero_pedido, pedido.numero_pedido);
            });

            let somaProgresso = 0;
            telhas.forEach((t) => {
              const op = localizarOpDoItem(t, opsDoPedido, telhas);
              if (op) {
                if (op.status === "finalizado") somaProgresso += 1.0;
                else if (op.status === "aguardando_colagem") somaProgresso += 0.75;
                else if (op.status === "em_producao") somaProgresso += 0.50;
                else if (op.status === "pausado") somaProgresso += 0.40;
                else if (op.status === "pendente") somaProgresso += 0.30;
                else somaProgresso += 0.25;
              } else if (t.status === "concluido") {
                somaProgresso += 1.0;
              } else if (t.status === "em_producao" || t.maquina) {
                somaProgresso += 0.30;
              }
            });

            const pctTelha = telhas.length > 0
              ? Math.min(100, Math.round((somaProgresso / telhas.length) * 100))
              : (pedido.percentual_concluido || 0);
            const pctGeral = Math.max(pctTelha, computePercentual(itens), pedido.percentual_concluido || 0);
            const pacoteConcluido = pctTelha === 100;

            // ── CÁLCULO DE DATA E URGÊNCIA ──
            const dataAlvoUrgencia = pedido.data_previsao_fabrica || pedido.data_entrega;
            const restantes = diasUteisRestantes(dataAlvoUrgencia);
            const urgencia = urgenciaPrazo(dataAlvoUrgencia, { concluido: pacoteConcluido });
            const isAtrasado = restantes != null && restantes < 0;
            const isHoje = restantes === 0;
            const isAmanha = restantes === 1;
            const isPrioritario = Boolean(pedido.prioridade);

            // Filtra apenas itens que foram distribuídos ou que já possuem OP criada na fábrica
            const algumItemTemDistribuido = telhas.some(i => i.distribuido === true || i.distribuido === false);
            const telhasParaExibir = telhas.filter(it => {
              const opExistente = localizarOpDoItem(it, opsDoPedido, telhas);
              if (opExistente) return true;
              if (it.status === "em_producao" || it.status === "concluido") return true;
              if (algumItemTemDistribuido) {
                return it.distribuido === true || it.status === "distribuido";
              }
              if (it.distribuido === false) return false;
              return ["distribuido", "em_producao"].includes(pedido.status_pcp);
            });

            if (telhasParaExibir.length === 0) return null;

            return (
              <div
                key={pedido.id}
                className={`p-4 sm:p-5 transition-all relative overflow-hidden bg-card ${
                  pacoteConcluido
                    ? "bg-emerald-50/20 dark:bg-emerald-950/10"
                    : isPrioritario
                    ? "border-l-4 border-l-amber-500 hover:bg-slate-50/40 dark:hover:bg-slate-900/20"
                    : isAtrasado
                    ? "border-l-4 border-l-red-600 ring-1 ring-red-400/20 hover:bg-slate-50/40 dark:hover:bg-slate-900/20"
                    : isHoje || isAmanha
                    ? "border-l-4 border-l-amber-500 hover:bg-slate-50/40 dark:hover:bg-slate-900/20"
                    : "border-l-4 border-l-blue-600 hover:bg-slate-50/40 dark:hover:bg-slate-900/20"
                }`}
              >
                <div className="relative z-10 space-y-3">
                  {/* ══════════════ PAINEL HERO: ONDE ESTÁ & STATUS EM MÁXIMA EVIDÊNCIA ══════════════ */}
                  <LocalizacaoStatusHero
                    pedido={pedido}
                    ops={opsDoPedido}
                    percentual={pctTelha}
                    setor="telhas"
                  />

                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <CroquiThumb pedido={pedido} alt={`Croqui do pedido #${pedido.numero_pedido}`} className="mt-1" />
                      
                      <div className="min-w-0 flex-1">
                        {/* Linha 1: Número, OF, Prioridade e Status da Fábrica */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          {isPrioritario && (
                            <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-[10px] gap-0.5 px-1.5 py-0 shadow-xs">
                              <Star className="w-2.5 h-2.5 fill-white" /> URGENTE
                            </Badge>
                          )}
                          <span className="text-base font-black text-slate-900 dark:text-white font-mono">
                            #{pedido.numero_pedido}
                          </span>
                          {pedido.of_nome ? (
                            <Badge variant="outline" className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                              OF: {pedido.of_nome}
                            </Badge>
                          ) : pedido.of_odoo_id ? (
                            <Badge variant="outline" className="text-[10px] font-mono font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                              OF: {pedido.of_odoo_id}
                            </Badge>
                          ) : null}

                          {pacoteConcluido ? (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
                              <CheckCircle2 className="w-3 h-3 mr-0.5" /> Pacote Telhas Concluído
                            </Badge>
                          ) : opsDoPedido.length > 0 ? (
                            <Badge className="bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40 text-[10px] font-bold">
                              ⚙️ Em Produção na Fábrica
                            </Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 text-[10px] font-bold">
                              Aguardando Criação de OP
                            </Badge>
                          )}
                        </div>

                        {/* Linha 2: Cliente, Vendedor e Filial */}
                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-300 flex-wrap">
                          <span className="flex items-center gap-1 font-semibold text-slate-900 dark:text-slate-100">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {pedido.cliente_nome || "Cliente não informado"}
                          </span>
                          {pedido.vendedor_nome && pedido.vendedor_nome !== "—" && (
                            <span className="text-slate-500">
                              Vendedor: <strong className="text-slate-700 dark:text-slate-200">{pedido.vendedor_nome}</strong>
                            </span>
                          )}
                          {pedido.loja_venda && (
                            <span className="text-slate-400 flex items-center gap-1">
                              <Store className="w-3 h-3" /> {pedido.loja_venda}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Lado Direito: Barras e Percentual de Conclusão */}
                    <div className="text-right shrink-0 flex flex-col justify-center min-w-[120px]">
                      <div className="flex items-center gap-2 justify-end">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Telhas</span>
                        <span className={`text-base font-black ${pctTelha >= 100 ? "text-emerald-600" : "text-orange-600"}`}>
                          {pctTelha}%
                        </span>
                      </div>
                      <div className="w-28 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden ml-auto mt-0.5">
                        <div
                          className={`h-full rounded-full transition-all ${pctTelha >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-amber-500"}`}
                          style={{ width: `${pctTelha}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 mt-1">Geral Pedido: <strong>{pctGeral}%</strong></span>
                    </div>
                  </div>

                  {/* ══════════════ BLOCO PREMIUM DE DATAS, PRAZO FABRIL & SLA ══════════════ */}
                  <div className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {/* Badge da Data Prometida Comercial */}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Entrega Prometida:</span>
                        <strong className="text-slate-900 dark:text-white font-mono">
                          {formatDataBR(pedido.data_entrega)}
                        </strong>
                      </div>

                      {/* Se houver Previsão da Fábrica reprogramada */}
                      {pedido.data_previsao_fabrica && (
                        <div
                          className="flex items-center gap-1 bg-orange-50 dark:bg-orange-950/40 px-2.5 py-1 rounded-lg border border-orange-300 dark:border-orange-800 font-semibold text-orange-900 dark:text-orange-200"
                          title={pedido.motivo_alteracao_prazo ? `Motivo: ${pedido.motivo_alteracao_prazo}` : "Previsão calculada pela fábrica"}
                        >
                          <Factory className="w-3.5 h-3.5 text-orange-600 shrink-0" />
                          <span>Previsão Fábrica:</span>
                          <strong className="text-orange-950 dark:text-orange-100 font-mono">
                            {formatDataBR(pedido.data_previsao_fabrica)}
                          </strong>
                        </div>
                      )}

                      {/* Badge Inteligente de SLA Countdown */}
                      <SlaCountdownBadge
                        dataPrometida={pedido.data_entrega}
                        dataPrevisaoFabrica={pedido.data_previsao_fabrica}
                      />
                    </div>

                    {/* Botão de Reprogramar / Ajustar Prazo Fabril Direto da Fila */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPedidoPrazoModal(pedido)}
                      className="h-7 text-xs font-bold gap-1 border-orange-300 dark:border-orange-800 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/40 ml-auto"
                      title="Reprogramar data da fábrica e notificar o vendedor"
                    >
                      <CalendarClock className="w-3.5 h-3.5 text-orange-600" />
                      Ajustar Prazo Fabril
                    </Button>
                  </div>

                  {/* ══════════════ ITENS DO PEDIDO / INSTRUÇÃO DE CORTE ══════════════ */}
                  <div className="space-y-2 pt-1">
                    {telhasParaExibir.map((item, idx) => {
                      const opDoItem = localizarOpDoItem(item, opsDoPedido, telhas);
                      let statusItem = "pendente";
                      let maquinaItem = item.maquina || "";

                      if (opDoItem) {
                        maquinaItem = opDoItem.maquina || maquinaItem;
                        if (opDoItem.status === "finalizado") {
                          statusItem = "concluido";
                        } else if (["em_producao", "pausado", "aguardando_colagem", "pendente"].includes(opDoItem.status)) {
                          statusItem = "em_producao";
                        }
                      } else if (item.status === "concluido") {
                        statusItem = "concluido";
                      } else if (item.status === "em_producao") {
                        statusItem = "em_producao";
                      }

                      const st = STATUS_ITEM[statusItem] || STATUS_ITEM.pendente;
                      const emProd = statusItem === "em_producao";
                      const concluido = statusItem === "concluido";

                      return (
                        <div
                          key={item._idx != null ? item._idx : idx}
                          className="p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-950/50 space-y-2 shadow-2xs"
                        >
                          <InstrucaoVendedorCard
                            descricao={item.descricao || item.produto}
                            quantidadeOdoo={item.quantidade}
                            espessura={item.espessura}
                            unidade="MT"
                          />

                          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap pt-1">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {item.produto || "—"}
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                {item.medida || "—"} · <strong>{item.quantidade} MT</strong>
                                {item.espessura ? ` · Chapa ${item.espessura}mm` : ""}
                                {maquinaItem ? (
                                  <strong className="text-orange-600 dark:text-orange-400 ml-1.5 font-bold">
                                    · Máquina: {maquinaItem}
                                  </strong>
                                ) : ""}
                              </p>
                            </div>

                            <Badge className={`shrink-0 border text-[10px] font-bold px-2 py-0.5 ${st.cls}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${st.dot} mr-1.5`} />
                              {st.label}
                            </Badge>

                            {onNovaOrdem && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  notificarStatus(pedido, "revisando_ordem", {
                                    status_novo: "em_revisao",
                                    item_nome: item.produto || item.descricao || "",
                                    maquina_atual: maquinaItem || "PCP / Fábrica"
                                  });
                                  onNovaOrdem(pedido, {
                                    ...item,
                                    _idx: item._idx != null ? item._idx : idx,
                                    maquina: maquinaItem,
                                    data: item.data_programada || pedido.data_previsao_fabrica || pedido.data_entrega,
                                    existingOp: opDoItem || null
                                  });
                                }}
                                className={
                                  concluido
                                    ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 h-8 px-3 gap-1.5 text-xs font-semibold"
                                    : emProd
                                    ? "bg-amber-500 hover:bg-amber-600 text-white h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs"
                                    : "bg-orange-500 hover:bg-orange-600 text-white h-8 px-3 gap-1.5 text-xs font-semibold shadow-xs"
                                }
                              >
                                {concluido ? (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Concluído</span>
                                  </>
                                ) : emProd ? (
                                  <>
                                    <Play className="w-3.5 h-3.5 fill-white" />
                                    <span>Revisar Ordem {maquinaItem ? `[${maquinaItem}]` : ""}</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 fill-white" />
                                    <span>Iniciar Produção</span>
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Alteração de Prazo Fabril acessível diretamente da Fila PCP */}
      {pedidoPrazoModal && (
        <AlterarPrazoFabrilDialog
          open={Boolean(pedidoPrazoModal)}
          onOpenChange={(aberto) => { if (!aberto) setPedidoPrazoModal(null); }}
          pedido={pedidoPrazoModal}
          onPrazoAlterado={() => {
            queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
            setPedidoPrazoModal(null);
          }}
        />
      )}
    </div>
  );
}