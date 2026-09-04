import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, CheckCircle2, Loader2, Trash2, Ruler, AlertCircle, Eye } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function FinalizarItemVariacaoDialog({
  open,
  onClose,
  item,
  itemIndex = 0,
  pedido,
  onConfirmarFinalizacao
}) {
  const [metragemReal, setMetragemReal] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [observacao, setObservacao] = useState("");
  const fileInputRef = useRef(null);

  const qty = Number(item?.qty) || 0;
  const mm = Number(item?.mm) || 0;
  const metrosPlanejados = qty > 0 && mm > 0 ? +((qty * mm) / 1000).toFixed(2) : 0;

  useEffect(() => {
    if (open && item) {
      // Se o item já tiver metragem real gravada anteriormente, usa ela; senão inicializa com o planejado
      setMetragemReal(item.metragem_real ? String(item.metragem_real) : String(metrosPlanejados));
      setFotoUrl(item.foto_item_url || "");
      setObservacao(item.observacao || "");
      setUploading(false);
    }
  }, [open, item, metrosPlanejados]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoUrl(file_url);
      toast.success("Foto do item anexada com sucesso!");
    } catch (err) {
      toast.error("Erro ao enviar foto: " + (err.message || "tente novamente"));
    } finally {
      setUploading(false);
    }
  };

  const mRealNum = Number(metragemReal) || 0;
  const diffMetros = mRealNum > 0 ? +(mRealNum - metrosPlanejados).toFixed(2) : 0;
  const podeFinalizar = mRealNum > 0 && !!fotoUrl && !uploading;

  const handleConfirmar = () => {
    if (!mRealNum || mRealNum <= 0) {
      toast.error("Informe a metragem real produzida.");
      return;
    }
    if (!fotoUrl) {
      toast.error("Tire ou anexe a foto do item produzido para continuar.");
      return;
    }
    onConfirmarFinalizacao({
      itemIndex,
      metragemReal: mRealNum,
      fotoUrl,
      observacao: observacao.trim()
    });
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md border-2 border-green-300">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100 text-green-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-800">
                Finalizar Item {itemIndex + 1} — {qty} pçs × {mm.toLocaleString("pt-BR")}mm
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Informe a metragem real tirada e anexe a foto do lote produzido
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Card Resumo do Planejado */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Item do Pedido #{pedido?.numero_pedido || ""}</span>
              <span className="font-bold text-slate-900 text-sm">{qty} peças de {(mm / 1000).toFixed(2)}m</span>
              {item.bobina_desc && (
                <span className="text-blue-600 block text-[11px] font-medium mt-0.5">
                  Bobina: {item.bobina_desc}
                </span>
              )}
            </div>
            <div className="text-right">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold">Planejado</span>
              <span className="text-base font-black text-slate-700">{metrosPlanejados.toFixed(2)}m</span>
            </div>
          </div>

          {/* Campo 1: Metragem Real Produzida */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                <Ruler className="w-3.5 h-3.5 text-primary" />
                Metragem Real Tirada (metros) *
              </Label>
              {diffMetros !== 0 && mRealNum > 0 && (
                <Badge variant="outline" className={`text-[10px] ${diffMetros > 0 ? "text-amber-600 border-amber-300" : "text-blue-600 border-blue-300"}`}>
                  {diffMetros > 0 ? `+${diffMetros}m acima` : `${diffMetros}m abaixo`}
                </Badge>
              )}
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.1"
              value={metragemReal}
              onChange={(e) => setMetragemReal(e.target.value)}
              placeholder="Ex: 20.00"
              className="text-base font-bold font-mono h-11 border-2 focus-visible:ring-green-400"
            />
            <p className="text-[11px] text-muted-foreground">
              Pré-preenchido com o cálculo planejado. Ajuste se houve sobras ou refugo.
            </p>
          </div>

          {/* Campo 2: Foto Obrigatória do Item Produzido */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
              <Camera className="w-3.5 h-3.5 text-green-600" />
              Foto do Produto Produzido *
            </Label>

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleUpload}
              className="hidden"
            />

            {!fotoUrl ? (
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all ${
                  uploading
                    ? "bg-slate-50 border-slate-300"
                    : "border-green-400 bg-green-50/50 hover:bg-green-100/50 hover:border-green-500"
                }`}
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2 py-2">
                    <Loader2 className="w-6 h-6 text-green-600 animate-spin" />
                    <span className="text-xs font-semibold text-slate-600">Enviando foto...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1.5 py-1">
                    <Camera className="w-7 h-7 text-green-600" />
                    <span className="text-xs font-bold text-green-800">
                      Tirar Foto do Lote Produzido
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Toque para abrir a câmera ou carregar da galeria
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative border-2 border-green-400 rounded-xl overflow-hidden bg-slate-900">
                <img
                  src={fotoUrl}
                  alt="Produto do Item"
                  className="w-full h-36 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end justify-between p-2.5">
                  <span className="text-xs font-bold text-white flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> Foto anexada
                  </span>
                  <div className="flex items-center gap-1.5">
                    <a
                      href={fotoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md bg-white/20 hover:bg-white/40 text-white backdrop-blur transition-all"
                      title="Ver foto ampliada"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setFotoUrl("")}
                      className="p-1.5 rounded-md bg-red-600/80 hover:bg-red-600 text-white transition-all"
                      title="Remover foto"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {!fotoUrl && (
              <p className="text-[11px] text-amber-700 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3 h-3 text-amber-600 flex-shrink-0" />
                A foto é obrigatória para conferência de acabamento e auditoria de qualidade.
              </p>
            )}
          </div>

          {/* Campo 3: Observação Opcional */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Observação do Item (Opcional)
            </Label>
            <Input
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: Emenda realizada, refugo de 0.5m, lote separado..."
              className="text-xs h-9"
            />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={!podeFinalizar}
            className={`font-bold gap-1.5 ${
              podeFinalizar
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
            onClick={handleConfirmar}
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar e Finalizar Item {itemIndex + 1}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
