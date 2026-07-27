import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Camera, RefreshCw, X, Sparkles, Scan, FileText, AlertCircle, Loader2, Upload
} from "lucide-react";

export default function ScannerCameraModal({ open, onOpenChange, onScanSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // "environment" | "user"
  const [hasCamera, setHasCamera] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  // Iniciar câmera com Foco Contínuo e Alta Resolução ao abrir
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
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          advanced: [{ focusMode: "continuous" }, { autoFocus: "continuous" }]
        }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setHasCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn("Câmera alta resolução indisponível, usando fallback:", err);
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: mode }
        });
        setStream(fallbackStream);
        setHasCamera(true);
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream;
        }
      } catch (fallbackErr) {
        console.error("Permissão de câmera negada:", fallbackErr);
        setHasCamera(false);
      }
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

  // Capturar quadro em alta resolução
  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsScanning(true);
    setScanStatus("Focando e capturando imagem da NF...");

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const w = video.videoWidth || 1920;
    const h = video.videoHeight || 1080;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(video, 0, 0, w, h);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error("Erro ao capturar imagem da câmera.");
        setIsScanning(false);
        return;
      }
      const file = new File([blob], `nf_scan_${Date.now()}.jpg`, { type: "image/jpeg" });
      
      setScanStatus("IA lendo dados e produtos da NF em alta precisão...");
      try {
        await onScanSuccess(file);
        stopCamera();
        onOpenChange(false);
      } catch (err) {
        toast.error("Erro no escaneamento com IA: " + (err?.message || "Tente novamente"));
      } finally {
        setIsScanning(false);
      }
    }, "image/jpeg", 0.92);
  };

  // Fallback upload
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

  if (!open) return null;

  // Render via React Portal direto no body para cobrir 100% da tela sem bug de posicionamento!
  return createPortal(
    <div className="fixed inset-0 z-[9999] w-screen h-screen bg-black text-white flex flex-col justify-between overflow-hidden select-none">
      
      {/* ── Top Floating HUD Bar ── */}
      <div className="absolute top-0 left-0 right-0 z-30 p-4 bg-gradient-to-b from-black/90 via-black/60 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400 border border-teal-500/30">
            <Scan className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="font-extrabold text-base flex items-center gap-1.5 text-white">
              Scanner IA Nota Fiscal <Sparkles className="w-4 h-4 text-amber-400 fill-amber-400" />
            </h3>
            <p className="text-xs text-slate-300">Aproxime e enquadre a Nota Fiscal no centro da tela</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasCamera && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-black/40 text-white hover:bg-white/20 backdrop-blur-md rounded-xl gap-1.5 text-xs"
              onClick={toggleCameraMode}
            >
              <RefreshCw className="w-4 h-4" /> Virar Câmera
            </Button>
          )}
          <button
            onClick={() => onOpenChange(false)}
            className="p-2.5 rounded-full bg-black/50 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* ── Main Full-Bleed Camera Viewport ── */}
      <div className="relative w-full h-full bg-black flex items-center justify-center overflow-hidden">
        {hasCamera ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-center p-8 space-y-4 max-w-md z-30">
            <AlertCircle className="w-12 h-12 mx-auto text-amber-400" />
            <p className="text-base font-bold">Câmera ao vivo não disponível no navegador</p>
            <p className="text-xs text-slate-400">Você pode carregar uma foto da galeria ou PDF da Nota Fiscal:</p>
            <Button
              type="button"
              className="gap-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-6 py-3 rounded-xl"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4" /> Selecionar Foto / PDF da NF
            </Button>
          </div>
        )}

        {/* ── Moldura Guia de Documento (Document Scanner Frame) ── */}
        {hasCamera && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 sm:p-10 z-20">
            <div className="relative w-full max-w-3xl h-[68vh] border-2 border-teal-400/60 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(20,184,166,0.35)] bg-teal-500/5">
              {/* HUD Corners */}
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-teal-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-teal-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-teal-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-teal-400 rounded-br-xl" />

              {/* Laser Animado */}
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_#34d399] animate-[scan_2.2s_ease-in-out_infinite]" />

              {/* Floating Tooltip */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-teal-300 border border-teal-500/40 shadow-lg flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" /> Mantenha a NF nítida no centro do quadro
              </div>
            </div>
          </div>
        )}

        {/* ── Overlay de Processamento da IA ── */}
        {isScanning && (
          <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-40 space-y-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-teal-500/30 border-t-teal-400 animate-spin" />
              <Sparkles className="w-8 h-8 text-amber-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="space-y-1">
              <p className="font-extrabold text-lg text-white">{scanStatus}</p>
              <p className="text-xs text-teal-300">Lendo CNPJ, Nº da Nota, Pesos e Produtos em Alta Nitidez...</p>
            </div>
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

      {/* ── Bottom Floating Shutter Deck ── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex items-center justify-between max-w-xl mx-auto pointer-events-auto">
        <Button
          type="button"
          variant="ghost"
          className="text-slate-300 hover:text-white hover:bg-white/10 rounded-xl gap-2 text-xs font-semibold"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-5 h-5 text-teal-400" /> Galeria / PDF
        </Button>

        {/* Botão de Disparo / Shutter Circular */}
        {hasCamera && (
          <button
            type="button"
            onClick={captureFrame}
            disabled={isScanning}
            className="relative group p-1.5 rounded-full border-4 border-white/90 hover:border-teal-400 transition-all hover:scale-105 active:scale-95 shadow-[0_0_35px_rgba(20,184,166,0.6)] cursor-pointer"
            title="Capturar Foto Nítida com IA"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold shadow-inner">
              {isScanning ? (
                <Loader2 className="w-8 h-8 animate-spin text-slate-950" />
              ) : (
                <Camera className="w-8 h-8 text-slate-950 group-hover:rotate-6 transition-transform" />
              )}
            </div>
          </button>
        )}

        {hasCamera && (
          <button
            type="button"
            onClick={toggleCameraMode}
            className="p-3 rounded-full bg-white/10 hover:bg-white/20 text-white backdrop-blur-md transition-colors"
            title="Virar Câmera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
