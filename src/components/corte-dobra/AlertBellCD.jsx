import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, PackageCheck, MessageCircle, Layers, CheckCircle2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { playFinishSound, speakOpFinalizada, playMaterialDisponivelSound, speakMaterialDisponivel, playAlertSound } from "@/lib/sounds";
import { useFilial } from "@/contexts/FilialContext";
import PopupDobradeira from "./PopupDobradeira";
import CentralChats from "@/components/chat/CentralChats";
import { useAllUnreadCount } from "@/hooks/useUnreadMessages";

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
  const [centralChatsOpen, setCentralChatsOpen] = useState(false);
  const prevFinalizedMaqRef = useRef(null);
  const prevFinalizedDesbobRef = useRef(null);
  const prevPendingCountRef = useRef(0);
  const prevChatCountRef = useRef(0);

  const isGestor = GESTOR_ROLES.includes(user?.role) || user?.full_name?.toLowerCase().includes("hudson");

  const unreadChats = useAllUnreadCount(user);

  // Notificação sonora quando chega nova mensagem de chat
  useEffect(() => {
    if (!isGestor) return;
    if (prevChatCountRef.current !== null && unreadChats > prevChatCountRef.current) {
      playAlertSound();
      toast.info(`💬 Nova mensagem no chat!`, { duration: 4000 });
    }
    prevChatCountRef.current = unreadChats;
  }, [unreadChats, isGestor]);

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

  // ── DETECÇÃO DE MATERIAIS DISPONÍVEIS (AGRUPADOS E DEDUPLICADOS) ──
  const [bellOpen, setBellOpen] = useState(false);
  const prevMaterialKeysRef = useRef(null);

  // Agrupa os materiais em falta que agora possuem estoque compatível
  const materiaisDisponiveis = useMemo(() => {
    if (!isGestor) return [];
    const grupos = new Map();

    // 1. Bobinas disponíveis para OPs da Desbobinadeira
    opsDesbAguardando.forEach(op => {
      const opEsp = normalizeEsp(op.material_espessura);
      const opCor = (op.material_cor || "").trim().toLowerCase();

      const bobinaComp = bobinasAlert.find(b => {
        const bEsp = normalizeEsp(b.chapa) || normalizeEsp(b.espessura_utilizada);
        const bEspAlts = (b.espessura_utilizada || "").split("/").map(s => normalizeEsp(s));
        const bCor = (b.cor || "").trim().toLowerCase();
        const espMatch = bEsp === opEsp || bEspAlts.includes(opEsp);
        const corMatch = !opCor || !bCor || bCor.includes(opCor) || opCor.includes(bCor);
        return espMatch && corMatch;
      });

      if (bobinaComp) {
        const chave = `bobina_${opEsp}_${opCor}`;
        if (!grupos.has(chave)) {
          grupos.set(chave, {
            id: chave,
            tipo: "bobina",
            titulo: `Bobina ${op.material_espessura || opEsp}${op.material_cor ? ` ${op.material_cor}` : ""}`,
            subtitulo: `Bobina ${bobinaComp.codigo_bobina || bobinaComp.codigo || ""} disponível`,
            ops: [op]
          });
        } else {
          grupos.get(chave).ops.push(op);
        }
      }
    });

    // 2. Chapas disponíveis para OPs de Máquinas CD
    opsMaqAguardando.forEach(op => {
      const opEsp = normalizeEsp(op.material_espessura);

      const chapaComp = chapasAlert.find(c => {
        const cEsp = normalizeEsp(c.espessura_mm);
        const cEspBobina = normalizeEsp((c.bobina_descricao || "").match(/[\d,]+mm/)?.[0]?.replace("mm", ""));
        return cEsp === opEsp || cEspBobina === opEsp;
      });

      if (chapaComp) {
        const chave = `chapa_${opEsp}`;
        if (!grupos.has(chave)) {
          grupos.set(chave, {
            id: chave,
            tipo: "chapa",
            titulo: `Chapa de ${op.material_espessura || opEsp}mm`,
            subtitulo: `Chapas prontas no estoque`,
            ops: [op]
          });
        } else {
          grupos.get(chave).ops.push(op);
        }
      }
    });

    return Array.from(grupos.values());
  }, [opsDesbAguardando, opsMaqAguardando, bobinasAlert, chapasAlert, isGestor]);

  // Disparo de notificação não-intrusiva (som + toast) apenas para novos materiais que chegaram
  useEffect(() => {
    if (!isGestor) return;
    const chavesAtuais = new Set(materiaisDisponiveis.map(m => m.id));

    if (prevMaterialKeysRef.current !== null) {
      const novas = Array.from(chavesAtuais).filter(k => !prevMaterialKeysRef.current.has(k));
      if (novas.length > 0) {
        playMaterialDisponivelSound();
        speakMaterialDisponivel("Corte e Dobra");
        const itensNovos = materiaisDisponiveis.filter(m => novas.includes(m.id));
        itensNovos.forEach(item => {
          toast.success(`📦 Material Disponível no Estoque!`, {
            description: `${item.titulo} — ${item.ops.length} OP(s) podem ser liberadas!`,
            duration: 8000,
            action: {
              label: "Ver OPs",
              onClick: () => {
                window.location.href = "/corte-dobra/producao?tab=sem_material";
              }
            }
          });
        });
      }
    }
    prevMaterialKeysRef.current = chavesAtuais;
  }, [materiaisDisponiveis, isGestor]);

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

  if (!isGestor) return null;

  const pendingCount = pendingDobradeira.length;
  const totalAlerts = pendingCount + materiaisDisponiveis.length;

  return (
    <>
      <button
        onClick={() => setCentralChatsOpen(true)}
        className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
        title="Central de Chats"
      >
        <MessageCircle className={`w-4 h-4 ${unreadChats > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
        {unreadChats > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
            {unreadChats}
          </span>
        )}
      </button>

      <Popover open={bellOpen} onOpenChange={setBellOpen}>
        <PopoverTrigger asChild>
          <button
            className="relative p-2 rounded-lg border border-border bg-card hover:bg-muted transition-colors cursor-pointer"
            title="Alertas de Produção e Estoque"
          >
            <Bell className={`w-4 h-4 ${totalAlerts > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            {totalAlerts > 0 && (
              <span className="absolute -top-1 -right-1 bg-amber-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-pulse">
                {totalAlerts}
              </span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[340px] sm:w-[420px] p-0 shadow-2xl border border-border bg-card rounded-2xl overflow-hidden z-[100]">
          {/* Header */}
          <div className="p-3.5 bg-muted/40 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-primary" />
              <span className="font-bold text-sm text-foreground">Alertas do Corte e Dobra</span>
            </div>
            <Badge variant="outline" className={`text-xs font-semibold ${totalAlerts > 0 ? "border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40" : ""}`}>
              {totalAlerts} pendência(s)
            </Badge>
          </div>

          {/* Lista com rolagem controlada */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-border p-2 space-y-2">
            {materiaisDisponiveis.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 px-2 pt-1 flex items-center gap-1.5">
                  <PackageCheck className="w-3.5 h-3.5" />
                  Materiais Disponíveis no Estoque ({materiaisDisponiveis.length})
                </p>
                {materiaisDisponiveis.map(m => (
                  <div key={m.id} className="p-2.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{m.titulo}</p>
                      <p className="text-[11px] text-muted-foreground">{m.ops.length} OP(s) podem ser liberadas</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.ops.slice(0, 3).map(op => (
                          <span key={op.id} className="text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 px-1.5 py-0.5 rounded font-mono font-semibold">
                            {op.numero_pedido ? `#${op.numero_pedido}` : op.cliente ? op.cliente.slice(0, 12) : "OP"}
                          </span>
                        ))}
                        {m.ops.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{m.ops.length - 3} mais</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shrink-0"
                      onClick={() => {
                        setBellOpen(false);
                        window.location.href = "/corte-dobra/producao?tab=sem_material";
                      }}
                    >
                      Liberar
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {pendingDobradeira.length > 0 && (
              <div className="space-y-1.5 pt-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 px-2 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Cortes Concluídos — Vincular Dobra ({pendingDobradeira.length})
                </p>
                <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground">{pendingDobradeira.length} corte(s) finalizados</p>
                    <p className="text-[11px] text-muted-foreground">Necessitam selecionar a máquina de dobra</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-100 shrink-0 font-semibold"
                    onClick={() => {
                      setBellOpen(false);
                      setPopupOpen(true);
                    }}
                  >
                    Atribuir
                  </Button>
                </div>
              </div>
            )}

            {totalAlerts === 0 && (
              <div className="py-8 text-center text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="text-xs font-semibold text-foreground">Tudo em dia!</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Nenhum alerta de material ou máquina pendente.</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-2.5 bg-muted/30 border-t border-border flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7 text-muted-foreground hover:text-foreground"
              onClick={() => setBellOpen(false)}
            >
              Fechar
            </Button>
            <Button
              size="sm"
              className="text-xs h-7 gap-1 font-semibold"
              onClick={() => {
                setBellOpen(false);
                window.location.href = "/corte-dobra/producao";
              }}
            >
              Ir para Produção
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </PopoverContent>
      </Popover>

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

      <CentralChats user={user} open={centralChatsOpen} onOpenChange={setCentralChatsOpen} />
    </>
  );
}