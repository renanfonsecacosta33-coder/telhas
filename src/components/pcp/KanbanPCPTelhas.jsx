import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Inbox, Factory, CheckCircle2, Star, Clock, Zap,
  Truck, Store, AlertTriangle, ArrowRight, User
} from "lucide-react";
import {
  calcularUrgenciaDetalhada,
  resumoMetragemEPeso,
  resumoBobinaPedido,
  resumoLogistica,
  resumoMaquinaEOperador,
} from "@/lib/pcpDetalhesHelper";
import CroquiThumb from "@/components/pcp/CroquiThumb";

export default function KanbanPCPTelhas({
  pedidos = [],
  pedidosProducao = [],
  bobinasEstoque = [],
  onFinalizar100,
  onAlterarPrazo,
  onAutoRotearPedido,
  atualizando,
}) {
  // Separação dos pedidos em 3 colunas canônicas de fluxo do PCP
  const colunas = React.useMemo(() => {
    const pendentes = [];
    const emProducao = [];
    const concluidos = [];

    pedidos.forEach((p) => {
      const isConcluido = p.status_pcp === "concluido" || (p.percentual_concluido || 0) >= 100;
      if (isConcluido) {
        concluidos.push(p);
        return;
      }

      const ops = pedidosProducao.filter(
        (op) =>
          op.pedido_odoo_id === p.id ||
          String(op.numero_pedido || "").trim() === String(p.numero_pedido || "").trim()
      );
      const temOpProduzindo = ops.some((op) => op.status === "em_producao");
      const pct = p.percentual_concluido || 0;

      if (temOpProduzindo || (pct > 25 && pct < 100)) {
        emProducao.push(p);
      } else {
        pendentes.push(p);
      }
    });

    const somarMetros = (lista) =>
      lista.reduce((acc, p) => acc + resumoMetragemEPeso(p).totalMetros, 0);

    return [
      {
        id: "pendentes",
        titulo: "Aguardando Início",
        subtitulo: "Na Fila / Sem Máquina",
        icone: Inbox,
        corHeader: "border-amber-500/40 bg-amber-500/5 text-amber-800 dark:text-amber-200",
        badgeCor: "bg-amber-100 text-amber-800 border-amber-300",
        itens: pendentes,
        totalMetros: somarMetros(pendentes),
      },
      {
        id: "em_producao",
        titulo: "Em Produção",
        subtitulo: "Rodando nas Máquinas",
        icone: Factory,
        corHeader: "border-blue-500/40 bg-blue-500/5 text-blue-800 dark:text-blue-200",
        badgeCor: "bg-blue-100 text-blue-800 border-blue-300",
        itens: emProducao,
        totalMetros: somarMetros(emProducao),
      },
      {
        id: "concluidos",
        titulo: "Concluídos",
        subtitulo: "Pronto p/ Expedição",
        icone: CheckCircle2,
        corHeader: "border-emerald-500/40 bg-emerald-500/5 text-emerald-800 dark:text-emerald-200",
        badgeCor: "bg-emerald-100 text-emerald-800 border-emerald-300",
        itens: concluidos,
        totalMetros: somarMetros(concluidos),
      },
    ];
  }, [pedidos, pedidosProducao]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 select-none">
      {colunas.map((col) => {
        const Icone = col.icone;

        return (
          <div
            key={col.id}
            className="flex flex-col bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-2xs min-h-[480px]"
          >
            {/* Header da Coluna */}
            <div className={`p-3 rounded-xl border mb-3 ${col.corHeader}`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Icone className="w-4 h-4 shrink-0" />
                  <span className="font-black text-sm tracking-tight">{col.titulo}</span>
                </div>
                <Badge className={`text-xs font-bold ${col.badgeCor}`}>
                  {col.itens.length} pedido(s)
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[11px] mt-1 text-slate-500 dark:text-slate-400 font-medium">
                <span>{col.subtitulo}</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {col.totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                </span>
              </div>
            </div>

            {/* Lista de Cards da Coluna */}
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[750px] pr-1">
              {col.itens.length === 0 ? (
                <div className="h-40 flex flex-col items-center justify-center text-center text-slate-400 text-xs">
                  <Inbox className="w-8 h-8 stroke-[1.5] mb-2 opacity-50" />
                  <span>Nenhum pedido nesta etapa</span>
                </div>
              ) : (
                col.itens.map((pedido) => {
                  const urgencia = calcularUrgenciaDetalhada(pedido);
                  const met = resumoMetragemEPeso(pedido);
                  const bobina = resumoBobinaPedido(pedido, bobinasEstoque);
                  const logistica = resumoLogistica(pedido);
                  const opsDoPedido = pedidosProducao.filter(
                    (op) =>
                      op.pedido_odoo_id === pedido.id ||
                      String(op.numero_pedido || "").trim() === String(pedido.numero_pedido || "").trim()
                  );
                  const maqInfo = resumoMaquinaEOperador(pedido, opsDoPedido);
                  const isConcluido = col.id === "concluidos";
                  const isPrioritario = Boolean(pedido.prioridade);

                  return (
                    <div
                      key={pedido.id}
                      className={`p-3.5 rounded-xl border bg-white dark:bg-slate-800 shadow-xs hover:shadow-md transition-all space-y-2.5 relative ${
                        isConcluido
                          ? "border-emerald-200 dark:border-emerald-800/80"
                          : urgencia.isCritico
                          ? "border-red-400 dark:border-red-800 ring-1 ring-red-400/30"
                          : urgencia.isModerado
                          ? "border-amber-300 dark:border-amber-700"
                          : isPrioritario
                          ? "border-amber-400 dark:border-amber-600"
                          : "border-slate-200 dark:border-slate-700"
                      }`}
                    >
                      {/* Topo do Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-sm text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-600">
                            #{pedido.numero_pedido}
                          </span>
                          {isPrioritario && (
                            <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 font-bold gap-0.5 animate-pulse">
                              <Star className="w-2.5 h-2.5 fill-current" /> URGENTE
                            </Badge>
                          )}
                          <CroquiThumb pedido={pedido} className="w-6 h-6 shrink-0" />
                        </div>
                        <Badge className={`text-[10px] py-0.5 px-2 border shrink-0 ${urgencia.classeBg}`}>
                          {urgencia.label}
                        </Badge>
                      </div>

                      {/* Cliente e Vendedor */}
                      <div className="text-xs">
                        <p className="font-extrabold text-slate-900 dark:text-slate-100 truncate">
                          {pedido.cliente_nome || "Cliente Balcão"}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">
                          {pedido.vendedor_nome ? `Vendedor: ${pedido.vendedor_nome}` : "Venda Direta"}
                        </p>
                      </div>

                      {/* Badges de Operação: Metragem + Bobina + Máquina */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
                        <div className="bg-slate-50 dark:bg-slate-700/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700/80">
                          <span className="text-[10px] text-slate-400 block font-medium">Metragem / Peso</span>
                          <span className="font-black text-slate-800 dark:text-slate-200">
                            {met.totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                          </span>
                          <span className="text-[9px] text-slate-400 block">~{met.pesoEstimadoKg} kg</span>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-700/50 p-1.5 rounded-lg border border-slate-100 dark:border-slate-700/80">
                          <span className="text-[10px] text-slate-400 block font-medium">Máquina Alocada</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                            {maqInfo.maquinaTexto}
                          </span>
                        </div>
                      </div>

                      {/* Status de Bobina e Logística */}
                      <div className="flex items-center justify-between gap-1 flex-wrap pt-0.5">
                        <Badge variant="outline" className={`text-[9px] font-bold py-0.5 px-1.5 ${bobina.classe}`}>
                          {bobina.label}
                        </Badge>
                        <Badge variant="outline" className={`text-[9px] font-bold py-0.5 px-1.5 ${logistica.classe}`}>
                          {logistica.label}
                        </Badge>
                      </div>

                      {/* Barra de Progresso */}
                      <div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                          <span>Progresso</span>
                          <span className={isConcluido ? "text-emerald-600 font-black" : "text-slate-700 dark:text-slate-300"}>
                            {isConcluido ? "100%" : `${pedido.percentual_concluido || 0}%`}
                          </span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isConcluido
                                ? "bg-emerald-500"
                                : "bg-linear-to-r from-orange-500 to-amber-500"
                            }`}
                            style={{
                              width: `${isConcluido ? 100 : Math.min(100, pedido.percentual_concluido || 0)}%`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Ações do Card */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-700/80">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onAlterarPrazo(pedido)}
                            className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900 gap-1 font-semibold"
                            title="Ajustar Prazo Fabril"
                          >
                            <Clock className="w-3 h-3" /> Prazo
                          </Button>
                          {!isConcluido && !pedido._isOpAvulsa && (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={atualizando === `auto-rotear-ped-${pedido.id}`}
                              onClick={() => onAutoRotearPedido(pedido)}
                              className="h-7 px-2 text-[11px] text-amber-600 hover:text-amber-700 gap-1 font-semibold"
                              title="Roteamento automático"
                            >
                              <Zap className="w-3 h-3 fill-current" /> Auto
                            </Button>
                          )}
                        </div>

                        {!isConcluido && (
                          <Button
                            size="sm"
                            onClick={() => onFinalizar100(pedido)}
                            disabled={atualizando === `finalizar-100-${pedido.id}`}
                            className="h-7 px-2.5 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                          >
                            <CheckCircle2 className="w-3 h-3" /> Concluir
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
