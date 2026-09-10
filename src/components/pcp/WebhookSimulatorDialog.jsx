import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Radio, Send, CheckCircle2, AlertTriangle } from "lucide-react";
import { parseWebhookPayload } from "@/lib/odooParser";

const EXEMPLO = JSON.stringify({
  numero_pedido: "S00627",
  cliente_nome: "NOME DO CLIENTE",
  vendedor_nome: "NOME DO VENDEDOR",
  data_entrega: "2026-09-15",
  unidade: "Matriz AJL",
  identificacao_1: "IDENTIFICAÇÃO 1",
  identificacao_2: "IDENTIFICAÇÃO 2",
  odoo_id: "1332146",
  of_odoo_id: "1332146",
  of_nome: "WH/MO/1332146",
  total_itens: 1,
  itens_json: JSON.stringify([
    {
      categoria: "Telhas",
      produto: "Telha TP 25 (0,43) nacional",
      quantidade: 3000.0,
      unidade: "Unidades A produzir",
      observacao: "Teste",
      foto_url: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=600&q=80"
    }
  ]),
  descricao: "Teste",
  foto_pedido_url: "https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=600&q=80",
  status_pcp: "pendente_distribuicao",
  progresso_inicial: 0,
  nova_of: true
}, null, 2);

export default function WebhookSimulatorDialog({ open, onOpenChange, onReceber }) {
  const [payload, setPayload] = useState(EXEMPLO);
  const [erro, setErro] = useState("");
  const [preview, setPreview] = useState(null);

  const handlePreview = () => {
    setErro("");
    try {
      const pedidos = parseWebhookPayload(payload);
      if (pedidos.length === 0) {
        setErro("Nenhum pedido válido encontrado (verifique as categorias industriais).");
        setPreview(null);
        return;
      }
      setPreview(pedidos);
    } catch (e) {
      setErro(e.message);
      setPreview(null);
    }
  };

  const handleReceber = async () => {
    setErro("");
    try {
      const pedidos = parseWebhookPayload(payload);
      if (pedidos.length === 0) {
        setErro("Nenhum pedido válido para receber.");
        return;
      }
      await onReceber(pedidos);
      onOpenChange(false);
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-orange-500" />
            Receber / Simular Webhook Odoo
          </DialogTitle>
          <DialogDescription>
            Cole o payload JSON do pedido Odoo para simular a recepção em tempo real.
            Categorias aceitas: Telhas, Corte e Dobra, Perfis, Frisadas, Chapas (revendas são descartadas).
          </DialogDescription>
        </DialogHeader>

        <Textarea
          value={payload}
          onChange={(e) => { setPayload(e.target.value); setPreview(null); setErro(""); }}
          rows={12}
          className="font-mono text-xs"
          placeholder="Cole aqui o JSON do webhook Odoo..."
        />

        {erro && (
          <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded-lg">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {preview && (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 space-y-2">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              {preview.length} pedido(s) válido(s) prontos para receber:
            </p>
            {preview.map((p, idx) => (
              <div key={idx} className="text-xs bg-white dark:bg-slate-800 rounded p-2 border border-slate-200 dark:border-slate-700">
                <span className="font-semibold">#{p.numero_pedido}</span> — {p.cliente_nome || "—"}
                <span className="text-slate-400"> | Telha:{p.itens_telha_count} C&D:{p.itens_cd_count} Frisada:{p.itens_frisada_count}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-1">
          <Button variant="outline" onClick={handlePreview} className="flex-1">
            <CheckCircle2 className="w-4 h-4" /> Pré-visualizar
          </Button>
          <Button onClick={handleReceber} className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white">
            <Send className="w-4 h-4" /> Receber Pedido(s)
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}