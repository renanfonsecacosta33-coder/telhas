import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrCode, ChevronDown, ChevronUp, Loader2, ClipboardList, Weight } from "lucide-react";
import QRCodeBobinaDialog from "@/components/bobinas/QRCodeBobinaDialog";

const STATUS_STYLES = {
  pendente: "bg-gray-100 text-gray-700 border-gray-300",
  em_producao: "bg-blue-100 text-blue-800 border-blue-300",
  pausado: "bg-amber-100 text-amber-800 border-amber-300",
  aguardando_corte: "bg-orange-100 text-orange-800 border-orange-300",
  finalizado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelado: "bg-red-100 text-red-700 border-red-300",
};

export default function HistoricoPedidosBobina({ bobina }) {
  const [expandido, setExpandido] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const { data: ordensDesbob = [], isLoading: loadingDesbob } = useQuery({
    queryKey: ["historico-bobina-desbob", bobina.id],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ bobina_id: bobina.id }, "-data", 100),
    enabled: !!bobina.id,
  });

  const { data: ordensMaquina = [], isLoading: loadingMaquina } = useQuery({
    queryKey: ["historico-bobina-maquina", bobina.id],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ bobina_id: bobina.id }, "-data", 100),
    enabled: !!bobina.id,
  });

  const isLoading = loadingDesbob || loadingMaquina;

  const todasOrdens = [
    ...(ordensDesbob || []).map(o => ({
      ...o,
      _tipo: "Desbobinadeira",
      _label: o.observacoes || `Corte ${o.comprimento_mm || ""}mm`,
      _qtd: o.quantidade,
      _kg: o.kg_estimado,
    })),
    ...(ordensMaquina || []).map(o => ({
      ...o,
      _tipo: o.maquina,
      _label: o.tipo_peca || o.desenvolvimento_descricao || o.dimensoes_livres || "",
      _qtd: o.quantidade,
      _kg: o.peso_kg,
    })),
  ].sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const totalKgConsumido = todasOrdens
    .filter(o => o.status === "finalizado")
    .reduce((s, o) => s + (o._kg || 0), 0);

  const totalPecas = todasOrdens
    .filter(o => o.status === "finalizado")
    .reduce((s, o) => s + (o._qtd || 0), 0);

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-indigo-800 flex items-center gap-1.5 text-xs">
          <ClipboardList className="w-3.5 h-3.5" />
          Histórico de Pedidos
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5 border-indigo-300 text-indigo-700 hover:bg-indigo-100"
          onClick={() => setShowQR(true)}
        >
          <QrCode className="w-3.5 h-3.5" /> QR Code
        </Button>
      </div>

      {!expandido && (
        <p className="text-xs text-muted-foreground">
          {todasOrdens.length} pedido(s) · {totalPecas.toLocaleString("pt-BR")} peças produzidas · {totalKgConsumido.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg consumidos
        </p>
      )}

      <button
        onClick={() => setExpandido(!expandido)}
        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 transition-colors"
      >
        {expandido ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        {expandido ? "Ocultar pedidos" : "Ver todos os pedidos"}
      </button>

      {expandido && (
        <div className="space-y-1.5 mt-1">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando...
            </div>
          ) : todasOrdens.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2">Nenhum pedido encontrado para esta bobina.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {todasOrdens.map((o) => (
                <div key={o.id} className="bg-white rounded-md border border-border p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_STYLES[o.status] || ""}`}>
                        {o.status}
                      </Badge>
                      <span className="font-medium text-gray-800 truncate">{o._label}</span>
                    </div>
                    <span className="text-muted-foreground shrink-0">{o.data}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-muted-foreground">
                    <span className="font-medium text-indigo-600">{o._tipo}</span>
                    <span>{o._qtd || 0} pçs</span>
                    {o._kg && <span className="flex items-center gap-0.5"><Weight className="w-3 h-3" />{o._kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg</span>}
                    {o.cliente && <span>· {o.cliente}</span>}
                    {o.numero_pedido && <span>· Ped: {o.numero_pedido}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showQR && (
        <QRCodeBobinaDialog bobina={bobina} ordens={todasOrdens} onClose={() => setShowQR(false)} />
      )}
    </div>
  );
}