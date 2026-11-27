import React, { useState } from "react";
import { Camera, Eye, Upload, ZoomIn, X, RotateCw, Image as ImageIcon, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

export default function GaleriaFotosRota({ rota, onAtualizarRota }) {
  const [modalFoto, setModalFoto] = useState(null); // { url, titulo }
  const [rotacao, setRotacao] = useState(0);
  const [uploadingTipo, setUploadingTipo] = useState(null);

  // Parser seguro de arrays JSON
  const parseFotos = (jsonStr) => {
    if (!jsonStr) return [];
    try {
      const parsed = typeof jsonStr === "string" ? JSON.parse(jsonStr) : jsonStr;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const fotosTelhas = parseFotos(rota.fotos_telhas_json);
  const fotosCD = parseFotos(rota.fotos_corte_dobra_json);
  const fotosExpedicao = parseFotos(rota.fotos_expedicao_json);
  const fotosTraseira = parseFotos(rota.fotos_caminhao_traseira_json);

  const totalFotos =
    (rota.rota_imagem_url ? 1 : 0) +
    fotosTraseira.length +
    fotosTelhas.length +
    fotosCD.length +
    fotosExpedicao.length;

  const handleUploadFoto = async (tipo, file) => {
    if (!file) return;
    setUploadingTipo(tipo);
    const toastId = toast.loading(`Enviando foto para ${tipo}...`);

    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (!res?.file_url) throw new Error("Não foi possível salvar o arquivo");

      const updateData = {};
      const novaEntrada = {
        url: res.file_url,
        data: new Date().toISOString(),
        nome: file.name || "Foto",
      };

      if (tipo === "folha") {
        updateData.rota_imagem_url = res.file_url;
        updateData.rota_imagem_nome = file.name;
      } else if (tipo === "traseira") {
        const novas = [...fotosTraseira, novaEntrada];
        updateData.fotos_caminhao_traseira_json = JSON.stringify(novas);
      } else if (tipo === "telhas") {
        const novas = [...fotosTelhas, novaEntrada];
        updateData.fotos_telhas_json = JSON.stringify(novas);
      } else if (tipo === "corte_dobra") {
        const novas = [...fotosCD, novaEntrada];
        updateData.fotos_corte_dobra_json = JSON.stringify(novas);
      } else if (tipo === "expedicao") {
        const novas = [...fotosExpedicao, novaEntrada];
        updateData.fotos_expedicao_json = JSON.stringify(novas);
      }

      await base44.entities.RotaEntrega.update(rota.id, updateData);
      toast.dismiss(toastId);
      toast.success("Foto salva com sucesso!");
      if (onAtualizarRota) onAtualizarRota();
    } catch (e) {
      console.error(e);
      toast.dismiss(toastId);
      toast.error("Erro ao enviar foto: " + (e?.message || "Tente novamente"));
    } finally {
      setUploadingTipo(null);
    }
  };

  const abrirVisualizador = (url, titulo) => {
    setRotacao(0);
    setModalFoto({ url, titulo });
  };

  return (
    <div className="bg-slate-50 dark:bg-slate-900/60 rounded-xl p-3 border border-border space-y-3">
      {/* Cabeçalho da Galeria */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wider">
            Galeria & Mídias da Carga
          </span>
          <Badge variant="secondary" className="text-[10px] h-5 font-bold px-1.5">
            {totalFotos} {totalFotos === 1 ? "foto" : "fotos"}
          </Badge>
        </div>
      </div>

      {/* Grid de Cards de Fotos */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* 1. Folha Original da Rota */}
        <div className="group relative rounded-lg border border-border bg-card overflow-hidden flex flex-col h-32 hover:border-primary/50 transition-all">
          <div className="px-2 py-1 bg-slate-900/80 text-white text-[10px] font-bold flex items-center justify-between">
            <span className="truncate">Folha de Rota</span>
            {rota.rota_imagem_url && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 overflow-hidden">
            {rota.rota_imagem_url ? (
              <>
                <img
                  src={rota.rota_imagem_url}
                  alt="Folha Original"
                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                  onClick={() => abrirVisualizador(rota.rota_imagem_url, "Folha Original da Rota")}
                />
                <button
                  type="button"
                  onClick={() => abrirVisualizador(rota.rota_imagem_url, "Folha Original da Rota")}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs font-medium cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" /> Ampliar
                </button>
              </>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 cursor-pointer w-full h-full p-2 text-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                <Upload className="w-5 h-5 text-muted-foreground/60" />
                <span className="text-[11px] font-medium leading-tight">Anexar Folha</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadFoto("folha", e.target.files?.[0])}
                  disabled={uploadingTipo === "folha"}
                />
              </label>
            )}
          </div>
        </div>

        {/* 2. Traseira do Caminhão */}
        <div className="group relative rounded-lg border border-border bg-card overflow-hidden flex flex-col h-32 hover:border-primary/50 transition-all">
          <div className="px-2 py-1 bg-slate-900/80 text-white text-[10px] font-bold flex items-center justify-between">
            <span className="truncate">Traseira Carga</span>
            {fotosTraseira.length > 0 && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 overflow-hidden">
            {fotosTraseira.length > 0 ? (
              <>
                <img
                  src={fotosTraseira[fotosTraseira.length - 1].url}
                  alt="Traseira Caminhão"
                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                  onClick={() => abrirVisualizador(fotosTraseira[fotosTraseira.length - 1].url, "Foto Traseira do Caminhão")}
                />
                <button
                  type="button"
                  onClick={() => abrirVisualizador(fotosTraseira[fotosTraseira.length - 1].url, "Foto Traseira do Caminhão")}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs font-medium cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" /> Ampliar
                </button>
              </>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 cursor-pointer w-full h-full p-2 text-center text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all">
                <Camera className="w-5 h-5 text-muted-foreground/60" />
                <span className="text-[11px] font-medium leading-tight">Foto Traseira</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadFoto("traseira", e.target.files?.[0])}
                  disabled={uploadingTipo === "traseira"}
                />
              </label>
            )}
          </div>
        </div>

        {/* 3. Fotos de Telhas */}
        <div className="group relative rounded-lg border border-border bg-card overflow-hidden flex flex-col h-32 hover:border-blue-500/50 transition-all">
          <div className="px-2 py-1 bg-blue-900 text-blue-100 text-[10px] font-bold flex items-center justify-between">
            <span className="truncate">Barracão Telhas</span>
            <span className="text-[9px] bg-blue-950 px-1 rounded">{fotosTelhas.length}/3</span>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 overflow-hidden">
            {fotosTelhas.length > 0 ? (
              <>
                <img
                  src={fotosTelhas[fotosTelhas.length - 1].url}
                  alt="Telhas"
                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                  onClick={() => abrirVisualizador(fotosTelhas[fotosTelhas.length - 1].url, "Foto Barracão Telhas")}
                />
                <button
                  type="button"
                  onClick={() => abrirVisualizador(fotosTelhas[fotosTelhas.length - 1].url, "Foto Barracão Telhas")}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs font-medium cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" /> Ampliar
                </button>
              </>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 cursor-pointer w-full h-full p-2 text-center text-muted-foreground hover:text-blue-500 hover:bg-blue-500/5 transition-all">
                <Camera className="w-5 h-5 text-blue-400" />
                <span className="text-[11px] font-medium leading-tight">Foto Telhas</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadFoto("telhas", e.target.files?.[0])}
                  disabled={uploadingTipo === "telhas"}
                />
              </label>
            )}
          </div>
        </div>

        {/* 4. Fotos de Corte & Dobra */}
        <div className="group relative rounded-lg border border-border bg-card overflow-hidden flex flex-col h-32 hover:border-orange-500/50 transition-all">
          <div className="px-2 py-1 bg-orange-900 text-orange-100 text-[10px] font-bold flex items-center justify-between">
            <span className="truncate">Corte e Dobra</span>
            <span className="text-[9px] bg-orange-950 px-1 rounded">{fotosCD.length}/3</span>
          </div>

          <div className="flex-1 relative flex items-center justify-center bg-slate-100 dark:bg-slate-800/50 overflow-hidden">
            {fotosCD.length > 0 ? (
              <>
                <img
                  src={fotosCD[fotosCD.length - 1].url}
                  alt="Corte e Dobra"
                  className="w-full h-full object-cover cursor-pointer group-hover:scale-105 transition-transform"
                  onClick={() => abrirVisualizador(fotosCD[fotosCD.length - 1].url, "Foto Corte e Dobra")}
                />
                <button
                  type="button"
                  onClick={() => abrirVisualizador(fotosCD[fotosCD.length - 1].url, "Foto Corte e Dobra")}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white gap-1 text-xs font-medium cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" /> Ampliar
                </button>
              </>
            ) : (
              <label className="flex flex-col items-center justify-center gap-1 cursor-pointer w-full h-full p-2 text-center text-muted-foreground hover:text-orange-500 hover:bg-orange-500/5 transition-all">
                <Camera className="w-5 h-5 text-orange-400" />
                <span className="text-[11px] font-medium leading-tight">Foto C&D</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleUploadFoto("corte_dobra", e.target.files?.[0])}
                  disabled={uploadingTipo === "corte_dobra"}
                />
              </label>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox / Modal de Zoom em Alta Resolução */}
      <Dialog open={!!modalFoto} onOpenChange={(open) => !open && setModalFoto(null)}>
        <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 bg-slate-950 text-white border-slate-800">
          <DialogHeader className="flex flex-row items-center justify-between border-b border-slate-800 pb-2">
            <DialogTitle className="text-sm font-bold text-slate-200">
              {modalFoto?.titulo || "Visualizador de Foto"}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1 border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer"
                onClick={() => setRotacao((r) => (r + 90) % 360)}
                title="Girar 90 graus"
              >
                <RotateCw className="w-3.5 h-3.5" /> Girar
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-auto flex items-center justify-center p-2 min-h-[400px]">
            {modalFoto?.url && (
              <img
                src={modalFoto.url}
                alt={modalFoto.titulo}
                style={{ transform: `rotate(${rotacao}deg)` }}
                className="max-h-[75vh] max-w-full object-contain rounded transition-transform duration-300"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
