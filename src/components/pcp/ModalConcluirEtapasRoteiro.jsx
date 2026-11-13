import React, { useState, useEffect } from "react";
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
import {
  CheckCircle2,
  Clock,
  Factory,
  ArrowRight,
  Layers,
  Plus,
  Trash2,
  Zap,
  Sparkles,
  Scissors,
  Check,
  ChevronRight
} from "lucide-react";
import {
  identificarRoteiroDoPedido,
  processarConclusaoEtapas
} from "@/lib/roteiroEtapasProducaoHelper";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { extrairNomeUsuario } from "@/lib/usuarioLogadoHelper";

export default function ModalConcluirEtapasRoteiro({
  open,
  onOpenChange,
  pedido,
  item = null,
  onSucesso
}) {
  const queryClient = useQueryClient();
  const [etapas, setEtapas] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [novaEtapaNome, setNovaEtapaNome] = useState("");
  const [mostrandoAddEtapa, setMostrandoAddEtapa] = useState(false);

  useEffect(() => {
    if (open && pedido) {
      const roteiro = identificarRoteiroDoPedido(pedido, item);
      setEtapas(roteiro);
    }
  }, [open, pedido, item]);

  if (!pedido) return null;

  const toggleEtapa = (idx) => {
    setEtapas(prev => {
      const novo = [...prev];
      const atual = novo[idx].concluida;
      // Inverte a etapa clicada
      novo[idx] = { ...novo[idx], concluida: !atual };

      // Se marcou uma etapa como concluída, garante que as anteriores também estejam marcadas
      if (!atual) {
        for (let i = 0; i < idx; i++) {
          novo[i] = { ...novo[i], concluida: true };
        }
      }
      return novo;
    });
  };

  const handleMarcarAteAqui = (idx) => {
    setEtapas(prev => {
      return prev.map((etp, i) => ({
        ...etp,
        concluida: i <= idx
      }));
    });
  };

  const handleAdicionarEtapaPersonalizada = () => {
    if (!novaEtapaNome.trim()) return;
    setEtapas(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        ordem: prev.length + 1,
        nome: `${prev.length + 1}. ${novaEtapaNome.trim()}`,
        maquina: novaEtapaNome.trim().toUpperCase(),
        setor: pedido.setor || "telha",
        descricao: "Etapa adicional adicionada pelo PCP",
        concluida: false
      }
    ]);
    setNovaEtapaNome("");
    setMostrandoAddEtapa(false);
  };

  const totalEtapas = etapas.length;
  const concluidasCount = etapas.filter(e => e.concluida).length;
  const todasConcluidas = totalEtapas > 0 && concluidasCount === totalEtapas;
  const proximaPendente = etapas.find(e => !e.concluida);
  const percentualPrevisto = totalEtapas > 0
    ? todasConcluidas ? 100 : Math.round((concluidasCount / totalEtapas) * 100)
    : 0;

  const handleConfirmar = async () => {
    setSalvando(true);
    try {
      const usuarioLogado = extrairNomeUsuario() || "PCP";
      const res = await processarConclusaoEtapas({
        pedido,
        item,
        etapas,
        usuario: usuarioLogado,
        queryClient
      });

      if (res.sucesso) {
        onSucesso?.(res);
        onOpenChange(false);
      }
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        className="w-[94vw] max-w-xl p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 shadow-2xl"
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-500/15 text-orange-600 flex items-center justify-center font-bold">
                  <Factory className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-base font-black tracking-tight">
                    Concluir Etapas da Produção
                  </DialogTitle>
                  <p className="text-xs text-slate-500">
                    Pedido <strong className="text-orange-600 font-mono">#{pedido.numero_pedido}</strong> · {pedido.cliente_nome || "Cliente"}
                  </p>
                </div>
              </div>
            </div>

            <Badge variant="outline" className="font-mono text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {concluidasCount} de {totalEtapas} etapas
            </Badge>
          </div>
        </DialogHeader>

        {/* Resumo do Produto */}
        <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between gap-2">
          <div className="truncate">
            <span className="font-bold text-slate-800 dark:text-slate-200">
              {item ? (item.produto || item.descricao) : (pedido.produto || pedido.modelo || "Item do Pedido")}
            </span>
            {pedido.observacoes_odoo && (
              <span className="text-[11px] text-slate-500 block truncate">
                {pedido.observacoes_odoo}
              </span>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0 text-[10px] font-bold">
            {pedido.setor === "corte_dobra" ? "🏭 Corte & Dobra" : "🏠 Fábrica de Telhas"}
          </Badge>
        </div>

        {/* Roteiro Sequencial de Etapas com Checkboxes */}
        <div className="space-y-2 my-2">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Selecione quais etapas já foram finalizadas:
          </p>

          <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1">
            {etapas.map((etp, idx) => {
              const estaConcluida = etp.concluida;
              const ehProxima = !estaConcluida && (idx === 0 || etapas[idx - 1]?.concluida);

              return (
                <div
                  key={etp.id || idx}
                  onClick={() => toggleEtapa(idx)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    estaConcluida
                      ? "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-700 shadow-2xs"
                      : ehProxima
                      ? "bg-orange-50/60 dark:bg-orange-950/20 border-orange-400 dark:border-orange-600 ring-1 ring-orange-300/40"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox estilizado */}
                    <div
                      className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 transition-colors border ${
                        estaConcluida
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                      }`}
                    >
                      {estaConcluida && <Check className="w-4 h-4 stroke-[3]" />}
                    </div>

                    <div className="min-w-0">
                      <p className={`text-xs font-bold leading-tight ${
                        estaConcluida ? "text-emerald-900 dark:text-emerald-200 line-through decoration-emerald-500" : "text-slate-900 dark:text-white"
                      }`}>
                        {etp.nome}
                      </p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {etp.descricao}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-1.5">
                    {estaConcluida ? (
                      <Badge variant="outline" className="text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-emerald-300">
                        ✓ Concluída
                      </Badge>
                    ) : ehProxima ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarcarAteAqui(idx);
                        }}
                        className="text-[10px] font-bold px-2 py-1 rounded bg-orange-600 text-white hover:bg-orange-700 shadow-2xs transition-colors"
                      >
                        Concluir até aqui
                      </button>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200">
                        Pendente
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Adicionar etapa personalizada */}
          {!mostrandoAddEtapa ? (
            <button
              type="button"
              onClick={() => setMostrandoAddEtapa(true)}
              className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1 pt-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar outra máquina/etapa ao roteiro
            </button>
          ) : (
            <div className="flex items-center gap-1.5 pt-1">
              <input
                type="text"
                placeholder="Ex: Furadeira, Calandra, Pintura..."
                value={novaEtapaNome}
                onChange={(e) => setNovaEtapaNome(e.target.value)}
                className="text-xs px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 flex-1"
              />
              <Button size="sm" onClick={handleAdicionarEtapaPersonalizada} className="h-7 text-xs font-bold">
                Adicionar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setMostrandoAddEtapa(false)} className="h-7 text-xs">
                Cancelar
              </Button>
            </div>
          )}
        </div>

        {/* Card do Impacto / Próxima Máquina */}
        <div className={`p-3 rounded-xl border text-xs my-2 ${
          todasConcluidas
            ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-700"
            : proximaPendente
            ? "bg-sky-50 dark:bg-sky-950/20 border-sky-300 dark:border-sky-700"
            : "bg-slate-50 dark:bg-slate-800 border-slate-200"
        }`}>
          {todasConcluidas ? (
            <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Todas as etapas marcadas! O pedido será 100% finalizado e liberado para expedição.</span>
            </div>
          ) : proximaPendente ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-800 dark:text-sky-300 flex items-center gap-1.5">
                  <ArrowRight className="w-3.5 h-3.5 text-sky-600" />
                  Próxima Máquina: <span className="underline uppercase">{proximaPendente.maquina}</span>
                </span>
                <span className="font-mono font-bold text-sky-700">
                  {percentualPrevisto}% concluído
                </span>
              </div>
              <p className="text-[11px] text-sky-700/90 dark:text-sky-300/80">
                A OP será enviada imediatamente para a fila da <strong>{proximaPendente.maquina}</strong> e as etapas anteriores serão dadas como concluídas.
              </p>
            </div>
          ) : (
            <span className="text-slate-500">Nenhuma etapa marcada. Marque pelo menos uma etapa para avançar.</span>
          )}
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="text-xs"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            disabled={salvando || concluidasCount === 0}
            onClick={handleConfirmar}
            className={`text-xs font-bold gap-1.5 shadow-sm text-white ${
              todasConcluidas
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-orange-600 hover:bg-orange-700"
            }`}
          >
            {salvando ? (
              <span>Atualizando Produção...</span>
            ) : todasConcluidas ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Concluir Pedido em 100%</span>
              </>
            ) : proximaPendente ? (
              <>
                <Zap className="w-3.5 h-3.5" />
                <span>Avançar para {proximaPendente.maquina} ({percentualPrevisto}%)</span>
              </>
            ) : (
              <span>Salvar Etapas</span>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
