import React from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Weight, Ruler, Factory, Calendar, CheckCircle2, AlertCircle } from "lucide-react";

export default function PreBaixaDetalhesDialog({
  open,
  onClose,
  bobina,
  preBaixaKg = 0,
  preBaixaMetros = 0,
  ops = []
}) {
  if (!bobina) return null;

  const pesoTotal = bobina.peso_kg || 0;
  const dispReal = Math.max(0, pesoTotal - preBaixaKg);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className="p-2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                Bobina {bobina.codigo || bobina.id} — Detalhes da Pré-Baixa
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Ordens de Produção (OPs) ativas reservando este material
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo da Bobina */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-3 text-center">
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Cor / Espessura</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {bobina.cor || "Natural"} · {bobina.chapa}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Peso em Estoque</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">
              {pesoTotal.toLocaleString("pt-BR")} kg
            </span>
          </div>
          <div className="bg-blue-100/50 dark:bg-blue-950/40 rounded-lg py-0.5">
            <span className="text-[10px] text-blue-800 dark:text-blue-300 uppercase font-bold block">Pré-Baixa Reservada</span>
            <span className="text-sm font-bold text-blue-700 dark:text-blue-400">
              {preBaixaKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
            </span>
            <span className="text-[10px] text-blue-600 dark:text-blue-400 block font-semibold">
              ≈ {preBaixaMetros > 0 ? preBaixaMetros.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : Math.round(preBaixaKg / 3.7)}m
            </span>
          </div>
          <div className="bg-emerald-100/50 dark:bg-emerald-950/40 rounded-lg py-0.5">
            <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-bold block">Disponível Real</span>
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {dispReal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
            </span>
          </div>
        </div>

        {/* Lista de OPs */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-2">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {ops.length} Ordem(ns) de Produção vinculada(s):
          </p>

          {ops.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm border rounded-xl border-dashed">
              Nenhuma ordem de produção vinculada encontrada para esta bobina.
            </div>
          ) : (
            <div className="space-y-2">
              {ops.map((op, idx) => (
                <div
                  key={`${op.id}-${idx}`}
                  className="bg-card border border-border rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-blue-400 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-xs bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded">
                        #{op.numero_pedido || op.id?.slice(0, 8)}
                      </span>
                      <span className="font-bold text-sm text-foreground">{op.produto}</span>
                      <Badge variant="outline" className="text-[10px] font-semibold">
                        <Factory className="w-3 h-3 mr-1" /> {op.maquina || "Produção"}
                      </Badge>
                      <Badge
                        className={`text-[10px] capitalize ${
                          ["em_producao", "produzindo", "iniciado"].includes(String(op.status).toLowerCase())
                            ? "bg-amber-100 text-amber-800 border-amber-300"
                            : "bg-blue-100 text-blue-800 border-blue-300"
                        }`}
                      >
                        {op.status}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3">
                      {op.cliente && <span>Cliente: <strong className="text-foreground">{op.cliente}</strong></span>}
                      {op.data && <span>Data: <strong>{op.data}</strong></span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 bg-slate-50 dark:bg-slate-800/60 p-2 rounded-lg border text-right">
                    <div>
                      <span className="text-[10px] text-muted-foreground block">Metragem linear</span>
                      <span className="text-sm font-bold text-primary">
                        {(op.metros || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                      </span>
                    </div>
                    <div className="border-l pl-3">
                      <span className="text-[10px] text-muted-foreground block">Peso alocado</span>
                      <span className="text-sm font-bold text-blue-600">
                        {(op.kg || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-border flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
