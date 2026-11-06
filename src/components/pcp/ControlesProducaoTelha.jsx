import React, { useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Play, Pause, Camera, CheckCircle2, RotateCcw, Layers } from "lucide-react";
import { format } from "date-fns";

/**
 * Controles de produção de TELHAS direto na Central PCP (exclusivo Ivaiporã).
 * O operador escolhe a bobina, inicia, pausa (setup/outro motivo) e finaliza
 * com foto obrigatória da telha pronta — sem precisar abrir o painel da máquina.
 */
export default function ControlesProducaoTelha({ op }) {
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  const [pausaOpen, setPausaOpen] = useState(false);
  const [pausaTipo, setPausaTipo] = useState("setup");
  const [pausaMotivo, setPausaMotivo] = useState("");
  const [fotoOpen, setFotoOpen] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const fotoRef = useRef(null);
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-telhas-ivaipora"],
    queryFn: async () => {
      const lista = await base44.entities.Bobina.filter({ setor: "telhas", unidade: "Ivaiporã" }, "-created_date", 300).catch(() => []);
      return (lista || []).filter(b => !b.arquivada && (b.peso_kg || 0) > 0);
    },
    staleTime: 60000,
  });

  const bobinaSel = useMemo(
    () => bobinas.find(b => b.id === op?.bobina_superior_id) || null,
    [bobinas, op?.bobina_superior_id]
  );

  if (!op) return null;

  const status = op.status || "pendente";
  const emProducao = status === "em_producao";
  const pausado = status === "pausado";

  const recarregar = () => {
    queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
    queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-pcp"] });
    queryClient.invalidateQueries({ queryKey: ["bobinas-telhas-ivaipora"] });
  };

  const atualizar = async (patch) => {
    setSalvando(true);
    try {
      await base44.entities.Pedido.update(op.id, patch);
      recarregar();
    } catch (e) {
      toast.error("Erro ao atualizar produção: " + (e?.message || ""));
    } finally {
      setSalvando(false);
    }
  };

  const tempoProducaoSeg = () => {
    let seg = op.tempo_producao_seg || 0;
    if (op.inicio_producao_ts) seg += Math.floor((agora - new Date(op.inicio_producao_ts).getTime()) / 1000);
    return Math.max(0, seg);
  };

  const tempoPausaSeg = () => {
    let seg = op.tempo_pausa_seg || 0;
    if (op.inicio_pausa_ts) seg += Math.floor((agora - new Date(op.inicio_pausa_ts).getTime()) / 1000);
    return Math.max(0, seg);
  };

  const hhmmss = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const seg = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(seg).padStart(2, "0")}`;
  };

  const selecionarBobina = (id) => {
    const b = bobinas.find(x => x.id === id);
    if (!b) return;
    atualizar({
      bobina_superior_id: b.id,
      bobina_superior: `${b.codigo || ""} ${b.cor || ""} ${b.chapa || ""}`.trim(),
    });
  };

  const iniciar = () => {
    if (!op.bobina_superior_id) {
      toast.error("Escolha a bobina antes de iniciar a produção.");
      return;
    }
    atualizar({ status: "em_producao", inicio_producao_ts: new Date().toISOString() });
  };

  const confirmarPausa = () => {
    const motivo = pausaTipo === "setup" ? "setup" : (pausaMotivo.trim() || "pausa");
    atualizar({
      status: "pausado",
      tempo_producao_seg: tempoProducaoSeg(),
      inicio_producao_ts: null,
      inicio_pausa_ts: new Date().toISOString(),
      motivo_pausa: motivo,
    });
    setPausaOpen(false);
    setPausaMotivo("");
    setPausaTipo("setup");
  };

  const retomar = () => {
    let pausaSeg = op.tempo_pausa_seg || 0;
    let setupSeg = op.tempo_setup_seg || 0;
    if (op.inicio_pausa_ts) {
      const delta = Math.floor((agora - new Date(op.inicio_pausa_ts).getTime()) / 1000);
      if (op.motivo_pausa === "setup") setupSeg += delta;
      else pausaSeg += delta;
    }
    let historico = [];
    try { historico = JSON.parse(op.historico_pausas || "[]"); } catch { historico = []; }
    historico.push({
      motivo: op.motivo_pausa,
      inicio: op.inicio_pausa_ts,
      fim: new Date().toISOString(),
      segundos: Math.floor((agora - new Date(op.inicio_pausa_ts || agora).getTime()) / 1000),
    });
    atualizar({
      status: "em_producao",
      tempo_pausa_seg: pausaSeg,
      tempo_setup_seg: setupSeg,
      inicio_pausa_ts: null,
      motivo_pausa: null,
      historico_pausas: JSON.stringify(historico),
      inicio_producao_ts: new Date().toISOString(),
    });
  };

  const metragemTotalPedido = () => {
    let variacoes = [];
    try { variacoes = JSON.parse(op.variacoes_telhas || "[]"); } catch { variacoes = []; }
    if (variacoes.length > 0) {
      return variacoes.reduce((s, v) => s + (Number(v.qty) || 0) * (Number(v.mm) || 0), 0) / 1000;
    }
    return (Number(op.metros) || 0) * ((Number(op.metragem_mm) || 0) / 1000);
  };

  const baixarBobina = async (metragemReal) => {
    if (!op.bobina_superior_id) return;
    const metragemTotal = metragemTotalPedido();
    const razao = metragemTotal > 0 ? metragemReal / metragemTotal : 1;
    const kgReal = (Number(op.kg_superior) || 0) * razao;
    try {
      const lista = await base44.entities.Bobina.filter({ id: op.bobina_superior_id });
      const bob = (lista || [])[0];
      if (!bob) return;
      await base44.entities.Bobina.update(bob.id, {
        peso_kg: Math.max(0, (bob.peso_kg || 0) - kgReal),
        ...(bob.metragem_restante != null ? { metragem_restante: Math.max(0, bob.metragem_restante - metragemReal) } : {}),
      });
    } catch (e) {
      toast.error("Falha ao baixar a bobina: " + (e?.message || ""));
    }
  };

  const enviarFoto = async (file) => {
    if (!file) return;
    setEnviandoFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const metragemReal = metragemTotalPedido() || Number(op.metragem_planejada) || 0;
      await base44.entities.Pedido.update(op.id, {
        status: "finalizado",
        tempo_producao_seg: tempoProducaoSeg(),
        inicio_producao_ts: null,
        metragem_utilizada: metragemReal,
        data_finalizacao: format(new Date(), "yyyy-MM-dd"),
        foto_finalizacao_url: file_url,
      });
      await baixarBobina(metragemReal);
      recarregar();
      toast.success("Telha finalizada com foto registrada!");
      setFotoOpen(false);
    } catch (e) {
      toast.error("Erro ao finalizar: " + (e?.message || ""));
    } finally {
      setEnviandoFoto(false);
    }
  };

  if (status === "finalizado" || status === "cancelado") return null;

  return (
    <div
      className="mt-1 rounded-[10px] border border-[#cfe3da] dark:border-emerald-800 bg-[#f4faf7] dark:bg-emerald-950/30 px-3 py-2 flex flex-wrap items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-[#28705c] dark:text-emerald-300">
        <Layers className="w-3 h-3" /> Produção aqui
      </span>

      <Select value={op.bobina_superior_id || ""} onValueChange={selecionarBobina} disabled={emProducao || pausado || salvando}>
        <SelectTrigger className="h-7 w-[190px] text-[11px] bg-white dark:bg-slate-900">
          <SelectValue placeholder={bobinas.length ? "Escolher bobina..." : "Sem bobina em estoque"} />
        </SelectTrigger>
        <SelectContent>
          {bobinas.map(b => (
            <SelectItem key={b.id} value={b.id} className="text-xs">
              {b.codigo || "—"} · {b.cor || ""} · {b.chapa || ""} · {Math.round(b.peso_kg || 0)}kg
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {bobinaSel && (
        <span className="text-[10px] font-semibold text-[#3f5b52] dark:text-slate-300">
          {Math.round(bobinaSel.peso_kg || 0)} kg disp.
        </span>
      )}

      {!emProducao && !pausado && (
        <Button size="sm" onClick={iniciar} disabled={salvando} className="h-7 gap-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white">
          <Play className="w-3 h-3" /> Iniciar Produção
        </Button>
      )}

      {emProducao && (
        <>
          <span className="font-mono text-[11px] font-bold text-[#28705c] dark:text-emerald-300">{hhmmss(tempoProducaoSeg())}</span>
          <Button size="sm" variant="outline" onClick={() => { setPausaTipo("setup"); setPausaOpen(true); }} disabled={salvando} className="h-7 gap-1 text-[11px]">
            <Pause className="w-3 h-3" /> Pausar / Setup
          </Button>
          <Button size="sm" onClick={() => setFotoOpen(true)} disabled={salvando} className="h-7 gap-1 text-[11px] bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="w-3 h-3" /> Finalizar
          </Button>
        </>
      )}

      {pausado && (
        <>
          <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">
            Pausado{op.motivo_pausa ? ` (${op.motivo_pausa})` : ""} · {hhmmss(tempoPausaSeg())}
          </span>
          <Button size="sm" variant="outline" onClick={retomar} disabled={salvando} className="h-7 gap-1 text-[11px]">
            <RotateCcw className="w-3 h-3" /> Retomar
          </Button>
          <Button size="sm" onClick={() => setFotoOpen(true)} disabled={salvando} className="h-7 gap-1 text-[11px] bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="w-3 h-3" /> Finalizar
          </Button>
        </>
      )}

      {/* Pausa / Setup */}
      <Dialog open={pausaOpen} onOpenChange={setPausaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Pausar produção</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="grid grid-cols-2 gap-2">
              <Button variant={pausaTipo === "setup" ? "default" : "outline"} onClick={() => setPausaTipo("setup")} className="h-9 text-xs">Setup de máquina</Button>
              <Button variant={pausaTipo === "outro" ? "default" : "outline"} onClick={() => setPausaTipo("outro")} className="h-9 text-xs">Outro motivo</Button>
            </div>
            {pausaTipo === "outro" && (
              <Input value={pausaMotivo} onChange={(e) => setPausaMotivo(e.target.value)} placeholder="Motivo da pausa" className="text-sm" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPausaOpen(false)}>Cancelar</Button>
            <Button onClick={confirmarPausa}>Pausar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalizar com foto obrigatória */}
      <Dialog open={fotoOpen} onOpenChange={setFotoOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Finalizar — Foto Obrigatória</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-4 text-center space-y-3">
              <Camera className="w-10 h-10 mx-auto text-slate-500" />
              <p className="font-semibold text-sm">Tire a foto da telha pronta</p>
              <p className="text-xs text-muted-foreground">Obrigatória para registrar a conclusão</p>
              <input ref={fotoRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => enviarFoto(e.target.files?.[0])} />
              <Button onClick={() => fotoRef.current?.click()} disabled={enviandoFoto} className="gap-2">
                <Camera className="w-4 h-4" /> {enviandoFoto ? "Enviando..." : "Tirar / Enviar Foto"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFotoOpen(false)}>Cancelar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}