import React, { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  History, Circle, Play, Pause, CheckCircle2, Star, Edit3,
  Trash2, Plus, Clock, User, FileText, ChevronRight
} from "lucide-react";

const STATUS_LABELS = {
  pendente: "Pendente",
  em_producao: "Em Produção",
  pausado: "Pausado",
  aguardando_colagem: "Aguardando Colagem",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

const ACAO_ICONS = {
  criado: { icon: Plus, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  status_alterado: { icon: ChevronRight, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  iniciado: { icon: Play, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  pausado: { icon: Pause, color: "text-purple-600", bg: "bg-purple-50 border-purple-200" },
  retomado: { icon: Play, color: "text-blue-600", bg: "bg-blue-50 border-blue-200" },
  finalizado: { icon: CheckCircle2, color: "text-green-600", bg: "bg-green-50 border-green-200" },
  prioridade: { icon: Star, color: "text-amber-600", bg: "bg-amber-50 border-amber-200" },
  editado: { icon: Edit3, color: "text-slate-600", bg: "bg-slate-50 border-slate-200" },
  excluido: { icon: Trash2, color: "text-red-600", bg: "bg-red-50 border-red-200" },
  default: { icon: Circle, color: "text-slate-500", bg: "bg-slate-50 border-slate-200" },
};

function getAcaoCfg(acao) {
  return ACAO_ICONS[acao] || ACAO_ICONS.default;
}

function formatData(dataStr) {
  if (!dataStr) return "—";
  try {
    const d = new Date(dataStr);
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return dataStr;
  }
}

export default function HistoricoPedidoTelhasSidebar({ open, onClose, pedidoId, pedidoNumero }) {
  const [loading, setLoading] = useState(false);
  const [pedido, setPedido] = useState(null);

  useEffect(() => {
    if (open && pedidoId) {
      loadPedido();
    }
    if (!open) setPedido(null);
  }, [open, pedidoId]);

  const loadPedido = async () => {
    setLoading(true);
    try {
      const p = await base44.entities.Pedido.get(pedidoId);
      setPedido(p);
    } catch {
      setPedido(null);
    }
    setLoading(false);
  };

  const historico = (() => {
    if (!pedido?.historico_alteracoes) return [];
    try {
      return JSON.parse(pedido.historico_alteracoes);
    } catch {
      return [];
    }
  })();

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            Histórico do Pedido
          </SheetTitle>
          <SheetDescription>
            {pedidoNumero ? `Pedido #${pedidoNumero}` : "Registro de alterações"}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
            </div>
          ) : historico.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Sem registros de alteração.</p>
            </div>
          ) : (
            <>
              {/* Resumo do pedido */}
              {pedido && (
                <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{pedido.produto}</span>
                    <Badge variant="outline" className="text-xs">{STATUS_LABELS[pedido.status] || pedido.status}</Badge>
                  </div>
                  {pedido.cliente && <p className="text-muted-foreground">Cliente: {pedido.cliente}</p>}
                  {pedido.numero_pedido && <p className="text-muted-foreground font-mono">#{pedido.numero_pedido}</p>}
                  {pedido.maquina && <p className="text-muted-foreground">Máquina: {pedido.maquina}</p>}
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-2">
                {[...historico].reverse().map((h, i) => {
                  const cfg = getAcaoCfg(h.acao);
                  const Icon = cfg.icon;
                  return (
                    <div key={i} className={`border ${cfg.bg} rounded-lg p-3 flex items-start gap-3`}>
                      <div className={`w-8 h-8 rounded-full bg-white border border-border flex items-center justify-center flex-shrink-0`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm">{h.acao_label || h.acao}</p>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {formatData(h.data)}
                          </span>
                        </div>
                        {h.usuario && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3" /> {h.usuario}
                          </p>
                        )}
                        {h.detalhes && (
                          <p className="text-xs mt-1 text-foreground/80">{h.detalhes}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function HistoricoPedidoTelhasButton({ pedido, className = "" }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`text-xs flex items-center gap-1 px-2 py-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ${className}`}
      >
        <History className="w-3.5 h-3.5" />
        Histórico
      </button>
      <HistoricoPedidoTelhasSidebar
        open={open}
        onClose={() => setOpen(false)}
        pedidoId={pedido?.id}
        pedidoNumero={pedido?.numero_pedido}
      />
    </>
  );
}