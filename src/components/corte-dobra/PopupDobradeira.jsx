import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Minimize2, Scissors, ArrowRight, Loader2, Image as ImageIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

const DOBRADEIRAS = ["DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M"];

export default function PopupDobradeira({ items, open, onClose, onMinimize, onAssigned }) {
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState({});

  const handleAssign = async (item) => {
    const dob = assignments[item.id];
    if (!dob) { toast.error("Selecione uma dobradeira"); return; }
    setLoading(prev => ({ ...prev, [item.id]: true }));
    try {
      await base44.entities.OrdemMaquinaCD.create({
        data: format(new Date(), "yyyy-MM-dd"),
        maquina: dob,
        chapa_cd_id: item.chapa_cd_id,
        chapa_descricao: item.chapa_descricao,
        chapa_origem: item.chapa_origem || "chaparia",
        tipo_peca: item.tipo_peca || "Dobra",
        dimensoes_livres: item.dimensoes_livres,
        numero_pedido: item.numero_pedido,
        cliente: item.cliente,
        quantidade: item.quantidade,
        peso_kg: item.peso_kg,
        ordem_corte_id: item.id,
        foto_pedido_url: item.foto_pedido_url,
        observacoes: item.observacoes,
        unidade: item.unidade,
        desenvolvimento_id: item.desenvolvimento_id,
        desenvolvimento_descricao: item.desenvolvimento_descricao,
        status: "pendente",
      });
      toast.success(`OP enviada para ${dob}!`);
      onAssigned();
    } catch (e) {
      toast.error("Erro ao atribuir: " + (e.message || e));
    }
    setLoading(prev => ({ ...prev, [item.id]: false }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <Scissors className="w-5 h-5 text-orange-500" />
                Atribuir Dobradeira
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {items.length} OP(s) cortada(s) aguardando atribuição
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onMinimize} className="gap-1">
              <Minimize2 className="w-4 h-4" /> Minimizar
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {items.map(item => (
            <div key={item.id} className="border border-border rounded-lg p-3 bg-muted/30">
              <div className="space-y-1 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-purple-100 text-purple-700 border-purple-200">{item.maquina}</Badge>
                  <span className="font-bold text-sm">{item.tipo_peca || "Corte"}</span>
                  {item.dimensoes_livres && (
                    <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{item.dimensoes_livres}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {item.numero_pedido && <span>Pedido: <strong className="text-foreground font-mono">{item.numero_pedido}</strong></span>}
                  {item.cliente && <span>Cliente: <strong className="text-foreground">{item.cliente}</strong></span>}
                  {item.quantidade > 0 && <span>{item.quantidade} pç</span>}
                  {item.chapa_descricao && <span className="font-mono">{item.chapa_descricao}</span>}
                </div>
                {item.foto_pedido_url && (
                  <a href={item.foto_pedido_url} target="_blank" rel="noopener noreferrer" className="inline-block">
                    <img src={item.foto_pedido_url} alt="Pedido" className="w-16 h-16 object-cover rounded border border-border" />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Select value={assignments[item.id] || ""} onValueChange={(v) => setAssignments(prev => ({ ...prev, [item.id]: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Escolher dobradeira..." /></SelectTrigger>
                  <SelectContent>
                    {DOBRADEIRAS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={() => handleAssign(item)} disabled={loading[item.id]} className="gap-1 bg-orange-500 hover:bg-orange-600">
                  {loading[item.id] ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight className="w-4 h-4" /> Enviar</>}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}