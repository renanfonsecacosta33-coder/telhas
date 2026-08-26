import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PenLine, Printer } from "lucide-react";
import ApontamentosEtapaPanel from "@/components/producao/ApontamentosEtapaPanel";

export default function ApontamentoOpButton({ ordem, ordem_tipo, label = "Apontar", size = "sm", variant = "outline", className = "", user }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={size} variant={variant} className={`gap-1 ${className}`} onClick={() => setOpen(true)} title="Apontamento e assinaturas digitais da OP">
        <PenLine className="w-3 h-3" /> {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="w-5 h-5 text-orange-500" />
              Documento Vivo da OP — Apontamento & Assinaturas
            </DialogTitle>
          </DialogHeader>
          <ApontamentosEtapaPanel ordem={ordem} ordem_tipo={ordem_tipo} />
          <DialogFooter>
            <Button variant="outline" onClick={() => window.print()} className="gap-1">
              <Printer className="w-4 h-4" /> Imprimir / PDF
            </Button>
            <Button onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}