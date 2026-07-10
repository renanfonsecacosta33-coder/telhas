import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { playFinishSound, speakOpFinalizada, playMaterialDisponivelSound, speakMaterialDisponivel } from "@/lib/sounds";
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
          const msg = `Chegou material de ${esp}${cor ? " " + cor : ""}. ${matchingOps.length} OP(s) aguardando liberação!`;
          playMaterialDisponivelSound();
          speakMaterialDisponivel("Desbobinadeira");
          setMaterialAlerts(prev => [...prev, { id: Date.now() + Math.random(), message: msg, espessura: esp, cor, count: matchingOps.length, tipo: "bobina" }]);
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
          const msg = `Chegou chapa de ${esp}. ${matchingOps.length} OP(s) aguardando liberação!`;
          playMaterialDisponivelSound();
          speakMaterialDisponivel("Corte e Dobra");
          setMaterialAlerts(prev => [...prev, { id: Date.now() + Math.random(), message: msg, espessura: esp, cor: "", count: matchingOps.length, tipo: "chapa" }]);
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

      {/* POPUP PROMINENTE — Material disponível */}
      {materialAlerts.length > 0 && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50" onClick={() => setMaterialAlerts([])}>
          <div
            className="relative bg-card border-2 border-green-500 rounded-2xl shadow-2xl p-6 w-[90vw] max-w-md animate-in zoom-in-95 duration-300"
            onClick={e => e.stopPropagation()}
          >
            {/* Barra superior colorida */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-green-500 to-emerald-600 rounded-t-2xl" />

            <div className="flex flex-col items-center text-center gap-3 pt-2">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center animate-pulse">
                <PackageCheck className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground">MATERIAL DISPONÍVEL!</h3>
              <p className="text-sm text-muted-foreground">
                Foram detectados {materialAlerts.length} alerta(s) de material que chegou ao estoque
              </p>

              <div className="w-full space-y-2 mt-2">
                {materialAlerts.map(a => (
                  <div key={a.id} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg p-3 text-left">
                    <PackageCheck className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">{a.message}</p>
                      <p className="text-xs text-muted-foreground">{a.count} OP(s) podem ser liberadas</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 w-full mt-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setMaterialAlerts([])}
                >
                  Fechar
                </Button>
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => {
                    setMaterialAlerts([]);
                    window.location.href = "/corte-dobra/producao";
                  }}
                >
                  Ver OPs
                </Button>
              </div>
            </div>
          </div>
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