import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { Snowflake, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
import { calcularMetrosPedido } from "@/lib/metrosHelper";
import { isTelhaBandeja } from "@/lib/bandejaHelper";

const MODELOS = [
  { key: "eps", label: "Telha + EPS", cor: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "manta", label: "EPS + Manta", cor: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { key: "eps_telha", label: "EPS + Telha", cor: "bg-teal-50 text-teal-700 border-teal-200" },
  { key: "bandeja", label: "Bandeja", cor: "bg-pink-50 text-pink-700 border-pink-200" },
];

/** Identifica o modelo de colagem do pedido (null = não passa pela colagem). */
export function modeloColagem(p) {
  const prod = String(p?.produto || p?.modelo || "").toUpperCase();
  if (prod.includes("BOBININHA") || prod.includes("CUMEEIRA")) return null;
  if (isTelhaBandeja(p) || prod.includes("BANDEJA")) return "bandeja";
  if (prod.includes("MANTA")) return "manta";
  if (prod.includes("TELHA + EPS + TELHA") || /EPS\s*\+\s*TELHA/.test(prod)) return "eps_telha";
  if (prod.includes("EPS") || prod.includes("SANDU") || prod.includes("TERMO")) return "eps";
  return null;
}

const fmt = (n) => (Number(n) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 });

export default function MetrosAColarCard({ pedidos = [] }) {
  const resumo = useMemo(() => {
    const porModelo = { eps: 0, manta: 0, eps_telha: 0, bandeja: 0 };
    let total = 0;
    let prontos = 0;
    let qtd = 0;

    (pedidos || []).forEach((p) => {
      if (!p || p.status === "finalizado" || p.status === "cancelado") return;
      const modelo = modeloColagem(p);
      if (!modelo) return;
      const m = calcularMetrosPedido(p);
      if (m <= 0) return;
      porModelo[modelo] += m;
      total += m;
      qtd += 1;
      if (p.status === "aguardando_colagem" || p.perfilacao_concluida === true) prontos += m;
    });

    return { porModelo, total, prontos, qtd };
  }, [pedidos]);

  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 p-4 sm:p-5">
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
              {resumo.qtd} pedido(s) com EPS ou Bandeja em aberto
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-1">
          {MODELOS.map((m) => (
            <div
              key={m.key}
              className={`px-3 py-2 rounded-xl border ${m.cor} flex flex-col min-w-[120px]`}
            >
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
    </div>
  );
}