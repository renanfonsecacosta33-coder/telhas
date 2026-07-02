import React from "react";
import { useFilial, FILIAIS } from "@/contexts/FilialContext";
import { Building2, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function FilialSwitcher() {
  const { filialAtiva, trocarFilial, podeTrocarFilial } = useFilial();

  if (!podeTrocarFilial) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-sm font-medium">
        <Building2 className="w-4 h-4 text-muted-foreground" />
        {filialAtiva}
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Building2 className="w-4 h-4" />
          <span className="font-semibold">{filialAtiva}</span>
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Trocar de Filial</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FILIAIS.map((f) => (
          <DropdownMenuItem
            key={f}
            onClick={() => trocarFilial(f)}
            className="flex items-center justify-between cursor-pointer"
          >
            {f}
            {f === filialAtiva && <Check className="w-4 h-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}