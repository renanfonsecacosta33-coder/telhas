import React, { useState, useMemo, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Snowflake, Play, Pause, CheckCircle2, Circle, Clock, Search, Filter, 
  Calendar, Layers, Scissors, Package, AlertTriangle, RefreshCw, ChevronLeft, ChevronRight, Check,
  Camera, Timer, Mail, FileText, AlertCircle, MapPin, Send, Bell
} from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { useFilial } from "@/contexts/FilialContext";
import { playAlertSound, playFinishSound } from "@/lib/sounds";
import ChatPedidoButton from "@/components/chat/ChatPedidoButton";
import ImageLink from "@/components/ui/ImageLink";
import UploadButton from "@/components/ui/UploadButton";

const PRODUTOS_COM_EPS = ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"];

const STATUS_EPS_LABELS = {
  pendente: { label: "Pendente de Corte", cls: "bg-amber-100 text-amber-800 border-amber-300", icon: Circle },
  em_corte: { label: "Em Corte", cls: "bg-blue-100 text-blue-800 border-blue-300", icon: Scissors },
  pausado:  { label: "Pausado", cls: "bg-purple-100 text-purple-800 border-purple-300", icon: Pause },
  pronto:   { label: "Pronto / Separado", cls: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: CheckCircle2 },
};

function formatTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function calcularNecessidadeEPS(pedido) {
  if (!pedido) return { totalMetrosLinear: 0, placasEstimatativas: 0, detalhamento: [] };

  let totalMetrosLinear = 0;
  let detalhamento = [];

  let vars = [];
  try { 
    if (pedido.variacoes_telhas) {
      vars = JSON.parse(pedido.variacoes_telhas); 
    }
  } catch {}

  if (Array.isArray(vars) && vars.length > 0) {
    vars.forEach(v => {
      const q = Number(v.qty) || 0;
      const mm = Number(v.mm) || 0;
      const m = (q * mm) / 1000;
      totalMetrosLinear += m;
      if (q > 0 && mm > 0) {
        detalhamento.push(`${q} pçs x ${mm}mm = ${m.toFixed(1)}m`);
      }
    });
  } else {
    const q = Number(pedido.quantidade_telhas || pedido.metros) || 0;
    const mm = Number(pedido.metragem_mm) || 0;
    if (q > 0 && mm > 0) {
      totalMetrosLinear = (q * mm) / 1000;
      detalhamento.push(`${q} pçs x ${mm}mm = ${totalMetrosLinear.toFixed(1)}m`);
    } else if (q > 0) {
      totalMetrosLinear = q;
      detalhamento.push(`${q} metros lineares`);
    }
  }

  const placasEstimatativas = Math.ceil(totalMetrosLinear / 2);

  return {
    totalMetrosLinear,
    placasEstimatativas,
    detalhamento,
  };
}

export default function CorteEPS() {
  const { filialAtiva } = useFilial();
  const [selectedDay, setSelectedDay] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos"); // "todos" | "pendente" | "em_corte" | "pronto" | "sem_estoque"
  const [user, setUser] = useState(null);
  const [tick, setTick] = useState(0);

  // Modais
  const [concluirDialog, setConcluirDialog] = useState(false);
  const [pauseDialog, setPauseDialog] = useState(false);
  const [emailDialog, setEmailDialog] = useState(false);

  const [pedidoSelecionado, setPedidoSelecionado] = useState(null);
  const [observacoesCorte, setObservacoesCorte] = useState("");
  const [carrinhoLocalizacao, setCarrinhoLocalizacao] = useState("");
  const [fotoEpsUrl, setFotoEpsUrl] = useState("");
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [motivoPausa, setMotivoPausa] = useState("Ajuste de fio/lâmina");
  const [emailDestinatario, setEmailDestinatario] = useState("");
  const [enviandoEmail, setEnviandoEmail] = useState(false);

  const fotoInputRef = useRef();
  const fotoScanRef = useRef();
  const processedAlertsRef = useRef(new Set());
  const queryClient = useQueryClient();

  // Timer tick
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Busca Usuários da equipe para destinatários de e-mail e alertas
  const { data: todosUsuarios = [] } = useQuery({
    queryKey: ["todos-usuarios-alertas"],
    queryFn: () => base44.entities.User.list(),
  });

  const emailsAdminsEGerentes = useMemo(() => {
    const set = new Set(["renanfonsecacosta33@gmail.com"]);
    todosUsuarios.forEach(u => {
      if (!u?.email) return;
      if (u.role === "admin" || u.role === "super_admin" || u.role === "gestor" || u.gerencia === true) {
        set.add(u.email);
      }
    });
    return Array.from(set);
  }, [todosUsuarios]);

  // Busca Pedidos
  const { data: todosPedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-corte-eps", filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ unidade: filialAtiva }, "-data", 400),
    refetchInterval: 10000,
  });

  // Busca Estoque de Isopor
  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores-estoque"],
    queryFn: () => base44.entities.Isopor.list(),
  });

  const getEstoqueModel = (especificacaoEps) => {
    const spec = (especificacaoEps || "EPS").toLowerCase();
    const item = isopores.find(i => (i.tipo || "").toLowerCase().includes(spec));
    if (item) return item.quantidade || 0;
    return isopores.reduce((sum, i) => sum + (i.quantidade || 0), 0);
  };

  const pedidosEPS = useMemo(() => {
    if (!Array.isArray(todosPedidos)) return [];
    return todosPedidos.filter(p => {
      if (!p) return false;
      const e = (p.eps || "").trim();
      const prod = (p.produto || "").toUpperCase();
      const maq = (p.maquina || "").toUpperCase();
      const temEps = e.length > 0 || PRODUTOS_COM_EPS.includes(prod) || maq === "COLAGEM";
      return temEps && p.status !== "cancelado";
    });
  }, [todosPedidos]);

  // AUTOMATISMO: Dispara E-Mail e Mensagens no APP Automaticamente ao detectar estoque de EPS insuficiente!
  useEffect(() => {
    if (!pedidosEPS || pedidosEPS.length === 0) return;

    pedidosEPS.forEach(async (p) => {
      if (!p || !p.id) return;
      const st = p.eps_status || "pendente";
      if (st === "pronto") return;

      const { placasEstimatativas } = calcularNecessidadeEPS(p);
      const disponivel = getEstoqueModel(p.eps);
      const semEstoque = disponivel < placasEstimatativas;

      // Se não tem estoque e ainda não foi enviado alerta para esta OP
      if (semEstoque && !p.alerta_email_eps_enviado && !processedAlertsRef.current.has(p.id)) {
        processedAlertsRef.current.add(p.id);

        const pedNum = p.numero_pedido || p.id.slice(-6).toUpperCase();
        const textoMsg = `🚨 ALERTA AUTOMÁTICO DE FALTA DE EPS / ISOPOR DA FÁBRICA\n\n` +
          `Pedido #: ${pedNum}\n` +
          `Cliente: ${p.cliente || "---"}\n` +
          `Especificação: ${p.eps || "EPS Padrão"}\n` +
          `Estoque Atual no Galpão: ${disponivel} placas\n` +
          `Necessário para a OP: ${placasEstimatativas} placas\n` +
          `Falta em Insumo: ${placasEstimatativas - disponivel} placas\n\n` +
          `⚠️ Favor providenciar a compra/envio urgente deste lote de EPS!`;

        // 1. Envia E-mail Automático para os Administradores e Encarregados
        try {
          await base44.integrations.Core.SendEmail({
            to: emailsAdminsEGerentes.join(", "),
            subject: `⚠️ ALERTA AUTOMÁTICO: Falta de EPS no Pedido #${pedNum} (${p.cliente || "Fábrica"})`,
            body: textoMsg,
          });
        } catch (e) {
          console.error("Erro no envio do e-mail automático:", e);
        }

        // 2. Envia Mensagem de Chat Automática no Canal do Pedido
        try {
          await base44.entities.MensagemChat.create({
            canal_tipo: "pedido",
            canal_id: p.id,
            canal_label: `PED #${pedNum}`,
            remetente_id: "SISTEMA_ESTOQUE",
            remetente_nome: "🚨 SISTEMA DE ESTOQUE (AUTOMÁTICO)",
            conteudo: textoMsg,
          });
        } catch (e) {}

        // 3. Envia Mensagem de Chat Automática no Canal da Colagem e Corte EPS
        try {
          await base44.entities.MensagemChat.create({
            canal_tipo: "maquina",
            canal_id: "COLAGEM",
            canal_label: "COLAGEM",
            remetente_id: "SISTEMA_ESTOQUE",
            remetente_nome: "🚨 ALERTA ESTOQUE EPS",
            conteudo: `⚠️ Falta ${placasEstimatativas - disponivel} placas de EPS para o Pedido #${pedNum} (${p.cliente}).`,
          });
        } catch (e) {}

        // 4. Cria Entrada no Painel de Solicitações/Notificações de Produção para os Encarregados
        try {
          await base44.entities.SolicitacaoProducao.create({
            unidade: p.unidade || filialAtiva,
            maquina: "CORTE DE EPS",
            pedido_id: p.id,
            pedido_info: `FALTA EPS — ${p.cliente || "Sem cliente"} #${pedNum}`,
            operador_nome: "SISTEMA AUTOMÁTICO",
            tipo: "falta_eps",
            motivo: `Faltam ${placasEstimatativas - disponivel} placas de EPS no estoque (${disponivel}/${placasEstimatativas} un)`,
            status: "pendente",
          });
        } catch (e) {}

        // 5. Marca o pedido no banco como alerta enviado
        try {
          await base44.entities.Pedido.update(p.id, { alerta_email_eps_enviado: true });
        } catch (e) {}

        playAlertSound();
        toast.error(`⚠️ Alerta automático de falta de EPS enviado por E-mail e Notificação Interna para a Gerência! (Pedido #${pedNum})`, { duration: 6000 });
      }
    });
  }, [pedidosEPS, isopores, emailsAdminsEGerentes]);

  // Filtros aplicados por data, status e busca
  const pedidosFiltrados = useMemo(() => {
    return pedidosEPS.filter(p => {
      if (!p) return false;
      const st = p.eps_status || "pendente";
      const { placasEstimatativas } = calcularNecessidadeEPS(p);
      const disponivel = getEstoqueModel(p.eps);
      const temEstoqueSuficiente = disponivel >= placasEstimatativas;

      // Filtro de Busca
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchNum = (p.numero_pedido || "").toLowerCase().includes(q);
        const matchCli = (p.cliente || "").toLowerCase().includes(q);
        const matchEps = (p.eps || "").toLowerCase().includes(q);
        const matchProd = (p.produto || "").toLowerCase().includes(q);
        if (!matchNum && !matchCli && !matchEps && !matchProd) return false;
      }

      if (filterStatus === "sem_estoque" && temEstoqueSuficiente) return false;
      if (filterStatus !== "todos" && filterStatus !== "sem_estoque" && st !== filterStatus) return false;

      if (!search.trim() && filterStatus === "todos") {
        const pData = p.data || "";
        const isSelectedDay = pData === selectedDay;
        const isEmAndamento = st === "em_corte" || st === "pausado" || (st === "pendente" && pData <= selectedDay);
        return isSelectedDay || isEmAndamento;
      }

      return true;
    }).sort((a, b) => {
      const ord = { em_corte: 0, pausado: 1, pendente: 2, pronto: 3 };
      const stA = a?.eps_status || "pendente";
      const stB = b?.eps_status || "pendente";
      return (ord[stA] ?? 2) - (ord[stB] ?? 2);
    });
  }, [pedidosEPS, selectedDay, search, filterStatus, isopores]);

  // KPIs
  const stats = useMemo(() => {
    let pendentes = 0;
    let emCorte = 0;
    let prontos = 0;
    let semEstoqueCount = 0;
    let totalMetros = 0;
    let totalPlacas = 0;

    pedidosEPS.forEach(p => {
      if (!p) return;
      const st = p.eps_status || "pendente";
      if (st === "pendente") pendentes++;
      if (st === "em_corte" || st === "pausado") emCorte++;
      if (st === "pronto") prontos++;

      const { totalMetrosLinear, placasEstimatativas } = calcularNecessidadeEPS(p);
      const disponivel = getEstoqueModel(p.eps);
      if (st !== "pronto" && disponivel < placasEstimatativas) {
        semEstoqueCount++;
      }

      if (st !== "pronto") {
        totalMetros += totalMetrosLinear;
        totalPlacas += placasEstimatativas;
      }
    });

    return { pendentes, emCorte, prontos, semEstoqueCount, totalMetros, totalPlacas };
  }, [pedidosEPS, isopores]);

  const updateEpsMutation = useMutation({
    mutationFn: ({ id, updates }) => base44.entities.Pedido.update(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-corte-eps"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina"] });
    },
  });

  // Ações de Produção / Cronômetro
  const handleIniciarCorte = (p) => {
    if (!p?.id) return;
    const { placasEstimatativas } = calcularNecessidadeEPS(p);
    const disponivel = getEstoqueModel(p.eps);

    if (disponivel < placasEstimatativas) {
      if (!window.confirm(`⚠️ O estoque de EPS (${disponivel} un) é menor que o necessário (${placasEstimatativas} un) para este pedido. Deseja iniciar mesmo assim?`)) {
        return;
      }
    }

    updateEpsMutation.mutate({
      id: p.id,
      updates: {
        eps_status: "em_corte",
        eps_inicio_corte_ts: new Date().toISOString(),
        eps_observacoes: p.eps_observacoes ? `${p.eps_observacoes}\n— Corte iniciado por ${user?.full_name || "Operador"}` : `Corte iniciado por ${user?.full_name || "Operador"}`,
      }
    });
    toast.info(`Corte de EPS iniciado para Pedido #${p.numero_pedido || p.id.slice(-4)}`);
  };

  const handleOpenPausar = (p) => {
    setPedidoSelecionado(p);
    setMotivoPausa("Ajuste de lâmina/fio");
    setPauseDialog(true);
  };

  const handleConfirmarPausa = () => {
    if (!pedidoSelecionado?.id) return;
    let prodSeg = pedidoSelecionado.eps_tempo_corte_seg || 0;
    if (pedidoSelecionado.eps_inicio_corte_ts) {
      prodSeg += Math.floor((Date.now() - new Date(pedidoSelecionado.eps_inicio_corte_ts).getTime()) / 1000);
    }

    updateEpsMutation.mutate({
      id: pedidoSelecionado.id,
      updates: {
        eps_status: "pausado",
        eps_tempo_corte_seg: prodSeg,
        eps_inicio_corte_ts: null,
        eps_inicio_pausa_ts: new Date().toISOString(),
        eps_motivo_pausa: motivoPausa,
      }
    });

    setPauseDialog(false);
    setPedidoSelecionado(null);
    toast.warning("Corte de EPS pausado.");
  };

  const handleRetomarCorte = (p) => {
    if (!p?.id) return;
    let pausaSeg = p.eps_tempo_pausa_seg || 0;
    if (p.eps_inicio_pausa_ts) {
      pausaSeg += Math.floor((Date.now() - new Date(p.eps_inicio_pausa_ts).getTime()) / 1000);
    }

    updateEpsMutation.mutate({
      id: p.id,
      updates: {
        eps_status: "em_corte",
        eps_tempo_pausa_seg: pausaSeg,
        eps_inicio_pausa_ts: null,
        eps_motivo_pausa: null,
        eps_inicio_corte_ts: new Date().toISOString(),
      }
    });

    toast.success("Corte de EPS retomado!");
  };

  const handleOpenConcluir = (p) => {
    setPedidoSelecionado(p);
    setObservacoesCorte("");
    setCarrinhoLocalizacao("");
    setFotoEpsUrl("");
    setConcluirDialog(true);
  };

  const handleUploadFotoEps = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoEpsUrl(file_url);
      toast.success("Foto do EPS cortado anexada com sucesso!");
    } catch (err) {
      toast.error("Erro no upload da foto: " + err.message);
    } finally {
      setUploadingFoto(false);
    }
  };

  const handleConfirmarConclusao = () => {
    if (!pedidoSelecionado?.id) return;

    if (!fotoEpsUrl) {
      toast.error("A foto do EPS cortado é OBRIGATÓRIA antes de marcar como pronto!");
      return;
    }

    let prodSeg = pedidoSelecionado.eps_tempo_corte_seg || 0;
    if (pedidoSelecionado.eps_inicio_corte_ts) {
      prodSeg += Math.floor((Date.now() - new Date(pedidoSelecionado.eps_inicio_corte_ts).getTime()) / 1000);
    }

    const locStr = carrinhoLocalizacao.trim() ? ` [Local: ${carrinhoLocalizacao.trim()}]` : "";
    const obsStr = observacoesCorte.trim() ? ` — ${observacoesCorte.trim()}` : "";
    const finalObs = `Pronto e separado por ${user?.full_name || "Operador"}${locStr}${obsStr}`;

    updateEpsMutation.mutate({
      id: pedidoSelecionado.id,
      updates: {
        eps_status: "pronto",
        foto_eps_url: fotoEpsUrl,
        eps_tempo_corte_seg: prodSeg,
        eps_inicio_corte_ts: null,
        eps_observacoes: pedidoSelecionado.eps_observacoes ? `${pedidoSelecionado.eps_observacoes}\n${finalObs}` : finalObs,
      }
    });

    playFinishSound();
    setConcluirDialog(false);
    setPedidoSelecionado(null);
    toast.success("EPS marcado como PRONTO e foto enviada para a colagem!");
  };

  const handleOpenEmailAlerta = (p) => {
    setPedidoSelecionado(p);
    setEmailDestinatario(emailsAdminsEGerentes.join(", "));
    setEmailDialog(true);
  };

  const handleEnviarEmailAlerta = async () => {
    if (!pedidoSelecionado) return;
    setEnviandoEmail(true);
    try {
      const { placasEstimatativas } = calcularNecessidadeEPS(pedidoSelecionado);
      const disponivel = getEstoqueModel(pedidoSelecionado.eps);
      const texto = `ALERTA DE FALTA DE EPS / ISOPOR DA FÁBRICA\n\n` +
        `Pedido #: ${pedidoSelecionado.numero_pedido || pedidoSelecionado.id}\n` +
        `Cliente: ${pedidoSelecionado.cliente || "---"}\n` +
        `Especificação: ${pedidoSelecionado.eps || "EPS Padrão"}\n` +
        `Estoque Atual: ${disponivel} placas\n` +
        `Necessário para a OP: ${placasEstimatativas} placas\n` +
        `Diferença em Falta: ${placasEstimatativas - disponivel} placas\n\n` +
        `Por favor, providencie a compra/envio urgente deste insumo de EPS.`;

      await base44.integrations.Core.SendEmail({
        to: emailDestinatario || emailsAdminsEGerentes.join(", "),
        subject: `⚠️ ALERTA DE FALTA DE EPS: Pedido #${pedidoSelecionado.numero_pedido || pedidoSelecionado.id.slice(-4)}`,
        body: texto,
      });

      await base44.entities.Pedido.update(pedidoSelecionado.id, { alerta_email_eps_enviado: true });

      toast.success("E-mail de alerta de falta enviado com sucesso!");
      setEmailDialog(false);
    } catch (err) {
      toast.error("Erro ao enviar e-mail: " + err.message);
    } finally {
      setEnviandoEmail(false);
    }
  };

  const handleReabrir = (p) => {
    if (!p?.id) return;
    updateEpsMutation.mutate({
      id: p.id,
      updates: { eps_status: "pendente" }
    });
    toast.info("Status de EPS reaberto para Pendente.");
  };

  return (
    <div className="p-4 sm:p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-cyan-950 via-slate-900 to-blue-950 text-white rounded-2xl p-6 shadow-lg border border-cyan-800/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-cyan-500/20 text-cyan-400 rounded-2xl border border-cyan-400/30 shadow-inner">
              <Snowflake className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">Painel do Operador de EPS</h1>
                <Badge className="bg-cyan-500/30 text-cyan-200 border-cyan-400/40 text-xs">Isopor & Sanduíche</Badge>
              </div>
              <p className="text-sm text-cyan-100/70 mt-0.5">
                Corte, cronômetro de tempo, foto de comprovação e alertas automáticos para Encarregados.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedDay(format(subDays(new Date(selectedDay + "T00:00:00"), 1), "yyyy-MM-dd"))}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              {isToday(new Date(selectedDay + "T00:00:00")) ? "Hoje" : format(new Date(selectedDay + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSelectedDay(format(addDays(new Date(selectedDay + "T00:00:00"), 1), "yyyy-MM-dd"))}
              className="bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Pendentes</span>
            <Circle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-3xl font-black text-amber-600">{stats.pendentes}</p>
          <p className="text-[11px] text-slate-400 mt-1">Aguardando corte</p>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Em Corte</span>
            <Scissors className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-3xl font-black text-blue-600">{stats.emCorte}</p>
          <p className="text-[11px] text-slate-400 mt-1">Sendo cortados agora</p>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Prontos</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-emerald-600">{stats.prontos}</p>
          <p className="text-[11px] text-slate-400 mt-1">Com foto & separados</p>
        </div>

        <div className={`bg-white border rounded-xl p-4 shadow-sm ${stats.semEstoqueCount > 0 ? "border-red-300 bg-red-50/30" : "border-border"}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wide">Falta Estoque</span>
            <AlertTriangle className="w-4 h-4 text-red-500 animate-pulse" />
          </div>
          <p className="text-3xl font-black text-red-600">{stats.semEstoqueCount}</p>
          <p className="text-[11px] text-red-500 mt-1">E-mail + App Notificados</p>
        </div>

        <div className="bg-white border border-border rounded-xl p-4 shadow-sm bg-gradient-to-br from-cyan-50 to-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-cyan-800 uppercase tracking-wide">Estimativa Placas</span>
            <Layers className="w-4 h-4 text-cyan-600" />
          </div>
          <p className="text-3xl font-black text-cyan-700">≈ {stats.totalPlacas}</p>
          <p className="text-[11px] text-cyan-600 mt-1">~{stats.totalMetros.toFixed(0)}m lineares</p>
        </div>
      </div>

      {/* Buscador e Filtros */}
      <div className="bg-white border border-border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Buscar por nº pedido, cliente, tipo de EPS..." 
              className="pl-9 h-9 text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button 
              size="sm" 
              variant={filterStatus === "todos" ? "default" : "outline"}
              onClick={() => setFilterStatus("todos")}
              className="h-8 text-xs"
            >
              Todos ({pedidosEPS.length})
            </Button>
            <Button 
              size="sm" 
              variant={filterStatus === "pendente" ? "default" : "outline"}
              onClick={() => setFilterStatus("pendente")}
              className="h-8 text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
            >
              🟡 Pendentes ({stats.pendentes})
            </Button>
            <Button 
              size="sm" 
              variant={filterStatus === "em_corte" ? "default" : "outline"}
              onClick={() => setFilterStatus("em_corte")}
              className="h-8 text-xs text-blue-700 border-blue-300 hover:bg-blue-50"
            >
              🔵 Em Corte ({stats.emCorte})
            </Button>
            <Button 
              size="sm" 
              variant={filterStatus === "pronto" ? "default" : "outline"}
              onClick={() => setFilterStatus("pronto")}
              className="h-8 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              🟢 Prontos ({stats.prontos})
            </Button>
            {stats.semEstoqueCount > 0 && (
              <Button 
                size="sm" 
                variant={filterStatus === "sem_estoque" ? "destructive" : "outline"}
                onClick={() => setFilterStatus("sem_estoque")}
                className="h-8 text-xs text-red-700 border-red-300 hover:bg-red-50"
              >
                🔴 Falta Estoque ({stats.semEstoqueCount})
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Ordens de EPS */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-cyan-600 rounded-full animate-spin" />
        </div>
      ) : pedidosFiltrados.length === 0 ? (
        <div className="bg-white border border-border rounded-xl p-12 text-center text-slate-500 space-y-2">
          <Snowflake className="w-12 h-12 mx-auto text-slate-300" />
          <h3 className="font-bold text-slate-700">Nenhum pedido de EPS encontrado</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Não há ordens pendentes de corte de isopor para o filtro ou busca informada.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pedidosFiltrados.map((p) => {
            const st = p.eps_status || "pendente";
            const cfg = STATUS_EPS_LABELS[st] || STATUS_EPS_LABELS.pendente;
            const IconSt = cfg.icon;
            const { totalMetrosLinear, placasEstimatativas, detalhamento } = calcularNecessidadeEPS(p);

            const disponivel = getEstoqueModel(p.eps);
            const semEstoque = disponivel < placasEstimatativas;

            // Tempo acumulado em segundos no corte
            let tempoProdSeg = p.eps_tempo_corte_seg || 0;
            if (st === "em_corte" && p.eps_inicio_corte_ts) {
              tempoProdSeg += Math.floor((Date.now() - new Date(p.eps_inicio_corte_ts).getTime()) / 1000);
            }

            return (
              <div 
                key={p.id} 
                className={`bg-white border-2 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                  st === "em_corte" 
                    ? "border-blue-400 bg-blue-50/20" 
                    : st === "pausado"
                    ? "border-purple-300 bg-purple-50/20"
                    : st === "pronto" 
                    ? "border-emerald-300 bg-emerald-50/10 opacity-90" 
                    : semEstoque
                    ? "border-red-300 bg-red-50/10"
                    : "border-slate-200"
                }`}
              >
                <div className="space-y-3">
                  {/* Header do Card */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-bold text-base text-slate-900 font-mono block">
                        #{p.numero_pedido || (p.id ? p.id.slice(-6).toUpperCase() : "---")}
                      </span>
                      <p className="text-xs font-semibold text-slate-700 truncate max-w-[200px]">
                        {p.cliente || "Cliente não informado"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={`border text-xs gap-1 font-semibold ${cfg.cls}`}>
                        <IconSt className="w-3 h-3" />
                        {cfg.label}
                      </Badge>
                      {semEstoque && st !== "pronto" && (
                        <Badge className="bg-red-600 text-white border-red-700 text-[10px] gap-1 animate-pulse">
                          <AlertTriangle className="w-2.5 h-2.5" /> ESTOQUE INSUFICIENTE
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Cronômetro se em corte ou pausado */}
                  {(st === "em_corte" || st === "pausado" || tempoProdSeg > 0) && (
                    <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-mono">
                      <span className="flex items-center gap-1.5 text-cyan-300 font-sans">
                        <Timer className="w-3.5 h-3.5 text-cyan-400" />
                        Tempo de Corte:
                      </span>
                      <span className="font-bold text-sm tracking-wider text-emerald-400">
                        {formatTempo(tempoProdSeg)}
                      </span>
                    </div>
                  )}

                  {/* Alerta de Falta de Estoque + Botão de Reenvio Manual se desejado */}
                  {semEstoque && st !== "pronto" && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-xs text-red-900 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="font-bold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5 text-red-600" /> Estoque: {disponivel} un (Necessário: {placasEstimatativas} un)
                          </p>
                          <p className="text-[10px] text-red-700">Faltam {placasEstimatativas - disponivel} placas no galpão.</p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleOpenEmailAlerta(p)}
                          className="h-7 text-[10px] gap-1 px-2 border-red-300 text-red-700 hover:bg-red-100 flex-shrink-0"
                        >
                          <Mail className="w-3 h-3" /> Reenviar E-mail
                        </Button>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        E-mail & Notificação no App Enviados Automaticamente para a Gerência
                      </div>
                    </div>
                  )}

                  {/* Detalhes do Produto e Máquina */}
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium">Produto:</span>
                      <span className="font-bold text-slate-900">{p.produto || "Telha Sanduíche"}</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium">Destino Fábrica:</span>
                      <Badge variant="outline" className="text-[10px] font-bold bg-white text-slate-800">
                        {p.maquina || "COLAGEM"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-slate-600">
                      <span className="font-medium">Especificação EPS:</span>
                      <span className="font-bold text-cyan-700 bg-cyan-50 px-2 py-0.5 rounded border border-cyan-200">
                        {p.eps || "EPS Padrão"}
                      </span>
                    </div>
                  </div>

                  {/* Necessidade Calculada de EPS */}
                  <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-xl p-3 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-cyan-900 flex items-center gap-1">
                        <Scissors className="w-3.5 h-3.5 text-cyan-600" />
                        Necessidade de EPS:
                      </span>
                      <span className="font-black text-cyan-700 text-sm">
                        ≈ {placasEstimatativas} placas ({totalMetrosLinear.toFixed(1)}m)
                      </span>
                    </div>
                    {detalhamento.length > 0 && (
                      <div className="text-[10px] text-cyan-800/80 pt-1 border-t border-cyan-200/60 space-y-0.5">
                        {detalhamento.map((d, idx) => (
                          <p key={idx} className="font-mono">{d}</p>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Foto do EPS cortado se já pronto */}
                  {p.foto_eps_url && (
                    <div className="border border-emerald-300 bg-emerald-50/50 rounded-xl p-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img src={p.foto_eps_url} alt="Foto EPS" className="w-10 h-10 object-cover rounded border border-emerald-400" />
                        <div>
                          <p className="text-xs font-bold text-emerald-900">Foto do EPS Anexada</p>
                          <p className="text-[10px] text-emerald-700">Enviada para o operador da colagem</p>
                        </div>
                      </div>
                      <ImageLink url={p.foto_eps_url} name="Foto EPS Cortado">
                        <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-400 text-emerald-800">Ver</Button>
                      </ImageLink>
                    </div>
                  )}

                  {/* Observações registradas */}
                  {p.eps_observacoes && (
                    <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900">
                      <span className="font-bold">Histórico / Obs:</span>
                      <p className="whitespace-pre-line text-amber-800 mt-0.5">{p.eps_observacoes}</p>
                    </div>
                  )}
                </div>

                {/* Footer do Card - Botões de Ação */}
                <div className="pt-4 mt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    {p.foto_pedido_url && (
                      <ImageLink url={p.foto_pedido_url} name="Desenho / Foto da OP">
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1 border-blue-200 text-blue-800 bg-blue-50" title="Ver foto/desenho da OP">
                          <FileText className="w-3.5 h-3.5 text-blue-600" /> Foto OP
                        </Button>
                      </ImageLink>
                    )}
                    <ChatPedidoButton 
                      canal_id={p.id} 
                      canal_label={`EPS #${p.numero_pedido || (p.id ? p.id.slice(-4) : "")}`} 
                      currentUser={user} 
                    />
                  </div>

                  <div className="flex items-center gap-1.5">
                    {st === "pendente" && (
                      <Button 
                        size="sm" 
                        onClick={() => handleIniciarCorte(p)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5 shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" /> Iniciar Corte
                      </Button>
                    )}

                    {st === "em_corte" && (
                      <>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleOpenPausar(p)}
                          className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs h-8 gap-1"
                        >
                          <Pause className="w-3.5 h-3.5" /> Pausar
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => handleOpenConcluir(p)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 gap-1.5 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Marcar Pronto
                        </Button>
                      </>
                    )}

                    {st === "pausado" && (
                      <Button 
                        size="sm" 
                        onClick={() => handleRetomarCorte(p)}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 gap-1.5 shadow-sm"
                      >
                        <Play className="w-3.5 h-3.5" /> Retomar
                      </Button>
                    )}

                    {st === "pronto" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleReabrir(p)}
                        className="text-slate-600 border-slate-300 hover:bg-slate-100 text-xs h-8 gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog Pausa */}
      <Dialog open={pauseDialog} onOpenChange={setPauseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-900">
              <Pause className="w-5 h-5 text-purple-600" /> Pausar Corte de EPS
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-xs">
            <p className="text-slate-600">Selecione o motivo da pausa do corte de EPS:</p>
            <div className="grid grid-cols-2 gap-2">
              {["Ajuste de lâmina/fio", "Troca de bloco de EPS", "Aguardando insumo/cola", "Manutenção na máquina"].map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMotivoPausa(m)}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold transition-all ${
                    motivoPausa === m ? "border-purple-600 bg-purple-50 text-purple-900" : "border-slate-200 hover:border-purple-300"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPauseDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmarPausa} className="bg-purple-600 hover:bg-purple-700 text-white">
              Confirmar Pausa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Concluir / Tirar Foto OBRIGATÓRIA do EPS */}
      <Dialog open={concluirDialog} onOpenChange={setConcluirDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Camera className="w-5 h-5 text-emerald-600" />
              Foto Obrigatória & Conclusão do EPS
            </DialogTitle>
          </DialogHeader>
          {pedidoSelecionado && (
            <div className="space-y-4 py-2 text-xs">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-emerald-950 space-y-1">
                <p className="font-bold text-sm">Pedido #{pedidoSelecionado.numero_pedido || (pedidoSelecionado.id ? pedidoSelecionado.id.slice(-6).toUpperCase() : "")}</p>
                <p className="text-emerald-800 font-medium">{pedidoSelecionado.cliente || "Sem cliente"}</p>
                <p className="text-emerald-700 font-mono">Especificação: {pedidoSelecionado.eps || "EPS Padrão"}</p>
              </div>

              {/* Upload Obrigatório de Foto do EPS Cortado */}
              <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center space-y-3">
                <Camera className="w-10 h-10 mx-auto text-orange-500" />
                <div>
                  <p className="font-bold text-slate-800">Tire uma foto dos blocos de EPS cortados</p>
                  <p className="text-[11px] text-slate-500">A foto aparecerá na tela do operador da Colagem para validação.</p>
                </div>

                <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => handleUploadFotoEps(e.target.files[0])} />
                <input ref={fotoScanRef} type="file" accept="image/*" className="hidden"
                  onChange={e => handleUploadFotoEps(e.target.files[0])} />

                {fotoEpsUrl ? (
                  <div className="relative border-2 border-emerald-500 rounded-xl overflow-hidden max-h-[180px] bg-slate-900 flex items-center justify-center">
                    <img src={fotoEpsUrl} alt="Foto do EPS" className="max-h-[180px] w-auto object-contain" />
                    <span className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">✓ Foto Anexada</span>
                  </div>
                ) : (
                  <UploadButton label="Tirar / Anexar Foto do EPS" icon={Camera} cameraRef={fotoInputRef} fileRef={fotoScanRef} uploading={uploadingFoto} size="default" variant="default" />
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-500" /> Carrinho / Local de Separação
                </Label>
                <Input 
                  placeholder="Ex: Carrinho #3 / Bancada de Colagem" 
                  value={carrinhoLocalizacao}
                  onChange={e => setCarrinhoLocalizacao(e.target.value)}
                  className="h-9"
                />
                <p className="text-[10px] text-slate-400">Indique onde você colocou o EPS cortado.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold">Observações / Detalhes (Opcional)</Label>
                <Textarea 
                  placeholder="Ex: Cortadas 24 placas de 30mm com os recortes perfeitos..." 
                  value={observacoesCorte}
                  onChange={e => setObservacoesCorte(e.target.value)}
                  className="h-16"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConcluirDialog(false)}>Cancelar</Button>
            <Button 
              onClick={handleConfirmarConclusao} 
              disabled={!fotoEpsUrl}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <Check className="w-4 h-4" /> Finalizar e Enviar para Colagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Alerta E-mail Falta de Estoque (Manual / Reenvio) */}
      <Dialog open={emailDialog} onOpenChange={setEmailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-900">
              <Mail className="w-5 h-5 text-red-600" />
              Enviar E-mail de Alerta de Falta de EPS
            </DialogTitle>
          </DialogHeader>
          {pedidoSelecionado && (
            <div className="space-y-4 py-2 text-xs">
              <p className="text-slate-600">
                O e-mail contendo os detalhes do pedido e a quantidade faltante de placas de EPS será enviado para os administradores e encarregados:
              </p>
              <div className="space-y-1.5">
                <Label className="text-slate-700 font-semibold">E-mail(s) do(s) Destinatário(s)</Label>
                <Input 
                  type="email" 
                  value={emailDestinatario}
                  onChange={e => setEmailDestinatario(e.target.value)}
                  placeholder="compras@ajl.com.br"
                  className="h-9 font-mono"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEmailDialog(false)}>Cancelar</Button>
            <Button 
              onClick={handleEnviarEmailAlerta}
              disabled={enviandoEmail}
              className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
            >
              <Send className="w-4 h-4" /> {enviandoEmail ? "Enviando..." : "Enviar E-mail Agora"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
