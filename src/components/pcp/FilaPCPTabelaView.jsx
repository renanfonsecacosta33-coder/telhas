import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink, History, Zap, CheckCircle2, Clock, AlertTriangle,
  Layers, Star, Eye, RefreshCw, Scissors, Home, Wind, Package,
  ChevronDown, ChevronRight, User, Calendar, Send, Factory,
  Check, Play, Sparkles, Flame, ShieldAlert, ArrowUpRight
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";
import { stripHtml } from "@/lib/stripHtml";
import {
  classGrupo,
  normalizarUnidadeMedidaItem,
  obterStatusDescritivoItem,
  calcularProgressoRealPedido
} from "@/lib/pedidoOdooHelper";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { verificarEstoqueItem, extrairDemandaItem } from "@/lib/estoqueMaterialHelper";
import { PrioridadeBadge, SeletorPrioridadeDropdown } from "@/lib/prioridadeHelper";
import ProcessoStepperPedido from "@/components/producao/ProcessoStepperPedido";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import { formatDataBR } from "@/lib/sla";

// Helper para resolver o nome real da máquina onde a OF está alocada
function resolverMaquina(ofItem, it, pedidosProducao = [], ordensCD = []) {
  if (it?.maquina && it.maquina !== "A Definir") return it.maquina;
  if (ofItem?.maquina && ofItem.maquina !== "A Definir") return ofItem.maquina;

  // 1. Busca nos galpões de telhas
  const pProd = (pedidosProducao || []).find(p =>
    (p.of_odoo_id && String(p.of_odoo_id) === String(ofItem.of_odoo_id)) ||
    (p.numero_pedido && String(p.numero_pedido) === String(ofItem.numero_pedido) && p.descricao === ofItem.descricao) ||
    (p.numero_pedido && String(p.numero_pedido) === String(ofItem.numero_pedido))
  );
  if (pProd?.maquina_nome) return pProd.maquina_nome;
  if (pProd?.maquina) return pProd.maquina;

  // 2. Busca em corte e dobra
  const oCD = (ordensCD || []).find(o =>
    (o.of_odoo_id && String(o.of_odoo_id) === String(ofItem.of_odoo_id)) ||
    (o.numero_pedido && String(o.numero_pedido) === String(ofItem.numero_pedido))
  );
  if (oCD?.maquina_nome) return oCD.maquina_nome;
  if (oCD?.maquina) return oCD.maquina;

  return "A Definir";
}

export default function FilaPCPTabelaView({
  gruposPedidos = null,
  pedidos = [],
  estoqueContext = null,
  pedidosProducao = [],
  ordensCD = [],
  selecionados = new Set(),
  onToggleSelect,
  onToggleSelectGrupo,
  onOpenDetalhe,
  onDistribuir,
  onDistribuirGrupo,
  onFinalizarOP,
  onFinalizarGrupo100,
  onOpenHistorico,
  onSincronizarOdoo,
  onSincronizarGrupoOdoo,
  onSetPrioridade,
  onSetPrioridadeGrupo,
}) {
  const [expandidos, setExpandidos] = useState(new Set());
  const [filtroStatusInterno, setFiltroStatusInterno] = useState("todos"); // "todos" | "pendentes" | "producao" | "concluidos"

  // Constrói ou utiliza gruposPedidos consolidados
  const listaGruposBase = useMemo(() => {
    if (Array.isArray(gruposPedidos) && gruposPedidos.length > 0) {
      return gruposPedidos;
    }
    // Fallback: agrupa pedidos por numero_pedido
    const map = new Map();
    pedidos.forEach(p => {
      const num = p.numero_pedido || `AVULSO_${p.id}`;
      if (!map.has(num)) {
        map.set(num, {
          numero_pedido: p.numero_pedido || "Sem Número",
          cliente_nome: p.cliente || p.cliente_nome || "—",
          vendedor_nome: p.vendedor || p.vendedor_nome || "—",
          data_entrega: p.data_entrega || p.data_prometida,
          unidade: p.unidade,
          prioridade: !!p.prioridade,
          prioridade_nivel: p.prioridade_nivel || p.prioridade_tipo,
          ofs: []
        });
      }
      map.get(num).ofs.push(p);
    });
    return Array.from(map.values());
  }, [gruposPedidos, pedidos]);

  // Estatísticas Rápidas da Fila
  const statsFila = useMemo(() => {
    let total = listaGruposBase.length;
    let pendentes = 0;
    let emProducao = 0;
    let concluidos = 0;

    listaGruposBase.forEach(g => {
      const ofs = g.ofs || [];
      const somaProg = ofs.reduce((acc, p) => acc + calcularProgressoRealPedido(p, pedidosProducao, ordensCD), 0);
      const prog = ofs.length > 0 ? Math.round(somaProg / ofs.length) : 0;
      const temPendente = ofs.some(o => {
        const pOf = calcularProgressoRealPedido(o, pedidosProducao, ordensCD);
        return pOf === 0 && (!o.status_pcp || o.status_pcp === "pendente_distribuicao" || o.status_pcp === "pendente");
      });

      if (prog >= 100) {
        concluidos++;
      } else if (temPendente) {
        pendentes++;
      } else {
        emProducao++;
      }
    });

    return { total, pendentes, emProducao, concluidos };
  }, [listaGruposBase, pedidosProducao, ordensCD]);

  // Filtra por status interno se acionado
  const listaGrupos = useMemo(() => {
    if (filtroStatusInterno === "todos") return listaGruposBase;
    return listaGruposBase.filter(g => {
      const ofs = g.ofs || [];
      const somaProg = ofs.reduce((acc, p) => acc + calcularProgressoRealPedido(p, pedidosProducao, ordensCD), 0);
      const prog = ofs.length > 0 ? Math.round(somaProg / ofs.length) : 0;
      const temPendente = ofs.some(o => {
        const pOf = calcularProgressoRealPedido(o, pedidosProducao, ordensCD);
        return pOf === 0 && (!o.status_pcp || o.status_pcp === "pendente_distribuicao" || o.status_pcp === "pendente");
      });

      if (filtroStatusInterno === "pendentes") return temPendente && prog < 100;
      if (filtroStatusInterno === "producao") return !temPendente && prog < 100;
      if (filtroStatusInterno === "concluidos") return prog >= 100;
      return true;
    });
  }, [listaGruposBase, filtroStatusInterno, pedidosProducao, ordensCD]);

  const toggleExpandir = (numeroPedido) => {
    setExpandidos(prev => {
      const next = new Set(prev);
      if (next.has(numeroPedido)) next.delete(numeroPedido);
      else next.add(numeroPedido);
      return next;
    });
  };

  const expandirTodos = () => {
    setExpandidos(new Set(listaGrupos.map(g => g.numero_pedido)));
  };

  const recolherTodos = () => {
    setExpandidos(new Set());
  };

  if (listaGruposBase.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
        <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-semibold text-base">Nenhum pedido na fila para os filtros selecionados</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
      {/* Barra de controle e estatísticas rápidas */}
      <div className="bg-muted/40 px-4 py-2.5 border-b border-border flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-foreground">Visão Tabela por Pedido</span>
          <span className="text-muted-foreground">·</span>

          {/* Filtros rápidos por estado */}
          <div className="inline-flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border text-[11px]">
            <button
              type="button"
              onClick={() => setFiltroStatusInterno("todos")}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                filtroStatusInterno === "todos"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Todos ({statsFila.total})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatusInterno("pendentes")}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                filtroStatusInterno === "pendentes"
                  ? "bg-amber-500 text-white shadow-2xs"
                  : "text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
              }`}
            >
              ⏳ Pendentes Envio ({statsFila.pendentes})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatusInterno("producao")}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                filtroStatusInterno === "producao"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "text-blue-600 dark:text-blue-400 hover:bg-blue-500/10"
              }`}
            >
              🏭 Na Fábrica ({statsFila.emProducao})
            </button>
            <button
              type="button"
              onClick={() => setFiltroStatusInterno("concluidos")}
              className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                filtroStatusInterno === "concluidos"
                  ? "bg-emerald-600 text-white shadow-2xs"
                  : "text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              }`}
            >
              ✅ Concluídos ({statsFila.concluidos})
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandirTodos}
            className="hover:text-foreground font-semibold px-2 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
          >
            Expandir Todas as OFs
          </button>
          <span>|</span>
          <button
            type="button"
            onClick={recolherTodos}
            className="hover:text-foreground font-semibold px-2 py-0.5 rounded hover:bg-muted transition-colors cursor-pointer"
          >
            Recolher Todas
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-muted/70 border-b border-border text-muted-foreground font-bold uppercase tracking-wider text-[11px]">
              <th className="py-2.5 px-3 w-8 text-center"></th>
              <th className="py-2.5 px-3 w-8 text-center"></th>
              <th className="py-2.5 px-3">Pedido</th>
              <th className="py-2.5 px-3">Cliente / Vendedor</th>
              <th className="py-2.5 px-3">Prazo / SLA</th>
              <th className="py-2.5 px-3 text-center">Setores</th>
              <th className="py-2.5 px-3 text-center">OFs</th>
              <th className="py-2.5 px-3 text-right">Metragem Total</th>
              <th className="py-2.5 px-3 text-center">Progresso</th>
              <th className="py-2.5 px-3 text-center">Status / Local</th>
              <th className="py-2.5 px-3 text-right min-w-[260px]">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {listaGrupos.map((grupo) => {
              const ofs = grupo.ofs || [];
              const numPedido = grupo.numero_pedido;
              const isExpandido = expandidos.has(numPedido);

              // IDs e seleção em grupo
              const idsDoGrupo = ofs.map(p => p.id);
              const totalSelecionados = idsDoGrupo.filter(id => selecionados.has(id)).length;
              const isTodoSelecionado = ofs.length > 0 && totalSelecionados === ofs.length;
              const isParcial = totalSelecionados > 0 && !isTodoSelecionado;

              // Metragens e Peças
              let totalMetros = 0;
              let totalPecas = 0;
              let hasTelha = false;
              let hasCD = false;

              ofs.forEach(p => {
                const grp = classGrupo(p);
                if (grp === "telha") hasTelha = true;
                if (grp === "cd" || grp === "frisada") hasCD = true;

                let itens = [];
                try {
                  itens = JSON.parse(p.itens_json || "[]");
                } catch {
                  itens = [];
                }
                if (Array.isArray(itens) && itens.length > 0) {
                  itens.forEach(it => {
                    const unid = normalizarUnidadeMedidaItem(it, grp);
                    const esp = extrairEspecificacao(`${it.observacao || ""} ${it.descricao || ""} ${it.produto || ""}`, it.quantidade, unid);
                    totalMetros += esp.metragem_total || (Number(it.quantidade) || 0);
                    totalPecas += esp.pecas || (Number(it.quantidade) || 1);
                  });
                } else {
                  totalMetros += Number(p.metros) || 0;
                  totalPecas += Number(p.quantidade_telhas || p.pecas_total) || 1;
                }
              });

              // Progresso e Distribuição
              const ofsStatusInfo = ofs.map(o => {
                const prog = calcularProgressoRealPedido(o, pedidosProducao, ordensCD);
                const statusPcp = o.status_pcp || "pendente_distribuicao";
                const isPendente = (statusPcp === "pendente_distribuicao" || statusPcp === "pendente") && prog === 0;
                const isConcluida = prog >= 100 || statusPcp === "concluido" || statusPcp === "finalizado";
                const isEmProducao = prog > 0 && prog < 100;
                const isDistribuida = !isPendente && !isConcluida;
                return { of: o, prog, isPendente, isDistribuida, isEmProducao, isConcluida };
              });

              const pendentesCount = ofsStatusInfo.filter(x => x.isPendente).length;
              const concluidasCount = ofsStatusInfo.filter(x => x.isConcluida).length;
              const emProducaoCount = ofsStatusInfo.filter(x => x.isEmProducao || x.isDistribuida).length;

              const totalOfs = ofs.length;
              const todosConcluidos = totalOfs > 0 && concluidasCount === totalOfs;
              const todosDistribuidos = totalOfs > 0 && pendentesCount === 0;
              const parcialmenteDistribuido = pendentesCount > 0 && pendentesCount < totalOfs;
              const todosPendentes = pendentesCount === totalOfs;

              const somaProgressos = ofsStatusInfo.reduce((acc, x) => acc + x.prog, 0);
              const progressoGeral = totalOfs > 0 ? Math.round(somaProgressos / totalOfs) : 0;

              const isUrgente = grupo.prioridade || ofs.some(p => p.prioridade || p.prioridade_nivel);
              const primeiroPedido = ofs[0] || {};

              return (
                <React.Fragment key={numPedido}>
                  {/* Linha Mestre: O Pedido de Venda Consolidado */}
                  <tr
                    className={`transition-colors cursor-pointer hover:bg-muted/40 ${
                      isExpandido ? "bg-muted/30 font-medium" : ""
                    } ${isUrgente ? "bg-amber-500/5 dark:bg-amber-950/20" : ""}`}
                    onClick={() => toggleExpandir(numPedido)}
                  >
                    {/* Checkbox de Seleção */}
                    <td className="py-2.5 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isTodoSelecionado}
                        ref={(el) => { if (el) el.indeterminate = isParcial; }}
                        onChange={() => onToggleSelectGrupo ? onToggleSelectGrupo(grupo) : null}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        title="Selecionar todas as OFs deste pedido"
                      />
                    </td>

                    {/* Botão de Expandir / Recolher */}
                    <td className="py-2.5 px-2 text-center text-muted-foreground">
                      <div className="w-5 h-5 flex items-center justify-center rounded hover:bg-muted">
                        {isExpandido ? (
                          <ChevronDown className="w-4 h-4 text-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </td>

                    {/* Número do Pedido + Prioridade */}
                    <td className="py-2.5 px-3 font-mono font-bold">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-primary font-black text-sm">
                          #{numPedido}
                        </span>
                        {isUrgente && (
                          <PrioridadeBadge prioridade={grupo.prioridade_nivel || "P1"} />
                        )}
                        {grupo.numero_oc && (
                          <span className="text-[10px] text-muted-foreground font-normal">
                            (OC: {grupo.numero_oc})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Cliente / Vendedor */}
                    <td className="py-2.5 px-3 max-w-[200px]">
                      <div className="font-bold text-foreground truncate" title={grupo.cliente_nome}>
                        {grupo.cliente_nome}
                      </div>
                      {grupo.vendedor_nome && grupo.vendedor_nome !== "—" && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          Vend: {grupo.vendedor_nome}
                        </div>
                      )}
                    </td>

                    {/* Prazo / SLA */}
                    <td className="py-2.5 px-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {grupo.data_entrega ? (
                        <SlaCountdownBadge
                          dataPrometida={grupo.data_entrega}
                          concluido={progressoGeral >= 100}
                        />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Setores */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {hasTelha && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200">
                            Telha
                          </span>
                        )}
                        {hasCD && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300 border border-orange-200">
                            C&D
                          </span>
                        )}
                        {!hasTelha && !hasCD && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            Geral
                          </span>
                        )}
                      </div>
                    </td>

                    {/* OFs Contagem */}
                    <td className="py-2.5 px-3 text-center font-bold">
                      <span className="bg-muted px-2 py-0.5 rounded-full text-foreground">
                        {ofs.length} OF{ofs.length > 1 ? "s" : ""}
                      </span>
                    </td>

                    {/* Metragem Total */}
                    <td className="py-2.5 px-3 text-right">
                      <span className="font-black font-mono text-blue-600 dark:text-blue-400 text-sm">
                        {totalMetros > 0 ? `${totalMetros.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m` : "—"}
                      </span>
                      {totalPecas > 0 && (
                        <span className="block text-[10px] text-muted-foreground font-semibold">
                          {totalPecas} peças
                        </span>
                      )}
                    </td>

                    {/* Progresso Geral */}
                    <td className="py-2.5 px-3 text-center">
                      <div className="w-24 mx-auto space-y-1">
                        <div className="flex justify-between text-[10px] font-bold">
                          <span>{progressoGeral}%</span>
                          {todosConcluidos && <span className="text-emerald-600">100%</span>}
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              progressoGeral >= 100 ? "bg-emerald-500" : progressoGeral > 0 ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-700"
                            }`}
                            style={{ width: `${progressoGeral}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status e Indicação Clara de Distribuição */}
                    <td className="py-2.5 px-3 text-center">
                      {todosConcluidos ? (
                        <Badge variant="outline" className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Concluído
                        </Badge>
                      ) : todosDistribuidos ? (
                        <Badge variant="outline" className="text-[10px] font-bold bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 gap-1" title="Todas as OFs deste pedido já estão encaminhadas às máquinas">
                          <Factory className="w-3 h-3 text-blue-600" />
                          Já Distribuído
                        </Badge>
                      ) : parcialmenteDistribuido ? (
                        <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 gap-1" title={`${totalOfs - pendentesCount} de ${totalOfs} OFs já enviadas à fábrica`}>
                          <Clock className="w-3 h-3 text-amber-600" />
                          Parcial ({totalOfs - pendentesCount}/{totalOfs})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] font-bold bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          Pendente Envio
                        </Badge>
                      )}
                    </td>

                    {/* Ações da Linha Mestre */}
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">

                        {/* 1. SE HOUVER OFs PENDENTES: BOTÃO DISTRIBUIR */}
                        {pendentesCount > 0 && onDistribuirGrupo && (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2.5 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer shadow-2xs"
                            onClick={() => onDistribuirGrupo(grupo)}
                            title={parcialmenteDistribuido ? `Distribuir as ${pendentesCount} OFs restantes deste pedido` : "Distribuir todas as OFs deste pedido para as máquinas"}
                          >
                            <Zap className="w-3.5 h-3.5" />
                            {parcialmenteDistribuido ? `Distribuir (${pendentesCount})` : "Distribuir"}
                          </Button>
                        )}

                        {/* 2. BOTÃO FINALIZAR PEDIDO (100%) - Dispara conclusão de todas as OFs */}
                        {!todosConcluidos && onFinalizarGrupo100 && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 gap-1 border-emerald-500 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold cursor-pointer shadow-2xs"
                            onClick={() => onFinalizarGrupo100(ofs)}
                            title="Finalizar e concluir 100% de todas as OFs deste pedido"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Finalizar Pedido</span>
                          </Button>
                        )}

                        {/* 3. SE JÁ ESTIVER 100% CONCLUÍDO: BOTÃO SINCRONIZAR ODOO */}
                        {todosConcluidos && onSincronizarGrupoOdoo && (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2.5 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold cursor-pointer shadow-2xs"
                            onClick={() => onSincronizarGrupoOdoo(ofs)}
                            title="Enviar status Concluído para o Odoo ERP"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Sincronizar Odoo</span>
                          </Button>
                        )}

                        {/* 4. VER DETALHES */}
                        {onOpenDetalhe && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => onOpenDetalhe(primeiroPedido)}
                            title="Ver detalhes do pedido"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {/* 5. HISTÓRICO */}
                        {onOpenHistorico && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => onOpenHistorico(numPedido)}
                            title="Ver histórico de alterações e logs do pedido"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* Linhas Filhas: OFs / Itens Detalhados do Pedido (quando expandido) */}
                  {isExpandido && (
                    <tr className="bg-muted/15 border-b border-border">
                      <td colSpan={11} className="p-3 pl-8 sm:pl-12 pr-4 bg-slate-50/50 dark:bg-slate-900/40">
                        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="bg-muted/60 border-b border-border text-[10px] font-bold text-muted-foreground uppercase">
                                <th className="py-2 px-3">Item / Especificação</th>
                                <th className="py-2 px-3 text-center">Peças × Comprimento</th>
                                <th className="py-2 px-3 text-right">Metragem</th>
                                <th className="py-2 px-3 text-center">Máquina Alocada</th>
                                <th className="py-2 px-3 text-center">Etapa / Processo</th>
                                <th className="py-2 px-3 text-center">Estoque MP</th>
                                <th className="py-2 px-3 text-center">Status OF</th>
                                <th className="py-2 px-3 text-right min-w-[200px]">Ações da OF</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {ofs.map((ofItem, ofIdx) => {
                                const cat = classGrupo(ofItem);
                                let itensOf = [];
                                try {
                                  itensOf = JSON.parse(ofItem.itens_json || "[]");
                                } catch {
                                  itensOf = [];
                                }

                                if (itensOf.length === 0) {
                                  itensOf = [{
                                    produto: ofItem.produto || ofItem.descricao || "Item",
                                    quantidade: ofItem.metros || ofItem.quantidade || 1,
                                    unidade: "MT"
                                  }];
                                }

                                const progOf = calcularProgressoRealPedido(ofItem, pedidosProducao, ordensCD);
                                const statusPcpOf = ofItem.status_pcp || "pendente_distribuicao";
                                const isOfPendente = (statusPcpOf === "pendente_distribuicao" || statusPcpOf === "pendente") && progOf === 0;
                                const isOfConcluida = progOf >= 100 || statusPcpOf === "concluido" || statusPcpOf === "finalizado";
                                const isOfEmProducao = progOf > 0 && progOf < 100;
                                const isOfDistribuida = !isOfPendente && !isOfConcluida;

                                return itensOf.map((it, itIdx) => {
                                  const unid = normalizarUnidadeMedidaItem(it, cat);
                                  const espTec = extrairEspecificacao(`${it.observacao || ""} ${it.descricao || ""} ${it.produto || ""}`, it.quantidade, unid);
                                  const estoqueItem = estoqueContext ? verificarEstoqueItem(it, estoqueContext, ofItem) : null;
                                  const demanda = estoqueItem?.demanda || extrairDemandaItem(it);
                                  const pecasReal = (demanda?.pecas && demanda.pecas > 0) ? demanda.pecas : (espTec?.pecas > 0 ? espTec.pecas : null);

                                  let qPecas = pecasReal || Number(it.quantidade) || 1;
                                  let totM = demanda?.metros || espTec?.metragem_total || Number(it.quantidade) || 0;

                                  let indFmt = "—";
                                  if (espTec?.comprimento_mm > 0) {
                                    const mm = espTec.comprimento_mm;
                                    indFmt = `${mm.toLocaleString("pt-BR")} mm (${(mm / 1000).toFixed(2)} m)`;
                                  } else if (espTec?.comprimento_m > 0) {
                                    indFmt = `${espTec.comprimento_m} m`;
                                  }

                                  const maqNome = resolverMaquina(ofItem, it, pedidosProducao, ordensCD);

                                  return (
                                    <tr key={`${ofItem.id}-${itIdx}`} className="hover:bg-muted/30">
                                      {/* Item / Produto limpo e sem repetições */}
                                      <td className="py-2.5 px-3">
                                        <div className="font-bold text-foreground">
                                          {it.produto || ofItem.produto || ofItem.descricao}
                                        </div>
                                        {/* Badges de Espessura e Cor se detectados */}
                                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                          {espTec?.espessura && (
                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 border border-slate-200">
                                              Esp: {espTec.espessura}
                                            </span>
                                          )}
                                          {espTec?.cor && (
                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200 border border-blue-200">
                                              {espTec.cor}
                                            </span>
                                          )}
                                          {espTec?.modelo && (
                                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 text-purple-800 dark:bg-purple-950 dark:text-purple-200 border border-purple-200">
                                              {espTec.modelo}
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      {/* Peças × Comprimento individual */}
                                      <td className="py-2.5 px-3 text-center font-mono">
                                        <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-bold text-foreground">
                                          {qPecas} pç{qPecas > 1 ? "s" : ""} × {indFmt}
                                        </span>
                                      </td>

                                      {/* Metragem */}
                                      <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                                        {totM > 0 ? `${Number(totM).toFixed(1)} m` : "—"}
                                      </td>

                                      {/* Máquina Alocada Real */}
                                      <td className="py-2.5 px-3 text-center">
                                        {maqNome !== "A Definir" ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                                            <Factory className="w-3 h-3 text-blue-600" />
                                            {maqNome}
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground bg-muted">
                                            A Definir
                                          </span>
                                        )}
                                      </td>

                                      {/* Processo Stepper */}
                                      <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                        <ProcessoStepperPedido
                                          pedido={ofItem}
                                          setor={cat}
                                          compacto={true}
                                          onEtapaClick={(_et, ped) => onOpenDetalhe?.(ped)}
                                        />
                                      </td>

                                      {/* Estoque MP */}
                                      <td className="py-2.5 px-3 text-center">
                                        {estoqueItem?.status === "sem_estoque" ? (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300 dark:bg-red-950/40 dark:text-red-300">
                                            Falta MP
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300">
                                            100% OK
                                          </span>
                                        )}
                                      </td>

                                      {/* Status OF Formatado */}
                                      <td className="py-2.5 px-3 text-center">
                                        {isOfConcluida ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Concluído
                                          </span>
                                        ) : isOfEmProducao ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                                            <Play className="w-3 h-3 text-blue-600 animate-pulse" /> Em Produção ({progOf}%)
                                          </span>
                                        ) : isOfDistribuida ? (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                                            <Factory className="w-3 h-3 text-purple-600" /> Na Máquina
                                          </span>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                                            <Clock className="w-3 h-3 text-amber-600" /> Pendente
                                          </span>
                                        )}
                                      </td>

                                      {/* Ações da OF Individual */}
                                      <td className="py-2.5 px-3 text-right">
                                        <div className="flex items-center justify-end gap-1.5">

                                          {/* SE ESTIVER PENDENTE: BOTÃO DISTRIBUIR */}
                                          {isOfPendente && onDistribuir && (
                                            <Button
                                              size="sm"
                                              className="h-6 text-[10px] px-2 font-bold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-2xs gap-1"
                                              onClick={() => onDistribuir(ofItem, it, itIdx)}
                                              title="Distribuir esta OF para a máquina"
                                            >
                                              <Zap className="w-3 h-3" /> Distribuir
                                            </Button>
                                          )}

                                          {/* SE JÁ ESTIVER DISTRIBUÍDA OU EM PRODUÇÃO: BOTÃO FINALIZAR OP */}
                                          {!isOfConcluida && !isOfPendente && onFinalizarOP && (
                                            <Button
                                              size="sm"
                                              className="h-6 text-[10px] px-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-2xs gap-1"
                                              onClick={() => onFinalizarOP(ofItem)}
                                              title="Finalizar esta OP agora (100% produzida)"
                                            >
                                              <Check className="w-3 h-3" /> Finalizar OP
                                            </Button>
                                          )}

                                          {/* REDISTRIBUIR (para trocar máquina ou reenviar) */}
                                          {!isOfConcluida && !isOfPendente && onDistribuir && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-6 text-[10px] px-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                              onClick={() => onDistribuir(ofItem, it, itIdx)}
                                              title="Redistribuir / Trocar Máquina"
                                            >
                                              <RefreshCw className="w-2.5 h-2.5" />
                                            </Button>
                                          )}

                                          {/* SE CONCLUÍDA: SINCRONIZAR ODOO */}
                                          {isOfConcluida && onSincronizarOdoo && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="h-6 text-[10px] px-2 font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 cursor-pointer gap-1"
                                              onClick={() => onSincronizarOdoo(ofItem)}
                                              title="Sincronizar conclusão com o Odoo"
                                            >
                                              <RefreshCw className="w-2.5 h-2.5 text-emerald-600" /> Odoo
                                            </Button>
                                          )}

                                          {/* DETALHES */}
                                          {onOpenDetalhe && (
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-6 w-6 text-muted-foreground hover:text-foreground cursor-pointer"
                                              onClick={() => onOpenDetalhe(ofItem)}
                                              title="Ver detalhes da OF"
                                            >
                                              <Eye className="w-3 h-3" />
                                            </Button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                });
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
