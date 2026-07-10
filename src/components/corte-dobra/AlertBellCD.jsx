import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { playFinishSound, speakOpFinalizada, playUrgentSound } from "@/lib/sounds";
import { useFilial } from "@/contexts/FilialContext";
import PopupDobradeira from "./PopupDobradeira";

const GESTOR_ROLES = ["admin", "super_admin", "encarregado"];

function normalizeEsp(val) {
  if (!val) return "";
  return String(val).replace(/\s/g, "").replace(".", ",");
}

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

  // ── Material em falta: buscar OPs aguardando material ──
  const { data: opsDesbAguardando = [] } = useQuery({
    queryKey: ["ops-desb-aguardando-material", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva, status: "aguardando_material" }, "-data", 200),
    refetchInterval: 30000,
    enabled: !!isGestor,
  });

  const { data: opsMaqAguardando = [] } = useQuery({
    queryKey: ["ops-maq-aguardando-material", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva, status: "aguardando_material" }, "-data", 200),
    refetchInterval: 30000,
    enabled: !!isGestor,
  });

  const { data: bobinasAlert = [] } = useQuery({
    queryKey: ["bobinas-alert-material", filialAtiva],
    queryFn: () => base44.entities.Bobina.filter({ setor: "corte_dobra", arquivada: false, unidade: filialAtiva }),
    refetchInterval: 30000,
    enabled: !!isGestor,
  });

  const { data: chapasAlert = [] } = useQuery({
    queryKey: ["chapas-alert-material", filialAtiva],
    queryFn: () => base44.entities.ChapaCD.filter({ unidade: filialAtiva }),
    refetchInterval: 30000,
    enabled: !!isGestor,
  });

  // Detectar chegada de novo material e verificar OPs aguardando
  const prevBobinaCountRef = useRef(null);
  const prevChapaCountRef = useRef(null);
  const [materialAlerts, setMaterialAlerts] = useState([]);

  useEffect(() => {
    if (!isGestor) return;

    // Verificar novas bobinas
    if (prevBobinaCountRef.current !== null && bobinasAlert.length > prevBobinaCountRef.current) {
      const novasBobinas = bobinasAlert.slice(0, bobinasAlert.length - prevBobinaCountRef.current);
      novasBobinas.forEach(b => {
        const bEsp = normalizeEsp(b.chapa) || normalizeEsp(b.espessura_utilizada);
        const bEspAlts = (b.espessura_utilizada || "").split("/").map(s => normalizeEsp(s));
        const bCor = (b.cor || "").trim().toLowerCase();

        const matchingOps = opsDesbAguardando.filter(op => {
          const opEsp = normalizeEsp(op.material_espessura);
          const opCor = (op.material_cor || "").trim().toLowerCase();
          const espMatch = bEsp === opEsp || bEspAlts.includes(opEsp);
          const corMatch = !opCor || !bCor || bCor.includes(opCor) || opCor.includes(bCor);
          return espMatch && corMatch;
        });

        if (matchingOps.length > 0) {
          const esp = bEsp || b.espessura_utilizada || "?";
          const cor = b.cor || "";
          const msg = `🔔 Chegou material de ${esp} ${cor}. Existem ${matchingOps.length} OP(s) aguardando liberação!`;
          playUrgentSound();
          toast.success(msg, { duration: 10000 });
          setMaterialAlerts(prev => [...prev, { id: Date.now() + Math.random(), message: msg, espessura: esp, cor, count: matchingOps.length }]);
        }
      });
    }
    prevBobinaCountRef.current = bobinasAlert.length;

    // Verificar novas chapas
    if (prevChapaCountRef.current !== null && chapasAlert.length > prevChapaCountRef.current) {
      const novasChapas = chapasAlert.slice(0, chapasAlert.length - prevChapaCountRef.current);
      novasChapas.forEach(c => {
        const cEsp = normalizeEsp(c.espessura_mm);
        const cEspBobina = normalizeEsp((c.bobina_descricao || "").match(/[\d,]+mm/)?.[0]?.replace("mm", ""));

        const matchingOps = opsMaqAguardando.filter(op => {
          const opEsp = normalizeEsp(op.material_espessura);
          return cEsp === opEsp || cEspBobina === opEsp;
        });

        if (matchingOps.length > 0) {
          const esp = cEsp || c.espessura_mm || "?";
          const msg = `🔔 Chegou chapa de ${esp}. Existem ${matchingOps.length} OP(s) aguardando liberação!`;
          playUrgentSound();
          toast.success(msg, { duration: 10000 });
          setMaterialAlerts(prev => [...prev, { id: Date.now() + Math.random(), message: msg, espessura: esp, cor: "", count: matchingOps.length }]);
        }
      });
    }
    prevChapaCountRef.current = chapasAlert.length;
  }, [bobinasAlert.length, chapasAlert.length, opsDesbAguardando, opsMaqAguardando, isGestor]);

  // Total de OPs aguardando material (para o badge)
  const totalAguardandoMaterial = opsDesbAguardando.length + opsMaqAguardando.length;

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
  const totalAlerts = pendingCount + materialAlerts.length;

  return (
    <>
      <button
        onClick={() => {
          setPopupOpen(true);
          setMinimized(false);
          if (materialAlerts.length > 0) {
            setMaterialAlerts([]);
          }
        }}
        className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
        title="Alertas de produção"
      >
        <Bell className={`w-4 h-4 ${totalAlerts > 0 ? "text-red-500" : "text-muted-foreground"}`} />
        {totalAlerts > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
            {totalAlerts}
          </span>
        )}
      </button>

      {/* Pop-up de alertas de material */}
      {materialAlerts.length > 0 && !popupOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-card border border-green-400 rounded-lg shadow-xl p-3 w-72 space-y-2">
          {materialAlerts.map(a => (
            <div key={a.id} className="flex items-start gap-2 text-xs">
              <PackageCheck className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-foreground">{a.message}</p>
            </div>
          ))}
          <button onClick={() => setMaterialAlerts([])} className="text-xs text-muted-foreground hover:text-foreground">Fechar</button>
        </div>
      )}

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