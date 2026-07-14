import React from "react";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, FileText, AlertCircle, Factory, CheckCircle2, Truck, Package, Clock, Warehouse } from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "bg-slate-100 text-slate-700", icon: Package },
  em_producao: { label: "Em Produção", color: "bg-blue-100 text-blue-700", icon: Factory },
  pausado: { label: "Pausado", color: "bg-amber-100 text-amber-700", icon: AlertCircle },
  aguardando_colagem: { label: "Aguardando Colagem", color: "bg-purple-100 text-purple-700", icon: Factory },
  aguardando_corte: { label: "Aguardando Corte", color: "bg-orange-100 text-orange-700", icon: Factory },
  aguardando_material: { label: "Aguardando Material", color: "bg-red-100 text-red-700", icon: AlertCircle },
  finalizado: { label: "Finalizado", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-700", icon: AlertCircle },
};

export function calcProgresso(card) {
  if (card.tipo === "telhas") {
    const s = card.status;
    if (s === "finalizado") return 100;
    if (s === "aguardando_colagem") return 75;
    if (s === "em_producao") return 50;
    if (s === "aguardando_material") return 5;
    if (s === "pendente") return 10;
    return 0;
  }
  if (!card.ops || card.ops.length === 0) return 0;
  const done = card.ops.filter(o => o.status === "finalizado").length;
  return Math.round((done / card.ops.length) * 100);
}

const TIMELINE_STAGES = [
  { key: 0, label: "Aguardando", icon: Clock },
  { key: 1, label: "Em Fabricação", icon: Factory },
  { key: 2, label: "Pronto na Expedição", icon: Warehouse },
  { key: 3, label: "A Caminho", icon: Truck },
  { key: 4, label: "Entregue", icon: CheckCircle2 },
];

function getTimelineStage(card) {
  const { status, status_expedicao } = card;
  if (status_expedicao === "expedido") return 4;
  if (status_expedicao === "em_transito" || status_expedicao === "carregado") return 3;
  if (status === "finalizado") return 2;
  if (["em_producao", "aguardando_corte", "aguardando_colagem", "pausado"].includes(status)) return 1;
  return 0;
}

function getUrgency(data_prevista) {
  if (!data_prevista) return null;
  const date = new Date(data_prevista);
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0) return { label: "Atrasado", color: "bg-red-500 text-white" };
  if (days === 0) return { label: "Entrega Hoje", color: "bg-red-500 text-white" };
  if (days === 1) return { label: "Entrega Amanhã", color: "bg-orange-500 text-white" };
  if (days <= 3) return { label: `Em ${days} dias`, color: "bg-amber-100 text-amber-800" };
  return null;
}

export default function PedidoVendedorCard({ card, onVerDetalhes, unreadCount = 0 }) {
  const progresso = calcProgresso(card);
  const urgency = getUrgency(card.data_prevista);
  const statusCfg = STATUS_CONFIG[card.status] || STATUS_CONFIG.pendente;
  const StatusIcon = statusCfg.icon;
  const currentStage = getTimelineStage(card);
  const opsProntas = card.ops ? card.ops.filter(o => o.status === "finalizado").length : 0;

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono font-bold text-sm text-foreground">#{card.numero_pedido || "—"}</span>
            <Badge variant="outline" className={`text-xs ${card.setor === "Telhas" ? "border-blue-300 text-blue-700" : "border-orange-300 text-orange-700"}`}>
              {card.setor}
            </Badge>
          </div>
          <p className="font-semibold text-foreground mt-0.5 truncate">{card.cliente || "Cliente não informado"}</p>
        </div>
        {urgency && (
          <Badge className={`text-xs flex-shrink-0 ${urgency.color}`}>
            <AlertCircle className="w-3 h-3 mr-1" />
            {urgency.label}
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {card.data_prevista && (
          <span>Prazo: <strong className="text-foreground">{format(new Date(card.data_prevista), "dd/MM", { locale: ptBR })}</strong></span>
        )}
        <span className="flex items-center gap-1">
          <StatusIcon className="w-3 h-3" />
          {statusCfg.label}
        </span>
      </div>

      <p className="text-sm text-foreground line-clamp-2">{card.descricao}</p>

      {/* Linha do tempo comercial */}
      <div className="py-1">
        <div className="flex items-center">
          {TIMELINE_STAGES.map((stage, i) => {
            const StageIcon = stage.icon;
            const isCompleted = currentStage > stage.key;
            const isCurrent = currentStage === stage.key;
            return (
              <React.Fragment key={stage.key}>
                <div className="flex flex-col items-center flex-shrink-0" style={{ width: "52px" }}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    isCompleted ? "bg-emerald-500 text-white" :
                    isCurrent ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-1" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    <StageIcon className="w-3 h-3" />
                  </div>
                  <span className={`text-[9px] mt-1 text-center leading-tight ${
                    isCompleted ? "text-emerald-600 font-medium" :
                    isCurrent ? "text-foreground font-semibold" :
                    "text-muted-foreground"
                  }`}>
                    {stage.label}
                  </span>
                  {stage.key === 1 && isCurrent && card.tipo === "corte_dobra" && card.ops && (
                    <span className="text-[9px] text-blue-600 font-bold">{opsProntas}/{card.ops.length} OPs</span>
                  )}
                </div>
                {i < TIMELINE_STAGES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-0.5 -mt-4 ${currentStage > stage.key ? "bg-emerald-500" : "bg-muted"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={() => onVerDetalhes(card)}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1.5 rounded-lg hover:bg-primary/5"
        >
          <FileText className="w-3.5 h-3.5" />
          Ver OPs e Fotos
        </button>
        {unreadCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-blue-600 px-2 py-1.5 bg-blue-50 rounded-lg">
            <MessageSquare className="w-3.5 h-3.5" />
            {unreadCount} msg{unreadCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}