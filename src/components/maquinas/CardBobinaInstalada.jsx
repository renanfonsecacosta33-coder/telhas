import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Disc,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Layers,
  ArrowRight,
  Sliders,
  Check
} from "lucide-react";
import { toast } from "sonner";
import { formatNomeMaterial } from "@/lib/sequenciamentoBobinaHelper";

export default function CardBobinaInstalada({
  maquinaNome = "",
  bobinaInstalada = null,
  onAlterarBobina = null,
  pedidosCampanha = [],
  metrosCampanha = 0,
  todasBobinas = []
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const [bobinaSelecionadaId, setBobinaSelecionadaId] = useState("");

  const cod = bobinaInstalada?.codigo || "Bobina não definida";
  const nomeMat = bobinaInstalada?.nomeMaterial || formatNomeMaterial(bobinaInstalada?.chaveMaterial);

  // Busca dados completos da bobina instalada no cadastro
  const bobinaObj = todasBobinas.find(b =>
    b.id === bobinaInstalada?.id ||
    b.codigo === bobinaInstalada?.codigo ||
    (b.codigo && String(cod).toUpperCase().includes(String(b.codigo).toUpperCase()))
  );

  const metragemRestante = bobinaObj?.metragem_restante ?? bobinaObj?.metragem ?? null;
  const alertaMetragemBaixa = metragemRestante != null && metrosCampanha > metragemRestante;

  const handleSalvarTroca = () => {
    if (!bobinaSelecionadaId) {
      toast.error("Selecione uma bobina.");
      return;
    }
    const b = todasBobinas.find(x => x.id === bobinaSelecionadaId || x.codigo === bobinaSelecionadaId);
    if (!b) return;

    const esp = b.espessura_utilizada || b.espessura_real || b.chapa || "0,43";
    const chave = b.cor && !["galvalume", "natural", "gv", "gl"].some(t => String(b.cor).toLowerCase().includes(t))
      ? `COR_${String(b.cor).toUpperCase()}_${esp}`
      : `NATURAL_${esp}`;

    const novaInstalada = {
      id: b.id,
      codigo: b.codigo || "Bobina",
      cor: b.cor || "Natural",
      chapa: esp,
      chaveMaterial: chave,
      nomeMaterial: `${b.cor || "Natural"} ${esp}`,
      origem: "manual_operador"
    };

    onAlterarBobina?.(novaInstalada);
    setModalOpen(false);
    toast.success(`Bobina no desbobinador atualizada para ${b.codigo}! A fila foi resequenciada.`);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs space-y-2.5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400 shrink-0">
            <Disc className="w-5 h-5 animate-spin-slow" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Sliders className="w-3 h-3 text-primary" />
                Bobina no Desbobinador
              </span>
              <Badge variant="outline" className="text-[10px] font-bold border-orange-300 text-orange-700 bg-orange-50/50 dark:border-orange-800 dark:text-orange-300 dark:bg-orange-950/40">
                Setup Ativo
              </Badge>
            </div>

            <p className="text-sm sm:text-base font-black text-foreground truncate mt-0.5">
              {cod !== "Bobina não definida" && (
                <span className="font-mono text-primary mr-1.5">{cod} ·</span>
              )}
              {nomeMat}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setModalOpen(true)}
            className="text-xs h-8 gap-1.5 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Trocar Bobina Montada
          </Button>
        </div>
      </div>

      {/* Indicadores da Campanha Atual na Fila */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2 border-t border-border/60 text-xs">
        <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
          <span className="text-[10px] text-muted-foreground block font-medium">Fila Deste Material</span>
          <strong className="text-foreground text-sm font-black flex items-center gap-1 mt-0.5">
            <Zap className="w-3.5 h-3.5 text-emerald-500" />
            {pedidosCampanha.length} pedido(s)
          </strong>
        </div>

        <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
          <span className="text-[10px] text-muted-foreground block font-medium">Metragem Acumulada</span>
          <strong className="text-foreground text-sm font-black mt-0.5 block">
            {metrosCampanha.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m sem troca
          </strong>
        </div>

        <div className="p-2 rounded-lg bg-muted/40 border border-border/40 col-span-2 sm:col-span-1">
          <span className="text-[10px] text-muted-foreground block font-medium">Estoque da Bobina</span>
          <strong className={`text-sm font-black mt-0.5 block ${alertaMetragemBaixa ? "text-amber-600 dark:text-amber-400" : "text-foreground"}`}>
            {metragemRestante != null ? `${Math.round(metragemRestante)}m restante` : "Metragem livre"}
          </strong>
        </div>
      </div>

      {/* Alerta se a fila exceder a metragem da bobina */}
      {alertaMetragemBaixa && (
        <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[11px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            <strong>Atenção:</strong> A fila atual requer <strong>{Math.round(metrosCampanha)}m</strong> e a bobina possui cerca de <strong>{Math.round(metragemRestante)}m</strong>. Prepare a bobina reserva com a ponte rolante!
          </span>
        </div>
      )}

      {/* Modal de Seleção de Bobina Montada */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Disc className="w-5 h-5 text-orange-500" />
              Selecionar Bobina Montada na {maquinaNome}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <p className="text-xs text-muted-foreground">
              Escolha qual bobina está colocada no desbobinador. A fila de pedidos será reordenada automaticamente para priorizar as ordens deste material.
            </p>

            <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
              {todasBobinas
                .filter(b => !b.arquivada)
                .slice(0, 30)
                .map(b => {
                  const isSel = bobinaSelecionadaId === b.id;
                  const esp = b.espessura_utilizada || b.espessura_real || b.chapa || "—";
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setBobinaSelecionadaId(b.id)}
                      className={`w-full p-2.5 rounded-lg border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                        isSel
                          ? "border-primary bg-primary/10 ring-1 ring-primary"
                          : "border-border hover:bg-muted/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-xs text-foreground block">
                          {b.codigo}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate block">
                          {b.cor || "Natural"} · Chapa {esp} · {b.origem || "Nacional"}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-semibold text-foreground">
                          {b.metragem_restante ? `${Math.round(b.metragem_restante)}m` : `${b.peso_kg || 0}kg`}
                        </span>
                        {isSel && <Check className="w-3.5 h-3.5 text-primary ml-auto mt-0.5" />}
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSalvarTroca} className="bg-primary text-primary-foreground font-semibold">
              Confirmar Bobina na Máquina
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
