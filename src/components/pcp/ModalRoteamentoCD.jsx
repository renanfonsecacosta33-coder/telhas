import React, { useState, useEffect, useMemo } from "react";
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
  Layers,
  Scissors,
  Wrench,
  Cog,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Factory,
  Package,
  Sparkles
} from "lucide-react";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { normalizarUnidadeMedidaItem } from "@/lib/pedidoOdooHelper";

const GRUPOS_MAQUINAS = {
  desbobinador: {
    titulo: "Desbobinador",
    subtitulo: "(Se vazio: já tem chapa cortada)",
    icon: Layers,
    corBadge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300",
    corHeader: "text-orange-600 dark:text-orange-400",
    maquinas: [
      { id: "DESBOBINADEIRA 01", label: "Desbobinadeira 01 (até 3,00mm)", limite: "até 3,00mm" },
      { id: "DESBOBINADEIRA 02", label: "Desbobinadeira 02 (0,80 a 4,75mm)", limite: "0,80 a 4,75mm" },
    ]
  },
  corte: {
    titulo: "Corte / Guilhotina",
    subtitulo: "(Se vazio: já se tem o blank cortado)",
    icon: Scissors,
    corBadge: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    corHeader: "text-blue-600 dark:text-blue-400",
    maquinas: [
      { id: "CORTE 6M", label: "Guilhotina 6m", limite: "até 6 metros" },
      { id: "CORTE 3M", label: "Guilhotina 3m", limite: "até 3 metros" },
    ]
  },
  dobra: {
    titulo: "Dobra",
    subtitulo: "(Dobragem longitudinal / conformação)",
    icon: Wrench,
    corBadge: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300",
    corHeader: "text-indigo-600 dark:text-indigo-400",
    maquinas: [
      { id: "DOBRA 3M", label: "Dobradeira 3m", limite: "até 3 metros" },
      { id: "DOBRA INICIO 6M", label: "01 Dobradeira 6m (Início)", limite: "6 metros" },
      { id: "DOBRA FUNDO 6M", label: "02 Dobradeira 6m (Fundo)", limite: "6 metros" },
    ]
  },
  perfiladeira: {
    titulo: "Perfiladeira",
    subtitulo: "(Exclusiva: não permite selecionar outras máquinas)",
    icon: Cog,
    corBadge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
    corHeader: "text-purple-600 dark:text-purple-400",
    maquinas: [
      { id: "PERFILADEIRA", label: "Máquina Perfiladeira (Slitter)", limite: "Perfis contínuos" },
    ]
  }
};

/**
 * Modal de Roteamento de Corte & Dobra pelo PCP
 * Permite ao PCP selecionar para cada material do pedido quais máquinas irão executar
 * a peça antes de disparar o envio direto ao chão de fábrica.
 */
export default function ModalRoteamentoCD({
  open,
  onOpenChange,
  pedido,
  itensCD = [],
  onConfirmar,
  distribuindo = false
}) {
  // roteiroPorItem: { [itemIdx]: { desbobinador: string|null, corte: string|null, dobra: string|null, perfiladeira: string|null } }
  const [roteiroPorItem, setRoteiroPorItem] = useState({});

  // Inicializa o roteiro quando abre com um novo pedido
  useEffect(() => {
    if (!open || !itensCD || itensCD.length === 0) {
      setRoteiroPorItem({});
      return;
    }

    const inicial = {};
    itensCD.forEach((it, idx) => {
      const itemKey = it._idx != null ? it._idx : idx;
      // Heurística de sugestão inteligente baseada nas medidas extraídas
      const descItem = it.descricao || it.produto || "";
      const unid = normalizarUnidadeMedidaItem(it, "cd");
      const spec = extrairEspecificacao(descItem, it.quantidade, unid);

      const compMm = spec?.comprimento_mm || (it.comprimento_mm ? Number(it.comprimento_mm) : null);
      const espNum = spec?.espessura_mm || (it.espessura ? parseFloat(String(it.espessura).replace(",", ".")) : null);

      let sugestaoDesb = null;
      let sugestaoCorte = null;
      let sugestaoDobra = null;
      let sugestaoPerfil = null;

      const textoLower = descItem.toLowerCase();
      if (textoLower.includes("perfiladeira") || textoLower.includes("slitter")) {
        sugestaoPerfil = "PERFILADEIRA";
      } else {
        // Desbobinador sugerido por espessura
        if (espNum && espNum > 3.0) {
          sugestaoDesb = "DESBOBINADEIRA 02";
        } else {
          sugestaoDesb = "DESBOBINADEIRA 01";
        }

        // Corte sugerido por comprimento
        if (compMm && compMm > 3000) {
          sugestaoCorte = "CORTE 6M";
        } else {
          sugestaoCorte = "CORTE 3M";
        }

        // Se for chapa cortada simples sem dobra (ex: apenas chapa ou blank)
        const temDobra = /(dobr|perfil|u\b|cantoneira|calha|rufo|pingadeira|degrau)/i.test(textoLower) || spec?.abas?.length > 0;
        if (temDobra) {
          if (compMm && compMm > 3000) {
            sugestaoDobra = "DOBRA INICIO 6M";
          } else {
            sugestaoDobra = "DOBRA 3M";
          }
        }
      }

      inicial[itemKey] = {
        desbobinador: sugestaoDesb,
        corte: sugestaoCorte,
        dobra: sugestaoDobra,
        perfiladeira: sugestaoPerfil
      };
    });

    setRoteiroPorItem(inicial);
  }, [open, itensCD]);

  // Alterna a seleção de uma máquina para um item específico
  const handleToggleMaquina = (itemKey, grupoId, maquinaId) => {
    setRoteiroPorItem(prev => {
      const atual = prev[itemKey] || {
        desbobinador: null,
        corte: null,
        dobra: null,
        perfiladeira: null
      };

      // REGRA DE EXCLUSIVIDADE DA PERFILADEIRA:
      // Se clicou na Perfiladeira: seleciona ela e desmarca tudo das outras etapas
      if (grupoId === "perfiladeira") {
        const jaSelecionada = atual.perfiladeira === maquinaId;
        return {
          ...prev,
          [itemKey]: {
            desbobinador: null,
            corte: null,
            dobra: null,
            perfiladeira: jaSelecionada ? null : maquinaId
          }
        };
      }

      // Se clicou em Desbobinador, Corte ou Dobra: desmarca perfiladeira imediatamente
      const jaSelecionadaNoGrupo = atual[grupoId] === maquinaId;
      return {
        ...prev,
        [itemKey]: {
          ...atual,
          perfiladeira: null, // zera perfiladeira se escolher fluxo padrão
          [grupoId]: jaSelecionadaNoGrupo ? null : maquinaId
        }
      };
    });
  };

  // Monta o array ordenado de máquinas para cada item
  const obterRoteiroOrdenado = (cfgItem) => {
    if (!cfgItem) return [];
    if (cfgItem.perfiladeira) return [cfgItem.perfiladeira];
    const seq = [];
    if (cfgItem.desbobinador) seq.push(cfgItem.desbobinador);
    if (cfgItem.corte) seq.push(cfgItem.corte);
    if (cfgItem.dobra) seq.push(cfgItem.dobra);
    return seq;
  };

  // Validação: todos os materiais de C&D devem ter pelo menos 1 máquina escolhida
  const itensValidados = useMemo(() => {
    return itensCD.map((it, idx) => {
      const itemKey = it._idx != null ? it._idx : idx;
      const cfg = roteiroPorItem[itemKey];
      const roteiro = obterRoteiroOrdenado(cfg);
      return {
        item: it,
        itemKey,
        valido: roteiro.length > 0,
        roteiro
      };
    });
  }, [itensCD, roteiroPorItem]);

  const todosValidos = itensValidados.length > 0 && itensValidados.every(v => v.valido);

  const handleConfirmarEnvio = () => {
    if (!todosValidos) return;

    // Constrói o mapa de roteamento consolidado
    const roteiroFinalPorItem = {};
    itensValidados.forEach(v => {
      roteiroFinalPorItem[v.itemKey] = {
        maquinas: v.roteiro,
        maquinaInicial: v.roteiro[0],
        etapas: v.roteiro.map((m, i) => ({
          ordem: i + 1,
          maquina: m,
          status: i === 0 ? "pendente" : "aguardando_etapa_anterior"
        }))
      };
    });

    onConfirmar(roteiroFinalPorItem, {
      pedido,
      roteiroFinalPorItem
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-background">
        <DialogHeader className="p-5 border-b border-border bg-card/60">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
            <Factory className="w-5 h-5" />
            <DialogTitle className="text-lg font-black tracking-tight">
              Roteamento Direto de Corte & Dobra
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Defina as etapas e máquinas de cada material antes de enviar para o chão de fábrica.
            O PCP escolhe o roteiro e a OP avança automaticamente máquina por máquina.
          </DialogDescription>

          {pedido && (
            <div className="flex items-center gap-2 pt-2 flex-wrap text-xs">
              <span className="font-mono font-bold bg-muted px-2 py-0.5 rounded text-foreground">
                #{pedido.numero_pedido}
              </span>
              {pedido.of_nome && (
                <Badge variant="outline" className="font-mono font-bold text-indigo-700 border-indigo-300">
                  OF: {pedido.of_nome}
                </Badge>
              )}
              {pedido.cliente_nome && (
                <span className="text-muted-foreground truncate max-w-xs">
                  Cliente: <strong className="text-foreground">{pedido.cliente_nome}</strong>
                </span>
              )}
            </div>
          )}
        </DialogHeader>

        {/* Lista de Materiais de Corte & Dobra */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {itensCD.map((it, idx) => {
            const itemKey = it._idx != null ? it._idx : idx;
            const cfg = roteiroPorItem[itemKey] || {};
            const roteiroAtual = obterRoteiroOrdenado(cfg);
            const isValido = roteiroAtual.length > 0;

            const descItem = it.descricao || it.produto || "Material C&D";
            const unid = normalizarUnidadeMedidaItem(it, "cd");
            const spec = extrairEspecificacao(descItem, it.quantidade, unid);

            return (
              <div
                key={itemKey}
                className={`rounded-2xl border-2 transition-all p-4 space-y-4 ${
                  isValido
                    ? "border-border bg-card shadow-xs"
                    : "border-red-400 bg-red-500/5 shadow-sm"
                }`}
              >
                {/* Cabeçalho do Material */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black px-2 py-0.5 rounded bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/30">
                        Material #{idx + 1}
                      </span>
                      <h4 className="font-bold text-sm text-foreground truncate">
                        {it.produto || descItem}
                      </h4>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      {descItem !== it.produto ? descItem : ""}
                    </p>

                    {/* Especificações detectadas */}
                    <div className="flex items-center gap-2 flex-wrap pt-1 text-[11px]">
                      {unid === "KG" ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300 font-bold">
                          ⚖️ Venda em KG ({it.quantidade} kg)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300 font-bold">
                          📦 {unid === "BR" ? "Barras (BR)" : "Peças (PC)"}
                        </Badge>
                      )}

                      {spec?.tipo_label && (
                        <Badge variant="outline" className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 font-bold">
                          {spec.tipo_label}
                        </Badge>
                      )}
                      {spec?.dimensoes_fmt && (
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                          Medida: {spec.dimensoes_fmt}
                        </span>
                      )}
                      {spec?.comprimento_mm && (
                        <span className="font-mono text-slate-600 dark:text-slate-400">
                          Comp: {spec.comprimento_mm}mm
                        </span>
                      )}
                      <span className="font-extrabold text-orange-600 dark:text-orange-400">
                        {unid === "KG"
                          ? (spec?.pecas ? `Qtd: ${spec.pecas} pçs (${it.quantidade} kg)` : `Peso: ${it.quantidade} kg`)
                          : `Qtd: ${it.quantidade || spec?.quantidade || 1} ${unid === "BR" ? "barras" : "pçs"}`}
                      </span>
                    </div>
                  </div>

                  {/* Badge de Roteiro Selecionado */}
                  <div className="flex flex-col items-end gap-1">
                    {roteiroAtual.length > 0 ? (
                      <div className="flex items-center gap-1.5 flex-wrap justify-end">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                          Roteiro:
                        </span>
                        {roteiroAtual.map((m, mIdx) => (
                          <React.Fragment key={m}>
                            <Badge className="bg-emerald-600 text-white font-mono font-bold text-[10px] px-2 py-0.5 shadow-xs">
                              {mIdx + 1}º {m}
                            </Badge>
                            {mIdx < roteiroAtual.length - 1 && (
                              <ArrowRight className="w-3 h-3 text-emerald-600 shrink-0" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] gap-1 animate-pulse">
                        <AlertCircle className="w-3 h-3" /> Selecione as máquinas
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Seletores de Etapas de Máquinas */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  {/* 1. Desbobinador */}
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-orange-600 dark:text-orange-400">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Desbobinador</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">Opcional</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Vazio se já houver chapa cortada
                    </p>
                    <div className="space-y-1.5 pt-1">
                      {GRUPOS_MAQUINAS.desbobinador.maquinas.map(m => {
                        const selecionada = cfg.desbobinador === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleToggleMaquina(itemKey, "desbobinador", m.id)}
                            className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              selecionada
                                ? "bg-orange-600 text-white border-orange-700 shadow-sm font-bold"
                                : "bg-card border-border hover:border-orange-400 text-foreground"
                            }`}
                          >
                            <span className="truncate">{m.label}</span>
                            {selecionada && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Corte */}
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-blue-600 dark:text-blue-400">
                        <Scissors className="w-3.5 h-3.5" />
                        <span>Corte / Guilhotina</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">Opcional</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Vazio se já se tem o blank
                    </p>
                    <div className="space-y-1.5 pt-1">
                      {GRUPOS_MAQUINAS.corte.maquinas.map(m => {
                        const selecionada = cfg.corte === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleToggleMaquina(itemKey, "corte", m.id)}
                            className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              selecionada
                                ? "bg-blue-600 text-white border-blue-700 shadow-sm font-bold"
                                : "bg-card border-border hover:border-blue-400 text-foreground"
                            }`}
                          >
                            <span className="truncate">{m.label}</span>
                            {selecionada && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Dobra */}
                  <div className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-indigo-600 dark:text-indigo-400">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>Dobra</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">Opcional</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-tight">
                      Dobragem e conformação final
                    </p>
                    <div className="space-y-1.5 pt-1">
                      {GRUPOS_MAQUINAS.dobra.maquinas.map(m => {
                        const selecionada = cfg.dobra === m.id;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleToggleMaquina(itemKey, "dobra", m.id)}
                            className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                              selecionada
                                ? "bg-indigo-600 text-white border-indigo-700 shadow-sm font-bold"
                                : "bg-card border-border hover:border-indigo-400 text-foreground"
                            }`}
                          >
                            <span className="truncate">{m.label}</span>
                            {selecionada && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 4. Perfiladeira (Exclusiva) */}
                <div className="rounded-xl border border-purple-300 dark:border-purple-900/50 bg-purple-500/5 p-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-300">
                      <Cog className="w-4 h-4 text-purple-600" />
                      <span>Máquina Perfiladeira (Slitter)</span>
                      <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200 text-[9px] ml-1">
                        Exclusiva
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Selecione se este perfil for feito 100% na perfiladeira contínua (substitui Desbobinador, Corte e Dobra).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleMaquina(itemKey, "perfiladeira", "PERFILADEIRA")}
                    className={`px-3 py-2 rounded-lg border text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                      cfg.perfiladeira === "PERFILADEIRA"
                        ? "bg-purple-600 text-white border-purple-700 shadow-sm"
                        : "bg-card border-border hover:border-purple-400 text-foreground"
                    }`}
                  >
                    <span>{cfg.perfiladeira === "PERFILADEIRA" ? "✓ Perfiladeira Selecionada" : "Selecionar Perfiladeira"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé com validação */}
        <DialogFooter className="p-4 border-t border-border bg-card/60 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            {!todosValidos ? (
              <span className="text-red-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                Preencha pelo menos 1 etapa em cada material acima para liberar o envio.
              </span>
            ) : (
              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Todos os materiais roteados com sucesso! Pronto para distribuir às máquinas.
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={distribuindo}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              onClick={handleConfirmarEnvio}
              disabled={!todosValidos || distribuindo}
              className="bg-orange-500 hover:bg-orange-600 text-white font-bold gap-2 px-5 shadow-sm cursor-pointer"
            >
              {distribuindo ? (
                <>Enviando às Máquinas...</>
              ) : (
                <>
                  <Factory className="w-4 h-4" />
                  Confirmar e Distribuir Direto
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
