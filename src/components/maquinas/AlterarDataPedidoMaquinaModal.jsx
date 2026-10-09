import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  CalendarClock, Calendar, User, Clock, CheckCircle2,
  AlertTriangle, RotateCcw, Send, Building2
} from "lucide-react";
import { format, addDays, isWeekend } from "date-fns";
import { ptBR } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { notificarStatus } from "@/lib/biNotificador";
import { getDataEntregaParaOrdenacao } from "@/lib/prioridadeHelper";
import { toast } from "sonner";

const MOTIVOS_SUGERIDOS = [
  "Sobrecarga de fila na perfiladeira / máquina",
  "Aguardando liberação / troca de bobina",
  "Ajuste na programação da rota de entrega",
  "Solicitação de ajuste pelo cliente / vendedor",
  "Manutenção preventiva / ajuste no maquinário",
  "Antecipação de produção solicitada"
];

function adicionarDiasUteis(dataBase, diasUteis) {
  let d = new Date(dataBase);
  let adicionados = 0;
  while (adicionados < diasUteis) {
    d = addDays(d, 1);
    if (!isWeekend(d)) {
      adicionados++;
    }
  }
  return format(d, "yyyy-MM-dd");
}

function formatDataExibicao(isoDate) {
  if (!isoDate || isoDate === "9999-99-99") return "Não definida";
  try {
    const d = new Date(isoDate + "T12:00:00");
    return format(d, "dd/MM/yyyy (EEEE)", { locale: ptBR });
  } catch {
    return isoDate;
  }
}

export default function AlterarDataPedidoMaquinaModal({
  open,
  onClose,
  pedido,
  onSuccess,
  usuarioNome = "Operador Máquina"
}) {
  const dataAtualIso = useMemo(() => {
    return getDataEntregaParaOrdenacao(pedido);
  }, [pedido]);

  const [novaData, setNovaData] = useState(() => {
    return dataAtualIso !== "9999-99-99" ? dataAtualIso : format(new Date(), "yyyy-MM-dd");
  });
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  React.useEffect(() => {
    if (open && pedido) {
      const d = getDataEntregaParaOrdenacao(pedido);
      setNovaData(d !== "9999-99-99" ? d : format(new Date(), "yyyy-MM-dd"));
      setMotivo(pedido.motivo_alteracao_prazo || "");
    }
  }, [open, pedido]);

  if (!pedido) return null;

  const presets = pedido._presets || {};
  const numeroPedido = pedido.numero_pedido || presets.numero_pedido || (pedido.id ? pedido.id.slice(-6).toUpperCase() : "");
  const nomeCliente = pedido.cliente || presets.cliente || "Cliente";
  const nomeVendedor = pedido.vendedor || presets.vendedor || "Vendedor";
  const nomeMaquina = pedido.maquina || presets.maquina || "Perfiladeira";

  const hojeIso = format(new Date(), "yyyy-MM-dd");
  const amanhaIso = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const handleSalvar = async () => {
    if (!novaData) {
      toast.error("Selecione uma data válida para a nova entrega.");
      return;
    }

    setSalvando(true);
    try {
      const agoraIso = new Date().toISOString();
      const dataAntigaFmt = formatDataExibicao(dataAtualIso);
      const dataNovaFmt = formatDataExibicao(novaData);

      // 1. Atualiza histórico do Pedido
      const histExistente = (() => {
        try {
          return JSON.parse(pedido.historico || "[]");
        } catch {
          return [];
        }
      })();

      const novoHistorico = [
        ...histExistente,
        {
          data: agoraIso,
          usuario: usuarioNome,
          acao: "alteracao_data_entrega",
          detalhes: `Data alterada de ${dataAntigaFmt} para ${dataNovaFmt} na máquina ${nomeMaquina}.${motivo ? ` Motivo: ${motivo}` : ""}`
        }
      ];

      // 2. Atualiza a entidade Pedido (OP da máquina)
      await base44.entities.Pedido.update(pedido.id, {
        data: novaData,
        data_prevista: novaData,
        data_entrega: novaData,
        data_previsao_fabrica: novaData,
        motivo_alteracao_prazo: motivo.trim(),
        data_alteracao_prazo: agoraIso,
        usuario_alteracao_prazo: usuarioNome,
        historico: JSON.stringify(novoHistorico)
      });

      // 3. Se houver PedidoOdoo vinculado, atualiza nele também
      let pedidoOdooVinculado = null;
      try {
        if (pedido.pedido_odoo_id) {
          pedidoOdooVinculado = await base44.entities.PedidoOdoo.get(pedido.pedido_odoo_id);
        } else if (numeroPedido) {
          const lista = await base44.entities.PedidoOdoo.list("-data_recebimento", 100);
          pedidoOdooVinculado = lista.find(po => String(po.numero_pedido).trim() === String(numeroPedido).trim());
        }

        if (pedidoOdooVinculado?.id) {
          const logOdoo = (() => {
            try { return JSON.parse(pedidoOdooVinculado.historico_log || "[]"); } catch { return []; }
          })();
          await base44.entities.PedidoOdoo.update(pedidoOdooVinculado.id, {
            data_entrega: novaData,
            data_previsao_fabrica: novaData,
            motivo_alteracao_prazo: motivo.trim(),
            data_alteracao_prazo: agoraIso,
            usuario_alteracao_prazo: usuarioNome,
            historico_log: JSON.stringify([
              ...logOdoo,
              {
                data: agoraIso,
                usuario: `${nomeMaquina} (${usuarioNome})`,
                acao: "alteracao_prazo_fabrica",
                detalhes: `Prazo alterado na máquina de ${dataAntigaFmt} para ${dataNovaFmt}.${motivo ? ` Motivo: ${motivo}` : ""}`
              }
            ])
          });
        }
      } catch (errOdooRec) {
        console.warn("[AlterarDataMaquina] Falha ao atualizar PedidoOdoo vinculado:", errOdooRec);
      }

      // 4. Cria Notificação para o Vendedor (e dashboard)
      try {
        await base44.entities.Notificacao.create({
          titulo: `📅 Data de Entrega Alterada — Pedido #${numeroPedido}`,
          mensagem: `A data de entrega do pedido #${numeroPedido} (${nomeCliente}) foi alterada para ${dataNovaFmt} na máquina ${nomeMaquina}.${motivo ? ` Motivo: ${motivo}.` : ""} Vendedor responsável: ${nomeVendedor}.`,
          tipo: "producao",
          unidade: pedido.unidade || "Todas",
          usuario_destino: nomeVendedor || "vendedor",
          autor_nome: `${nomeMaquina} (${usuarioNome})`,
          link: "/dashboard-vendedor",
          data_hora: agoraIso,
          lida: false
        });
      } catch (errNotif) {
        console.warn("[AlterarDataMaquina] Falha ao criar Notificacao:", errNotif);
      }

      // 5. Registra mensagem de alerta no Chat do Pedido (visível ao vendedor)
      try {
        await base44.entities.MensagemChat.create({
          canal_tipo: "pedido",
          canal_id: pedido.id,
          canal_label: `Pedido #${numeroPedido}`,
          remetente_nome: `${nomeMaquina} (${usuarioNome})`,
          conteudo: `📢 [AVISO AO VENDEDOR (${nomeVendedor})]: Data de entrega alterada para ${dataNovaFmt}.${motivo ? ` Motivo: ${motivo}` : ""}`,
          data_hora: agoraIso,
          lido: false
        });
      } catch (errChat) {
        console.warn("[AlterarDataMaquina] Falha ao enviar MensagemChat:", errChat);
      }

      // 6. Notifica no PRÓPRIO ODOO ERP via webhook BI Industrial
      try {
        const payloadOdoo = pedidoOdooVinculado || pedido;
        await notificarStatus(payloadOdoo, "prazo_fabrica_alterado", {
          numero_pedido: numeroPedido,
          nova_data_fabrica: novaData,
          data_previsao_fabrica: novaData,
          data_entrega_fabrica: novaData,
          commitment_date: novaData,
          date_planned: novaData,
          date_deadline: novaData,
          motivo_alteracao_prazo: motivo.trim(),
          usuario: usuarioNome,
          maquina_atual: nomeMaquina
        });
      } catch (errBi) {
        console.warn("[AlterarDataMaquina] Falha ao notificar webhook Odoo:", errBi);
      }

      toast.success(`Data alterada para ${dataNovaFmt}! Vendedor e Odoo ERP notificados com sucesso.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      toast.error("Erro ao alterar data: " + (err.message || ""));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card text-card-foreground border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Alterar Data de Entrega</span>
                <Badge variant="outline" className="font-mono text-xs font-black bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200">
                  #{numeroPedido}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Atualiza a fila da máquina, notifica o vendedor no dashboard e sincroniza no Odoo ERP.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Card Resumo do Pedido */}
          <div className="bg-muted/40 border border-border/70 rounded-xl p-3 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Cliente:
              </span>
              <strong className="text-foreground">{nomeCliente}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" /> Vendedor:
              </span>
              <strong className="text-blue-600 dark:text-blue-400">{nomeVendedor}</strong>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span className="text-muted-foreground flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Data Atual na Fila:
              </span>
              <span className="font-bold text-slate-700 dark:text-slate-300">
                {formatDataExibicao(dataAtualIso)}
              </span>
            </div>
          </div>

          {/* Campo de Nova Data com Atalhos Rápidos */}
          <div className="space-y-2">
            <Label className="text-xs font-bold flex items-center justify-between">
              <span>Nova Data de Entrega / Produção</span>
              <span className="text-[11px] text-muted-foreground font-normal">
                (Define prioridade 7 da fila)
              </span>
            </Label>
            <Input
              type="date"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
              className="h-10 text-sm font-semibold"
            />

            {/* Atalhos Rápidos de Data */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => setNovaData(hojeIso)}
                className={`text-[11px] px-2 py-1 rounded-md border font-semibold transition-colors ${
                  novaData === hojeIso
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted text-muted-foreground border-border"
                }`}
              >
                Hoje
              </button>
              <button
                type="button"
                onClick={() => setNovaData(amanhaIso)}
                className={`text-[11px] px-2 py-1 rounded-md border font-semibold transition-colors ${
                  novaData === amanhaIso
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted text-muted-foreground border-border"
                }`}
              >
                Amanhã
              </button>
              <button
                type="button"
                onClick={() => setNovaData(adicionarDiasUteis(new Date(), 2))}
                className="text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-muted text-muted-foreground border-border font-semibold transition-colors"
              >
                +2 dias úteis
              </button>
              <button
                type="button"
                onClick={() => setNovaData(adicionarDiasUteis(new Date(), 3))}
                className="text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-muted text-muted-foreground border-border font-semibold transition-colors"
              >
                +3 dias úteis
              </button>
              <button
                type="button"
                onClick={() => setNovaData(adicionarDiasUteis(new Date(), 5))}
                className="text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-muted text-muted-foreground border-border font-semibold transition-colors"
              >
                +5 dias úteis
              </button>
              <button
                type="button"
                onClick={() => setNovaData(adicionarDiasUteis(new Date(), 7))}
                className="text-[11px] px-2 py-1 rounded-md border bg-background hover:bg-muted text-muted-foreground border-border font-semibold transition-colors"
              >
                +7 dias úteis
              </button>
            </div>
          </div>

          {/* Campo Motivo da Alteração com Sugestões */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">
              Motivo da Alteração (enviado ao Vendedor e ao Odoo)
            </Label>
            <Textarea
              placeholder="Explique o motivo do ajuste na data..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              className="text-xs resize-none"
            />
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">
                Sugestões Rápidas:
              </span>
              <div className="flex flex-wrap gap-1">
                {MOTIVOS_SUGERIDOS.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setMotivo(sug)}
                    className="text-[10px] bg-muted hover:bg-muted/80 text-muted-foreground px-2 py-0.5 rounded border border-border/50 text-left transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Banner de Confirmação das Notificações */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 rounded-xl p-3 text-[11px] text-indigo-900 dark:text-indigo-200 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              Notificações Automáticas em Tempo Real:
            </div>
            <ul className="list-disc list-inside text-indigo-800 dark:text-indigo-300 space-y-0.5 pl-1">
              <li>Notificação direta para o vendedor <strong>{nomeVendedor}</strong> no sininho e Dashboard</li>
              <li>Registro formal no Chat do Pedido #{numeroPedido}</li>
              <li>Atualização automática via Webhook no <strong>próprio Odoo ERP</strong></li>
            </ul>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={salvando}
            className="text-xs h-9"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs h-9 gap-1.5 shadow-sm"
          >
            {salvando ? (
              <span>Salvando e Notificando...</span>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Salvar e Notificar Vendedor/Odoo</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
