import React from "react";
import { Badge } from "@/components/ui/badge";
import {
  Circle, Clock, Pause, CheckCircle2, AlertCircle, Star,
  Layers, Package, ShoppingCart, Ruler, Weight, DollarSign, Scissors, MapPin, Calendar,
  Timer, Coffee, Square, Loader2, FileText,
} from "lucide-react";
import SafeImage from "./SafeImage";
import DualPhotoGallery from "@/components/corte-dobra/DualPhotoGallery";
import CorChapaDot, { extractEspessuraFromDesc } from "@/components/corte-dobra/CorChapaDot";
import ChatPedidoButton from "@/components/chat/ChatPedidoButton";
import { HistoricoPedidoButton } from "@/components/corte-dobra/HistoricoPedidoSidebar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatTempo(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  return `${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}

function StatusBadge({ status }) {
  const cfg = {
    pendente:          { label: "Pendente",     Icon: Circle,       color: "bg-slate-100 text-slate-600 border-slate-200" },
    aguardando_corte:  { label: "Aguard. Corte", Icon: Clock,       color: "bg-orange-100 text-orange-700 border-orange-200" },
    em_producao:       { label: "Em Andamento", Icon: Clock,        color: "bg-green-100 text-green-700 border-green-200" },
    pausado:           { label: "Pausado",      Icon: Pause,        color: "bg-purple-100 text-purple-700 border-purple-200" },
    finalizado:        { label: "Concluído",    Icon: CheckCircle2, color: "bg-green-100 text-green-700 border-green-200" },
    cancelado:         { label: "Cancelado",    Icon: AlertCircle,  color: "bg-red-100 text-red-700 border-red-200" },
  }[status] || { label: status, Icon: Circle, color: "bg-slate-100 text-slate-600" };
  return (
    <Badge className={`border text-xs ${cfg.color}`}>
      <cfg.Icon className="w-3 h-3 mr-1" />{cfg.label}
    </Badge>
  );
}

function SpecRow({ icon: Icon, label, value, highlight }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50 transition-colors">
      <span className="flex items-center gap-1.5 text-xs text-slate-500">
        <Icon className="w-3.5 h-3.5 text-slate-400" />
        {label}
      </span>
      <span className={`text-sm font-bold ${highlight || "text-slate-800"}`}>{value}</span>
    </div>
  );
}

export default function DetalheOPPanel({ ordem: o, pedidoSeq, user, ordens, isGestor, onAmpliarFoto }) {
  if (!o) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-white text-center p-8">
        <Layers className="w-12 h-12 text-slate-200 mb-3" />
        <p className="text-sm text-slate-400">Selecione uma OP na lista à esquerda para ver os detalhes</p>
      </div>
    );
  }

  const codOP = `[${o.id.slice(-6).toUpperCase()}]`;
  const espessura = extractEspessuraFromDesc(o.chapa_descricao) || extractEspessuraFromDesc(o.bobina_descricao) || extractEspessuraFromDesc(o.desenvolvimento_descricao);
  const fotoPrincipal = o.foto_pedido_url || o.foto_material_url || o.foto_finalizacao_url;

  // Cronômetros ao vivo
  const now = Date.now();
  let tempoProd = o.tempo_producao_seg || 0;
  let tempoPausa = o.tempo_pausa_seg || 0;
  let tempoSetup = o.tempo_setup_seg || 0;
  if (o.status === "em_producao" && o.inicio_producao_ts) {
    tempoProd += Math.floor((now - new Date(o.inicio_producao_ts).getTime()) / 1000);
  }
  if (o.status === "pausado" && o.inicio_pausa_ts) {
    const delta = Math.floor((now - new Date(o.inicio_pausa_ts).getTime()) / 1000);
    if (o.motivo_pausa === "setup") tempoSetup += delta;
    else tempoPausa += delta;
  }
  const showCron = o.status === "em_producao" || o.status === "pausado" || tempoProd > 0;

  // Roteiro de operações — se Guilhotina com dobra vinculada
  const isGuilhotina = o.maquina === "CORTE 3M" || o.maquina === "CORTE 6M";
  const temDobraVinculada = !!o.ordem_dobra_maquina;

  return (
    <div className="flex-1 flex flex-col bg-white overflow-y-auto">
      {/* Cabeçalho da OP */}
      <div className="px-5 py-4 border-b border-slate-200">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight">{codOP}</h1>
            <StatusBadge status={o.status} />
            {o.prioridade && (
              <Badge className="bg-amber-500 text-white border-amber-600 animate-pulse text-xs">
                <Star className="w-3 h-3 mr-0.5 fill-white" /> PRIORIDADE
              </Badge>
            )}
            {o.data < format(new Date(), "yyyy-MM-dd") && o.status !== "finalizado" && o.status !== "cancelado" && (
              <Badge className="bg-red-500 text-white border-red-600 animate-pulse text-xs">
                <AlertCircle className="w-3 h-3 mr-0.5" /> PRIORIDADE — DIA ANTERIOR
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {o.numero_pedido && <HistoricoPedidoButton numeroPedido={o.numero_pedido} size="sm" />}
            <ChatPedidoButton canal_id={o.id} canal_label={`OP ${o.maquina || "CD"} ${o.numero_pedido || codOP}`} currentUser={user} />
          </div>
        </div>
        {/* Metadados */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          {o.cliente && <span>Cliente: <strong className="text-slate-700">{o.cliente}</strong></span>}
          {o.numero_pedido && <span>Pedido: <strong className="text-slate-700">#{o.numero_pedido}</strong></span>}
          {pedidoSeq && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500 text-white">{pedidoSeq}</span>}
          {o.vendedor && <span>Vendedor: <strong className="text-slate-700">{o.vendedor}</strong></span>}
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {/* Galeria de Fotos */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Desenho / Foto do Pedido</p>
          {fotoPrincipal ? (
            <div className="relative rounded-xl overflow-hidden border-2 border-slate-200 group">
              <SafeImage url={fotoPrincipal} name="Foto principal" className="w-full h-48" imgClassName="object-cover" />
              <button
                onClick={onAmpliarFoto}
                className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-2 py-1 rounded-lg hover:bg-black/80 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <FileText className="w-3 h-3" /> Ver todas as fotos
              </button>
            </div>
          ) : (
            <SafeImage url="" className="w-full h-48" />
          )}
          {/* Mini galeria adicional */}
          {(o.foto_pedido_url || o.foto_material_url || o.foto_finalizacao_url) && (
            <div className="mt-2">
              <DualPhotoGallery fotoPedidoUrl={o.foto_pedido_url} fotoMaterialUrl={o.foto_material_url} fotoFinalizacaoUrl={o.foto_finalizacao_url} z="normal" />
            </div>
          )}
        </div>

        {/* Grid de Especificações */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Especificações Técnicas</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0">
            <SpecRow icon={Layers} label="Espessura" value={espessura ? `${String(espessura).replace(".", ",")}mm` : "—"} />
            <SpecRow icon={Ruler} label="Largura" value={o.chapa_descricao?.match(/(\d+)\s*mm/)?.[1] ? `${o.chapa_descricao.match(/(\d+)\s*mm/)[1]}mm` : "—"} />
            <SpecRow icon={Package} label="Peças" value={o.quantidade || "—"} highlight="text-blue-600" />
            <SpecRow icon={Weight} label="Peso Est." value={o.peso_kg ? `${o.peso_kg} kg` : "—"} highlight="text-emerald-600" />
            <SpecRow icon={DollarSign} label="Valor" value={o.valor_pago_cliente ? `R$ ${o.valor_pago_cliente}` : "—"} highlight="text-green-600" />
            <SpecRow icon={Scissors} label="Corte" value={o.dimensoes_livres || o.maquina || "—"} />
            <SpecRow icon={MapPin} label="Rota" value={o.cliente ? "—": "—"} />
            <SpecRow icon={Calendar} label="Data Fab." value={o.data ? format(new Date(o.data + "T12:00:00"), "dd/MM", { locale: ptBR }) : "—"} />
          </div>
          {o.desenvolvimento_descricao && (
            <div className="mt-2 pt-2 border-t border-slate-200">
              <p className="text-xs text-emerald-700 font-medium">📐 {o.desenvolvimento_descricao}</p>
            </div>
          )}
          {o.observacoes && (
            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-1.5 text-xs text-yellow-800">
              📋 {o.observacoes}
            </div>
          )}
        </div>

        {/* Cronômetros */}
        {showCron && (
          <div className="grid grid-cols-3 gap-2">
            <div className={`rounded-xl px-3 py-2 text-center ${o.status === "em_producao" ? "bg-green-50 border border-green-200" : "bg-slate-50 border border-slate-200"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Timer className="w-3 h-3 text-green-600" />
                <span className="text-[10px] text-slate-500">Produção</span>
              </div>
              <p className={`text-sm font-bold tabular-nums ${o.status === "em_producao" ? "text-green-700" : "text-slate-600"}`}>{formatTempo(tempoProd)}</p>
            </div>
            <div className={`rounded-xl px-3 py-2 text-center ${o.status === "pausado" && o.motivo_pausa !== "setup" ? "bg-amber-50 border border-amber-200" : "bg-slate-50 border border-slate-200"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Coffee className="w-3 h-3 text-amber-600" />
                <span className="text-[10px] text-slate-500">Pausa</span>
              </div>
              <p className={`text-sm font-bold tabular-nums ${o.status === "pausado" && o.motivo_pausa !== "setup" ? "text-amber-700" : "text-slate-600"}`}>{formatTempo(tempoPausa)}</p>
            </div>
            <div className={`rounded-xl px-3 py-2 text-center ${o.status === "pausado" && o.motivo_pausa === "setup" ? "bg-purple-50 border border-purple-200" : "bg-slate-50 border border-slate-200"}`}>
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Square className="w-3 h-3 text-purple-600" />
                <span className="text-[10px] text-slate-500">Setup</span>
              </div>
              <p className={`text-sm font-bold tabular-nums ${o.status === "pausado" && o.motivo_pausa === "setup" ? "text-purple-700" : "text-slate-600"}`}>{formatTempo(tempoSetup)}</p>
            </div>
          </div>
        )}

        {/* Roteiro de Operações / Checklist */}
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Roteiro de Operações</p>
            <span className="text-xs text-slate-500">
              {o.status === "finalizado" ? "1 de 1 concluída" : isGuilhotina && temDobraVinculada ? "1 de 2 concluída" : "0 de 1 concluída"}
            </span>
          </div>
          {/* Progress bar */}
          <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-green-500 transition-all"
              style={{ width: o.status === "finalizado" ? "100%" : isGuilhotina && temDobraVinculada ? "50%" : o.status === "em_producao" ? "25%" : "0%" }}
            />
          </div>

          {/* Etapas */}
          <div className="space-y-1.5">
            {/* OP1 - Corte */}
            <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
              o.status === "finalizado" ? "bg-green-50 border-green-300"
              : o.status === "em_producao" ? "bg-orange-50 border-orange-400 ring-1 ring-orange-200"
              : o.status === "pausado" ? "bg-amber-50 border-amber-300"
              : "bg-white border-slate-200"
            }`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                o.status === "finalizado" ? "bg-green-500 text-white"
                : o.status === "em_producao" ? "bg-orange-500 text-white"
                : "bg-slate-200 text-slate-500"
              }`}>
                {o.status === "finalizado" ? <CheckCircle2 className="w-3.5 h-3.5" />
                  : o.status === "em_producao" ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <span className="text-[10px] font-bold">1</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-700">{isGuilhotina ? "OP1 — Corte Guilhotina" : "OP1 — Produção"}</p>
                <p className="text-[10px] text-slate-400">{o.maquina} · {o.tipo_peca || o.chapa_descricao || ""}</p>
              </div>
              {o.status === "finalizado" && <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">CONCLUÍDO</Badge>}
              {o.status === "em_producao" && <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] animate-pulse">EM ANDAMENTO</Badge>}
              {o.status === "pausado" && <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">PAUSADO</Badge>}
              {(o.status === "pendente" || o.status === "aguardando_corte") && <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">PENDENTE</Badge>}
            </div>

            {/* OP2 - Dobra (se guilhotina com dobra vinculada) */}
            {isGuilhotina && temDobraVinculada && (
              <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                o.status === "finalizado" ? "bg-orange-50 border-orange-400 ring-1 ring-orange-200"
                : "bg-white border-slate-200"
              }`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  o.status === "finalizado" ? "bg-orange-500 text-white" : "bg-slate-200 text-slate-500"
                }`}>
                  {o.status === "finalizado" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-[10px] font-bold">2</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-700">OP2 — Dobra Pendente</p>
                  <p className="text-[10px] text-slate-400">{o.ordem_dobra_maquina}</p>
                </div>
                <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">{o.status === "finalizado" ? "EM ANDAMENTO" : "PENDENTE"}</Badge>
              </div>
            )}
          </div>

          {/* Material info */}
          <div className="mt-3 pt-2 border-t border-slate-200 flex items-center gap-2 text-xs">
            {o.chapa_origem === "chaparia" ? <Layers className="w-3.5 h-3.5 text-orange-500" /> : <Package className="w-3.5 h-3.5 text-blue-500" />}
            <span className="font-mono text-slate-600 truncate">{o.chapa_origem === "chaparia" ? (o.chapa_descricao || "Chapa") : (o.bobina_descricao || o.chapa_descricao || "Bobina")}</span>
            <CorChapaDot espessura={espessura} size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}