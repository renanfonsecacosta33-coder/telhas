import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Calendar, Send, Clock, User, AlertTriangle, CheckCircle2, RotateCcw, Info } from "lucide-react";
import { formatDataBR, calcularDataPrometidaSLA, toISODate, slaDiasPorCategoria, diasUteisRestantes } from "@/lib/sla";
import { base44 } from "@/api/base44Client";
import { criarNotificacao } from "@/lib/notificacoesHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { toast } from "sonner";

const MOTIVOS_SUGERIDOS = [
  "Aguardando chegada de bobina metálica",
  "Falta de matéria-prima / bobina em falta",
  "Sobrecarga de fila na perfiladeira",
  "Aguardando liberação de croqui técnico",
  "Manutenção preventiva de maquinário",
  "Solicitação de ajuste de rota / logística",
];

export default function AlterarPrazoFabrilDialog({
  open,
  onOpenChange,
  pedido,
  onPrazoAlterado,
}) {
  const slaPadraoDias = useMemo(() => (pedido ? slaDiasPorCategoria(pedido) : 7), [pedido]);
  const dataPadraoSLA = useMemo(() => {
    if (!pedido) return "";
    return toISODate(calcularDataPrometidaSLA(pedido.data_recebimento, slaPadraoDias));
  }, [pedido, slaPadraoDias]);

  const dataAtualFabrica = pedido?.data_previsao_fabrica || dataPadraoSLA;

  const [novaData, setNovaData] = useState(dataAtualFabrica);
  const [motivo, setMotivo] = useState(pedido?.motivo_alteracao_prazo || "");
  const [salvando, setSalvando] = useState(false);

  // Sincroniza estado quando o modal abre
  React.useEffect(() => {
    if (open && pedido) {
      setNovaData(pedido.data_previsao_fabrica || dataPadraoSLA);
      setMotivo(pedido.motivo_alteracao_prazo || "");
    }
  }, [open, pedido, dataPadraoSLA]);

  if (!pedido) return null;

  // Atalhos para somar dias úteis a partir de hoje
  const aplicarAtalhoDias = (diasAdicionais) => {
    const base = new Date();
    const dataCalculada = toISODate(calcularDataPrometidaSLA(base, diasAdicionais));
    setNovaData(dataCalculada);
  };

  const restaurarPadrao = () => {
    setNovaData(dataPadraoSLA);
    setMotivo("Retorno ao prazo padrão de produção (7 dias úteis)");
  };

  const handleSalvar = async () => {
    if (!novaData) {
      toast.error("Selecione uma data válida para a nova previsão.");
      return;
    }

    setSalvando(true);
    try {
      let usuarioNome = "PCP";
      try {
        const u = await base44.auth.me();
        usuarioNome = u?.full_name || u?.email || "PCP";
      } catch {}

      const agoraIso = new Date().toISOString();
      const logExistente = (() => {
        try {
          return JSON.parse(pedido.historico_log || "[]");
        } catch {
          return [];
        }
      })();

      const dataFormatadaAntiga = formatDataBR(dataAtualFabrica);
      const dataFormatadaNova = formatDataBR(novaData);

      const novoLog = [
        ...logExistente,
        {
          data: agoraIso,
          usuario: usuarioNome,
          acao: "alteracao_prazo_fabrica",
          detalhes: `Previsão fabril alterada de ${dataFormatadaAntiga} para ${dataFormatadaNova}.${motivo ? ` Motivo: ${motivo}` : ""}`,
        },
      ];

      // 1. Atualiza a entidade PedidoOdoo
      const atualizado = await base44.entities.PedidoOdoo.update(pedido.id, {
        data_previsao_fabrica: novaData,
        motivo_alteracao_prazo: motivo.trim(),
        data_alteracao_prazo: agoraIso,
        usuario_alteracao_prazo: usuarioNome,
        historico_log: JSON.stringify(novoLog),
      });

      // 2. Cria Notificação no Sininho / Sistema para o Vendedor
      const vendedorDestino = pedido.vendedor_nome || "vendedor";
      await criarNotificacao({
        titulo: `📅 Prazo Fabril Alterado — Pedido #${pedido.numero_pedido}`,
        mensagem: `O PCP alterou a data de previsão da fábrica do pedido #${pedido.numero_pedido} (${pedido.cliente_nome}) para ${dataFormatadaNova}.${motivo ? ` Motivo: ${motivo}.` : ""} Vendedor: ${vendedorDestino}.`,
        tipo: "pedido_odoo",
        link: "/pcp",
        unidade: pedido.unidade || "Todas",
        usuario_destino: vendedorDestino,
        autor_nome: usuarioNome,
      });

      // 3. Registra mensagem de alerta no Chat do Pedido (para ficar visível para o vendedor)
      try {
        await base44.entities.MensagemChat.create({
          canal_tipo: "pedido",
          canal_id: pedido.id,
          canal_label: `Pedido #${pedido.numero_pedido}`,
          remetente_nome: `PCP (${usuarioNome})`,
          conteudo: `📢 [AVISO AO VENDEDOR (${vendedorDestino})]: A data de previsão de produção da fábrica foi alterada para ${dataFormatadaNova}.${motivo ? ` Motivo: ${motivo}` : ""}`,
          data_hora: agoraIso,
          lido: false,
        });
      } catch (errChat) {
        console.warn("Falha ao postar no chat do pedido:", errChat);
      }

      // 4. Dispara webhook do Mini BI / Odoo
      try {
        await notificarStatus(atualizado, "prazo_fabrica_alterado", {
          status_novo: pedido.status_pcp,
          nova_data_fabrica: novaData,
          motivo_alteracao: motivo,
          usuario: usuarioNome,
        });
      } catch (errBi) {
        console.warn("Falha ao notificar webhook Odoo:", errBi);
      }

      toast.success(
        `Previsão alterada para ${dataFormatadaNova}! Vendedor ${vendedorDestino} foi notificado.`
      );

      if (onPrazoAlterado) {
        onPrazoAlterado(atualizado);
      }

      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao alterar prazo fabril:", err);
      toast.error("Erro ao alterar prazo: " + (err.message || "Tente novamente"));
    } finally {
      setSalvando(false);
    }
  };

  const diasRestantesCalculados = diasUteisRestantes(novaData);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-950 dark:text-orange-200">
            <div className="w-8 h-8 rounded-lg bg-orange-100 dark:bg-orange-950/60 text-orange-600 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <span>Alterar Prazo Fabril (SLA da Fábrica)</span>
          </DialogTitle>
          <DialogDescription>
            Ajuste a data de previsão da fábrica para o pedido #{pedido.numero_pedido} e envie um aviso automático para o vendedor responsável.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Card Resumo do Pedido */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Vendedor</p>
              <p className="font-bold text-slate-800 dark:text-slate-100 truncate flex items-center gap-1 mt-0.5">
                <User className="w-3 h-3 text-blue-500" />
                {pedido.vendedor_nome || "Não informado"}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">Prometida Cliente</p>
              <p className="font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                {formatDataBR(pedido.data_entrega)}
              </p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase font-bold">SLA Padrão</p>
              <p className="font-bold text-orange-600 dark:text-orange-400 mt-0.5">
                {slaPadraoDias} dias úteis
              </p>
            </div>
          </div>

          {/* Seleção da Nova Data de Previsão */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-bold text-xs flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orange-600" />
                Nova Data de Previsão da Fábrica:
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={restaurarPadrao}
                className="h-6 text-[10px] text-muted-foreground hover:text-orange-600 gap-1 px-1.5"
              >
                <RotateCcw className="w-3 h-3" /> Restaurar Padrão
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="h-9 font-semibold text-sm"
              />
              <div className="shrink-0 text-center px-2 py-1 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800 rounded-lg">
                <p className="text-[9px] text-orange-600 uppercase font-bold">Faltam</p>
                <p className="font-black text-xs text-orange-700 dark:text-orange-300 leading-none">
                  {diasRestantesCalculados < 0 ? `${diasRestantesCalculados}d (atraso)` : `${diasRestantesCalculados}d úteis`}
                </p>
              </div>
            </div>

            {/* Atalhos Rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap pt-1">
              <span className="text-[10px] text-muted-foreground font-semibold">Atalhos:</span>
              <button
                type="button"
                onClick={() => aplicarAtalhoDias(3)}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-orange-100 dark:bg-slate-800 text-slate-700 hover:text-orange-700 transition-colors"
              >
                +3 dias úteis
              </button>
              <button
                type="button"
                onClick={() => aplicarAtalhoDias(7)}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-orange-100 dark:bg-slate-800 text-slate-700 hover:text-orange-700 transition-colors"
              >
                +7 dias úteis
              </button>
              <button
                type="button"
                onClick={() => aplicarAtalhoDias(10)}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-orange-100 dark:bg-slate-800 text-slate-700 hover:text-orange-700 transition-colors"
              >
                +10 dias úteis
              </button>
              <button
                type="button"
                onClick={() => aplicarAtalhoDias(15)}
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 hover:bg-orange-100 dark:bg-slate-800 text-slate-700 hover:text-orange-700 transition-colors"
              >
                +15 dias úteis
              </button>
            </div>
          </div>

          {/* Motivo da Alteração para o Vendedor */}
          <div className="space-y-1.5">
            <Label className="font-bold text-xs flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              Motivo da Alteração (chegará para o vendedor):
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex: Falta de matéria-prima, fila sobrecarregada, previsão de chegada da bobina..."
              className="min-h-[70px] text-xs resize-none"
            />
            {/* Chips de motivos frequentes */}
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {MOTIVOS_SUGERIDOS.map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setMotivo(sug)}
                  className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-600 hover:text-slate-900 dark:text-slate-400 transition-colors truncate max-w-[220px]"
                  title={sug}
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Box de Notificação Transparente */}
          <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/30 p-2.5 text-blue-900 dark:text-blue-200 flex items-start gap-2 text-[11px]">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Notificação Automática do Vendedor</p>
              <p className="text-blue-800 dark:text-blue-300 mt-0.5 leading-relaxed">
                Ao confirmar, o vendedor <strong>{pedido.vendedor_nome || "responsável"}</strong> será notificado imediatamente pelo sininho do sistema e uma mensagem será fixada no Chat do Pedido com a nova previsão e justificativa.
              </p>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={salvando}>
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={salvando || !novaData}
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold gap-1.5 shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            {salvando ? "Salvando e Notificando..." : "Confirmar e Notificar Vendedor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
