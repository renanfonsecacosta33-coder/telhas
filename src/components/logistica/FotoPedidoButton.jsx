import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, Eye, Plus, X, Loader2, Image as ImageIcon, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ImageViewer from "@/components/ui/ImageViewer";
import SmartImage from "@/components/ui/SmartImage";
import { comprimirImagemParaUpload } from "@/lib/compressImage";

export default function FotoPedidoButton({ rotaId, numeroPedido, cliente, fotosPedidosJson }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");
  const [uploading, setUploading] = useState(false);

  const cameraInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // Mapa de todas as fotos por pedido
  const fotosMapa = (() => {
    try {
      return JSON.parse(fotosPedidosJson || "{}");
    } catch {
      return {};
    }
  })();

  const chave = String(numeroPedido || "").trim();
  const fotosDoPedido = fotosMapa[chave] || [];

  const salvarFotos = async (novasFotos) => {
    const mapaAtualizado = { ...fotosMapa, [chave]: novasFotos };
    await base44.entities.RotaEntrega.update(rotaId, {
      fotos_pedidos_json: JSON.stringify(mapaAtualizado),
    });
    queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
    queryClient.invalidateQueries({ queryKey: ["rotas-arquivadas"] });
  };

  const handleUpload = async (file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido.");
      return;
    }

    setUploading(true);
    try {
      const fileOtimizado = await comprimirImagemParaUpload(file);
      const { file_url } = await base44.integrations.Core.UploadFile({ file: fileOtimizado });
      const agora = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
      const novaFoto = {
        url: file_url,
        nome: file.name,
        data: agora,
        numero_pedido: chave,
      };
      const listaAtualizada = [...fotosDoPedido, novaFoto];
      await salvarFotos(listaAtualizada);
      toast.success(`Foto anexada ao pedido #${chave}!`);
    } catch (e) {
      toast.error("Erro ao enviar foto: " + (e?.message || ""));
    } finally {
      setUploading(false);
    }
  };

  const removerFoto = async (idx) => {
    const listaAtualizada = fotosDoPedido.filter((_, i) => i !== idx);
    await salvarFotos(listaAtualizada);
    toast.info("Foto removida.");
  };

  const fotoPrincipal = fotosDoPedido[fotosDoPedido.length - 1];

  return (
    <>
      <div className="inline-flex items-center gap-1">
        {fotosDoPedido.length === 0 ? (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground border border-border/70 transition-colors cursor-pointer"
            title={`Adicionar foto do pedido #${chave}`}
          >
            <Camera className="w-3.5 h-3.5 text-primary" />
            <span>Foto</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 p-0.5 pr-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition-all cursor-pointer group"
            title={`Ver fotos do pedido #${chave} (${fotosDoPedido.length})`}
          >
            <div className="relative w-6 h-6 rounded overflow-hidden shrink-0 border border-emerald-500/40">
              <SmartImage src={fotoPrincipal.url} alt="pedido" className="w-full h-full" clickable={false} />
            </div>
            <span className="text-[11px] font-bold">
              📸 {fotosDoPedido.length} {fotosDoPedido.length === 1 ? "foto" : "fotos"}
            </span>
          </button>
        )}
      </div>

      {/* Modal de visualização e anexo de fotos do pedido */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="w-5 h-5 text-primary" />
              Fotos do Pedido #{chave}
            </DialogTitle>
            {cliente && <p className="text-xs text-muted-foreground">Cliente: <b>{cliente}</b></p>}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Galeria de fotos deste pedido */}
            {fotosDoPedido.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-border rounded-xl bg-muted/20">
                <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-xs text-muted-foreground font-medium">
                  Nenhuma foto registrada para este pedido ainda.
                </p>
                <p className="text-[11px] text-muted-foreground/75 mt-0.5">
                  Tire fotos das peças/fardos carregados no caminhão para comprovação.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1">
                {fotosDoPedido.map((f, idx) => (
                  <div key={idx} className="relative group rounded-lg overflow-hidden border border-border bg-muted aspect-square">
                    <SmartImage src={f.url} alt={`Pedido ${chave} - foto ${idx + 1}`} className="w-full h-full" clickable={false} />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
                      <button
                        type="button"
                        onClick={() => { setViewerUrl(f.url); setViewerName(`Pedido #${chave} - Foto ${idx + 1}`); }}
                        className="p-1.5 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors"
                        title="Ver ampliada"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removerFoto(idx)}
                        className="p-1.5 rounded-full bg-red-600/80 text-white hover:bg-red-700 transition-colors"
                        title="Excluir foto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {f.data && (
                      <span className="absolute bottom-1 left-1 bg-black/70 text-white text-[9px] px-1 rounded font-mono">
                        {f.data}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Ações para tirar ou anexar foto */}
            <div className="flex gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                className="flex-1 gap-2"
                onClick={() => cameraInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                Tirar Foto (Câmera)
              </Button>

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Plus className="w-4 h-4" />
                Galeria
              </Button>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  handleUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  handleUpload(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ImageViewer url={viewerUrl} name={viewerName} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
    </>
  );
}
