import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import UploadButton from "@/components/ui/UploadButton";
import {
  Pause, Square, Coffee, Camera, CheckCircle2, AlertCircle, Star,
  Edit3, AlertOctagon, Loader2, FileText,
} from "lucide-react";
import AproveitamentoDialog from "@/components/corte-dobra/AproveitamentoDialog";

/**
 * Pausa Dialog — motivo de pausa (setup / outro)
 */
export function PausaDialog({ open, onClose, onConfirm }) {
  const [tipo, setTipo] = useState("setup");
  const [motivo, setMotivo] = useState("");

  React.useEffect(() => {
    if (open) { setTipo("setup"); setMotivo(""); }
  }, [open]);

  const confirmar = () => {
    const m = tipo === "setup" ? "setup" : (motivo.trim() || "pausa");
    onConfirm(m);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Pausar OP</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Qual o motivo da pausa?</p>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setTipo("setup")}
              className={`border-2 rounded-xl p-4 text-center transition-all ${tipo === "setup" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
              <Square className="w-6 h-6 mx-auto mb-2 text-purple-600" />
              <p className="font-semibold text-sm">Setup de Máquina</p>
              <p className="text-xs text-muted-foreground mt-1">Ajuste, troca de chapa, etc.</p>
            </button>
            <button onClick={() => setTipo("outro")}
              className={`border-2 rounded-xl p-4 text-center transition-all ${tipo === "outro" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}>
              <Coffee className="w-6 h-6 mx-auto mb-2 text-amber-600" />
              <p className="font-semibold text-sm">Outro Motivo</p>
              <p className="text-xs text-muted-foreground mt-1">Especifique abaixo</p>
            </button>
          </div>
          {tipo === "outro" && (
            <Textarea placeholder="Descreva o motivo da pausa..." value={motivo}
              onChange={e => setMotivo(e.target.value)} className="h-20" autoFocus />
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirmar} disabled={tipo === "outro" && !motivo.trim()} className="gap-1">
            <Pause className="w-4 h-4" /> Confirmar Pausa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Finalizar Dialog — foto obrigatória (não-guilhotina)
 */
export function FinalizarFotoDialog({ open, onClose, onUpload, uploading }) {
  const fotoInputRef = React.useRef();
  const fotoScanRef = React.useRef();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Finalizar — Foto Obrigatória</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-slate-50 border border-border rounded-xl p-4 text-center space-y-3">
            <Camera className="w-10 h-10 mx-auto text-slate-500" />
            <p className="font-semibold text-sm">Tire uma foto do material produzido</p>
            <p className="text-xs text-muted-foreground">Obrigatória para registrar a conclusão da OP</p>
            <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => onUpload(e.target.files[0])} />
            <input ref={fotoScanRef} type="file" accept="image/*" className="hidden"
              onChange={e => onUpload(e.target.files[0])} />
            <UploadButton label="Tirar / Selecionar Foto" icon={Camera} cameraRef={fotoInputRef} fileRef={fotoScanRef} uploading={uploading} size="default" variant="default" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Modificação de Blank Dialog (Guilhotina) — repassa OBD para a dobra
 */
export function ModificacaoBlankDialog({ open, onClose, onConfirm }) {
  const [modBlank, setModBlank] = useState(false);
  const [descricao, setDescricao] = useState("");

  React.useEffect(() => {
    if (open) { setModBlank(false); setDescricao(""); }
  }, [open]);

  const confirmar = () => {
    onConfirm(modBlank, descricao);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Edit3 className="w-5 h-5 text-amber-500" /> Modificação no Blank?</DialogTitle>
          <DialogDescription>
            Você fez alguma modificação no blank ou na peça durante o corte?
            Esta informação será repassada como <strong className="text-foreground">OBD (Obs. de Dobra)</strong> para a dobradeira.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setModBlank(false)}
              className={`border-2 rounded-xl p-4 text-center transition-all ${!modBlank ? "border-green-500 bg-green-50" : "border-border hover:border-green-300"}`}>
              <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-green-600" />
              <p className="font-semibold text-sm">Não</p>
              <p className="text-xs text-muted-foreground mt-0.5">Sem modificação</p>
            </button>
            <button onClick={() => setModBlank(true)}
              className={`border-2 rounded-xl p-4 text-center transition-all ${modBlank ? "border-amber-500 bg-amber-50" : "border-border hover:border-amber-300"}`}>
              <Edit3 className="w-6 h-6 mx-auto mb-2 text-amber-600" />
              <p className="font-semibold text-sm">Sim</p>
              <p className="text-xs text-muted-foreground mt-0.5">Houve modificação</p>
            </button>
          </div>
          {modBlank && (
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Descreva a modificação (OBD)</Label>
              <Textarea value={descricao} onChange={e => setDescricao(e.target.value)}
                placeholder="Ex: Ajustei o blank em 5mm na lateral direita..." rows={3} className="resize-none" />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirmar} disabled={modBlank && !descricao.trim()} className="bg-green-600 hover:bg-green-700 gap-2">
            <CheckCircle2 className="w-4 h-4" /> Confirmar Finalização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Bloqueio Dialog — já existe OP em andamento na máquina
 */
export function BloqueioDialog({ open, onClose, ordemBloqueante, isGestor, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>⚠️ OP em Andamento</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Já existe uma OP em andamento nesta máquina:</p>
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
            <p className="font-semibold text-amber-900">{ordemBloqueante?.tipo_peca || ordemBloqueante?.chapa_descricao || "OP"}</p>
            {ordemBloqueante?.numero_pedido && <p className="text-xs text-amber-700">Pedido: {ordemBloqueante.numero_pedido}</p>}
            {ordemBloqueante?.cliente && <p className="text-xs text-amber-700">Cliente: {ordemBloqueante.cliente}</p>}
            <p className="text-xs text-amber-700 mt-1">Status: {ordemBloqueante?.status === "em_producao" ? "Em produção" : "Pausado"}</p>
          </div>
          <p className="text-xs text-muted-foreground">Iniciar outra OP simultaneamente pode causar problemas de controle. Deseja continuar mesmo assim?</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {isGestor && <Button className="bg-amber-500 hover:bg-amber-600" onClick={onConfirm}>Iniciar mesmo assim</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Prioridade Dialog — existe OP prioritária pendente
 */
export function PrioridadeDialog({ open, onClose, ordemPrioritaria, isGestor, onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Star className="w-5 h-5 text-amber-500 fill-amber-500" /> OP Prioritária Pendente</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Existe uma OP marcada como <strong className="text-amber-600">prioritária</strong> nesta máquina que ainda não foi finalizada:</p>
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
            <p className="font-semibold text-amber-900">{ordemPrioritaria?.tipo_peca || ordemPrioritaria?.chapa_descricao || "OP"}</p>
            {ordemPrioritaria?.numero_pedido && <p className="text-xs text-amber-700">Pedido: {ordemPrioritaria.numero_pedido}</p>}
            {ordemPrioritaria?.cliente && <p className="text-xs text-amber-700">Cliente: {ordemPrioritaria.cliente}</p>}
          </div>
          {isGestor
            ? <p className="text-xs text-muted-foreground">Como gestor, você pode autorizar o início desta OP mesmo com a prioritária pendente.</p>
            : <p className="text-xs text-red-600 font-semibold">⚠️ Apenas o gestor pode autorizar o início de uma OP não prioritária enquanto existe uma prioritária pendente.</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          {isGestor && <Button className="bg-amber-500 hover:bg-amber-600 gap-1" onClick={onConfirm}><Star className="w-4 h-4" /> Autorizar início</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sucata / Parada Dialog — registra parada não programada ou perda de material
 */
export function SucataDialog({ open, onClose, onConfirm }) {
  const [motivo, setMotivo] = useState("");
  const [quantidade, setQuantidade] = useState("");

  React.useEffect(() => {
    if (open) { setMotivo(""); setQuantidade(""); }
  }, [open]);

  const confirmar = () => {
    onConfirm(motivo.trim() || "parada não programada", Number(quantidade) || 0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><AlertOctagon className="w-5 h-5 text-red-500" /> Parada / Sucata</DialogTitle>
          <DialogDescription>Registre uma parada não programada ou perda de material. Será salvo no histórico da OP.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Motivo da parada / sucata</Label>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)}
              placeholder="Ex: Material defeituoso, erro de corte, quebra de ferramenta..." rows={3} className="resize-none" autoFocus />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Quantidade de peças perdidas (opcional)</Label>
            <input type="number" min="0" value={quantidade} onChange={e => setQuantidade(e.target.value)}
              placeholder="0" className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirmar} disabled={!motivo.trim()} className="bg-red-600 hover:bg-red-700 gap-2">
            <AlertOctagon className="w-4 h-4" /> Registrar Parada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Wrapper que renderiza o AproveitamentoDialog (guilhotina)
 */
export function AproveitamentoWrapper({ open, onClose, ordem, espessura, onConfirm }) {
  return (
    <AproveitamentoDialog open={open} onClose={onClose} ordemGuilhotina={ordem} espessuraBobina={espessura} onConfirm={onConfirm} />
  );
}