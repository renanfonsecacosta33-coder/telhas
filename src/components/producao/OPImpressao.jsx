import React, { useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, QrCode } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import QRCode from "qrcode";

export default function OPImpressao({ open, onClose, pedido }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!open || !pedido?.id || !canvasRef.current) return;
    // Gera QR com o ID do pedido — ao escanear, abre o sistema direto no pedido
    const url = `${window.location.origin}/producao?pedido=${pedido.id}`;
    QRCode.toCanvas(canvasRef.current, url, { width: 120, margin: 1 });
  }, [open, pedido]);

  if (!pedido) return null;

  const handlePrint = () => {
    window.print();
  };

  const metragemTotal = ((pedido.metros || 0) * ((pedido.metragem_mm || 0) / 1000)).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Ordem de Produção
          </DialogTitle>
        </DialogHeader>

        {/* Área de impressão */}
        <div id="op-print-area" className="border border-border rounded-xl p-5 space-y-4 bg-white print:border-0 print:p-0">
          {/* Cabeçalho */}
          <div className="flex items-start justify-between border-b border-border pb-3">
            <div>
              <h2 className="text-xl font-black text-slate-800">ORDEM DE PRODUÇÃO</h2>
              <p className="text-xs text-slate-500">AJL Ferro e Aço</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Data</p>
              <p className="font-bold text-sm">
                {pedido.data ? format(new Date(pedido.data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR }) : "—"}
              </p>
              {pedido.numero_pedido && (
                <p className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded mt-1">#{pedido.numero_pedido}</p>
              )}
            </div>
          </div>

          {/* Dados principais em grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="space-y-2">
              <Row label="Produto" value={pedido.produto} bold />
              <Row label="Modelo" value={pedido.modelo} />
              <Row label="Máquina" value={pedido.maquina} />
              <Row label="Cliente" value={pedido.cliente} />
              <Row label="Vendedor" value={pedido.vendedor} />
            </div>
            <div className="space-y-2">
              <Row label="Qtd. Telhas" value={pedido.metros ? `${pedido.metros} un` : "—"} bold />
              <Row label="Comprimento" value={pedido.metragem_mm ? `${pedido.metragem_mm} mm` : "—"} />
              <Row label="Total Linear" value={metragemTotal !== "0.00" ? `${metragemTotal} m` : "—"} />
              <Row label="Bobina" value={pedido.bobina_superior || "—"} />
              {pedido.eps && <Row label="EPS" value={pedido.eps} />}
            </div>
          </div>

          {/* Isopor se necessário */}
          {pedido.isopor_utilizado > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 text-sm">
              <span className="font-semibold text-orange-800">Isopor: </span>
              <span className="text-orange-700">{pedido.isopor_utilizado} placas ({pedido.eps})</span>
            </div>
          )}

          {pedido.observacoes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
              <span className="font-semibold">Obs: </span>{pedido.observacoes}
            </div>
          )}

          {/* Área de controle do operador */}
          <div className="border border-dashed border-slate-300 rounded-lg p-3 space-y-2">
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Preenchimento do Operador</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-slate-500 mb-1">Metragem Real (m):</p>
                <div className="h-7 border-b border-slate-400" />
              </div>
              <div>
                <p className="text-slate-500 mb-1">Hora de Início:</p>
                <div className="h-7 border-b border-slate-400" />
              </div>
              <div>
                <p className="text-slate-500 mb-1">Hora de Término:</p>
                <div className="h-7 border-b border-slate-400" />
              </div>
              <div>
                <p className="text-slate-500 mb-1">Operador:</p>
                <div className="h-7 border-b border-slate-400" />
              </div>
            </div>
          </div>

          {/* QR Code */}
          <div className="flex items-center gap-4 border-t border-border pt-3">
            <canvas ref={canvasRef} className="rounded-lg" />
            <div>
              <p className="text-xs font-bold text-slate-700">Escaneie para abrir no sistema</p>
              <p className="text-xs text-slate-400 mt-0.5">O operador pode escanear este QR para carregar este pedido automaticamente</p>
              <p className="text-xs font-mono text-slate-400 mt-1 break-all">ID: {pedido.id?.slice(0, 16)}...</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" />
            Imprimir OP
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className="flex gap-1">
      <span className="text-slate-500 shrink-0">{label}:</span>
      <span className={bold ? "font-bold text-slate-800" : "text-slate-700"}>{value || "—"}</span>
    </div>
  );
}