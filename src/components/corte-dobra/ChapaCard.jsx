import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2, ShoppingCart, Ruler, Clock, Camera, Edit2, Trash2,
  ChevronDown, ChevronUp, Image as ImageIcon, Package, Hash
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function StatusBadge({ status, destino, numeroPedido, origem }) {
  if (status === "consumido") return <Badge className="bg-slate-100 text-slate-600 border-slate-200 border text-xs">Consumido</Badge>;
  if (status === "cancelado") return <Badge className="bg-red-100 text-red-600 border-red-200 border text-xs">Cancelado</Badge>;
  if (status === "parcial") return <Badge className="bg-amber-100 text-amber-700 border-amber-200 border text-xs">Parcial</Badge>;
  if (destino === "pedido_direto") return (
    <Badge className="bg-blue-100 text-blue-700 border-blue-200 border text-xs">
      <ShoppingCart className="w-3 h-3 mr-1" />
      Pedido {numeroPedido || ""}
    </Badge>
  );
  return (
    <div className="flex items-center gap-1.5">
      <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 border text-xs"><CheckCircle2 className="w-3 h-3 mr-1" />Disponível</Badge>
      {origem === "manual" && <Badge className="bg-purple-100 text-purple-700 border-purple-200 border text-xs">Manual</Badge>}
    </div>
  );
}

export default function ChapaCard({
  chapa, isAdmin, isConsumed,
  onEdit, onDelete, onViewFoto
}) {
  const [expanded, setExpanded] = useState(false);

  // Parse histórico para extrair fotos anexadas
  let historico = [];
  try { if (chapa.historico_movimentacoes) historico = JSON.parse(chapa.historico_movimentacoes); } catch {}

  const fotosHistorico = historico.filter(h => h.anexo_url).reverse();

  const temFoto = !!chapa.foto_finalizacao_url || fotosHistorico.length > 0;

  return (
    <div
      className={`bg-card border rounded-xl shadow-sm overflow-hidden transition-all ${
        chapa.origem === "manual"
          ? "border-l-4 border-l-purple-400"
          : chapa.destino === "pedido_direto"
            ? "border-l-4 border-l-blue-400"
            : "border-l-4 border-l-emerald-400"
      } ${isConsumed ? "opacity-60" : ""}`}
    >
      {/* Linha principal */}
      <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Info principal */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {chapa.codigo && (
              <span className="font-black text-base font-mono text-foreground">{chapa.codigo}</span>
            )}
            <span className="font-semibold text-sm text-muted-foreground">
              {chapa.bobina_descricao || (chapa.material ? `Mat: ${chapa.material}` : "Bobina")}
              {chapa.espessura_mm ? ` — ${chapa.espessura_mm}mm` : ""}
            </span>
            <StatusBadge status={chapa.status} destino={chapa.destino} numeroPedido={chapa.numero_pedido} origem={chapa.origem} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
            {chapa.comprimento_mm > 0 && (
              <span className="flex items-center gap-1">
                <Ruler className="w-3 h-3" /> {chapa.comprimento_mm}mm × {chapa.largura_mm || "?"}mm
              </span>
            )}
            {chapa.data_corte && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(chapa.data_corte), "dd/MM/yyyy", { locale: ptBR })}
              </span>
            )}
            {chapa.destino === "pedido_direto" && chapa.cliente && (
              <span className="font-semibold text-blue-600">{chapa.cliente}</span>
            )}
            {chapa.qualidade && (
              <span className="bg-primary/10 text-primary text-xs font-bold px-1.5 py-0.5 rounded">{chapa.qualidade}</span>
            )}
          </div>
          {chapa.observacoes && (
            <p className="text-xs text-amber-700 bg-amber-50 rounded px-2 py-0.5 inline-block">📋 {chapa.observacoes}</p>
          )}
        </div>

        {/* Quantidade */}
        <div className="text-center min-w-[80px]">
          <p className="text-2xl font-black text-foreground">{chapa.quantidade_disponivel ?? chapa.quantidade_total}</p>
          <p className="text-xs text-muted-foreground">de {chapa.quantidade_total} pcs</p>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-2">
          {temFoto && (
            <Button
              size="sm" variant="ghost"
              className="gap-1 text-muted-foreground hover:text-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? "Ver menos" : "Ver mais"}
            </Button>
          )}
          {(isAdmin || !isConsumed) && (
            <Button size="sm" variant="outline" className="gap-1" onClick={() => onEdit(chapa)}>
              <Edit2 className="w-3 h-3" /> Editar
            </Button>
          )}
          {isAdmin && (
            <Button
              size="sm" variant="ghost"
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
              onClick={() => { if (confirm(`Excluir chapa ${chapa.codigo || chapa.id}?`)) onDelete(chapa.id); }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Seção expansível: Fotos */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-4">
          {/* Foto de finalização */}
          {chapa.foto_finalizacao_url && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" /> Foto de finalização
              </p>
              <div
                className="relative w-full max-w-xs rounded-lg overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                onClick={() => onViewFoto(chapa.foto_finalizacao_url)}
              >
                <img
                  src={chapa.foto_finalizacao_url}
                  alt="Finalização"
                  className="w-full h-32 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white opacity-0 hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </div>
          )}

          {/* Fotos do histórico */}
          {fotosHistorico.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5" /> Fotos do histórico ({fotosHistorico.length})
              </p>
              <div className="flex flex-wrap gap-3">
                {fotosHistorico.map((h, i) => (
                  <div key={i} className="space-y-1">
                    <div
                      className="relative w-24 h-24 rounded-lg overflow-hidden border border-border cursor-pointer hover:ring-2 hover:ring-primary/30 transition-all"
                      onClick={() => onViewFoto(h.anexo_url)}
                    >
                      <img src={h.anexo_url} alt={h.motivo || "Histórico"} className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[10px] text-muted-foreground max-w-[96px] truncate" title={h.motivo}>
                      {h.motivo || "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {h.data ? format(new Date(h.data), "dd/MM/yy", { locale: ptBR }) : ""}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info adicional */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-card rounded-lg p-2.5 border border-border">
              <p className="text-muted-foreground flex items-center gap-1"><Hash className="w-3 h-3" /> Material</p>
              <p className="font-semibold mt-0.5">{chapa.material || "—"}</p>
            </div>
            <div className="bg-card rounded-lg p-2.5 border border-border">
              <p className="text-muted-foreground flex items-center gap-1"><Ruler className="w-3 h-3" /> Dimensões</p>
              <p className="font-semibold mt-0.5">{chapa.comprimento_mm || "?"} × {chapa.largura_mm || "?"} mm</p>
            </div>
            <div className="bg-card rounded-lg p-2.5 border border-border">
              <p className="text-muted-foreground flex items-center gap-1"><Package className="w-3 h-3" /> Total original</p>
              <p className="font-semibold mt-0.5">{chapa.quantidade_total || 0} pcs</p>
            </div>
            {chapa.qualidade && (
              <div className="bg-card rounded-lg p-2.5 border border-border">
                <p className="text-muted-foreground">Qualidade</p>
                <p className="font-semibold mt-0.5">{chapa.qualidade}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}