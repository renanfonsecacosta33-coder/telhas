import React from "react";
import { Search, X, Calendar, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SafeImage from "./SafeImage";
import { Circle, Clock, Pause, CheckCircle2, AlertCircle } from "lucide-react";

function MiniStatus({ status }) {
  const cfg = {
    pendente:           { label: "Pendente",   Icon: Circle,       color: "bg-slate-100 text-slate-600 border-slate-200" },
    aguardando_corte:   { label: "Aguard.",     Icon: Clock,        color: "bg-orange-100 text-orange-700 border-orange-200" },
    em_producao:        { label: "Produzindo",  Icon: Clock,        color: "bg-amber-100 text-amber-700 border-amber-200" },
    pausado:            { label: "Pausado",     Icon: Pause,        color: "bg-purple-100 text-purple-700 border-purple-200" },
    finalizado:         { label: "Finalizado",  Icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200" },
    cancelado:          { label: "Cancelado",   Icon: AlertCircle,  color: "bg-red-100 text-red-700 border-red-200" },
  }[status] || { label: status, Icon: Circle, color: "bg-slate-100 text-slate-600" };
  return (
    <Badge className={`border text-[10px] ${cfg.color}`}>
      <cfg.Icon className="w-2.5 h-2.5 mr-0.5" />{cfg.label}
    </Badge>
  );
}

export default function WorkListPanel({
  ordens,
  ordemSelecionada,
  onSelectOrdem,
  buscaPedido,
  setBuscaPedido,
  viewMode,
  setViewMode,
  selectedDay,
  setSelectedDay,
  user,
  maquinaLabel,
}) {
  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Header */}
      <div className="px-3 py-3 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">AJL Ferro e Aço</p>
            <h2 className="text-sm font-bold text-slate-800">Ordens do Operador</h2>
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-100 transition-colors">
            <Filter className="w-4 h-4 text-slate-500" />
          </button>
        </div>
        {/* Busca */}
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={buscaPedido}
            onChange={(e) => setBuscaPedido(e.target.value)}
            placeholder="Buscar por pedido, cliente, peça..."
            className="w-full h-8 pl-8 pr-7 rounded-lg border border-slate-200 bg-white text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
          {buscaPedido && (
            <button onClick={() => setBuscaPedido("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {/* Abas de filtro */}
        <div className="flex items-center gap-1 bg-slate-200/60 rounded-lg p-0.5">
          {[
            { key: "semana", label: "Semana" },
            { key: "dia", label: "Dia" },
            { key: "hoje", label: "Hoje" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === "hoje") {
                  setSelectedDay(new Date().toISOString().slice(0, 10));
                  setViewMode("dia");
                } else {
                  setViewMode(tab.key);
                }
              }}
              className={`flex-1 h-7 rounded-md text-xs font-semibold transition-all ${
                (tab.key === viewMode || (tab.key === "hoje" && viewMode === "dia"))
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de OPs */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {ordens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs text-slate-400">Nenhuma OP encontrada</p>
          </div>
        ) : (
          ordens.map(o => {
            const isSelected = ordemSelecionada?.id === o.id;
            const codOP = `[${o.id.slice(-6).toUpperCase()}]`;
            return (
              <button
                key={o.id}
                onClick={() => onSelectOrdem(o)}
                className={`w-full text-left rounded-xl border bg-white p-2.5 transition-all ${
                  isSelected
                    ? "border-orange-500 border-2 shadow-md ring-1 ring-orange-200"
                    : "border-slate-200 hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* Mini thumbnail */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100">
                    <SafeImage url={o.foto_pedido_url || o.foto_material_url} name="OP" className="w-full h-full" imgClassName="object-cover" showAmpliar={false} />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <span className="font-mono font-bold text-xs text-slate-800 truncate">{codOP}</span>
                      <MiniStatus status={o.status} />
                    </div>
                    <p className="text-xs font-semibold text-slate-700 truncate">
                      {o.cliente || o.tipo_peca || "—"}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {o.numero_pedido ? `#${o.numero_pedido} · ` : ""}{o.tipo_peca || o.chapa_descricao || ""}
                    </p>
                    {o.prioridade && (
                      <span className="inline-block mt-0.5 text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">★ PRIORIDADE</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Paginação */}
      <div className="px-3 py-2 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-[10px] text-slate-400">
        <span>{ordens.length} OP(s) na fila</span>
        <div className="flex items-center gap-1">
          <button className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200">‹</button>
          <button className="w-5 h-5 flex items-center justify-center rounded hover:bg-slate-200">›</button>
        </div>
      </div>
    </div>
  );
}