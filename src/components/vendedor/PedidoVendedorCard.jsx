import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MessageSquare, FileText, AlertCircle, Factory, CheckCircle2,
  Truck, Package, Clock, Warehouse, Camera, Disc, Share2, Check,
  Layers, User, Zap
} from "lucide-react";
import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { gerarMensagemWhatsApp } from "@/lib/vendedorHelper";

function getUrgency(data_prevista) {
  if (!data_prevista) return null;
  const date = new Date(data_prevista);
  if (isNaN(date.getTime())) return null;
  const days = differenceInCalendarDays(date, new Date());
  if (days < 0) return { label: `${Math.abs(days)}d em atraso`, color: "bg-red-500 text-white" };
  if (days === 0) return { label: "Entrega Hoje", color: "bg-red-500 text-white" };
  if (days === 1) return { label: "Entrega Amanhã", color: "bg-orange-500 text-white" };
  if (days <= 3) return { label: `Em ${days} dias`, color: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" };
  return null;
}

export default function PedidoVendedorCard({ card, onVerDetalhes, unreadCount = 0 }) {
  const [copiado, setCopiado] = useState(false);

  const urgency = getUrgency(card.data_prevista);
  const statusOp = card.statusOperacional || {
    chave: "aguardando_pcp",
    label: "Aguardando PCP",
    sublabel: "Aguardando liberação"
  };

  const pct = card.percentual || 0;
  const totalFotos = card.fotos?.total || 0;
  const bobinas = card.bobinasUtilizadas || [];

  const handleCopiarWhatsApp = (e) => {
    e.stopPropagation();
    const texto = gerarMensagemWhatsApp(card);
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(true);
      toast.success(`Resumo do Pedido #${card.numero_pedido} copiado para envio no WhatsApp!`);
      setTimeout(() => setCopiado(false), 2500);
    }).catch(() => {
      toast.error("Não foi possível copiar o texto.");
    });
  };

  return (
    <div
      onClick={() => onVerDetalhes(card)}
      className="bg-card rounded-xl border border-border shadow-xs hover:shadow-md hover:border-primary/40 transition-all p-4 space-y-3 cursor-pointer flex flex-col justify-between"
    >
      <div className="space-y-2.5">
        {/* Topo: Número, Setor, Vendedor e Urgência */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-sm text-foreground">
                #{card.numero_pedido || "—"}
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] font-bold px-1.5 py-0.5 ${
                  card.setor === "Telhas"
                    ? "border-blue-300 text-blue-700 bg-blue-50/50 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/40"
                    : "border-orange-300 text-orange-700 bg-orange-50/50 dark:border-orange-800 dark:text-orange-300 dark:bg-orange-950/40"
                }`}
              >
                {card.setor}
              </Badge>
              {card.vendedor && card.vendedor !== "—" && (
                <Badge variant="secondary" className="text-[10px] text-muted-foreground font-medium py-0 px-1.5">
                  <User className="w-2.5 h-2.5 mr-0.5" />
                  {card.vendedor}
                </Badge>
              )}
            </div>
            <p className="font-bold text-base text-foreground mt-1 truncate" title={card.cliente}>
              {card.cliente || "Cliente não informado"}
            </p>
          </div>

          {urgency && (
            <Badge className={`text-[10px] font-bold shrink-0 px-2 py-0.5 ${urgency.color}`}>
              <AlertCircle className="w-3 h-3 mr-1" />
              {urgency.label}
            </Badge>
          )}
        </div>

        {/* Badge de Status Operacional em Tempo Real em Destaque */}
        <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              {statusOp.chave === "produzindo" && <Zap className="w-3.5 h-3.5 text-blue-500 animate-pulse" />}
              {statusOp.chave === "colagem" && <Layers className="w-3.5 h-3.5 text-purple-500" />}
              {statusOp.chave === "pronto_patio" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
              {statusOp.chave === "em_transito" && <Truck className="w-3.5 h-3.5 text-indigo-500" />}
              {statusOp.chave === "fila_maquina" && <Clock className="w-3.5 h-3.5 text-amber-500" />}
              {statusOp.chave === "aguardando_pcp" && <Package className="w-3.5 h-3.5 text-slate-400" />}
              {statusOp.label}
            </span>
            <span className="text-xs font-mono font-extrabold text-primary">
              {pct}%
            </span>
          </div>

          {/* Barra de Progresso Real */}
          <div className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                pct >= 100
                  ? "bg-emerald-500"
                  : pct > 50
                  ? "bg-blue-500"
                  : "bg-orange-500"
              }`}
              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
            />
          </div>

          {statusOp.sublabel && (
            <p className="text-[11px] text-muted-foreground truncate">
              {statusOp.sublabel}
            </p>
          )}
        </div>

        {/* Descrição resumida dos itens */}
        <p className="text-xs text-muted-foreground line-clamp-2">
          {card.descricao}
        </p>

        {/* Bobinas utilizadas (SIGILOSO: sem NF ou custos) */}
        {bobinas.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5">
              <Disc className="w-3 h-3 text-indigo-400" />
              Bobina:
            </span>
            {bobinas.slice(0, 2).map((b, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[10px] bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-medium px-1.5 py-0"
              >
                {b.codigo} {b.espessura && b.espessura !== "—" ? `· ${b.espessura}` : ""}
              </Badge>
            ))}
            {bobinas.length > 2 && (
              <span className="text-[10px] text-slate-400 font-semibold">
                +{bobinas.length - 2}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Rodapé com Datas, Fotos e Botões de Ação */}
      <div className="pt-2 border-t border-border flex items-center justify-between gap-2 mt-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {card.data_prevista && (
            <span>
              Prazo: <strong className="text-foreground">{format(new Date(card.data_prevista), "dd/MM", { locale: ptBR })}</strong>
            </span>
          )}
          {totalFotos > 0 && (
            <span className="flex items-center gap-0.5 text-blue-600 dark:text-blue-400 font-semibold text-[11px] bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded-md">
              <Camera className="w-3 h-3" />
              {totalFotos}
            </span>
          )}
          {unreadCount > 0 && (
            <span className="flex items-center gap-0.5 text-red-600 font-bold text-[11px] bg-red-50 dark:bg-red-950 px-1.5 py-0.5 rounded-md">
              <MessageSquare className="w-3 h-3" />
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopiarWhatsApp}
            className="h-7 px-2 text-[11px] font-semibold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-950"
            title="Copiar resumo de status para enviar no WhatsApp do cliente"
          >
            {copiado ? (
              <>
                <Check className="w-3 h-3 mr-1 text-emerald-600" />
                Copiado!
              </>
            ) : (
              <>
                <Share2 className="w-3 h-3 mr-1" />
                WhatsApp
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onVerDetalhes(card);
            }}
            className="h-7 px-2 text-[11px] font-semibold text-primary hover:bg-primary/10"
          >
            <FileText className="w-3 h-3 mr-1" />
            Detalhes
          </Button>
        </div>
      </div>
    </div>
  );
}