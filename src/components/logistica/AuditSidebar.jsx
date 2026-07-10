import React, { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Camera, Truck, Package, User, Clock, CheckCircle2, ImageOff, Images, FileText } from "lucide-react";
import UploadButton from "@/components/ui/UploadButton";

function parseHistorico(str) {
  if (!str) return [];
  try {
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDateTime(dt) {
  if (!dt) return "";
  try {
    return format(new Date(dt), "dd/MM HH:mm", { locale: ptBR });
  } catch {
    return dt;
  }
}

export default function AuditSidebar({ open, onClose, item, tipo }) {
  const [showCompare, setShowCompare] = useState(false);
  const queryClient = useQueryClient();

  const fotoMaquina = item?.foto_finalizacao_url || item?.foto_etiqueta_bobina_url || item?.foto_pedido_url || "";
  const fotoCaminhao = item?.foto_carregamento_url || "";

  const historicoAlteracoes = useMemo(() => {
    if (!item) return [];
    const ha = parseHistorico(item.historico_alteracoes);
    const he = parseHistorico(item.historico_expedicao);
    const hp = parseHistorico(item.historico_pausas).map(p => ({
      data: p.inicio,
      usuario: "—",
      acao: "Pausa",
      detalhes: p.motivo || "—",
    }));
    return [...ha, ...he, ...hp].sort((a, b) => {
      const da = a.data || a.data_avaliacao || "";
      const db = b.data || b.data_avaliacao || "";
      return db.localeCompare(da);
    });
  }, [item]);

  if (!item) return null;

  const titulo = tipo === "pedido"
    ? `Pedido ${item.numero_pedido || "—"}`
    : `OP ${item.numero_pedido || item.tipo_peca || "—"}`;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {titulo}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {/* Detalhes do pedido */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Detalhes</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {item.cliente && (
                <div className="flex items-center gap-1 col-span-2">
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="font-semibold">{item.cliente}</span>
                </div>
              )}
              {item.numero_pedido && (
                <div>
                  <p className="text-xs text-muted-foreground">Nº Pedido</p>
                  <p className="font-bold">{item.numero_pedido}</p>
                </div>
              )}
              {item.produto && (
                <div>
                  <p className="text-xs text-muted-foreground">Produto</p>
                  <p className="font-bold">{item.produto}</p>
                </div>
              )}
              {item.modelo && (
                <div>
                  <p className="text-xs text-muted-foreground">Modelo</p>
                  <p className="font-bold">{item.modelo}</p>
                </div>
              )}
              {item.maquina && (
                <div>
                  <p className="text-xs text-muted-foreground">Máquina</p>
                  <p className="font-bold">{item.maquina}</p>
                </div>
              )}
              {item.tipo_peca && (
                <div>
                  <p className="text-xs text-muted-foreground">Peça</p>
                  <p className="font-bold">{item.tipo_peca}</p>
                </div>
              )}
              {item.quantidade != null && (
                <div>
                  <p className="text-xs text-muted-foreground">Quantidade</p>
                  <p className="font-bold">{item.quantidade}</p>
                </div>
              )}
              {item.data_finalizacao && (
                <div>
                  <p className="text-xs text-muted-foreground">Finalizado em</p>
                  <p className="font-bold">{format(new Date(item.data_finalizacao + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}</p>
                </div>
              )}
            </div>

            {/* Status badges */}
            <div className="flex flex-wrap gap-1.5 pt-2">
              <Badge variant={item.status === "finalizado" ? "default" : "secondary"} className="text-xs">
                {item.status === "finalizado" ? "✓ Finalizado" : item.status}
              </Badge>
              {item.status_expedicao && item.status_expedicao !== "aguardando" && (
                <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">
                  <Truck className="w-3 h-3 mr-1" />
                  {item.status_expedicao === "carregado" ? "Carregado" : item.status_expedicao === "em_transito" ? "Em Trânsito" : "Expedido"}
                </Badge>
              )}
              {item.motorista_nome && (
                <Badge className="text-xs bg-purple-100 text-purple-700 border-purple-200">
                  {item.motorista_nome}
                </Badge>
              )}
            </div>
          </div>

          {/* Fotos — comparação lado a lado */}
          {(fotoMaquina || fotoCaminhao) && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide">Fotos</h3>
                {fotoMaquina && fotoCaminhao && (
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowCompare(!showCompare)}>
                    <Images className="w-3.5 h-3.5" />
                    {showCompare ? "Ocultar" : "Comparar"}
                  </Button>
                )}
              </div>
              <div className={`grid gap-3 ${showCompare ? "grid-cols-2" : "grid-cols-1"}`}>
                {fotoMaquina && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-semibold">📷 Foto da Máquina / Produção</p>
                    <a href={fotoMaquina} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={fotoMaquina} alt="Foto da máquina" className="w-full rounded-lg border border-border object-cover max-h-48" />
                    </a>
                  </div>
                )}
                {fotoCaminhao ? (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1 font-semibold">🚚 Foto do Caminhão</p>
                    <a href={fotoCaminhao} target="_blank" rel="noopener noreferrer" className="block">
                      <img src={fotoCaminhao} alt="Foto do caminhão" className="w-full rounded-lg border border-border object-cover max-h-48" />
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 text-muted-foreground">
                    <ImageOff className="w-6 h-6 mb-1" />
                    <p className="text-xs">Sem foto de carregamento</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Histórico / Audit Log */}
          <div className="bg-card border border-border rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Histórico de Auditoria
            </h3>
            {historicoAlteracoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro encontrado</p>
            ) : (
              <div className="space-y-3">
                {historicoAlteracoes.map((h, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${h.acao?.includes("Final") || h.acao?.includes("final") ? "bg-green-500" : h.acao?.includes("Carreg") || h.acao?.includes("carreg") ? "bg-blue-500" : h.acao?.includes("Vincul") || h.acao?.includes("vincul") ? "bg-purple-500" : "bg-muted-foreground"}`} />
                      {i < historicoAlteracoes.length - 1 && <div className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <p className="text-sm font-semibold">{h.acao || h.acao_label || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(h.data || h.data_avaliacao)} {h.usuario ? `· ${h.usuario}` : ""}
                      </p>
                      {h.detalhes && <p className="text-xs text-muted-foreground mt-0.5">{h.detalhes}</p>}
                      {h.motivo && <p className="text-xs text-muted-foreground mt-0.5">Motivo: {h.motivo}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}