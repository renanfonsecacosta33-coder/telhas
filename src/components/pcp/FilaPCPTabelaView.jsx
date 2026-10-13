import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink, History, Zap, CheckCircle2, Clock, AlertTriangle,
  Layers, Star, Eye, RefreshCw, Scissors, Home, Wind, Package,
  ChevronDown, ChevronRight, User, Calendar, Send
} from "lucide-react";
import { stripHtml } from "@/lib/stripHtml";
import { classGrupo, normalizarUnidadeMedidaItem, obterStatusDescritivoItem, calcularProgressoRealPedido } from "@/lib/pedidoOdooHelper";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { verificarEstoqueItem, extrairDemandaItem } from "@/lib/estoqueMaterialHelper";
import { PrioridadeBadge, SeletorPrioridadeDropdown } from "@/lib/prioridadeHelper";
import ProcessoStepperPedido from "@/components/producao/ProcessoStepperPedido";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import { formatDataBR } from "@/lib/sla";

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
  onOpenHistorico,
  onSincronizarOdoo,
  onAlterarPrioridade,
}) {
  const [expandidos, setExpandidos] = useState(new Set());

  // Constrói ou utiliza gruposPedidos consolidados
  const listaGrupos = useMemo(() => {
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

  if (listaGrupos.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
        <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-semibold text-base">Nenhum pedido na fila para os filtros selecionados</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
      {/* Barra de controle de expansão da tabela */}
      <div className="bg-muted/40 px-4 py-2 border-b border-border flex items-center justify-between text-xs text-muted-foreground flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-bold text-foreground">Visão Tabela por Pedido</span>
          <span>· {listaGrupos.length} pedidos na fila</span>
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
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
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

                // Tenta extrair itens do json
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

              // Progresso
              const somaProgressos = ofs.reduce((acc, p) => acc + calcularProgressoRealPedido(p, pedidosProducao, ordensCD), 0);
              const progressoGeral = ofs.length > 0 ? Math.round(somaProgressos / ofs.length) : 0;

              const isUrgente = grupo.prioridade || ofs.some(p => p.prioridade || p.prioridade_nivel);
              const primeiroPedido = ofs[0] || {};

              return (
                <React.Fragment key={numPedido}>
                  {/* Linha Mestre: O Pedido de Venda */}
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

                    {/* Status PCP */}
                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-bold capitalize ${
                          progressoGeral >= 100
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : progressoGeral > 0
                            ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300"
                            : "bg-slate-50 text-slate-700 border-slate-300"
                        }`}
                      >
                        {progressoGeral >= 100 ? "Concluído" : progressoGeral > 0 ? "Em Produção" : "Pendente"}
                      </Badge>
                    </td>

                    {/* Ações da Linha */}
                    <td className="py-2.5 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {onDistribuirGrupo && progressoGeral < 100 && (
                          <Button
                            size="sm"
                            className="h-7 text-xs px-2 gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer"
                            onClick={() => onDistribuirGrupo(grupo)}
                            title="Distribuir todas as OFs deste pedido"
                          >
                            <Zap className="w-3 h-3" /> Distribuir
                          </Button>
                        )}
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
                        {onOpenHistorico && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => onOpenHistorico(numPedido)}
                            title="Histórico / Timeline"
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
                      <td colSpan={11} className="p-3 pl-12 pr-4 bg-slate-50/50 dark:bg-slate-900/40">
                        <div className="rounded-lg border border-border bg-card overflow-hidden shadow-2xs">
                          <table className="w-full text-xs text-left">
                            <thead>
                              <tr className="bg-muted/50 border-b border-border text-[10px] font-bold text-muted-foreground uppercase">
                                <th className="py-2 px-3">Item / Produto</th>
                                <th className="py-2 px-3 text-center">Peças × Medida Individual</th>
                                <th className="py-2 px-3 text-right">Metragem</th>
                                <th className="py-2 px-3 text-center">Máquina</th>
                                <th className="py-2 px-3 text-center">Processo</th>
                                <th className="py-2 px-3 text-center">Estoque MP</th>
                                <th className="py-2 px-3 text-center">Status</th>
                                <th className="py-2 px-3 text-right">Ação</th>
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

                                  return (
                                    <tr key={`${ofItem.id}-${itIdx}`} className="hover:bg-muted/30">
                                      {/* Produto */}
                                      <td className="py-2 px-3">
                                        <div className="font-bold text-foreground">
                                          {it.produto || ofItem.produto}
                                        </div>
                                        {espTec?.resumo_formatado && (
                                          <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">
                                            {espTec.resumo_formatado}
                                          </div>
                                        )}
                                      </td>

                                      {/* Peças x Medida */}
                                      <td className="py-2 px-3 text-center font-mono">
                                        <span className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-bold">
                                          {qPecas} pç{qPecas > 1 ? "s" : ""} × {indFmt}
                                        </span>
                                      </td>

                                      {/* Metragem */}
                                      <td className="py-2 px-3 text-right font-mono font-bold text-blue-600">
                                        {totM > 0 ? `${Number(totM).toFixed(1)} m` : "—"}
                                      </td>

                                      {/* Máquina */}
                                      <td className="py-2 px-3 text-center">
                                        <span className="bg-muted px-1.5 py-0.5 rounded text-[10px] font-semibold">
                                          {ofItem.maquina || "A Definir"}
                                        </span>
                                      </td>

                                      {/* Processo Stepper */}
                                      <td className="py-2 px-3 text-center whitespace-nowrap">
                                        <ProcessoStepperPedido
                                          pedido={ofItem}
                                          setor={cat}
                                          compacto={true}
                                          onEtapaClick={(_et, ped) => onOpenDetalhe?.(ped)}
                                        />
                                      </td>

                                      {/* Estoque MP */}
                                      <td className="py-2 px-3 text-center">
                                        {estoqueItem?.status === "sem_estoque" ? (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700 border border-red-300">
                                            Falta MP
                                          </span>
                                        ) : (
                                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-300">
                                            100% OK
                                          </span>
                                        )}
                                      </td>

                                      {/* Status */}
                                      <td className="py-2 px-3 text-center">
                                        <span className="text-[10px] font-bold capitalize text-muted-foreground">
                                          {ofItem.status_pcp || "pendente"}
                                        </span>
                                      </td>

                                      {/* Ação individual */}
                                      <td className="py-2 px-3 text-right">
                                        {onDistribuir && ofItem.status_pcp !== "concluido" && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 text-[10px] px-2 font-bold hover:bg-blue-50 cursor-pointer"
                                            onClick={() => onDistribuir(ofItem, it, itIdx)}
                                          >
                                            Distribuir
                                          </Button>
                                        )}
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
