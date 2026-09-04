import React, { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Play,
  Pause,
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Pencil,
  Trash2,
  Route,
  Camera,
  AlertTriangle,
  RotateCcw
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ImageLink from "@/components/ui/ImageLink";
import CorChapaDot from "@/components/corte-dobra/CorChapaDot";
import ChatPedidoButton from "@/components/chat/ChatPedidoButton";
import ApontamentoOpButton from "@/components/producao/ApontamentoOpButton";
import {
  PrioridadeBadge,
  SeletorPrioridadeDropdown,
  getPrioridadeNivel
} from "@/lib/prioridadeHelper";

function formatTempoCompacto(segundos) {
  const s = Math.floor(segundos || 0);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec}s`;
}

function StatusBadgeCD({ status }) {
  const cfg = {
    pendente: { label: "Pendente", Icon: Circle, badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700" },
    aguardando_corte: { label: "Aguard. Corte", Icon: Clock, badge: "bg-orange-100 text-orange-700 border-orange-200" },
    aguardando_material: { label: "Sem Material", Icon: AlertCircle, badge: "bg-red-100 text-red-700 border-red-200" },
    em_producao: { label: "Produzindo", Icon: Clock, badge: "bg-amber-100 text-amber-700 border-amber-200" },
    pausado: { label: "Pausado", Icon: Pause, badge: "bg-purple-100 text-purple-700 border-purple-200" },
    finalizado: { label: "Finalizado", Icon: CheckCircle2, badge: "bg-green-100 text-green-700 border-green-200" },
    cancelado: { label: "Cancelado", Icon: AlertCircle, badge: "bg-red-100 text-red-700 border-red-200" },
  }[status] || { label: status, Icon: Circle, badge: "bg-slate-100 text-slate-600 border-slate-200" };

  const Icon = cfg.Icon;
  return (
    <Badge className={`border text-[11px] font-semibold ${cfg.badge}`}>
      <Icon className="w-3 h-3 mr-1" />
      {cfg.label}
    </Badge>
  );
}

export default function OrdemCardCD({
  ordem: o,
  tipo = "desbobinadeira", // "desbobinadeira" | "maquina"
  isGestor = false,
  user = null,
  onEdit,
  onDelete,
  onStatusChange,
  onSelectPrioridade,
  onToggleRota,
  onRetrabalho
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (o.status === "em_producao" || o.status === "pausado") {
      const iv = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(iv);
    }
  }, [o.status]);

  const now = Date.now();
  let tempoProd = o.tempo_producao_seg || 0;
  let tempoPausa = o.tempo_pausa_seg || 0;
  if (o.status === "em_producao" && o.inicio_producao_ts) {
    tempoProd += Math.floor((now - new Date(o.inicio_producao_ts).getTime()) / 1000);
  }
  if (o.status === "pausado" && o.inicio_pausa_ts) {
    tempoPausa += Math.floor((now - new Date(o.inicio_pausa_ts).getTime()) / 1000);
  }

  const prioNivel = getPrioridadeNivel(o);
  const isDesb = tipo === "desbobinadeira";

  // Identificação principal do produto/peça
  const titulo = isDesb
    ? o.bobina_descricao || "Bobina C&D"
    : o.tipo_peca || o.chapa_descricao || "Peça C&D";

  // Medidas / dimensões
  const medidas = isDesb
    ? [
        o.espessura ? `#${o.espessura}` : null,
        o.largura_mm ? `${o.largura_mm}mm` : null,
        o.comprimento_mm ? `${o.comprimento_mm}mm` : null,
      ].filter(Boolean).join(" × ")
    : o.dimensoes_livres || o.chapa_descricao || "";

  // Peso calculado / estimado
  const peso = o.peso_real || o.kg_estimado || o.peso_kg || 0;

  // Borda lateral e destaque de fundo
  let borderLeftCls = "border-l-4 border-l-transparent";
  if (o.rota) {
    borderLeftCls = "border-l-4 border-l-red-600 bg-red-50/30 dark:bg-red-950/20";
  } else if (prioNivel === 1) {
    borderLeftCls = "border-l-4 border-l-red-500 bg-red-50/20 dark:bg-red-950/20";
  } else if (prioNivel === 2) {
    borderLeftCls = "border-l-4 border-l-orange-500 bg-orange-50/20 dark:bg-orange-950/20";
  } else if (prioNivel === 3) {
    borderLeftCls = "border-l-4 border-l-amber-500 bg-amber-50/20 dark:bg-amber-950/20";
  } else if (o.status === "em_producao") {
    borderLeftCls = "border-l-4 border-l-amber-500 bg-amber-50/15";
  } else if (o.status === "finalizado") {
    borderLeftCls = "border-l-4 border-l-green-500 opacity-90";
  }

  return (
    <div className={`px-4 py-3 hover:bg-muted/20 transition-colors ${borderLeftCls}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Lado Esquerdo: Informações estruturadas da Ordem */}
        <div className="flex-1 min-w-0 space-y-1">
          {/* Linha 1: Badges Prioridade/Rota + Título + Status + Quantidade + Timer */}
          <div className="flex items-center gap-2 flex-wrap">
            <PrioridadeBadge pedido={o} />

            {o.rota && (
              <Badge className="bg-red-600 text-white border-red-700 text-xs gap-1 animate-pulse font-black shadow-sm select-none">
                <Route className="w-3 h-3" /> ROTA
              </Badge>
            )}

            {o.is_retrabalho && (
              <Badge className="bg-purple-600 text-white border-purple-700 text-xs font-bold gap-1">
                <AlertTriangle className="w-3 h-3" /> Retrabalho
              </Badge>
            )}

            <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
              <CorChapaDot
                cor={o.material_cor}
                descricao={isDesb ? o.bobina_descricao : o.chapa_descricao}
              />
              <span className="truncate">{titulo}</span>
            </div>

            <StatusBadgeCD status={o.status} />

            {o.quantidade > 0 && (
              <span className="text-sm font-black text-orange-600 dark:text-orange-400">
                {o.quantidade} pç{o.quantidade > 1 ? "s" : ""}
              </span>
            )}

            {peso > 0 && (
              <span className="text-xs font-semibold text-muted-foreground">
                ({Number(peso).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg)
              </span>
            )}

            {/* Timer Compacto Inline quando Em Produção ou Pausado */}
            {o.status === "em_producao" && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-green-700 dark:text-green-400 bg-green-100/80 dark:bg-green-950/40 px-2 py-0.5 rounded-full animate-pulse border border-green-300 dark:border-green-800">
                ⏱️ {formatTempoCompacto(tempoProd)}
              </span>
            )}

            {o.status === "pausado" && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 dark:text-amber-400 bg-amber-100/80 dark:bg-amber-950/40 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                ⏸ Pausa {formatTempoCompacto(tempoPausa)}
              </span>
            )}
          </div>

          {/* Linha 2: Cliente + Vendedor + Pedido + Destino + Guilhotina */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            {o.cliente && (
              <span>
                👤 <span className="text-foreground font-medium">{o.cliente}</span>
              </span>
            )}
            {o.vendedor && <span>🏷 {o.vendedor}</span>}
            {o.numero_pedido && (
              <span className="font-semibold text-foreground/80">#{o.numero_pedido}</span>
            )}
            <span>
              {o.destino === "estoque" ? "🏭 Estoque" : "📦 Pedido Direto"}
            </span>
            {isDesb && o.guilhotina && (
              <span>
                ✂️ Guilhotina: <strong className="text-foreground">{o.guilhotina}</strong>
                {o.tamanho_corte_guilhotina ? ` (${o.tamanho_corte_guilhotina}mm)` : ""}
              </span>
            )}
            {o.data_prevista && (
              <span>
                📅 Prev: {format(new Date(o.data_prevista + "T12:00:00"), "dd/MM", { locale: ptBR })}
              </span>
            )}
          </div>

          {/* Linha 3: Medidas técnicas, Observações e Chips de Fotos Clicáveis */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-0.5">
            {medidas && (
              <span>
                📐 <span className="font-medium text-foreground/90">{medidas}</span>
              </span>
            )}

            {o.desenvolvimento_mm > 0 && (
              <span>Dev: {o.desenvolvimento_mm}mm</span>
            )}

            {o.observacoes && (
              <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100/60 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md border border-amber-300/60 dark:border-amber-800">
                📋 {o.observacoes}
              </span>
            )}

            {/* Chips de Fotos Compactas com visualizador ao clicar */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {o.foto_pedido_url && (
                <ImageLink url={o.foto_pedido_url} name={`Foto Pedido #${o.numero_pedido || o.id}`}>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer">
                    <Camera className="w-3 h-3" /> Pedido
                  </span>
                </ImageLink>
              )}

              {(o.foto_etiqueta_bobina_url || o.foto_etiqueta_chapa_url || o.foto_material_url) && (
                <ImageLink
                  url={o.foto_etiqueta_chapa_url || o.foto_etiqueta_bobina_url || o.foto_material_url}
                  name={o.foto_etiqueta_chapa_url ? `Etiqueta Chapa — ${titulo}` : `Etiqueta Material — ${titulo}`}
                >
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition-colors cursor-pointer">
                    <Camera className="w-3 h-3" /> {o.foto_etiqueta_chapa_url ? "Etiqueta Chapa" : "Etiqueta"}
                  </span>
                </ImageLink>
              )}

              {o.foto_finalizacao_url && (
                <ImageLink
                  url={o.foto_finalizacao_url}
                  name={`Foto Finalização — ${titulo}`}
                >
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer">
                    ✓ Peça Pronta
                  </span>
                </ImageLink>
              )}
            </div>
          </div>
        </div>

        {/* Lado Direito: Ações Rápidas (Dropdown Prioridade, Rota, Play/Check, Edit, Retrabalho, Delete) */}
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
          {/* Seletor Dropdown de Prioridade (P1 a P5) */}
          {onSelectPrioridade && o.status !== "finalizado" && o.status !== "cancelado" && (
            <SeletorPrioridadeDropdown
              pedido={o}
              onSelectPrioridade={(nivel) => onSelectPrioridade(o, nivel)}
              disabled={false}
              size="sm"
            />
          )}

          {/* Botão de Alternância de Rota em 1 Clique */}
          {onToggleRota && o.status !== "finalizado" && o.status !== "cancelado" && (
            <Button
              variant="ghost"
              size="icon"
              className={`h-7 w-7 rounded-lg transition-colors ${
                o.rota
                  ? "bg-red-600 text-white hover:bg-red-700 shadow-sm"
                  : "text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              }`}
              title={o.rota ? "Remover de Rota de Entrega" : "Marcar como Rota de Entrega (Urgência)"}
              onClick={() => onToggleRota(o)}
            >
              <Route className="w-4 h-4" />
            </Button>
          )}

          {/* Play / Pausa / Retomar / Finalizar Rápido */}
          {onStatusChange && (
            <>
              {o.status === "pendente" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                  title="Iniciar Produção"
                  onClick={() => onStatusChange(o, "em_producao")}
                >
                  <Play className="w-4 h-4" />
                </Button>
              )}

              {o.status === "em_producao" && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                    title="Pausar Produção"
                    onClick={() => onStatusChange(o, "pausado")}
                  >
                    <Pause className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                    title="Finalizar Ordem"
                    onClick={() => onStatusChange(o, "finalizado")}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </Button>
                </>
              )}

              {o.status === "pausado" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/30"
                  title="Retomar Produção"
                  onClick={() => onStatusChange(o, "em_producao")}
                >
                  <Play className="w-4 h-4" />
                </Button>
              )}

              {o.status === "finalizado" && isGestor && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  title="Reabrir Ordem"
                  onClick={() => onStatusChange(o, "pendente")}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}
            </>
          )}

          {/* Chat do Pedido */}
          <ChatPedidoButton
            canal_id={o.id}
            canal_label={`OP ${o.numero_pedido || o.id?.slice(-6).toUpperCase()}`}
            currentUser={user}
          />

          {/* Apontamento OP (Assinatura e Impressão) */}
          <ApontamentoOpButton
            ordem={o}
            ordem_tipo={isDesb ? "desbobinadeira" : "maquina_cd"}
            size="icon"
            label=""
            className="h-7 w-7"
            user={user}
          />

          {/* Retrabalho */}
          {onRetrabalho && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              title="Solicitar Retrabalho"
              onClick={() => onRetrabalho(o)}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* Editar */}
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-600 hover:text-foreground"
              title="Editar Ordem"
              onClick={() => onEdit(o)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* Excluir (Gestor) */}
          {isGestor && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              title="Excluir Ordem"
              onClick={() => {
                if (window.confirm("Deseja realmente excluir esta ordem de produção?")) {
                  onDelete(o.id);
                }
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
