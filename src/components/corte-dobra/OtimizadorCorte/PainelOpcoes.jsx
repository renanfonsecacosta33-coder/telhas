import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Settings2 } from "lucide-react";

export default function PainelOpcoes({ opcoes, onChange }) {
  const set = (k, v) => onChange({ ...opcoes, [k]: v });

  return (
    <div className="space-y-3">
      <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
        <Settings2 className="w-4 h-4 text-slate-500" />
        Opções
      </h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-xs font-medium">Espessura do corte / kerf (mm)</Label>
            <p className="text-[10px] text-muted-foreground">Espessura perdida na guilhotina ou laser</p>
          </div>
          <Input
            type="number"
            min="0"
            step="0.5"
            value={opcoes.kerf}
            onChange={e => set("kerf", parseFloat(e.target.value) || 0)}
            className="h-7 text-xs w-20 text-center"
          />
        </div>

        <div className="flex items-center justify-between gap-3">
          <div>
            <Label className="text-xs font-medium">Permitir rotação 90°</Label>
            <p className="text-[10px] text-muted-foreground">Rotaciona peças para melhor aproveitamento</p>
          </div>
          <Switch
            checked={opcoes.permitirRotacao}
            onCheckedChange={v => set("permitirRotacao", v)}
          />
        </div>
      </div>
    </div>
  );
}