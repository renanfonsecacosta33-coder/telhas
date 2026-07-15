import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, LogOut, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import HistoricoHoraExtra from "./HistoricoHoraExtra";

function formatTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function getHorariosHoje() {
  const hoje = new Date();
  const y = hoje.getFullYear();
  const mo = hoje.getMonth();
  const d = hoje.getDate();
  const inicio = new Date(y, mo, d, 17, 55, 0);
  const limite = new Date(y, mo, d, 18, 5, 0);
  const agora = new Date();
  return { inicio, limite, agora, hojeStr: format(hoje, "yyyy-MM-dd") };
}

export default function FinalizarExpedienteButton({ maquina, setor, pedidosAtivos, filialAtiva, user, onPausarTodas }) {
  const [, setTick] = useState(0);
  const [processando, setProcessando] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const { data: registroHoje } = useQuery({
    queryKey: ["hora-extra-hoje", maquina, filialAtiva],
    queryFn: () => base44.entities.HoraExtra.filter({
      maquina, unidade: filialAtiva, data: getHorariosHoje().hojeStr
    }, "-created_date", 1),
    refetchInterval: 5000,
  });

  const registro = registroHoje?.[0] || null;
  const expedienteFinalizado = registro?.status === "finalizado";

  const { inicio, limite, agora, hojeStr } = getHorariosHoje();
  const temPedidosAtivos = pedidosAtivos && pedidosAtivos.length > 0;
  const janelaAberta = agora >= inicio;
  const horaExtraAtiva = !expedienteFinalizado && agora > limite && temPedidosAtivos;
  const botaoVisivel = janelaAberta && temPedidosAtivos && !expedienteFinalizado;

  let tempoExtraSeg = 0;
  if (horaExtraAtiva) {
    tempoExtraSeg = Math.floor((agora - limite) / 1000);
  } else if (registro?.tem_hora_extra && registro?.fim_hora_extra) {
    tempoExtraSeg = registro.duracao_extra_seg || 0;
  }

  const handleFinalizar = async () => {
    if (processando) return;
    setProcessando(true);
    try {
      const agoraIso = new Date().toISOString();
      const isHoraExtra = agora > limite;

      if (onPausarTodas) {
        await onPausarTodas();
      }

      if (registro) {
        await base44.entities.HoraExtra.update(registro.id, {
          horario_fim_expediente: agoraIso,
          tem_hora_extra: isHoraExtra,
          fim_hora_extra: isHoraExtra ? agoraIso : null,
          inicio_hora_extra: isHoraExtra ? limite.toISOString() : null,
          duracao_extra_seg: isHoraExtra ? Math.floor((agora - limite) / 1000) : 0,
          status: "finalizado",
        });
      } else {
        await base44.entities.HoraExtra.create({
          unidade: filialAtiva,
          setor,
          maquina,
          operador_nome: user?.full_name || user?.email || "—",
          operador_id: user?.id || "",
          data: hojeStr,
          horario_fim_expediente: agoraIso,
          tem_hora_extra: isHoraExtra,
          inicio_hora_extra: isHoraExtra ? limite.toISOString() : null,
          fim_hora_extra: isHoraExtra ? agoraIso : null,
          duracao_extra_seg: isHoraExtra ? Math.floor((agora - limite) / 1000) : 0,
          pedidos_ativos_json: JSON.stringify((pedidosAtivos || []).map(p => ({
            id: p.id, numero: p.numero_pedido || "", produto: p.produto || ""
          }))),
          status: "finalizado",
        });
      }

      queryClient.invalidateQueries({ queryKey: ["hora-extra-hoje"] });
      queryClient.invalidateQueries({ queryKey: ["hora-extra-historico"] });

      if (isHoraExtra) {
        toast.error(`Expediente finalizado com HORA EXTRA! Tempo extra: ${formatTempo(Math.floor((agora - limite) / 1000))}`);
      } else {
        toast.success("Expediente finalizado no horário! Bom descanso.");
      }
    } catch (err) {
      toast.error("Erro ao finalizar expediente: " + (err.message || ""));
    } finally {
      setProcessando(false);
    }
  };

  if (!temPedidosAtivos && !horaExtraAtiva && !expedienteFinalizado) return null;

  return (
    <>
      {horaExtraAtiva && (
        <div className="bg-red-50 border-2 border-red-300 rounded-xl p-3 flex items-center justify-between gap-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-red-700 text-sm">HORA EXTRA EM ANDAMENTO</p>
              <p className="text-xs text-red-600">Expediente nao finalizado - contando hora extra desde 18:05</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-red-700 tabular-nums">{formatTempo(tempoExtraSeg)}</p>
            <p className="text-xs text-red-500">tempo extra</p>
          </div>
        </div>
      )}

      {botaoVisivel && (
        <div className={`rounded-xl p-3 border-2 ${horaExtraAtiva ? "bg-red-50 border-red-300" : "bg-green-50 border-green-300"}`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <LogOut className={`w-5 h-5 ${horaExtraAtiva ? "text-red-600" : "text-green-600"}`} />
              <div>
                <p className={`font-bold text-sm ${horaExtraAtiva ? "text-red-700" : "text-green-700"}`}>
                  {horaExtraAtiva ? "FINALIZAR EXPEDIENTE (Hora Extra)" : "Finalizar Expediente"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {horaExtraAtiva
                    ? "Pausa todas as OPs ativas e registra hora extra"
                    : `${pedidosAtivos.length} OP(s) ativa(s) - pausar ao finalizar`}
                </p>
              </div>
            </div>
            <Button
              onClick={handleFinalizar}
              disabled={processando}
              className={`gap-2 ${horaExtraAtiva ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"} text-white border-0`}
            >
              <LogOut className="w-4 h-4" />
              {processando ? "Finalizando..." : horaExtraAtiva ? "Finalizar c/ Hora Extra" : "Finalizar Expediente"}
            </Button>
          </div>
        </div>
      )}

      {expedienteFinalizado && registro && (
        <div className={`rounded-xl p-3 border-2 ${registro.tem_hora_extra ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${registro.tem_hora_extra ? "text-red-600" : "text-green-600"}`} />
              <div>
                <p className={`font-bold text-sm ${registro.tem_hora_extra ? "text-red-700" : "text-green-700"}`}>
                  {registro.tem_hora_extra ? "Expediente finalizado com Hora Extra" : "Expediente finalizado"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Finalizado as {registro.horario_fim_expediente ? format(new Date(registro.horario_fim_expediente), "HH:mm") : "--"} por {registro.operador_nome}
                  {registro.tem_hora_extra && ` - Extra: ${formatTempo(registro.duracao_extra_seg)}`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setMostrarHistorico(true)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <Clock className="w-3 h-3" /> Historico de Horas Extras
      </button>

      {mostrarHistorico && (
        <HistoricoHoraExtra
          maquina={maquina}
          setor={setor}
          filialAtiva={filialAtiva}
          onClose={() => setMostrarHistorico(false)}
        />
      )}
    </>
  );
}