import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Tag, Layers, Factory, Scissors, Wind, Trash2, Star, ShieldAlert, Undo2, RefreshCw } from "lucide-react";
import {
  formatDataBR,
  slaDiasPorCategoria
} from "@/lib/sla";
import { slaCountdown, slaCountdownCls, progressoChecklist } from "@/lib/regrasFabrica";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";
import CroquiThumb from "@/components/pcp/CroquiThumb";
import PedidoItensLista from "@/components/pcp/PedidoItensLista";
import { notificarStatus } from "@/lib/biNotificador";
import { toast } from "sonner";

const STATUS_PCP = {
  pendente_distribuicao: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" },
  distribuido: { label: "Distribuído", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40" },
  em_producao: { label: "Em Produção", cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40" },
  concluido: { label: "Concluído", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" }
};

export default function PedidoOdooCard({
  pedido, onClick, onDelete, onRetirarFila, onTogglePrioridade,
  progressoReal, pedidosProducao = [], ordensCD = []
}) {
  const [hover, setHover] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const st = STATUS_PCP[pedido.status_pcp] || STATUS_PCP.pendente_distribuicao;
  const sla = slaDiasPorCategoria(pedido);
  const chk = progressoChecklist(pedido.itens_json);
  const espessuras = (() => {
    try { return JSON.parse(pedido.espessuras_tags || "[]"); } catch { return []; }
  })();
  const isPrioritario = !!pedido.prioridade;
  const podeRetirarFila = pedido.status_pcp === "distribuido" || pedido.status_pcp === "em_producao";
  const handleSincronizarOdoo = async (e) => {
    e.stopPropagation();
    setSincronizando(true);
    try {
      const pct = progressoReal != null ? progressoReal : (pedido.percentual_concluido || 0);
      await notificarStatus(pedido, "sincronizacao_manual", {
        percentual_concluido: pct,
        status_novo: pedido.status_pcp || "em_producao",
        item_nome: `Pedido #${pedido.numero_pedido}`
      });
      toast.success(`Pedido #${pedido.numero_pedido} sincronizado com o Odoo ERP!`);
    } catch (err) {
      toast.error("Falha ao sincronizar com o Odoo ERP");
    } finally {
      setSincronizando(false);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer flex flex-col gap-3 ${
        isPrioritario
          ? "border-amber-400 dark:border-amber-600 ring-1 ring-amber-300/50"
          : "border-slate-200 dark:border-slate-800 hover:border-orange-400/50"
      }`}
    >
      <CroquiThumb pedido={pedido} alt={`Croqui do pedido #${pedido.numero_pedido}`} className="w-full mb-1" />
      <div className="flex items-start gap-3">
        <div className="flex items-start justify-between gap-2 flex-1 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {isPrioritario && (
                <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-[10px] gap-0.5">
                  <Star className="w-3 h-3 fill-white" /> URGENTE
                </Badge>
              )}
              <h3 className="font-extrabold text-base text-slate-900 dark:text-slate-100 leading-none">
                #{pedido.numero_pedido}
              </h3>
              {pedido.odoo_id && (
                <span className="text-[10px] text-slate-400 font-mono">Odoo:{pedido.odoo_id}</span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate mt-0.5">
              {pedido.cliente_nome || "Cliente não informado"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleSincronizarOdoo}
              disabled={sincronizando}
              title="Sincronizar em tempo real com o Mini BI do Odoo ERP"
              className="p-1 rounded-md text-blue-500 hover:text-blue-600 hover:bg-blue-500/10 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${sincronizando ? "animate-spin" : ""}`} />
            </button>
            {onTogglePrioridade && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onTogglePrioridade(pedido); }}
                title={isPrioritario ? "Remover prioridade" : "Marcar como Prioridade Alta (requer PIN do gestor)"}
                className={`p-1 rounded-md transition-colors ${isPrioritario ? "text-amber-500 bg-amber-500/10" : "text-slate-300 hover:text-amber-500 hover:bg-amber-500/10"}`}
              >
                <Star className={`w-4 h-4 ${isPrioritario ? "fill-amber-500" : ""}`} />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(pedido); }}
                title="Excluir pedido"
                className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <Badge className={`border ${st.cls}`}>{st.label}</Badge>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <User className="w-3 h-3" />
        <span className="truncate">{pedido.vendedor_nome || "—"}</span>
      </div>

      {/* SLA Countdown (Regra 6) */}
      <SlaCountdownBadge dataPrometida={pedido.data_entrega} />

      {/* Lista de Itens com Barras de Progresso Individuais e Etapas (Telha+EPS+Manta) */}
      <PedidoItensLista
        pedido={pedido}
        itensJson={pedido.itens_json}
        pedidosProducao={pedidosProducao}
        ordensCD={ordensCD}
      />

      {/* Barra de Progresso Geral do Pedido (Combinando todos os itens) */}
      {(() => {
        const pct = progressoReal != null ? progressoReal : (pedido.percentual_concluido || 0);
        return (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700 dark:text-slate-300">
                Progresso Geral do Pedido
              </span>
              <span className={`font-black text-sm ${pct >= 100 ? "text-emerald-600" : "text-orange-600"}`}>
                {pct}%
              </span>
            </div>
            <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  pct >= 100 ? "bg-emerald-500" : "bg-gradient-to-r from-orange-500 to-amber-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })()}

      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-200">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDataBR(pedido.data_entrega)}</span>
        </div>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span className="text-slate-500 dark:text-slate-400">SLA {sla}d úteis</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100 dark:border-slate-800">
        {pedido.itens_telha_count > 0 && (
          <Badge className="bg-[#FFD700] text-black border-[#FFD700] text-[10px]">
            <Factory className="w-3 h-3 mr-0.5" />{pedido.itens_telha_count} Telha
          </Badge>
        )}
        {pedido.itens_cd_count > 0 && (
          <Badge className="bg-[#FF6B00] text-white border-[#FF6B00] text-[10px]">
            <Scissors className="w-3 h-3 mr-0.5" />{pedido.itens_cd_count} C&D
          </Badge>
        )}
        {pedido.itens_frisada_count > 0 && (
          <Badge className="bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/30 text-[10px]">
            <Wind className="w-3 h-3 mr-0.5" />{pedido.itens_frisada_count} Frisada
          </Badge>
        )}
        <span className="text-[10px] text-slate-400 flex items-center gap-0.5 ml-auto">
          <Layers className="w-3 h-3" />{pedido.total_itens || 0} itens
        </span>
      </div>

      {espessuras.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <Tag className="w-3 h-3 text-slate-400" />
          {espessuras.map((e, idx) => (
            <span key={idx} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {e.espessura}mm
            </span>
          ))}
        </div>
      )}

      {podeRetirarFila && onRetirarFila && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRetirarFila(pedido); }}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Retirar da Fila do Galpão
        </button>
      )}
    </div>
  );
}