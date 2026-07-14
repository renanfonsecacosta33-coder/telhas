import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Truck, Camera } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ChatPanel from "@/components/chat/ChatPanel";
import { useAuth } from "@/lib/AuthContext";

const STATUS_LABELS = {
  pendente: { label: "Pendente", color: "bg-slate-100 text-slate-700" },
  em_producao: { label: "Produzindo", color: "bg-blue-100 text-blue-700" },
  pausado: { label: "Pausado", color: "bg-amber-100 text-amber-700" },
  aguardando_corte: { label: "Aguardando Corte", color: "bg-orange-100 text-orange-700" },
  aguardando_colagem: { label: "Aguardando Colagem", color: "bg-purple-100 text-purple-700" },
  aguardando_material: { label: "Aguardando Material", color: "bg-red-100 text-red-700" },
  finalizado: { label: "Concluída", color: "bg-emerald-100 text-emerald-700" },
  cancelado: { label: "Cancelada", color: "bg-red-100 text-red-700" },
};

function OpRow({ op, index }) {
  const cfg = STATUS_LABELS[op.status] || STATUS_LABELS.pendente;
  const maquinaLabel = op.maquina || op.maquina_inicial || "—";
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border p-2.5">
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{maquinaLabel}</p>
        <p className="text-xs text-muted-foreground truncate">
          {op.tipo_peca || op.dimensoes_livres || "—"} · {op.quantidade || 0} pç
        </p>
      </div>
      <Badge className={`text-xs ${cfg.color}`}>{cfg.label}</Badge>
    </div>
  );
}

function PhotoBlock({ url, label, icon: Icon }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="group block">
      <div className="relative rounded-lg overflow-hidden border-2 border-border group-hover:border-primary/50 transition-colors">
        <img src={url} alt={label} className="w-full h-32 object-cover" />
        <div className="absolute top-1.5 left-1.5 text-[10px] font-bold rounded-full flex items-center gap-0.5 bg-black/70 text-white px-2 py-0.5">
          <Icon className="w-3 h-3" /> {label}
        </div>
      </div>
    </a>
  );
}

export default function PedidoDetalheDrawer({ card, open, onOpenChange }) {
  const { user } = useAuth();
  if (!card) return null;

  const canalId = String(card.numero_pedido || card.id);
  const canalLabel = `Pedido ${card.numero_pedido || card.id}`;

  const photos = [];
  if (card.tipo === "telhas" && card.pedido_original) {
    if (card.pedido_original.foto_pedido_url) photos.push({ url: card.pedido_original.foto_pedido_url, label: "Foto do Pedido", icon: Camera });
    if (card.pedido_original.foto_carregamento_url) photos.push({ url: card.pedido_original.foto_carregamento_url, label: "Carregamento", icon: Truck });
  } else if (card.ops) {
    card.ops.forEach(op => {
      if (op.foto_finalizacao_url) photos.push({ url: op.foto_finalizacao_url, label: `Finalização · ${op.maquina || op.maquina_inicial || ""}`, icon: CheckCircle2 });
      if (op.foto_carregamento_url) photos.push({ url: op.foto_carregamento_url, label: "Carregamento", icon: Truck });
      if (op.foto_pedido_url) photos.push({ url: op.foto_pedido_url, label: "Pedido", icon: Camera });
    });
  }
  const uniquePhotos = photos.filter((p, i, arr) => arr.findIndex(x => x.url === p.url) === i);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span>Pedido #{card.numero_pedido || "—"}</span>
            <Badge variant="outline" className={card.setor === "Telhas" ? "border-blue-300 text-blue-700" : "border-orange-300 text-orange-700"}>
              {card.setor}
            </Badge>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          <div className="space-y-1">
            <p className="font-bold text-lg text-foreground">{card.cliente || "—"}</p>
            <p className="text-sm text-muted-foreground">{card.descricao}</p>
            {card.data_prevista && (
              <p className="text-xs text-muted-foreground">
                Prazo de entrega: <strong className="text-foreground">{format(new Date(card.data_prevista), "dd/MM/yyyy", { locale: ptBR })}</strong>
              </p>
            )}
          </div>

          {card.tipo === "corte_dobra" && card.ops && card.ops.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-foreground">Ordens de Produção ({card.ops.length})</h4>
              {card.ops.map((op, i) => <OpRow key={op.id || i} op={op} index={i} />)}
            </div>
          )}

          {card.tipo === "telhas" && card.pedido_original && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-foreground">Detalhes do Pedido</h4>
              <div className="rounded-lg border border-border p-3 space-y-1 text-sm">
                <p><span className="text-muted-foreground">Produto:</span> <strong>{card.pedido_original.produto}</strong></p>
                {card.pedido_original.modelo && <p><span className="text-muted-foreground">Modelo:</span> {card.pedido_original.modelo}</p>}
                {card.pedido_original.metros && <p><span className="text-muted-foreground">Metros:</span> {card.pedido_original.metros}m</p>}
                {card.pedido_original.quantidade_telhas && <p><span className="text-muted-foreground">Qtd Telhas:</span> {card.pedido_original.quantidade_telhas}</p>}
              </div>
            </div>
          )}

          {uniquePhotos.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-foreground">Galeria de Fotos ({uniquePhotos.length})</h4>
              <div className="grid grid-cols-2 gap-2">
                {uniquePhotos.map((p, i) => <PhotoBlock key={i} {...p} />)}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h4 className="text-sm font-bold text-foreground">Chat do Pedido</h4>
            <div className="rounded-lg border border-border overflow-hidden">
              <ChatPanel
                canal_tipo="pedido"
                canal_id={canalId}
                canal_label={canalLabel}
                currentUser={user}
                heightClass="h-[300px]"
              />
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}