import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { playFinishSound, speakOpFinalizada } from "@/lib/sounds";
import { useFilial } from "@/contexts/FilialContext";
import PopupDobradeira from "./PopupDobradeira";

const GESTOR_ROLES = ["admin", "super_admin", "encarregado"];

export default function AlertBellCD({ user }) {
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();
  const [popupOpen, setPopupOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const prevFinalizedMaqRef = useRef(null);
  const prevFinalizedDesbobRef = useRef(null);
  const prevPendingCountRef = useRef(0);

  const isGestor = GESTOR_ROLES.includes(user?.role) || user?.full_name?.toLowerCase().includes("hudson");

  const { data: ordensMaquina = [] } = useQuery({
    queryKey: ["alert-ordens-maquina", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva }, "-data", 500),
    refetchInterval: 10000,
    enabled: !!isGestor,
  });

  const { data: ordensDesbob = [] } = useQuery({
    queryKey: ["alert-ordens-desbob", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva }, "-data", 500),
    refetchInterval: 10000,
    enabled: !!isGestor,
  });

  // Detectar finalizações nas máquinas CD → som suave + toast
  useEffect(() => {
    if (!isGestor || !ordensMaquina.length) return;
    const finalized = ordensMaquina.filter(o => o.status === "finalizado");
    const finalizedIds = new Set(finalized.map(o => o.id));
    const prev = prevFinalizedMaqRef.current;
    if (prev !== null) {
      const newOnes = finalized.filter(o => !prev.has(o.id));
      if (newOnes.length > 0) {
        playFinishSound();
        newOnes.forEach((o, i) => {
          setTimeout(() => speakOpFinalizada(o.maquina, o.numero_pedido || o.id?.slice(-4)), i * 3500);
          toast.success(`✅ OP Finalizada: ${o.maquina} — ${o.tipo_peca || ""}${o.numero_pedido ? ` (Pedido ${o.numero_pedido})` : ""}`, { duration: 6000 });
        });
      }
    }
    prevFinalizedMaqRef.current = finalizedIds;
  }, [ordensMaquina, isGestor]);

  // Detectar finalizações na Desbobinadeira → som suave + toast
  useEffect(() => {
    if (!isGestor || !ordensDesbob.length) return;
    const finalized = ordensDesbob.filter(o => o.status === "finalizado");
    const finalizedIds = new Set(finalized.map(o => o.id));
    const prev = prevFinalizedDesbobRef.current;
    if (prev !== null) {
      const newOnes = finalized.filter(o => !prev.has(o.id));
      if (newOnes.length > 0) {
        playFinishSound();
        newOnes.forEach((o, i) => {
          setTimeout(() => speakOpFinalizada("Desbobinadeira", o.numero_pedido || o.id?.slice(-4)), i * 3500);
          toast.success(`✅ Desbobinadeira Finalizada: ${o.bobina_descricao || ""}${o.numero_pedido ? ` (Pedido ${o.numero_pedido})` : ""}`, { duration: 6000 });
        });
      }
    }
    prevFinalizedDesbobRef.current = finalizedIds;
  }, [ordensDesbob, isGestor]);

  // CORTE 3M/6M finalizado sem dobra vinculada → pendente atribuição
  const pendingDobradeira = useMemo(() => {
    const corteFinalizadas = ordensMaquina.filter(o =>
      (o.maquina === "CORTE 3M" || o.maquina === "CORTE 6M") && o.status === "finalizado"
    );
    const dobraCorteIds = new Set(
      ordensMaquina.filter(o => o.ordem_corte_id).map(o => o.ordem_corte_id)
    );
    return corteFinalizadas.filter(o => !dobraCorteIds.has(o.id));
  }, [ordensMaquina]);

  // Abrir popup automaticamente quando novas OPs precisam atribuição
  useEffect(() => {
    if (pendingDobradeira.length > prevPendingCountRef.current) {
      setPopupOpen(true);
      setMinimized(false);
    }
    prevPendingCountRef.current = pendingDobradeira.length;
  }, [pendingDobradeira.length]);

  if (!isGestor) return null;

  const pendingCount = pendingDobradeira.length;

  return (
    <>
      <button
        onClick={() => { setPopupOpen(true); setMinimized(false); }}
        className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
        title="Alertas de produção"
      >
        <Bell className={`w-4 h-4 ${pendingCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
        {pendingCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
            {pendingCount}
          </span>
        )}
      </button>

      {/* Badge vermelho flutuante quando minimizado */}
      {minimized && pendingCount > 0 && (
        <button
          onClick={() => { setMinimized(false); setPopupOpen(true); }}
          className="fixed top-16 right-4 z-50 bg-red-500 text-white rounded-full px-4 py-2.5 shadow-lg flex items-center gap-2 animate-pulse hover:bg-red-600 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="text-sm font-bold">{pendingCount} OP(s) aguardando dobradeira</span>
        </button>
      )}

      <PopupDobradeira
        items={pendingDobradeira}
        open={popupOpen && pendingCount > 0}
        onClose={() => setPopupOpen(false)}
        onMinimize={() => { setMinimized(true); setPopupOpen(false); }}
        onAssigned={() => {
          queryClient.invalidateQueries({ queryKey: ["alert-ordens-maquina"] });
          queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
        }}
      />
    </>
  );
}