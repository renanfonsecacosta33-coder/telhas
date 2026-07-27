import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Camera, RefreshCw, X, Sparkles, Scan, FileText, AlertCircle, Loader2, Upload, Zap, Eye
} from "lucide-react";

export default function ScannerCameraModal({ open, onOpenChange, onScanSuccess }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const nativeCamRef = useRef(null);

  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState("environment"); // "environment" | "user"
  const [hasCamera, setHasCamera] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState(null);

  // Enumerar câmeras disponíveis ao abrir
  useEffect(() => {
    if (open) {
      enumerateCameras();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open]);

  // Iniciar câmera quando deviceId ou facingMode mudar
  useEffect(() => {
    if (open) {
      startCamera(facingMode, selectedDeviceId);
    }
  }, [open, facingMode, selectedDeviceId]);

  const enumerateCameras = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter(d => d.kind === "videoinput");
      setVideoDevices(videoInputs);
      
      // Tentar encontrar câmera traseira principal (back/environment)
      const backCam = videoInputs.find(d => 
        d.label.toLowerCase().includes("back") || 
        d.label.toLowerCase().includes("traseira") ||
        d.label.toLowerCase().includes("rear") ||
        d.label.toLowerCase().includes("0")
      );
      if (backCam) {
        setSelectedDeviceId(backCam.deviceId);
      }
    } catch (e) {
      console.warn("Erro ao enumerar câmeras:", e);
    }
  };

  const startCamera = async (mode, deviceId) => {
    stopCamera();
    setTorchOn(false);

    // Tentar constraints progressivas (Da mais alta resolução para a básica)
    const constraintList = [
      // 1. Alta definição travada no deviceId ou facingMode exato
      {
        video: {
          deviceId: deviceId ? { exact: deviceId } : undefined,
          facingMode: !deviceId ? { ideal: mode } : undefined,
          width: { ideal: 2560, min: 1280 },
          height: { ideal: 1440, min: 720 },
          frameRate: { ideal: 30 }
        }
      },
      // 2. Resolução Full HD padrão
      {
        video: {
          facingMode: mode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      },
      // 3. Fallback genérico
      { video: true }
    ];

    let mediaStream = null;
    for (const constraints of constraintList) {
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (mediaStream) break;
      } catch (err) {
        console.warn("Tentativa de câmera falhou, tentando próxima:", err);
      }
    }

    if (mediaStream) {
      setStream(mediaStream);
      setHasCamera(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Verificar suporte a Lanterna / Torch
      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.torch) {
          setHasTorch(true);
        }
      }
    } else {
      setHasCamera(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && hasTorch) {
      try {
        const nextTorch = !torchOn;
        await track.applyConstraints({
          advanced: [{ torch: nextTorch }]
        });
        setTorchOn(nextTorch);
      } catch (e) {
        console.warn("Erro ao alternar lanterna:", e);
      }
    }
  };

  const toggleCameraMode = () => {
    if (videoDevices.length > 1) {
      const currentIndex = videoDevices.findIndex(d => d.deviceId === selectedDeviceId);
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      setSelectedDeviceId(videoDevices[nextIndex].deviceId);
    } else {
      setFacingMode(prev => (prev === "environment" ? "user" : "environment"));
    }
  };

  // Capturar quadro e aplicar filtro de nitidez no canvas antes de enviar
  const captureFrame = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsScanning(true);
    setScanStatus("Focando e gravando foto HD da Nota Fiscal...");

    const video = videoRef.current;
    const canvas = canvasRef.current;

    const w = video.videoWidth || 1920;
    const h = video.videoHeight || 1080;
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    
    // Desenhar o vídeo no canvas
    ctx.drawImage(video, 0, 0, w, h);

    // Otimização de contraste e nitidez visual para texto impresso
    try {
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      // Pequeno ganho de contraste para realçar letras em papel térmico/impresso
      for (let i = 0; i < data.length; i += 4) {
        // Realçar preto/branco levemente
        data[i] = data[i] < 128 ? Math.max(0, data[i] - 15) : Math.min(255, data[i] + 15);     // Red
        data[i+1] = data[i+1] < 128 ? Math.max(0, data[i+1] - 15) : Math.min(255, data[i+1] + 15); // Green
        data[i+2] = data[i+2] < 128 ? Math.max(0, data[i+2] - 15) : Math.min(255, data[i+2] + 15); // Blue
      }
      ctx.putImageData(imageData, 0, 0);
    } catch (e) {
      console.warn("Filtro de contraste ignorado:", e);
    }

    canvas.toBlob(async (blob) => {
      if (!blob) {
        toast.error("Erro ao capturar imagem da câmera.");
        setIsScanning(false);
        return;
      }
      const file = new File([blob], `nf_scan_${Date.now()}.jpg`, { type: "image/jpeg" });
      
      setScanStatus("IA lendo NF e produtos em alta definição...");
      try {
        await onScanSuccess(file);
        stopCamera();
        onOpenChange(false);
      } catch (err) {
        toast.error("Erro no escaneamento com IA: " + (err?.message || "Tente novamente"));
      } finally {
        setIsScanning(false);
      }
    }, "image/jpeg", 0.95);
  };

  // Processar arquivo selecionado
  const handleFileUpload = async (file) => {
    if (!file) return;
    setIsScanning(true);
    setScanStatus("IA analisando arquivo HD da NF...");
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
            <p className="text-xs text-slate-300">Enquadre a Nota Fiscal e mantenha a câmera estável</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className={`border-white/20 backdrop-blur-md rounded-xl gap-1.5 text-xs ${
                torchOn ? "bg-amber-400 text-slate-950 font-bold border-amber-300" : "bg-black/40 text-white hover:bg-white/20"
              }`}
              onClick={toggleTorch}
            >
              <Zap className="w-4 h-4" /> {torchOn ? "Luz Ligada" : "Lanterna"}
            </Button>
          )}

          {hasCamera && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-white/20 bg-black/40 text-white hover:bg-white/20 backdrop-blur-md rounded-xl gap-1.5 text-xs"
              onClick={toggleCameraMode}
            >
              <RefreshCw className="w-4 h-4" /> Trocar Câmera
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
            <p className="text-base font-bold">Câmera ao vivo não detectada</p>
            <p className="text-xs text-slate-400">Você pode usar a câmera nativa do sistema em alta definição:</p>
            <Button
              type="button"
              className="gap-2 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold px-6 py-3 rounded-xl shadow-lg"
              onClick={() => nativeCamRef.current?.click()}
            >
              <Camera className="w-5 h-5" /> Abrir Câmera HD do Tablet
            </Button>
          </div>
        )}

        {/* ── Moldura Guia de Documento (Document Scanner Frame) ── */}
        {hasCamera && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-6 sm:p-10 z-20">
            <div className="relative w-full max-w-3xl h-[68vh] border-2 border-teal-400/70 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(20,184,166,0.35)] bg-teal-500/5">
              {/* HUD Corners */}
              <div className="absolute top-0 left-0 w-10 h-10 border-t-4 border-l-4 border-teal-400 rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-10 h-10 border-t-4 border-r-4 border-teal-400 rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-10 h-10 border-b-4 border-l-4 border-teal-400 rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-10 h-10 border-b-4 border-r-4 border-teal-400 rounded-br-xl" />

              {/* Laser Animado */}
              <div className="w-full h-1 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_20px_#34d399] animate-[scan_2.2s_ease-in-out_infinite]" />

              {/* Floating Tooltip */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-bold text-teal-300 border border-teal-500/40 shadow-lg flex items-center gap-2">
                <FileText className="w-4 h-4 text-amber-400" /> Posicione a NF bem iluminada dentro da moldura
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
              <p className="text-xs text-teal-300">Lendo CNPJ, Nº da Nota, Pesos e Produtos em Alta Definição...</p>
            </div>
          </div>
        )}
      </div>

      {/* Hidden Canvas & File Inputs */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf,.pdf"
        className="hidden"
        onChange={e => handleFileUpload(e.target.files?.[0])}
      />
      <input
        ref={nativeCamRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFileUpload(e.target.files?.[0])}
      />

      {/* ── Bottom Floating Shutter Deck ── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 p-6 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex items-center justify-between max-w-2xl mx-auto pointer-events-auto gap-3">
        
        {/* Opção 1: Abrir Câmera HD do Sistema Operacional (Hardware Nativo) */}
        <Button
          type="button"
          variant="outline"
          className="border-teal-400/50 bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 rounded-xl gap-1.5 text-xs font-bold py-5"
          onClick={() => nativeCamRef.current?.click()}
        >
          <Camera className="w-4 h-4 text-teal-300" /> Câmera HD Nativa
        </Button>

        {/* Botão de Disparo Principal (Câmera ao Vivo) */}
        {hasCamera && (
          <button
            type="button"
            onClick={captureFrame}
            disabled={isScanning}
            className="relative group p-1.5 rounded-full border-4 border-white/90 hover:border-teal-400 transition-all hover:scale-105 active:scale-95 shadow-[0_0_40px_rgba(20,184,166,0.7)] cursor-pointer shrink-0"
            title="Escanear Agora com IA"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-400 flex items-center justify-center text-slate-950 font-bold shadow-inner">
              {isScanning ? (
                <Loader2 className="w-8 h-8 animate-spin text-slate-950" />
              ) : (
                <Scan className="w-8 h-8 text-slate-950 group-hover:rotate-6 transition-transform" />
              )}
            </div>
          </button>
        )}

        {/* Opção 2: Galeria / PDF */}
        <Button
          type="button"
          variant="ghost"
          className="text-slate-300 hover:text-white hover:bg-white/10 rounded-xl gap-1.5 text-xs font-semibold py-5"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="w-4 h-4 text-amber-400" /> Galeria / PDF
        </Button>
      </div>
    </div>,
    document.body
  );
}
