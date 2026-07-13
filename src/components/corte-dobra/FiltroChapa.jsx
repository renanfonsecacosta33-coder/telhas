import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Layers } from "lucide-react";

export default function FiltroChapa({ chapas, value, onChange }) {
  if (!chapas || chapas.length === 0) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chapa:</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 w-auto min-w-[200px] max-w-[280px] text-xs gap-1.5">
          <Layers className="w-3 h-3 shrink-0" />
          <SelectValue placeholder="Todas" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todas">Todas as chapas</SelectItem>
          {chapas.map(c => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}