import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Camera, RefreshCw, X, Sparkles, Scan, FileText, CheckCircle2, AlertCircle, Loader2, Upload
} from "lucide-react";

export default function ScannerCameraModal({ open, onOpenChange, onScanSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // "environment" (traseira) | "user" (frontal)
  const [hasCamera, setHasCamera] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  // Iniciar câmera ao abrir modal
  useEffect(() => {
    if (open) {
      startCamera(facingMode);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open, facingMode]);

  const startCamera = async (mode) => {
    stopCamera();
    try {
      const constraints = {
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn("Câmera ao vivo indisponível ou permissão negada:", err);
      setHasCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleCameraMode = () => {
    setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
  };

  // Capturar quadro do vídeo e escanear
  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsScanning(true);
    setScanStatus("Capturando imagem da Nota Fiscal...");

    const video = videoRef.current;
    const MAX_DIM = 1280;
    let w = video.videoWidth || 1280;
    let h = video.videoHeight || 720;
    if (w > MAX_DIM || h > MAX_DIM) {
      if (w > h) { h = Math.round((h * MAX_DIM) / w); w = MAX_DIM; }
      else { w = Math.round((w * MAX_DIM) / h); h = MAX_DIM; }
    }
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error("Erro ao capturar imagem da câmera.");
        setIsScanning(false);
        return;
      }
      const file = new File([blob], `nf_scan_${Date.now()}.jpg`, { type: "image/jpeg" });
      
      setScanStatus("IA lendo dados em alta velocidade...");
      try {
        await onScanSuccess(file);
        stopCamera();
        onOpenChange(false);
      } catch (err) {
        toast.error("Erro no escaneamento com IA: " + (err?.message || "Tente novamente"));
      } finally {
        setIsScanning(false);
      }
    }, "image/jpeg", 0.75);
  };

  // Fallback upload se a câmera ao vivo não for suportada
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsScanning(true);
    setScanStatus("IA analisando arquivo da NF...");
    try {
      await onScanSuccess(file);
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro no escaneamento: " + (err?.message || "Tente novamente"));
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden bg-slate-950 text-white border-slate-800">
        {/* Header do Scanner */}
        <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-teal-500/20 text-teal-400">
              <Scan className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-sm flex items-center gap-1.5 text-white">
                Scanner IA de Nota Fiscal <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
              </h3>
              <p className="text-xs text-slate-400">Posicione a NF inteira dentro do quadro demarcado</p>
            </div>
          </div>
          <button onClick={() => onOpenChange(false)} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Viewport da Câmera com Efeitos IA */}
        <div className="relative aspect-[4/3] bg-black overflow-hidden flex items-center justify-center">
          {hasCamera ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="text-center p-6 space-y-3">
              <AlertCircle className="w-10 h-10 mx-auto text-amber-400" />
              <p className="text-sm font-semibold">Câmera ao vivo não detectada ou permissão negada</p>
              <p className="text-xs text-slate-400">Você pode carregar uma foto ou arquivo PDF da NF normalmente:</p>
              <Button
                type="button"
                variant="outline"
                className="gap-2 border-teal-500 text-teal-400 hover:bg-teal-500/20"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-4 h-4" /> Selecionar Foto / PDF da NF
              </Button>
            </div>
          )}

          {/* Overlay da Moldura de Escaneamento Inteligente (Estilo Document Scanner) */}
          {hasCamera && (
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-6">
              {/* Moldura de corte inteligente */}
              <div className="relative w-full h-full border-2 border-teal-400/40 rounded-2xl overflow-hidden shadow-[0_0_50px_rgba(20,184,166,0.2)]">
                {/* Cantoneiras HUD */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-teal-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-teal-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-teal-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-teal-400 rounded-br-lg" />

                {/* Laser de Leitura Animado */}
                <div className="w-full h-1 bg-gradient-to-r from-transparent via-teal-400 to-transparent shadow-[0_0_15px_#2dd4bf] animate-[scan_2.5s_ease-in-out_infinite]" />

                {/* Grid Guia */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 pointer-events-none">
                  <div className="border-r border-b border-teal-300" />
                  <div className="border-r border-b border-teal-300" />
                  <div className="border-b border-teal-300" />
                  <div className="border-r border-b border-teal-300" />
                  <div className="border-r border-b border-teal-300" />
                  <div className="border-b border-teal-300" />
                  <div className="border-r border-teal-300" />
                  <div className="border-r border-teal-300" />
                  <div />
                </div>

                {/* Badge Central Informativo */}
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full text-[11px] font-semibold text-teal-300 border border-teal-500/30 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Enquadre a Nota Fiscal aqui
                </div>
              </div>
            </div>
          )}

          {/* Loader de Processamento IA */}
          {isScanning && (
            <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6 z-20 space-y-3">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-teal-500/30 border-t-teal-400 animate-spin" />
                <Sparkles className="w-6 h-6 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="font-bold text-base text-white">{scanStatus}</p>
              <p className="text-xs text-teal-300">Identificando CNPJ, Nº da Nota, Pesos e Lista de Produtos...</p>
            </div>
          )}
        </div>

        {/* Hidden Canvas & File Input */}
        <canvas ref={canvasRef} className="hidden" />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.pdf"
          className="hidden"
          onChange={e => handleFileUpload(e.target.files?.[0])}
        />

        {/* Rodapé de Controles da Câmera */}
        <div className="p-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-300 hover:text-white hover:bg-slate-800 gap-1.5"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" /> Arquivo / PDF
          </Button>

          {hasCamera && (
            <Button
              type="button"
              onClick={captureFrame}
              disabled={isScanning}
              className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-extrabold px-6 py-5 rounded-xl shadow-lg shadow-teal-500/25 gap-2 text-sm"
            >
              {isScanning ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5" /> ESCANEAR COM IA
                </>
              )}
            </Button>
          )}

          {hasCamera && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800"
              onClick={toggleCameraMode}
              title="Alternar Câmera"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
