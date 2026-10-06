import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Zap, CheckCircle2, Factory, Calendar, AlertTriangle, Layers, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useFilial } from "@/contexts/FilialContext";
import {
  prepararPresetNovaOrdemTelhas,
  getItens,
  buildItensJson,
  computePercentual,
  statusPcpPorPercentual
} from "@/lib/pedidoOdooHelper";
import { notificarStatus } from "@/lib/biNotificador";

const MAQUINAS_TELHAS_LISTA = [
  "TP - 40",
  "TP - 25",
  "ONDULADA",
  "COLONIAL",
  "BANDEJA",
  "DESBOBINADOR",
  "CUMEEIRA",
  "COLAGEM",
];

export default function ProducaoEmLoteModal({
  open,
  onOpenChange,
  itensSelecionados = [],
  onConcluido
}) {
  const [dataProducao, setDataProducao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [maquinaModo, setMaquinaModo] = useState("auto"); // "auto" | máquina fixa
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

  // Calcula metros totais selecionados
  const totalMetros = itensSelecionados.reduce((acc, { item }) => {
    return acc + (Number(item?.quantidade || 0));
  }, 0);

  const handleExecutarEmLote = async () => {
    if (itensSelecionados.length === 0) return;
    setProcessando(true);
    setProgresso(0);

    let criados = 0;
    let falhas = 0;

    for (let i = 0; i < itensSelecionados.length; i++) {
      const { pedido, item, idx } = itensSelecionados[i];
      try {
        const itemIdx = item._idx != null ? item._idx : idx;
        const preset = prepararPresetNovaOrdemTelhas(pedido, item, filialAtiva);

        // Define a máquina
        let maquinaFinal = preset.maquina || "TP - 40";
        if (maquinaModo !== "auto") {
          maquinaFinal = maquinaModo;
        }

        const novaOpData = {
          ...preset,
          data: dataProducao,
          maquina: maquinaFinal,
          pedido_odoo_id: pedido.id,
          item_idx: itemIdx,
          status: "pendente",
        };

        // 1. Cria a OP na máquina
        await base44.entities.Pedido.create(novaOpData);

        // 2. Atualiza atomicamente o PedidoOdoo buscando o mais recente
        try {
          let pedFresco = null;
          try {
            pedFresco = await base44.entities.PedidoOdoo.get(pedido.id);
          } catch {
            const l = await base44.entities.PedidoOdoo.filter({ id: pedido.id });
            pedFresco = l?.[0];
          }
          const pedParaAtualizar = pedFresco || pedido;
          const itens = getItens(pedParaAtualizar);

          if (itens[itemIdx]) {
            itens[itemIdx] = {
              ...itens[itemIdx],
              status: "em_producao",
              maquina: maquinaFinal,
            };
            const percentual = computePercentual(itens);
            const status_pcp = statusPcpPorPercentual(percentual, pedParaAtualizar.status_pcp);

            const updated = await base44.entities.PedidoOdoo.update(pedido.id, {
              itens_json: buildItensJson(itens),
              percentual_concluido: percentual,
              status_pcp,
            });

            // Dispara webhook
            notificarStatus(updated, "maquina_inicio", {
              maquina_atual: maquinaFinal,
              item_nome: itens[itemIdx]?.produto || preset.produto || "",
              inicio_fmt: new Date().toISOString(),
              status_novo: status_pcp,
            }).catch(() => {});
          }
        } catch (errPed) {
          console.warn("[ProducaoLote] Falha ao atualizar PedidoOdoo:", errPed?.message || errPed);
        }

        criados++;
      } catch (err) {
        console.error("[ProducaoLote] Erro ao criar OP:", err);
        falhas++;
      }

      setProgresso(Math.round(((i + 1) / itensSelecionados.length) * 100));
    }

    queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
    queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
    queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });

    if (criados > 0) {
      toast.success(`⚡ ${criados} ordens de produção iniciadas com sucesso!${falhas > 0 ? ` (${falhas} falhas)` : ""}`);
    } else {
      toast.error("Nenhuma ordem pôde ser criada.");
    }

    setProcessando(false);
    onOpenChange(false);
    if (onConcluido) onConcluido();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !processando && onOpenChange(v)}>
      <DialogContent className="max-w-lg p-6 space-y-4">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            Colocar Selecionados em Produção
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Inicie ordens de produção para múltiplos cortes e pedidos de uma só vez sem travar o sistema.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo do Lote */}
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Itens / Cortes Selecionados:</span>
            <Badge className="bg-amber-500 text-white font-bold">{itensSelecionados.length} itens</Badge>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground">Metragem Total Estimada:</span>
            <strong className="text-amber-700 dark:text-amber-400 font-mono text-sm">{totalMetros.toFixed(1)} MT</strong>
          </div>
        </div>

        {/* Formulário de Configuração do Lote */}
        <div className="space-y-3.5 py-1">
          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              Data de Produção
            </Label>
            <Input
              type="date"
              value={dataProducao}
              onChange={(e) => setDataProducao(e.target.value)}
              disabled={processando}
              className="h-9 text-xs"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Factory className="w-3.5 h-3.5 text-muted-foreground" />
              Destino / Máquina
            </Label>
            <Select value={maquinaModo} onValueChange={setMaquinaModo} disabled={processando}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione a máquina..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto" className="text-xs font-bold text-primary">
                  ⚡ Automática (Conforme perfil da telha: TP-25, TP-40, Ondulada...)
                </SelectItem>
                {MAQUINAS_TELHAS_LISTA.map((m) => (
                  <SelectItem key={m} value={m} className="text-xs">
                    Fixar em {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Barra de Progresso quando estiver processando */}
        {processando && (
          <div className="space-y-1.5 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                Criando ordens de produção...
              </span>
              <span className="font-bold">{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
          </div>
        )}

        <DialogFooter className="border-t border-border/80 pt-3 flex items-center justify-between sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processando} size="sm">
            Cancelar
          </Button>
          <Button
            onClick={handleExecutarEmLote}
            disabled={processando || itensSelecionados.length === 0}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5"
          >
            {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 fill-white" />}
            {processando ? "Iniciando Lote..." : `Enviar ${itensSelecionados.length} para Produção`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
