import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Snowflake, ChevronRight, Clock, CheckCircle2, Layers } from "lucide-react";
import { resumirColagem } from "@/lib/colagemResumoHelper";

const MODELOS = [
  { key: "eps", label: "Telha + EPS", cor: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "manta", label: "EPS + Manta", cor: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "eps_telha", label: "EPS + Telha", cor: "bg-teal-50 text-teal-700 border-teal-200" },
  { key: "bandeja", label: "Bandeja", cor: "bg-pink-50 text-pink-700 border-pink-200" },
];

const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default function MetrosAColarCard({ pedidos = [], pedidosOdoo = [] }) {
  const resumo = useMemo(
    () => resumirColagem({ pedidos, pedidosOdoo }),
    [pedidos, pedidosOdoo]
  );

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      <div className="p-4 sm:p-5 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex items-center gap-4 lg:min-w-[260px]">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
              <Snowflake className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Falta Colar</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-3xl font-black text-rose-600 tracking-tight">{fmt(resumo.total)}</span>
                <span className="text-xs font-bold text-slate-400">metros</span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                {resumo.qtd} pedido(s) distribuído(s) com EPS ou Bandeja em aberto
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-1">
            {MODELOS.map((m) => (
              <div key={m.key} className={`px-3 py-2 rounded-xl border ${m.cor} flex flex-col min-w-[120px]`}>
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{m.label}</span>
                <span className="text-base font-black leading-tight">{fmt(resumo.porModelo[m.key])} m</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5 lg:items-end shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {fmt(resumo.prontos)} m já perfilados aguardando colagem
            </div>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              {fmt(resumo.total - resumo.prontos)} m ainda na fila de perfilagem
            </div>
            <Link
              to="/maquina/colagem"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 mt-0.5"
            >
              Abrir painel da Colagem <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {resumo.porEps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mr-1">
              <Layers className="w-3.5 h-3.5 text-slate-400" /> EPS necessário
            </span>
            {resumo.porEps.map((e) => (
              <div
                key={e.chave}
                className="px-3 py-1.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 flex items-center gap-2"
              >
                <span className="text-[11px] font-bold uppercase tracking-wide">{e.label}</span>
                <span className="text-sm font-black leading-none">{fmt(e.pecas)} un</span>
                <span className="text-[11px] font-semibold text-amber-700">({fmt(e.metros)} m)</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}