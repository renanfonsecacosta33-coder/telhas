import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  CheckCheck,
  Package,
  Truck,
  AlertTriangle,
  ArrowLeftRight,
  Bookmark,
  Factory,
  Trash2,
  ExternalLink,
  Clock,
  Sparkles
} from "lucide-react";
import { marcarComoLida, marcarTodasComoLidas, excluirNotificacao } from "@/lib/notificacoesHelper";
import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const TIPO_CONFIG = {
  pedido_odoo: {
    icon: Package,
    label: "Pedido Odoo",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/50",
    badgeColor: "bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
  },
  rota: {
    icon: Truck,
    label: "Rota de Entrega",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900/50",
    badgeColor: "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
  },
  estoque_minimo: {
    icon: AlertTriangle,
    label: "Estoque Mínimo",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50",
    badgeColor: "bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300"
  },
  transferencia: {
    icon: ArrowLeftRight,
    label: "Transferência",
    color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-900/50",
    badgeColor: "bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300"
  },
  reserva: {
    icon: Bookmark,
    label: "Reserva",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/50",
    badgeColor: "bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
  },
  producao: {
    icon: Factory,
    label: "Produção",
    color: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-900/50",
    badgeColor: "bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300"
  },
  sistema: {
    icon: Bell,
    label: "Sistema",
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800",
    badgeColor: "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
  }
};

export default function NotificationsDrawer({ open, onOpenChange, notificacoes = [], refetch }) {
  const navigate = useNavigate();
  const [filtroTab, setFiltroTab] = useState("todas"); // todas | nao_lidas | odoo | rotas | estoque

  const naoLidasCount = useMemo(() => {
    return notificacoes.filter(n => !n.lida).length;
  }, [notificacoes]);

  const notificacoesFiltradas = useMemo(() => {
    return notificacoes.filter(n => {
      if (filtroTab === "nao_lidas") return !n.lida;
      if (filtroTab === "odoo") return n.tipo === "pedido_odoo";
      if (filtroTab === "rotas") return n.tipo === "rota";
      if (filtroTab === "estoque") return n.tipo === "estoque_minimo";
      return true;
    });
  }, [notificacoes, filtroTab]);

  const handleClickItem = async (item) => {
    if (!item.lida) {
      await marcarComoLida(item.id);
      if (refetch) refetch();
    }
    if (item.link) {
      onOpenChange(false);
      navigate(item.link);
    }
  };

  const handleMarcarTodas = async () => {
    await marcarTodasComoLidas(notificacoes);
    if (refetch) refetch();
  };

  const handleExcluir = async (e, id) => {
    e.stopPropagation();
    await excluirNotificacao(id);
    if (refetch) refetch();
  };

  const formatDataRelativa = (isoString) => {
    if (!isoString) return "";
    try {
      return formatDistanceToNow(parseISO(isoString), { addSuffix: true, locale: ptBR });
    } catch {
      return "";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col bg-background font-sans">
        {/* Header */}
        <div className="p-4 border-b border-border bg-card/60 backdrop-blur-md">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <SheetTitle className="text-base font-bold flex items-center gap-2">
                  Notificações
                  {naoLidasCount > 0 && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                      {naoLidasCount} novas
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Alertas em tempo real das fábricas
                </SheetDescription>
              </div>
            </div>

            {naoLidasCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleMarcarTodas}
                className="text-xs gap-1.5 h-8 text-primary hover:text-primary hover:bg-primary/10"
                title="Marcar todas como lidas"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Marcar lidas</span>
              </Button>
            )}
          </div>

          {/* Filtros em Abas */}
          <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setFiltroTab("todas")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filtroTab === "todas"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              Todas ({notificacoes.length})
            </button>
            <button
              onClick={() => setFiltroTab("nao_lidas")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filtroTab === "nao_lidas"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              Não lidas ({naoLidasCount})
            </button>
            <button
              onClick={() => setFiltroTab("odoo")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filtroTab === "odoo"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              📦 Odoo
            </button>
            <button
              onClick={() => setFiltroTab("rotas")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filtroTab === "rotas"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              🚛 Rotas
            </button>
            <button
              onClick={() => setFiltroTab("estoque")}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filtroTab === "estoque"
                  ? "bg-rose-600 text-white shadow-xs"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted"
              }`}
            >
              ⚠️ Estoque
            </button>
          </div>
        </div>

        {/* Lista de Notificações */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {notificacoesFiltradas.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-muted-foreground">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <Sparkles className="w-6 h-6 text-muted-foreground/40" />
              </div>
              <p className="text-sm font-semibold">Tudo limpo por aqui!</p>
              <p className="text-xs text-muted-foreground max-w-xs mt-1">
                Nenhuma notificação encontrada no momento. Novos alertas de produção e entregas aparecerão aqui.
              </p>
            </div>
          ) : (
            notificacoesFiltradas.map((item) => {
              const conf = TIPO_CONFIG[item.tipo] || TIPO_CONFIG.sistema;
              const Icone = conf.icon;
              const tempoRelativo = formatDataRelativa(item.data_hora);

              return (
                <div
                  key={item.id}
                  onClick={() => handleClickItem(item)}
                  className={`group relative p-3.5 rounded-xl border transition-all duration-200 cursor-pointer ${
                    item.lida
                      ? "bg-card/40 hover:bg-card border-border opacity-75 hover:opacity-100"
                      : "bg-card hover:bg-muted/40 border-primary/30 shadow-xs ring-1 ring-primary/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${conf.color}`}>
                      <Icone className="w-4 h-4" />
                    </div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-xs font-bold text-foreground line-clamp-1">
                          {item.titulo}
                        </span>
                        {!item.lida && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 animate-pulse" />
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed break-words">
                        {item.mensagem}
                      </p>

                      <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground flex-wrap">
                        {tempoRelativo && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {tempoRelativo}
                          </span>
                        )}
                        {item.unidade && item.unidade !== "Todas" && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">
                            {item.unidade}
                          </Badge>
                        )}
                        {item.link && (
                          <span className="flex items-center gap-0.5 text-primary font-medium hover:underline">
                            Ver detalhes <ExternalLink className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleExcluir(e, item.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive rounded"
                      title="Excluir notificação"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
