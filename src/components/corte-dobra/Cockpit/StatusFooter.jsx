import React from "react";
import { User, Clock, Factory, Wifi } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Barra de status escura no rodapé do Cockpit.
 * Mostra: Operador, Turno, Máquina, Data, hora atual, e indicador de conexão.
 */
function getTurno() {
  const h = new Date().getHours();
  if (h >= 6 && h < 14) return "1º Turno · 06:00–14:00";
  if (h >= 14 && h < 22) return "2º Turno · 14:00–22:00";
  return "3º Turno · 22:00–06:00";
}

export default function StatusFooter({ user, maquinaLabel }) {
  const agora = new Date();
  return (
    <div className="bg-slate-900 text-white flex items-center justify-between gap-4 px-4 py-2 text-xs rounded-b-xl flex-shrink-0">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Operador:</span>
          <strong className="font-semibold">{user?.full_name || "—"}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Turno:</span>
          <strong className="font-semibold">{getTurno()}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Factory className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Máquina:</span>
          <strong className="font-semibold">{maquinaLabel || "—"}</strong>
        </span>
        <span className="text-slate-400">
          {format(agora, "dd/MM/yyyy", { locale: ptBR })}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <Wifi className="w-3.5 h-3.5 text-green-500" />
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <span className="text-green-400 font-medium">Online</span>
        <span className="text-slate-500 ml-2 tabular-nums">{format(agora, "HH:mm:ss")}</span>
      </div>
    </div>
  );
}