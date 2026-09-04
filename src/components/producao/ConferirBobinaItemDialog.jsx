import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, AlertTriangle, Play, Weight, Palette, Ruler } from "lucide-react";

export default function ConferirBobinaItemDialog({
  open,
  onClose,
  item,
  itemIndex = 0,
  pedido,
  bobinas = [],
  onConfirmarInicio
}) {
  if (!item) return null;

  const qty = Number(item.qty) || 0;
  const mm = Number(item.mm) || 0;
  const metros = qty > 0 && mm > 0 ? (qty * mm) / 1000 : 0;

  // Localiza bobinas configuradas para este item (com fallback para as bobinas da OP)
  const bobinaSupId = item.bobina_id || pedido?.bobina_superior_id || pedido?.bobina_superior;
  const bobinaInfId = item.bobina_inf_id || pedido?.bobina_inferior_id || pedido?.bobina_inferior;

  const bobinaSup = useMemo(() => {
    return bobinas.find(b => b.id === bobinaSupId || b.codigo === bobinaSupId);
  }, [bobinas, bobinaSupId]);

  const bobinaInf = useMemo(() => {
    return bobinas.find(b => b.id === bobinaInfId || b.codigo === bobinaInfId);
  }, [bobinas, bobinaInfId]);

  const corSup = bobinaSup?.cor || item.bobina_desc || pedido?.rvm_superior || "Padrão / Natural";
  const chapaSup = bobinaSup?.chapa || bobinaSup?.espessura_mm || pedido?.espessura_exigida || "—";
  const codSup = bobinaSup?.codigo || (typeof bobinaSupId === "string" ? bobinaSupId : "—");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg border-2 border-indigo-200">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-800">
                Conferência de Bobina — Item {itemIndex + 1}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Confirme a bobina instalada na máquina antes de iniciar este item
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo do Item a ser produzido */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-mono font-bold text-xs flex items-center justify-center">
              {itemIndex + 1}
            </span>
            <div>
              <p className="text-sm font-black text-slate-900">
                {qty} peças × {mm.toLocaleString("pt-BR")} mm
              </p>
              <p className="text-xs text-muted-foreground">
                {pedido?.produto} {pedido?.cliente ? `· ${pedido.cliente}` : ""}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-black text-primary leading-none">
              {metros.toFixed(2)}m
            </p>
            <p className="text-[11px] text-muted-foreground">linear planejado</p>
          </div>
        </div>

        {/* Bobina Superior / Principal deste Item */}
        <div className="border-2 border-blue-400 bg-blue-50/70 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
              <Weight className="w-4 h-4 text-blue-700" />
              Bobina do Item {itemIndex + 1}
            </span>
            <Badge className="bg-blue-600 text-white text-xs font-mono font-bold">
              {codSup}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white/80 rounded-lg p-2 border border-blue-200">
              <span className="text-[10px] text-muted-foreground block">Cor / RVM</span>
              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                <Palette className="w-3.5 h-3.5 text-blue-600" />
                {corSup}
              </span>
            </div>
            <div className="bg-white/80 rounded-lg p-2 border border-blue-200">
              <span className="text-[10px] text-muted-foreground block">Espessura / Chapa</span>
              <span className="font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                <Ruler className="w-3.5 h-3.5 text-blue-600" />
                {chapaSup} mm
              </span>
            </div>
            {bobinaSup?.peso_kg != null && (
              <div className="bg-white/80 rounded-lg p-2 border border-blue-200 col-span-2">
                <span className="text-[10px] text-muted-foreground block">Estoque da Bobina</span>
                <span className="font-bold text-emerald-700">
                  {Number(bobinaSup.peso_kg).toLocaleString("pt-BR")} kg em estoque
                </span>
                {bobinaSup.qualidade && (
                  <span className="text-slate-500 text-[11px] ml-2 font-normal">
                    ({bobinaSup.qualidade})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Se houver Bobina Inferior para este item (ex: termoacústica) */}
        {bobinaInfId && (
          <div className="border border-indigo-300 bg-indigo-50/60 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-900">
                Bobina Inferior do Item
              </span>
              <Badge variant="outline" className="text-xs font-mono">
                {bobinaInf?.codigo || bobinaInfId}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-muted-foreground block">Cor Inferior:</span>
                <span className="font-semibold text-slate-800">{bobinaInf?.cor || "Padrão"}</span>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground block">Chapa:</span>
                <span className="font-semibold text-slate-800">{bobinaInf?.chapa || "—"} mm</span>
              </div>
            </div>
          </div>
        )}

        {/* Alerta de Verificação Obrigatória */}
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <p className="font-bold">Atenção para troca de cor ou espessura!</p>
            <p className="text-amber-800 leading-relaxed">
              Como este pedido possui múltiplos itens, confirme na máquina se a bobina instalada no momento confere com os dados acima antes de iniciar o corte.
            </p>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-1.5"
            onClick={() => {
              onConfirmarInicio(itemIndex);
              onClose();
            }}
          >
            <Play className="w-3.5 h-3.5" /> Confirmar Bobina e Iniciar Item {itemIndex + 1}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
