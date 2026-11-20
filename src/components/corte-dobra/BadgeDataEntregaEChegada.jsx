import React, { useMemo } from "react";
import { Calendar, Clock, AlertTriangle, Flame } from "lucide-react";
import { format, differenceInMinutes, differenceInHours, differenceInDays, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Converte com segurança strings ISO ou YYYY-MM-DD em objeto Date
 */
function parseDataSegura(val) {
  if (!val) return null;
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const s = String(val).trim();
  if (s.includes("T") || s.includes(" ")) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return d;
  }
  const matchYmd = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (matchYmd) {
    const d = new Date(Number(matchYmd[1]), Number(matchYmd[2]) - 1, Number(matchYmd[3]), 12, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  const matchDmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (matchDmy) {
    const d = new Date(Number(matchDmy[3]), Number(matchDmy[2]) - 1, Number(matchDmy[1]), 12, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  const dt = new Date(s);
  return !isNaN(dt.getTime()) ? dt : null;
}

/**
 * Retorna tempo decorrido amigável (ex: "há 15 min", "há 2h", "ontem", "há 3 dias")
 */
function formatarTempoDecorrido(d) {
  if (!d) return "";
  const agora = new Date();
  const diffMin = differenceInMinutes(agora, d);
  if (diffMin < 1) return "agora há pouco";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = differenceInHours(agora, d);
  if (diffHoras < 24) return `há ${diffHoras}h`;
  const diffDias = differenceInDays(agora, d);
  if (diffDias === 1) return "ontem";
  return `há ${diffDias} dias`;
}

/**
 * Badges de Data de Entrega e Data de Chegada da OP na Máquina
 */
export default function BadgeDataEntregaEChegada({ ordem, pedidoOdoo = null, className = "" }) {
  if (!ordem && !pedidoOdoo) return null;

  const o = ordem || {};
  const p = pedidoOdoo || {};

  // 1. Data de Entrega
  const dataEntregaObj = useMemo(() => {
    const raw = o.data_entrega || p.data_entrega || o.data_prontidao || p.data_prontidao;
    if (!raw) return null;
    const dt = parseDataSegura(raw);
    if (!dt) return null;

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dtZero = new Date(dt);
    dtZero.setHours(0, 0, 0, 0);

    const diffDias = Math.round((dtZero.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
    const fmt = format(dt, "dd/MM/yyyy");

    let status = "normal";
    if (diffDias < 0) status = "atrasado";
    else if (diffDias === 0) status = "hoje";

    return { dt, fmt, status, diffDias };
  }, [o.data_entrega, p.data_entrega, o.data_prontidao, p.data_prontidao]);

  // 2. Data de Chegada da OP na Máquina
  const dataChegadaObj = useMemo(() => {
    const raw = o.created_date || o.created_at || o.data_recebimento || p.data_recebimento || o.data;
    if (!raw) return null;
    const dt = parseDataSegura(raw);
    if (!dt) return null;

    const temHora = String(raw).includes("T") || String(raw).includes(":");
    const fmtDataHora = temHora ? format(dt, "dd/MM 'às' HH:mm", { locale: ptBR }) : format(dt, "dd/MM/yyyy");
    const tempoRelativo = temHora ? formatarTempoDecorrido(dt) : "";

    return { dt, fmtDataHora, tempoRelativo, temHora };
  }, [o.created_date, o.created_at, o.data_recebimento, p.data_recebimento, o.data]);

  if (!dataEntregaObj && !dataChegadaObj) return null;

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
      {/* 📅 Badge de Data de Entrega */}
      {dataEntregaObj && (
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black tracking-tight border shadow-2xs transition-all ${
            dataEntregaObj.status === "atrasado"
              ? "bg-red-500/15 text-red-900 dark:text-red-200 border-red-500/50 shadow-xs animate-pulse"
              : dataEntregaObj.status === "hoje"
              ? "bg-amber-500/20 text-amber-950 dark:text-amber-200 border-amber-500/60 shadow-xs"
              : "bg-emerald-500/10 text-emerald-900 dark:text-emerald-200 border-emerald-500/40"
          }`}
          title={
            dataEntregaObj.status === "atrasado"
              ? `⚠️ Pedido com entrega atrasada! Deveria ter sido entregue em ${dataEntregaObj.fmt}`
              : dataEntregaObj.status === "hoje"
              ? `⚡ Entrega agendada para HOJE (${dataEntregaObj.fmt})!`
              : `Data limite de entrega: ${dataEntregaObj.fmt}`
          }
        >
          {dataEntregaObj.status === "atrasado" ? (
            <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 shrink-0" />
          ) : dataEntregaObj.status === "hoje" ? (
            <Flame className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
          ) : (
            <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          )}
          <span>
            {dataEntregaObj.status === "atrasado"
              ? `ENTREGA: ${dataEntregaObj.fmt} (ATRASADO)`
              : dataEntregaObj.status === "hoje"
              ? `ENTREGA: HOJE (${dataEntregaObj.fmt})`
              : `ENTREGA: ${dataEntregaObj.fmt}`}
          </span>
        </span>
      )}

      {/* ⏳ Badge de Chegada na Máquina */}
      {dataChegadaObj && (
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 shadow-2xs"
          title={`Ordem registrada nesta máquina em: ${dataChegadaObj.fmtDataHora}`}
        >
          <Clock className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            Chegou na Máquina: <strong>{dataChegadaObj.fmtDataHora}</strong>
            {dataChegadaObj.tempoRelativo ? ` (${dataChegadaObj.tempoRelativo})` : ""}
          </span>
        </span>
      )}
    </div>
  );
}
