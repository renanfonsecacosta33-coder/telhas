import React from "react";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function EmptyState({ title, description, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Package className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 text-center max-w-sm">{description}</p>
      {onAdd && (
        <Button onClick={onAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          Adicionar
        </Button>
      )}
    </div>
  );
}