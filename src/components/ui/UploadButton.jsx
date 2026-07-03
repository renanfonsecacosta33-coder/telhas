import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Camera, Image as ImageIcon, ScanLine, Loader2 } from "lucide-react";
import { abrirAdobeScan } from "@/lib/adobeScan";

/**
 * Botão único de upload que abre um bottom sheet com 3 opções:
 * - Câmera (tira foto direto)
 * - Seletor de mídia (galeria/arquivos)
 * - Adobe Scan (abre o app Adobe Scan)
 *
 * Substitui os grupos de 3 botões (anexar + câmera + scan) por um único botão.
 *
 * Props:
 * - label: texto do botão
 * - icon: ícone lucide (opcional, padrão Paperclip)
 * - cameraRef: ref do input[type=file][capture=environment]
 * - fileRef: ref do input[type=file] (sem capture)
 * - uploading: boolean (mostra spinner)
 * - variant/size/classLoader: repassados ao Button
 */
export default function UploadButton({
  label = "Anexar",
  icon: Icon = Camera,
  cameraRef,
  fileRef,
  uploading = false,
  variant = "outline",
  size = "sm",
  className = "",
  disabled = false,
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const handleSelect = (source) => {
    setSheetOpen(false);
    if (source === "camera" && cameraRef?.current) {
      cameraRef.current.value = "";
      cameraRef.current.click();
    } else if (source === "gallery" && fileRef?.current) {
      fileRef.current.value = "";
      fileRef.current.click();
    } else if (source === "scan") {
      abrirAdobeScan(fileRef);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={`flex-1 border-dashed border-2 h-10 text-xs gap-1.5 ${className}`}
        onClick={() => setSheetOpen(true)}
        disabled={uploading || disabled}
      >
        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
        {uploading ? "Enviando..." : label}
      </Button>

      <Drawer open={sheetOpen} onOpenChange={setSheetOpen}>
        <DrawerContent className="rounded-t-2xl" shouldScaleBackground={false}>
          <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-muted" />
          <div className="px-4 pb-6 pt-3">
            <p className="text-center text-sm font-medium text-muted-foreground mb-4">
              Escolha a fonte
            </p>
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => handleSelect("camera")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:bg-accent hover:shadow-md active:scale-95"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <Camera className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium">Câmera</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect("gallery")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:bg-accent hover:shadow-md active:scale-95"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium">Seletor de mídia</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelect("scan")}
                className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:bg-accent hover:shadow-md active:scale-95"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600">
                  <ScanLine className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium">Adobe Scan</span>
              </button>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}