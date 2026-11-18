import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import {
  Send, Mic, Camera, Image as ImageIcon, Tag, Search,
  X, Check, CheckCheck, Clock, AlertCircle, Play, Pause,
  Calendar, RotateCcw, ChevronUp, ExternalLink, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { comprimirImagemParaUpload, criarPreviewLocalInstantaneo } from "@/lib/compressImage";
import AudioMessagePlayer from "./AudioMessagePlayer";
import VincularPedidoDialog from "./VincularPedidoDialog";

function formatarTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function ChatPanel({
  canal_tipo,
  canal_id,
  canal_label,
  currentUser,
  heightClass = "h-[450px]",
  destinatarioId
}) {
  const [mensagens, setMensagens] = useState([]);
  const [texto, setTexto] = useState("");
  const [pagina, setPagina] = useState(1);
  const [temMaisMensagens, setTemMaisMensagens] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);

  // Barra de Pesquisa e Filtros
  const [buscaAberta, setBuscaAberta] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroData, setFiltroData] = useState("");

  // Gravação de Áudio
  const [gravandoAudio, setGravandoAudio] = useState(false);
  const [tempoGravacao, setTempoGravacao] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerAudioRef = useRef(null);

  // Vínculo de Pedido (Tag de OP)
  const [vincularModalOpen, setVincularModalOpen] = useState(false);
  const [pedidoVinculado, setPedidoVinculado] = useState(null);

  // Zoom de Foto
  const [fotoZoom, setFotoZoom] = useState(null);

  // Detalhes da OP Vinculada
  const [opDetalheModal, setOpDetalheModal] = useState({ open: false, dados: null });

  // Upload de Foto
  const cameraInputRef = useRef(null);
  const galeriaInputRef = useRef(null);
  const [menuAnexoOpen, setMenuAnexoOpen] = useState(false);

  const scrollRef = useRef(null);
  const isFirstLoadRef = useRef(true);

  // 1. Carregamento inicial de mensagens e Realtime subscription
  useEffect(() => {
    if (!canal_id) return;
    let active = true;

    const carregar = async () => {
      try {
        const msgs = await base44.entities.MensagemChat.filter(
          { canal_tipo, canal_id },
          "-data_hora",
          60
        );
        if (!active) return;
        const listaOrdenada = (msgs || []).reverse();
        setMensagens(listaOrdenada);
        setTemMaisMensagens((msgs || []).length >= 60);

        // Marca como lidas as mensagens de outros remetentes
        msgs?.forEach(m => {
          if (!m.lido && m.remetente_id !== currentUser?.id && m.id) {
            base44.entities.MensagemChat.update(m.id, { lido: true }).catch(() => {});
          }
        });
      } catch (err) {
        console.error("Erro ao carregar mensagens:", err);
      }
    };

    carregar();

    const unsubscribe = base44.entities.MensagemChat.subscribe((event) => {
      if (event.type === "create") {
        const msg = event.data;
        if (msg.canal_tipo === canal_tipo && String(msg.canal_id) === String(canal_id)) {
          setMensagens(prev => {
            if (prev.some(m => m.id === msg.id || (m._tempId && m._tempId === msg._tempId))) {
              return prev.map(m => (m._tempId && m._tempId === msg._tempId) ? msg : m);
            }
            return [...prev, msg];
          });
          if (!msg.lido && msg.remetente_id !== currentUser?.id && msg.id) {
            base44.entities.MensagemChat.update(msg.id, { lido: true }).catch(() => {});
          }
        }
      } else if (event.type === "update") {
        const msg = event.data;
        if (msg.canal_tipo === canal_tipo && String(msg.canal_id) === String(canal_id)) {
          setMensagens(prev => prev.map(m => m.id === msg.id ? { ...m, ...msg } : m));
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [canal_tipo, canal_id, currentUser?.id]);

  // 2. Rolagem automática para o fim apenas na carga inicial ou em novos envios próprios
  useEffect(() => {
    if (scrollRef.current && (isFirstLoadRef.current || !termoBusca)) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (mensagens.length > 0) isFirstLoadRef.current = false;
    }
  }, [mensagens.length, termoBusca]);

  // Carregar mensagens mais antigas (Paginação)
  const handleCarregarMais = async () => {
    if (carregandoMais || !temMaisMensagens || mensagens.length === 0) return;
    setCarregandoMais(true);
    try {
      const maisAntiga = mensagens[0];
      const msgsAntigas = await base44.entities.MensagemChat.filter(
        {
          canal_tipo,
          canal_id,
          data_hora: { $lt: maisAntiga.data_hora }
        },
        "-data_hora",
        40
      );
      if (msgsAntigas && msgsAntigas.length > 0) {
        const ordenadas = msgsAntigas.reverse();
        setMensagens(prev => [...ordenadas, ...prev]);
        setTemMaisMensagens(msgsAntigas.length >= 40);
      } else {
        setTemMaisMensagens(false);
      }
    } catch (err) {
      console.error("Erro ao carregar mensagens antigas:", err);
    } finally {
      setCarregandoMais(false);
    }
  };

  // 3. ENVIO OTIMISTA E ROBUSTO (Texto, Foto ou Áudio)
  const enviarMensagemOtimista = async ({
    tipo_mensagem = "texto",
    conteudo = "",
    fotoFile = null,
    fotoPreviewUrl = "",
    audioFile = null,
    audioBlobUrl = "",
    audio_duracao = 0,
    pedido = null
  }) => {
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const agoraIso = new Date().toISOString();
    const remetenteNome = currentUser?.full_name || currentUser?.name || currentUser?.operador || "Operador";

    // 3.1. Criação imediata da mensagem local (0ms na tela)
    const msgLocal = {
      id: tempId,
      _tempId: tempId,
      _enviando: true,
      canal_tipo,
      canal_id,
      canal_label: canal_label || canal_id,
      remetente_id: currentUser?.id || "",
      remetente_nome: remetenteNome,
      conteudo: conteudo || (tipo_mensagem === "audio" ? `Áudio (${formatarTempo(audio_duracao)})` : tipo_mensagem === "foto" ? "Foto anexada" : ""),
      tipo_mensagem,
      foto_url: fotoPreviewUrl || "",
      audio_url: audioBlobUrl || "",
      audio_duracao: audio_duracao || 0,
      pedido_id: pedido?.id || "",
      numero_pedido: pedido?.numero_pedido || "",
      pedido_resumo: pedido?.resumo || "",
      lido: false,
      data_hora: agoraIso,
    };

    if (destinatarioId) msgLocal.destinatario_id = destinatarioId;

    setMensagens(prev => [...prev, msgLocal]);

    // Limpa a tag de pedido vinculado após engatilhar o envio
    if (pedido) {
      setPedidoVinculado(null);
    }

    // Scroll imediato
    setTimeout(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, 20);

    // 3.2. Processamento em segundo plano (Upload de mídia se houver)
    let finalFotoUrl = "";
    let finalAudioUrl = "";

    try {
      if (fotoFile) {
        const fotoOtimizada = await comprimirImagemParaUpload(fotoFile);
        const resFoto = await base44.integrations.Core.UploadFile({ file: fotoOtimizada });
        finalFotoUrl = resFoto?.file_url || "";
      }

      if (audioFile) {
        const resAudio = await base44.integrations.Core.UploadFile({ file: audioFile });
        finalAudioUrl = resAudio?.file_url || "";
      }

      const payloadServidor = {
        canal_tipo,
        canal_id,
        canal_label: canal_label || canal_id,
        remetente_id: currentUser?.id || "",
        remetente_nome: remetenteNome,
        conteudo: msgLocal.conteudo,
        tipo_mensagem,
        lido: false,
        data_hora: agoraIso,
        ...(finalFotoUrl ? { foto_url: finalFotoUrl } : {}),
        ...(finalAudioUrl ? { audio_url: finalAudioUrl, audio_duracao } : {}),
        ...(pedido?.id ? {
          pedido_id: pedido.id,
          numero_pedido: pedido.numero_pedido,
          pedido_resumo: pedido.resumo
        } : {})
      };

      if (destinatarioId) payloadServidor.destinatario_id = destinatarioId;

      const msgConfirmada = await base44.entities.MensagemChat.create(payloadServidor);

      // Substitui o item otimista pelo item gravado na nuvem
      setMensagens(prev => prev.map(m => (m.id === tempId ? { ...msgConfirmada, _enviando: false } : m)));
    } catch (err) {
      console.error("Falha ao enviar mensagem:", err);
      toast.error("Falha no envio da mensagem. Verifique a conexão.");
      setMensagens(prev => prev.map(m => (m.id === tempId ? { ...m, _enviando: false, _erro: true } : m)));
    }
  };

  // Enviar texto
  const handleSendTexto = () => {
    if (!texto.trim() || gravandoAudio) return;
    const msgTexto = texto.trim();
    setTexto("");
    enviarMensagemOtimista({
      tipo_mensagem: "texto",
      conteudo: msgTexto,
      pedido: pedidoVinculado
    });
  };

  // 4. GRAVAÇÃO DE ÁUDIO NO TABLET
  const iniciarGravacaoAudio = async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Este dispositivo não suporta gravação de áudio direto.");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let mimeType = "audio/webm";
      if (typeof MediaRecorder !== "undefined") {
        if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
          mimeType = "audio/webm;codecs=opus";
        } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
          mimeType = "audio/mp4";
        }
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(100);
      setGravandoAudio(true);
      setTempoGravacao(0);

      timerAudioRef.current = setInterval(() => {
        setTempoGravacao(t => t + 1);
      }, 1000);
    } catch (err) {
      console.error("Erro ao ativar microfone:", err);
      toast.error("Não foi possível acessar o microfone. Autorize nas permissões do tablet.");
    }
  };

  const cancelarGravacaoAudio = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
    }
    clearInterval(timerAudioRef.current);
    setGravandoAudio(false);
    setTempoGravacao(0);
    audioChunksRef.current = [];
  };

  const finalizarEEnviarAudio = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    const duracaoSegundos = tempoGravacao;
    clearInterval(timerAudioRef.current);

    mediaRecorderRef.current.onstop = async () => {
      mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      const mime = mediaRecorderRef.current.mimeType || "audio/webm";
      const blob = new Blob(audioChunksRef.current, { type: mime });
      const ext = mime.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `audio_${Date.now()}.${ext}`, { type: mime });
      const localUrl = URL.createObjectURL(blob);

      enviarMensagemOtimista({
        tipo_mensagem: "audio",
        audioBlobUrl: localUrl,
        audioFile: file,
        audio_duracao: duracaoSegundos,
        pedido: pedidoVinculado
      });
    };

    mediaRecorderRef.current.stop();
    setGravandoAudio(false);
    setTempoGravacao(0);
  };

  // 5. ENVIO DE FOTO (Câmera ou Galeria)
  const handleFotoSelecionada = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setMenuAnexoOpen(false);

    const previewUrl = criarPreviewLocalInstantaneo(file);
    enviarMensagemOtimista({
      tipo_mensagem: "foto",
      fotoPreviewUrl: previewUrl,
      fotoFile: file,
      conteudo: texto.trim() || "",
      pedido: pedidoVinculado
    });
    setTexto("");
  };

  // 6. BUSCA E FILTRAGEM DE HISTÓRICO
  const mensagensFiltradas = useMemo(() => {
    return mensagens.filter(m => {
      // Filtro de Data
      if (filtroData && m.data_hora) {
        if (!m.data_hora.startsWith(filtroData)) return false;
      }
      // Filtro de Termo
      if (termoBusca.trim()) {
        const termo = termoBusca.toLowerCase().trim();
        const noConteudo = String(m.conteudo || "").toLowerCase().includes(termo);
        const noRemetente = String(m.remetente_nome || "").toLowerCase().includes(termo);
        const noNumero = String(m.numero_pedido || "").toLowerCase().includes(termo);
        const noResumo = String(m.pedido_resumo || "").toLowerCase().includes(termo);
        return noConteudo || noRemetente || noNumero || noResumo;
      }
      return true;
    });
  }, [mensagens, termoBusca, filtroData]);

  const destacarTexto = (conteudoStr, query) => {
    if (!query || !conteudoStr) return conteudoStr;
    const parts = String(conteudoStr).split(new RegExp(`(${query})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-300 text-slate-900 rounded px-0.5 font-bold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  // Abrir detalhes de pedido vinculado
  const handleAbrirOpVinculada = async (m) => {
    try {
      let pedidoObj = null;
      if (m.pedido_id) {
        pedidoObj = await base44.entities.Pedido.get(m.pedido_id).catch(() => null);
      }
      if (!pedidoObj && m.numero_pedido) {
        const numLimpo = m.numero_pedido.replace("#", "").trim();
        const res = await base44.entities.Pedido.filter({ numero_pedido: numLimpo }, "-data", 1).catch(() => []);
        pedidoObj = res?.[0] || null;
      }
      if (pedidoObj) {
        setOpDetalheModal({ open: true, dados: pedidoObj });
      } else {
        toast.info(`Ordem ${m.numero_pedido || ""} vinculada nesta mensagem.`);
      }
    } catch {
      toast.info(`Ordem ${m.numero_pedido || ""} vinculada.`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950 select-none">
      {/* ── BARRA SUPERIOR: Título e Botão de Busca Rápida ── */}
      <div className="px-3.5 py-2.5 border-b border-border bg-white dark:bg-slate-900 flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="text-[11px] font-bold border-primary/40 text-primary bg-primary/5 uppercase">
            {canal_tipo === "maquina" ? "Máquina" : canal_tipo === "pedido" ? "OP" : "Chat"}
          </Badge>
          <span className="font-extrabold text-xs text-foreground truncate block">
            {canal_label || canal_id}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            variant={buscaAberta ? "secondary" : "ghost"}
            onClick={() => {
              setBuscaAberta(!buscaAberta);
              if (buscaAberta) {
                setTermoBusca("");
                setFiltroData("");
              }
            }}
            className="h-8 px-2 text-xs font-bold gap-1 cursor-pointer"
            title="Pesquisar histórico de mensagens"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Buscar</span>
          </Button>
        </div>
      </div>

      {/* ── PAINEL EXPANSÍVEL DE BUSCA & FILTRO POR DATA ── */}
      {buscaAberta && (
        <div className="p-2.5 bg-slate-100 dark:bg-slate-900/90 border-b border-border space-y-2 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                autoFocus
                placeholder="Buscar palavra, remetente, número da OP..."
                value={termoBusca}
                onChange={(e) => setTermoBusca(e.target.value)}
                className="pl-8 h-8 text-xs bg-white dark:bg-slate-950 font-medium"
              />
              {termoBusca && (
                <button
                  type="button"
                  onClick={() => setTermoBusca("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Input
                type="date"
                value={filtroData}
                onChange={(e) => setFiltroData(e.target.value)}
                className="h-8 text-xs w-32 bg-white dark:bg-slate-950"
                title="Filtrar por data"
              />
              {(termoBusca || filtroData) && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setTermoBusca("");
                    setFiltroData("");
                  }}
                  className="h-8 px-2 text-xs text-muted-foreground hover:text-red-600"
                  title="Limpar filtros"
                >
                  <RotateCcw className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
            <span>
              {mensagensFiltradas.length} mensagem(ns) encontrada(s)
            </span>
            {filtroData && (
              <span className="font-bold text-primary">
                Data: {format(new Date(`${filtroData}T12:00:00`), "dd/MM/yyyy")}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── ÁREA DE MENSAGENS COM ROLAGEM E PAGINAÇÃO ── */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto space-y-3 p-3.5 ${heightClass}`}
      >
        {temMaisMensagens && !termoBusca && !filtroData && (
          <div className="text-center py-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={carregandoMais}
              onClick={handleCarregarMais}
              className="h-7 text-[11px] font-bold gap-1 text-muted-foreground hover:text-foreground bg-white/70 dark:bg-slate-900 shadow-2xs"
            >
              {carregandoMais ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <ChevronUp className="w-3 h-3" />
              )}
              Carregar mensagens anteriores
            </Button>
          </div>
        )}

        {mensagensFiltradas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 text-slate-400">
            <p className="text-sm font-semibold">
              {termoBusca || filtroData
                ? "Nenhuma mensagem encontrada para este filtro."
                : "Nenhuma mensagem nesta conversa ainda."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Envie um texto, foto da máquina ou áudio rápido para a equipe.
            </p>
          </div>
        ) : (
          mensagensFiltradas.map((m) => {
            const isMine = m.remetente_id === currentUser?.id;
            const isEnviando = !!m._enviando;
            const isErro = !!m._erro;
            const isAudio = m.tipo_mensagem === "audio" || !!m.audio_url;
            const isFoto = m.tipo_mensagem === "foto" || !!m.foto_url;
            const temOpVinculada = !!m.numero_pedido || !!m.pedido_id;

            return (
              <div
                key={m.id || m._tempId}
                className={`flex flex-col ${isMine ? "items-end" : "items-start"} group`}
              >
                {/* Nome do Remetente */}
                <span
                  className={`text-[11px] font-extrabold mb-1 px-1 flex items-center gap-1.5 ${
                    isMine ? "text-primary" : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <span>{m.remetente_nome || "Operador"}</span>
                  {m.canal_tipo === "direto" && (
                    <span className="text-[9px] font-normal opacity-70">
                      (Direto)
                    </span>
                  )}
                </span>

                {/* Bolha da Mensagem */}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3 shadow-xs space-y-2 relative transition-all ${
                    isMine
                      ? "bg-primary text-primary-foreground rounded-tr-xs"
                      : "bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-foreground rounded-tl-xs"
                  } ${isEnviando ? "opacity-75" : ""}`}
                >
                  {/* TAG DE OP VINCULADA (Mini Card Clicável) */}
                  {temOpVinculada && (
                    <div
                      onClick={() => handleAbrirOpVinculada(m)}
                      className={`rounded-xl p-2 border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                        isMine
                          ? "bg-white/15 border-white/25 hover:bg-white/25 text-white"
                          : "bg-primary/5 border-primary/20 hover:bg-primary/10 text-primary"
                      }`}
                      title="Clique para ver os detalhes da ordem"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Tag className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-mono font-black text-xs">
                            {m.numero_pedido || "OP Vinculada"}
                          </span>
                        </div>
                        {m.pedido_resumo && (
                          <p className="text-[10px] opacity-90 truncate mt-0.5 font-medium">
                            {destacarTexto(m.pedido_resumo, termoBusca)}
                          </p>
                        )}
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    </div>
                  )}

                  {/* FOTO ANEXADA */}
                  {isFoto && m.foto_url && (
                    <div className="relative rounded-xl overflow-hidden border border-black/10 bg-black/10 cursor-pointer">
                      <img
                        src={m.foto_url}
                        alt="Foto da mensagem"
                        onClick={() => setFotoZoom(m.foto_url)}
                        className="w-full max-h-56 object-cover hover:scale-102 transition-transform duration-200"
                        loading="lazy"
                      />
                      {isEnviando && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs flex items-center justify-center text-white text-xs font-bold gap-1.5">
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          Enviando foto...
                        </div>
                      )}
                    </div>
                  )}

                  {/* PLAYER DE ÁUDIO */}
                  {isAudio && m.audio_url && (
                    <AudioMessagePlayer
                      audioUrl={m.audio_url}
                      duracaoEstimada={m.audio_duracao || 0}
                      isMine={isMine}
                    />
                  )}

                  {/* TEXTO DA MENSAGEM */}
                  {m.conteudo && (!isAudio || m.conteudo !== `Áudio (${formatarTempo(m.audio_duracao)})`) && (
                    <p className="whitespace-pre-wrap break-words text-xs sm:text-sm font-normal leading-relaxed">
                      {destacarTexto(m.conteudo, termoBusca)}
                    </p>
                  )}

                  {/* RODAPÉ DA BOLHA: Hora e Indicador de Envio */}
                  <div
                    className={`flex items-center justify-end gap-1.5 pt-0.5 text-[10px] ${
                      isMine ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    <span>
                      {m.data_hora
                        ? format(new Date(m.data_hora), "HH:mm", { locale: ptBR })
                        : ""}
                    </span>

                    {isMine && (
                      <span className="flex items-center">
                        {isErro ? (
                          <span title="Falha ao enviar" className="text-red-300">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </span>
                        ) : isEnviando ? (
                          <span title="Enviando..." className="animate-spin opacity-80">
                            <Clock className="w-3 h-3" />
                          </span>
                        ) : m.lido ? (
                          <span title="Lida" className="text-emerald-300">
                            <CheckCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                          </span>
                        ) : (
                          <span title="Enviada ao servidor">
                            <Check className="w-3.5 h-3.5 stroke-[2]" />
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── BARRA INFERIOR DE DIGITAÇÃO E ENTRADA MULTIMÍDIA ── */}
      <div className="p-2.5 sm:p-3 border-t border-border bg-white dark:bg-slate-900 space-y-2 shadow-md">
        {/* Tag do Pedido que será vinculado nesta mensagem */}
        {pedidoVinculado && (
          <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold animate-in fade-in duration-150">
            <div className="flex items-center gap-1.5 min-w-0">
              <Tag className="w-3.5 h-3.5 shrink-0" />
              <span className="font-mono">{pedidoVinculado.numero_pedido}</span>
              <span className="font-normal opacity-80 truncate hidden sm:inline">
                • {pedidoVinculado.resumo}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPedidoVinculado(null)}
              className="p-1 hover:bg-primary/20 rounded-full transition-colors cursor-pointer"
              title="Remover vínculo deste pedido"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* MODO GRAVANDO ÁUDIO (Interface Grande para Chão de Fábrica) */}
        {gravandoAudio ? (
          <div className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-red-50 dark:bg-red-950/40 border-2 border-red-300 dark:border-red-800 animate-in fade-in duration-150">
            <div className="flex items-center gap-3 pl-2">
              <div className="w-3.5 h-3.5 rounded-full bg-red-600 animate-ping" />
              <span className="font-mono font-bold text-sm text-red-700 dark:text-red-300">
                {formatarTempo(tempoGravacao)}
              </span>
              <span className="text-xs text-red-600 font-medium hidden sm:inline">
                Gravando áudio da máquina...
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cancelarGravacaoAudio}
                className="h-10 px-3.5 text-xs font-bold text-red-700 border-red-300 hover:bg-red-100 dark:hover:bg-red-900/50 cursor-pointer gap-1"
              >
                <X className="w-4 h-4" /> Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={finalizarEEnviarAudio}
                className="h-10 px-4 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm cursor-pointer gap-1.5"
              >
                <Send className="w-4 h-4" /> Enviar Áudio
              </Button>
            </div>
          </div>
        ) : (
          /* MODO DIGITAÇÃO NORMAL */
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Botão Vincular OP */}
            <Button
              type="button"
              size="icon"
              variant={pedidoVinculado ? "default" : "outline"}
              onClick={() => setVincularModalOpen(true)}
              className={`h-11 w-11 rounded-xl shrink-0 cursor-pointer ${
                pedidoVinculado ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Vincular pedido / OP a esta mensagem"
            >
              <Tag className="w-5 h-5" />
            </Button>

            {/* Menu Rápido de Fotos (Câmera ou Galeria) */}
            <Popover open={menuAnexoOpen} onOpenChange={setMenuAnexoOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  size="icon"
                  variant="outline"
                  className="h-11 w-11 rounded-xl shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Tirar foto ou anexar imagem"
                >
                  <Camera className="w-5 h-5 text-emerald-600" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-56 p-2 rounded-2xl shadow-xl">
                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-xs font-bold text-foreground cursor-pointer transition-colors"
                  >
                    <Camera className="w-4 h-4 text-emerald-600" />
                    📸 Tirar Foto na Hora (Câmera)
                  </button>
                  <button
                    type="button"
                    onClick={() => galeriaInputRef.current?.click()}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-foreground cursor-pointer transition-colors"
                  >
                    <ImageIcon className="w-4 h-4 text-blue-600" />
                    🖼️ Galeria / Arquivos
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Inputs Ocultos de Câmera e Galeria */}
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFotoSelecionada}
              className="hidden"
            />
            <input
              type="file"
              ref={galeriaInputRef}
              accept="image/*"
              onChange={handleFotoSelecionada}
              className="hidden"
            />

            {/* Campo de Texto Principal */}
            <Input
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendTexto();
                }
              }}
              placeholder="Digite sua mensagem na máquina..."
              className="h-11 text-xs sm:text-sm font-medium rounded-xl border-2 focus-visible:ring-primary shadow-2xs flex-1"
            />

            {/* Botão de Gravar Áudio (ou Enviar Texto se houver algo digitado) */}
            {texto.trim() ? (
              <Button
                type="button"
                size="icon"
                onClick={handleSendTexto}
                className="h-11 w-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shrink-0 shadow-sm cursor-pointer"
                title="Enviar mensagem"
              >
                <Send className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={iniciarGravacaoAudio}
                className="h-11 w-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-sm cursor-pointer"
                title="Gravar mensagem de voz (Áudio rápido)"
              >
                <Mic className="w-5 h-5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ── MODAIS AUXILIARES ── */}

      {/* Modal Seletor de OP para Vínculo */}
      {vincularModalOpen && (
        <VincularPedidoDialog
          open={vincularModalOpen}
          onOpenChange={setVincularModalOpen}
          canal_tipo={canal_tipo}
          canal_id={canal_id}
          onSelectPedido={(p) => setPedidoVinculado(p)}
        />
      )}

      {/* Lightbox / Zoom da Foto */}
      {fotoZoom && (
        <Dialog open={!!fotoZoom} onOpenChange={() => setFotoZoom(null)}>
          <DialogContent className="max-w-3xl p-2 bg-black/95 border-0 rounded-2xl shadow-2xl flex flex-col items-center">
            <div className="relative w-full max-h-[80vh] flex items-center justify-center">
              <img
                src={fotoZoom}
                alt="Foto ampliada"
                className="max-w-full max-h-[80vh] object-contain rounded-xl"
              />
            </div>
            <div className="w-full flex items-center justify-between p-2 text-white text-xs">
              <span>Registro Fotográfico da Máquina</span>
              <a
                href={fotoZoom}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold underline hover:text-primary"
              >
                Abrir em Nova Aba ↗
              </a>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Modal de Detalhes da OP Vinculada na Mensagem */}
      {opDetalheModal.open && opDetalheModal.dados && (
        <Dialog open={opDetalheModal.open} onOpenChange={(open) => setOpDetalheModal({ open, dados: null })}>
          <DialogContent className="max-w-lg p-5 font-sans rounded-2xl shadow-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <Tag className="w-5 h-5 text-primary" />
                Ordem #{opDetalheModal.dados.numero_pedido || opDetalheModal.dados.id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 space-y-1.5">
                <p><strong>Cliente:</strong> {opDetalheModal.dados.cliente || "—"}</p>
                <p><strong>Produto:</strong> {opDetalheModal.dados.produto || "—"}</p>
                <p><strong>Máquina:</strong> {opDetalheModal.dados.maquina || "—"}</p>
                <p><strong>Status:</strong> <Badge variant="outline">{opDetalheModal.dados.status || "—"}</Badge></p>
                {opDetalheModal.dados.metros && (
                  <p><strong>Metragem:</strong> {Number(opDetalheModal.dados.metros).toFixed(2)}m</p>
                )}
                {opDetalheModal.dados.observacoes && (
                  <p><strong>Observações:</strong> {opDetalheModal.dados.observacoes}</p>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
