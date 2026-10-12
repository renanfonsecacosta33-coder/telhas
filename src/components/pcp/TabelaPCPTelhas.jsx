import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Flame, Clock, CheckCircle2, User, Factory, Zap, Star,
  Calendar, Truck, Store, ExternalLink, Printer, MoreVertical,
  AlertTriangle, ShieldAlert, ArrowUpDown
} from "lucide-react";
import {
  calcularUrgenciaDetalhada,
  resumoMetragemEPeso,
  resumoBobinaPedido,
  resumoLogistica,
  resumoMaquinaEOperador,
} from "@/lib/pcpDetalhesHelper";
import CroquiThumb from "@/components/pcp/CroquiThumb";

export default function TabelaPCPTelhas({
  pedidos = [],
  pedidosProducao = [],
  bobinasEstoque = [],
  itensSelecionados = [],
  onToggleSelecionarTodos,
  onToggleItem,
  onFinalizar100,
  onAlterarPrazo,
  onAutoRotearPedido,
  onAbrirOP,
  atualizando,
}) {
  return (
    <div className="w-full overflow-x-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xs">
      <table className="w-full text-left border-collapse text-xs">
        {/* Cabeçalho Denso */}
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-[11px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider select-none">
            <th className="py-3 px-3 w-10 text-center">
              <span className="sr-only">Seleção</span>
            </th>
            <th className="py-3 px-3 font-mono">Pedido / OF</th>
            <th className="py-3 px-3">Cliente / Vendedor</th>
            <th className="py-3 px-3">Metragem & Peso</th>
            <th className="py-3 px-3">Máquina</th>
            <th className="py-3 px-3">Matéria-Prima (Bobina)</th>
            <th className="py-3 px-3">Logística</th>
            <th className="py-3 px-3">Prazo / SLA</th>
            <th className="py-3 px-3 w-28">Progresso</th>
            <th className="py-3 px-3 text-right">Ações Rápidas</th>
          </tr>
        </thead>

        {/* Linhas */}
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
          {pedidos.map((pedido) => {
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
            const isConcluido = pedido.status_pcp === "concluido" || pedido.percentual_concluido >= 100;
            const isPrioritario = Boolean(pedido.prioridade);

            // Linha com background contextual suave baseado no prazo
            let bgRowClass = "hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors";
            if (isConcluido) {
              bgRowClass = "bg-emerald-50/20 dark:bg-emerald-950/10 hover:bg-emerald-50/40";
            } else if (urgencia.isCritico) {
              bgRowClass = "bg-red-50/30 dark:bg-red-950/20 hover:bg-red-50/60";
            } else if (urgencia.isModerado) {
              bgRowClass = "bg-amber-50/20 dark:bg-amber-950/15 hover:bg-amber-50/40";
            }

            return (
              <tr key={pedido.id} className={bgRowClass}>
                {/* Checkbox de seleção */}
                <td className="py-2.5 px-3 text-center align-middle">
                  <div className="flex items-center justify-center">
                    <CroquiThumb pedido={pedido} className="w-7 h-7 shrink-0 mr-1 hidden sm:block" />
                  </div>
                </td>

                {/* Pedido / OF / Prioridade */}
                <td className="py-2.5 px-3 align-middle font-mono">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-xs border border-slate-200 dark:border-slate-700">
                      #{pedido.numero_pedido}
                    </span>
                    {isPrioritario && (
                      <Badge className="bg-amber-500 text-white text-[9px] px-1.5 py-0 font-bold gap-0.5 animate-pulse">
                        <Star className="w-2.5 h-2.5 fill-current" /> URGENTE
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-[130px]">
                    {pedido.of_nome || pedido.of_odoo_id || "Sem OF Odoo"}
                  </div>
                </td>

                {/* Cliente / Vendedor */}
                <td className="py-2.5 px-3 align-middle">
                  <div className="font-bold text-slate-900 dark:text-slate-100 truncate max-w-[180px]">
                    {pedido.cliente_nome || "Cliente Balcão"}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[180px] flex items-center gap-1">
                    {pedido.vendedor_nome ? (
                      <span>Vendedor: <strong>{pedido.vendedor_nome}</strong></span>
                    ) : (
                      <span>Venda Direta</span>
                    )}
                  </div>
                </td>

                {/* Metragem e Peso */}
                <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                  <div className="font-black text-slate-900 dark:text-white text-xs">
                    {met.totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                  </div>
                  <div className="text-[10px] text-slate-500 font-medium">
                    {met.totalPecas} pç(s) · ~{met.pesoEstimadoKg} kg
                  </div>
                </td>

                {/* Máquina */}
                <td className="py-2.5 px-3 align-middle">
                  <div className="flex items-center gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-orange-500 shrink-0" />
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[110px]">
                      {maqInfo.maquinaTexto}
                    </span>
                  </div>
                  {maqInfo.operadores && (
                    <div className="text-[10px] text-slate-400 truncate max-w-[110px]">
                      Op: {maqInfo.operadores}
                    </div>
                  )}
                </td>

                {/* Matéria-Prima (Bobina) */}
                <td className="py-2.5 px-3 align-middle">
                  <Badge variant="outline" className={`text-[10px] font-bold py-0.5 px-2 ${bobina.classe}`}>
                    {bobina.label}
                  </Badge>
                </td>

                {/* Logística */}
                <td className="py-2.5 px-3 align-middle">
                  <Badge variant="outline" className={`text-[10px] font-bold py-0.5 px-2 ${logistica.classe}`}>
                    {logistica.label}
                  </Badge>
                </td>

                {/* Prazo / SLA */}
                <td className="py-2.5 px-3 align-middle whitespace-nowrap">
                  <Badge className={`text-[10px] py-0.5 px-2 border ${urgencia.classeBg}`}>
                    {urgencia.label}
                  </Badge>
                  {pedido.data_entrega && (
                    <div className="text-[10px] text-slate-400 mt-0.5 font-medium">
                      SLA: {pedido.data_entrega}
                    </div>
                  )}
                </td>

                {/* Progresso */}
                <td className="py-2.5 px-3 align-middle">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[10px] font-bold text-slate-500">
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
                </td>

                {/* Ações Rápidas */}
                <td className="py-2.5 px-3 align-middle text-right whitespace-nowrap">
                  <div className="flex items-center justify-end gap-1">
                    {/* Botão Rotear / Auto-Bobina */}
                    {!isConcluido && !pedido._isOpAvulsa && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onAutoRotearPedido(pedido)}
                        disabled={atualizando === `auto-rotear-ped-${pedido.id}`}
                        className="h-7 w-7 p-0 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 border-amber-300"
                        title="Roteamento automático com seleção de bobina"
                      >
                        <Zap className="w-3.5 h-3.5 fill-current" />
                      </Button>
                    )}

                    {/* Botão Ajustar Prazo */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onAlterarPrazo(pedido)}
                      className="h-7 w-7 p-0 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title="Alterar Prazo Fabril"
                    >
                      <Clock className="w-3.5 h-3.5" />
                    </Button>

                    {/* Botão Finalizar 100% */}
                    {!isConcluido && (
                      <Button
                        size="sm"
                        onClick={() => onFinalizar100(pedido)}
                        disabled={atualizando === `finalizar-100-${pedido.id}`}
                        className="h-7 px-2 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                        title="Finalizar 100% o pedido"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span className="hidden lg:inline">Concluir</span>
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
