import React from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Tag, Layers, Factory, Scissors, Wind } from "lucide-react";
import {
  formatDataBR,
  diasUteisRestantes,
  slaDiasPorCategoria
} from "@/lib/sla";

const STATUS_PCP = {
  pendente_distribuicao: { label: "Pendente", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40" },
  distribuido: { label: "Distribuído", cls: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/40" },
  em_producao: { label: "Em Produção", cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/40" },
  concluido: { label: "Concluído", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40" }
};

export default function PedidoOdooCard({ pedido, onClick }) {
  const st = STATUS_PCP[pedido.status_pcp] || STATUS_PCP.pendente_distribuicao;
  const sla = slaDiasPorCategoria(pedido);
  const restantes = diasUteisRestantes(pedido.data_entrega);
  const espessuras = (() => {
    try { return JSON.parse(pedido.espessuras_tags || "[]"); } catch { return []; }
  })();

  const atrasado = restantes < 0;

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 hover:shadow-lg hover:border-orange-400/50 transition-all cursor-pointer flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
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
        <Badge className={`shrink-0 border ${st.cls}`}>{st.label}</Badge>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <User className="w-3 h-3" />
        <span className="truncate">{pedido.vendedor_nome || "—"}</span>
      </div>

      <div className="flex items-center gap-3 text-xs">
        <div className={`flex items-center gap-1.5 font-semibold ${atrasado ? "text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-200"}`}>
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDataBR(pedido.data_entrega)}</span>
        </div>
        <span className="text-slate-300 dark:text-slate-600">•</span>
        <span className="text-slate-500 dark:text-slate-400">SLA {sla}d úteis</span>
        {atrasado ? (
          <Badge variant="destructive" className="ml-auto text-[10px] py-0">Atrasado {restantes}d</Badge>
        ) : (
          <span className={`ml-auto text-[11px] font-medium ${restantes <= 2 ? "text-amber-600" : "text-emerald-600"}`}>
            {restantes}d úteis
          </span>
        )}
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
            <span key={idx} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {e.espessura}mm
            </span>
          ))}
        </div>
      )}
    </div>
  );
}