import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Zap, Truck, Star, Lock, AlertTriangle, Calendar, Clock, Check } from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";

function gerarAtalhosDeDatas() {
  const hoje = new Date();
  const opcoes = [];

  opcoes.push({
    iso: format(hoje, "yyyy-MM-dd"),
    label: `Hoje (${format(hoje, "dd/MM")})`
  });

  const amanha = addDays(hoje, 1);
  const diaSemAmanha = format(amanha, "EEEE", { locale: ptBR });
  opcoes.push({
    iso: format(amanha, "yyyy-MM-dd"),
    label: `Amanhã (${format(amanha, "dd/MM")} • ${diaSemAmanha.charAt(0).toUpperCase() + diaSemAmanha.slice(1)})`
  });

  const depois = addDays(hoje, 2);
  const diaSemDepois = format(depois, "EEEE", { locale: ptBR });
  opcoes.push({
    iso: format(depois, "yyyy-MM-dd"),
    label: `Depois de Amanhã (${format(depois, "dd/MM")} • ${diaSemDepois.charAt(0).toUpperCase() + diaSemDepois.slice(1)})`
  });

  for (let i = 3; i <= 5; i++) {
    const d = addDays(hoje, i);
    const sem = format(d, "EEEE", { locale: ptBR });
    opcoes.push({
      iso: format(d, "yyyy-MM-dd"),
      label: `${format(d, "dd/MM")} (${sem.charAt(0).toUpperCase() + sem.slice(1)})`
    });
  }

  return opcoes;
}

export default function ModalPrioridadeObrigatoria({
  open,
  onOpenChange,
  pedidos = [],
  onConfirmarPrioridadeEDistribuir,
  salvando = false
}) {
  const [subTipoData, setSubTipoData] = useState(null); // 'ROTA' | 'PRIORIDADE' | null
  const [dataSelecionada, setDataSelecionada] = useState(format(new Date(), "yyyy-MM-dd"));
  const atalhos = gerarAtalhosDeDatas();

  const isLote = pedidos.length > 1;
  const pedidoUnico = pedidos.length === 1 ? pedidos[0] : null;

  const handleEscolher = (tipo, data = null) => {
    if (tipo === "ROTA" || tipo === "PRIORIDADE") {
      setSubTipoData(tipo);
      setDataSelecionada(format(new Date(), "yyyy-MM-dd"));
      return;
    }
    // RETIRA_AGORA ou NORMAL
    onConfirmarPrioridadeEDistribuir?.(tipo, null);
  };

  const handleConfirmarData = () => {
    if (!subTipoData || !dataSelecionada) return;
    onConfirmarPrioridadeEDistribuir?.(subTipoData, dataSelecionada);
    setSubTipoData(null);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!salvando) {
        setSubTipoData(null);
        onOpenChange(val);
      }
    }}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-amber-600 dark:text-amber-400">
            <div className="p-2 bg-amber-100 dark:bg-amber-950/60 rounded-xl">
              <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100">
                Prioridade Obrigatória para Produção
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                {isLote
                  ? `${pedidos.length} pedidos selecionados precisam de prioridade para entrar na fila da fábrica.`
                  : "Defina como este pedido deve ser ordenado e priorizado na máquina do operador."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumo do Pedido / Lote */}
        {pedidoUnico ? (
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div>
              <div className="flex items-center gap-2">
                <Badge className="bg-blue-600 text-white font-mono font-bold">
                  #{pedidoUnico.numero_pedido}
                </Badge>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                  {pedidoUnico.cliente_nome || pedidoUnico.cliente || "Cliente não informado"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Vendedor: {pedidoUnico.vendedor_nome || pedidoUnico.vendedor || "—"} • Fábrica: {pedidoUnico.unidade || "Matriz"}
              </p>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
              <span className="font-black text-sm text-slate-900 dark:text-slate-100">
                {pedidoUnico.total_metros || pedidoUnico.metros || 0}m
              </span>
            </div>
          </div>
        ) : (
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-xs">
            <div className="flex items-center justify-between font-bold text-slate-800 dark:text-slate-200">
              <span>{pedidos.length} Pedidos sem Prioridade no Lote:</span>
              <Badge variant="outline" className="font-mono">
                {pedidos.slice(0, 4).map(p => `#${p.numero_pedido}`).join(", ")}
                {pedidos.length > 4 ? ` +${pedidos.length - 4}` : ""}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500">
              Escolha a prioridade que será aplicada em massa aos pedidos pendentes para liberar o envio imediato às máquinas.
            </p>
          </div>
        )}

        {/* Passo 2: Seleção de Data (se clicou em Rota ou Prioridade) */}
        {subTipoData ? (
          <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-800 dark:text-slate-200 flex items-center gap-1.5 uppercase">
                {subTipoData === "ROTA" ? (
                  <>
                    <Truck className="w-4 h-4 text-indigo-600" />
                    Data de Carregamento da Rota
                  </>
                ) : (
                  <>
                    <Star className="w-4 h-4 fill-current text-amber-500" />
                    Data de Prontidão na Fábrica
                  </>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSubTipoData(null)}
                className="h-6 px-2 text-[11px] text-slate-500"
              >
                Voltar
              </Button>
            </div>

            {/* Atalhos Rápidos de Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {atalhos.map((at) => (
                <button
                  key={at.iso}
                  type="button"
                  onClick={() => setDataSelecionada(at.iso)}
                  className={`text-left p-2.5 rounded-lg border text-xs transition-all flex items-center justify-between ${
                    dataSelecionada === at.iso
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/60 font-bold text-blue-700 dark:text-blue-300 ring-2 ring-blue-400/40"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  <span>{at.label}</span>
                  {dataSelecionada === at.iso && <Check className="w-4 h-4 text-blue-600" />}
                </button>
              ))}
            </div>

            {/* Input Customizado de Data */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">Ou outra data:</span>
              <Input
                type="date"
                value={dataSelecionada}
                onChange={(e) => setDataSelecionada(e.target.value)}
                className="h-8 text-xs font-semibold"
              />
            </div>

            <Button
              onClick={handleConfirmarData}
              disabled={salvando || !dataSelecionada}
              className={`w-full font-bold h-10 gap-2 mt-2 ${
                subTipoData === "ROTA"
                  ? "bg-indigo-600 hover:bg-indigo-700 text-white"
                  : "bg-amber-600 hover:bg-amber-700 text-white"
              }`}
            >
              <Zap className="w-4 h-4" />
              <span>
                {salvando
                  ? "Salvando e Distribuindo..."
                  : `Confirmar (${dataSelecionada.split("-").reverse().slice(0, 2).join("/")}) e Distribuir para Produção`}
              </span>
            </Button>
          </div>
        ) : (
          /* Passo 1: Escolha entre as 4 Opções Válidas */
          <div className="space-y-2.5">
            {/* 1. ⚡ Cliente Retira Agora */}
            <button
              type="button"
              disabled={salvando}
              onClick={() => handleEscolher("RETIRA_AGORA")}
              className="w-full text-left p-3.5 rounded-xl border-2 border-red-300 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 hover:bg-red-100/60 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-red-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                  <Zap className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <div className="font-black text-sm text-red-700 dark:text-red-400">
                    ⚡ Cliente Retira Agora (Balcão)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    1º Lugar Absoluto na Fila • Cliente aguardando retirada hoje na fábrica
                  </div>
                </div>
              </div>
              <Badge className="bg-red-600 text-white text-[10px] uppercase font-black tracking-wider">
                1º Lugar
              </Badge>
            </button>

            {/* 2. 🚚 Rota (Carga Agendada com Data) */}
            <button
              type="button"
              disabled={salvando}
              onClick={() => handleEscolher("ROTA")}
              className="w-full text-left p-3.5 rounded-xl border-2 border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/30 hover:bg-indigo-100/60 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-sm group-hover:scale-105 transition-transform">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-sm text-indigo-700 dark:text-indigo-400">
                    🚚 Pedido de Rota (Carga Agendada)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    2º Lugar • Carga programada para caminhão com data de carregamento
                  </div>
                </div>
              </div>
              <span className="text-xs text-indigo-600 font-bold group-hover:translate-x-1 transition-transform">
                Escolher Data →
              </span>
            </button>

            {/* 3. ⭐ Prioridade (Prazo Fabril Prometido com Data) */}
            <button
              type="button"
              disabled={salvando}
              onClick={() => handleEscolher("PRIORIDADE")}
              className="w-full text-left p-3.5 rounded-xl border-2 border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/30 hover:bg-amber-100/60 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500 text-white shadow-sm group-hover:scale-105 transition-transform">
                  <Star className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <div className="font-bold text-sm text-amber-700 dark:text-amber-400">
                    ⭐ Prioridade (Prazo Fabril Prometido)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    2º Lugar • Pedido prioritário com compromisso de entrega na data
                  </div>
                </div>
              </div>
              <span className="text-xs text-amber-600 font-bold group-hover:translate-x-1 transition-transform">
                Escolher Data →
              </span>
            </button>

            {/* 4. ⚪ Fila Normal (Padrão / FIFO) */}
            <button
              type="button"
              disabled={salvando}
              onClick={() => handleEscolher("NORMAL")}
              className="w-full text-left p-3.5 rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-sm group-hover:scale-105 transition-transform">
                  <div className="w-5 h-5 rounded-full border-2 border-slate-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-slate-500" />
                  </div>
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-800 dark:text-slate-200">
                    ⚪ Fila Normal (Padrão)
                  </div>
                  <div className="text-[11px] text-slate-500">
                    3º Lugar • Sem urgência forçada, segue ordem natural de chegada (FIFO)
                  </div>
                </div>
              </div>
              <Badge variant="outline" className="text-slate-600 text-[10px] font-bold">
                Padrão
              </Badge>
            </button>
          </div>
        )}

        <DialogFooter className="pt-2 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center sm:justify-between">
          <span className="text-[11px] text-slate-400">
            A OP entrará na máquina devidamente identificada.
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={salvando}
            onClick={() => onOpenChange(false)}
            className="text-xs text-slate-500"
          >
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
