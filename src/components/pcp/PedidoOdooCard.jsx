import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, User, Tag, Layers, Factory, Scissors, Wind, Trash2, Star, ShieldAlert } from "lucide-react";
import {
  formatDataBR,
  slaDiasPorCategoria
} from "@/lib/sla";
import { slaCountdown, slaCountdownCls, progressoChecklist } from "@/lib/regrasFabrica";
import SlaCountdownBadge from "@/components/pcp/SlaCountdownBadge";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";
import CroquiImage from "@/components/pcp/CroquiImage";

const STATUS_PCP = {
  pendente_distribuicao: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" },
  distribuido: { label: "Distribuído", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40" },
  em_producao: { label: "Em Produção", cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40" },
  concluido: { label: "Concluído", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" }
};

export default function PedidoOdooCard({ pedido, onClick, onDelete, onTogglePrioridade }) {
  const [hover, setHover] = useState(false);
  const st = STATUS_PCP[pedido.status_pcp] || STATUS_PCP.pendente_distribuicao;
  const sla = slaDiasPorCategoria(pedido);
  const chk = progressoChecklist(pedido.itens_json);
  const espessuras = (() => {
    try { return JSON.parse(pedido.espessuras_tags || "[]"); } catch { return []; }
  })();
  const isPrioritario = !!pedido.prioridade;

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-slate-900 border rounded-2xl p-4 hover:shadow-lg transition-all cursor-pointer flex flex-col gap-3 ${
        isPrioritario
          ? "border-amber-400 dark:border-amber-600 ring-1 ring-amber-300/50"
          : "border-slate-200 dark:border-slate-800 hover:border-orange-400/50"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isPrioritario && (
              <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-[10px] gap-0.5">
                <Star className="w-3 h-3 fill-white" /> URGENTE
              </Badge>
            )}
            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
              #{pedido.numero_pedido}
            </span>
            {pedido.odoo_id && (
              <span className="text-[10px] text-slate-400 font-mono">Odoo:{pedido.odoo_id}</span>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate mt-0.5">
            {pedido.cliente_nome || "Cliente não informado"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
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

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <User className="w-3 h-3" />
        <span className="truncate">{pedido.vendedor_nome || "—"}</span>
      </div>

      {/* Croqui/Foto do pedido (Odoo) — clica para expandir */}
      {pedido.foto_pedido_url && (
        <CroquiImage
          url={pedido.foto_pedido_url}
          alt={`Croqui do pedido #${pedido.numero_pedido}`}
          imgClassName="w-full max-h-40 object-cover rounded-lg border border-slate-200 dark:border-slate-800 hover:opacity-90 transition-opacity"
        />
      )}

      {/* SLA Countdown (Regra 6) */}
      <SlaCountdownBadge dataPrometida={pedido.data_entrega} />

      {(() => {
        let its = [];
        try { its = JSON.parse(pedido.itens_json || "[]"); } catch { its = []; }
        const prim = its.find((i) => i.descricao || i.produto);
        if (!prim) return null;
        return (
          <InstrucaoVendedorCard
            descricao={prim.descricao || prim.produto}
            quantidadeOdoo={prim.quantidade}
            espessura={prim.espessura}
            unidade="MT"
            compact
          />
        );
      })()}

      {/* Checklist progress (Regra 4) */}
      {chk.total > 1 && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${chk.percentual >= 100 ? "bg-emerald-500" : "bg-blue-500"}`}
              style={{ width: `${chk.percentual}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
            {chk.concluidos}/{chk.total} itens
          </span>
        </div>
      )}

      {(pedido.percentual_concluido > 0 || pedido.status_pcp === "em_producao") && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${pedido.percentual_concluido >= 100 ? "bg-emerald-500" : "bg-orange-500"}`}
              style={{ width: `${pedido.percentual_concluido || 0}%` }}
            />
          </div>
          <span className={`text-[11px] font-bold ${pedido.percentual_concluido >= 100 ? "text-emerald-600" : "text-orange-600"}`}>
            {pedido.percentual_concluido || 0}%
          </span>
        </div>
      )}

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
          <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30 text-[10px]">
            <Factory className="w-3 h-3 mr-0.5" />{pedido.itens_telha_count} Telha
          </Badge>
        )}
        {pedido.itens_cd_count > 0 && (
          <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 text-[10px]">
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
    </div>
  );
}