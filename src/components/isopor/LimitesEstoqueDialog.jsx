import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, Settings2 } from "lucide-react";

export default function LimitesEstoqueDialog({ open, onClose, limites, onSave }) {
  const [form, setForm] = useState({ ...limites });

  const handleSave = () => {
    if (Number(form.critico) >= Number(form.baixo)) {
      alert("O limite crítico deve ser menor que o limite baixo.");
      return;
    }
    onSave({ critico: Number(form.critico), baixo: Number(form.baixo) });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-4 h-4" />
            Limites de Estoque
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <p className="text-sm text-muted-foreground">
            Define os limites de quantidade (placas) para classificar o nível do estoque de cada modelo.
          </p>

          {/* Crítico */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" />
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              Crítico — abaixo de
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={form.critico}
                onChange={(e) => setForm((f) => ({ ...f, critico: e.target.value }))}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">placas</span>
            </div>
            <p className="text-xs text-red-600">Estoque em situação crítica — reposição urgente</p>
          </div>

          {/* Baixo */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
              Baixo — abaixo de
            </Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min="0"
                value={form.baixo}
                onChange={(e) => setForm((f) => ({ ...f, baixo: e.target.value }))}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">placas</span>
            </div>
            <p className="text-xs text-amber-600">Atenção — estoque começando a baixar</p>
          </div>

          {/* OK */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" />
              <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
              OK — acima de {form.baixo || "—"} placas
            </Label>
            <p className="text-xs text-green-600">Estoque adequado</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}>Salvar Limites</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}