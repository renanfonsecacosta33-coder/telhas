import React, { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

function formatarSegundos(segundos) {
  const s = Math.floor(segundos || 0);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function AudioMessagePlayer({ audioUrl, duracaoEstimada = 0, isMine = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(duracaoEstimada || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => setIsPlaying(true)).catch((err) => {
        console.error("Erro ao reproduzir áudio:", err);
      });
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio) return;
    const novoTempo = Number(e.target.value);
    audio.currentTime = novoTempo;
    setCurrentTime(novoTempo);
  };

  const toggleSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const rates = [1, 1.5, 2];
    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
    const nextRate = rates[nextIndex];
    audio.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const percent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-2.5 py-1 min-w-[210px] sm:min-w-[240px] select-none ${isMine ? "text-primary-foreground" : "text-foreground"}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Botão Play / Pause grande e acessível */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-xs transition-transform active:scale-95 cursor-pointer ${
          isMine
            ? "bg-white text-primary hover:bg-white/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        }`}
        title={isPlaying ? "Pausar áudio" : "Tocar áudio"}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      {/* Barra de Progresso e Ondas */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="relative flex items-center w-full h-4">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none ${
              isMine ? "bg-white/30 accent-white" : "bg-slate-300 dark:bg-slate-700 accent-primary"
            }`}
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono font-medium opacity-80 leading-none">
          <span>{formatarSegundos(currentTime)}</span>
          <span>{formatarSegundos(duration || duracaoEstimada)}</span>
        </div>
      </div>

      {/* Botão de Velocidade (1x, 1.5x, 2x) */}
      <button
        type="button"
        onClick={toggleSpeed}
        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 transition-opacity hover:opacity-100 cursor-pointer ${
          isMine
            ? "bg-white/20 hover:bg-white/30 text-white"
            : "bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-700 dark:text-slate-300"
        }`}
        title="Alterar velocidade de reprodução"
      >
        {playbackRate}x
      </button>
    </div>
  );
}
