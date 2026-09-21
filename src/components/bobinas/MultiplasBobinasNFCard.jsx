import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Layers, ArrowRight, CheckCircle2, Loader2, X, FileText } from "lucide-react";

/**
 * Card exibido quando a Nota Fiscal analisada pela IA contém mais de uma bobina
 * (ex: 2, 3, 4 bobinas faturadas com lotes e pesos individuais na mesma NF).
 * Dá 2 opções ao usuário:
 * 1. (Recomendada) Cadastrar todas as bobinas em lote com 1 clique.
 * 2. Escolher uma bobina individual da lista para preencher o formulário atual.
 */
export default function MultiplasBobinasNFCard({
  dadosNF,
  onCadastrarEmLote,
  onSelecionarIndividual,
  onDescartar,
  salvandoEmLote = false,
}) {
  if (!dadosNF || !dadosNF.bobinas || dadosNF.bobinas.length <= 1) return null;

  const totalBobinas = dadosNF.bobinas.length;
  const pesoTotal = dadosNF.bobinas.reduce((acc, b) => acc + (Number(b.peso_kg) || 0), 0);

  return (
    <div className="rounded-xl border-2 border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background p-4 sm:p-5 space-y-4 shadow-md animate-in fade-in-50 slide-in-from-top-2 duration-300">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-xs shadow-xs">
              {totalBobinas}
            </span>
            <h4 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-1.5">
              <span>{totalBobinas} Bobinas Detectadas nesta Nota Fiscal!</span>
            </h4>
            <Badge variant="outline" className="border-emerald-500/60 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 font-mono text-[11px]">
              NF {dadosNF.numero_nf || "S/N"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>{dadosNF.fornecedor || "Fornecedor da NF"}</strong> · Peso Total: <strong className="text-foreground">{pesoTotal.toLocaleString("pt-BR")} kg</strong>
          </p>
        </div>

        {onDescartar && (
          <button
            type="button"
            onClick={onDescartar}
            disabled={salvandoEmLote}
            className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"
            title="Fechar detecção de múltiplas bobinas"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* OPÇÃO 1 — RECOMENDADA: Cadastrar todas de uma vez em lote */}
      <div className="rounded-xl border-2 border-emerald-500 bg-emerald-500/15 dark:bg-emerald-950/40 p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] tracking-wide uppercase px-2 py-0.5 shadow-xs">
              Opção 1 — Mais Recomendada
            </Badge>
            <span className="text-xs font-semibold text-emerald-950 dark:text-emerald-100 hidden sm:inline">
              Entrada em Lote Automática
            </span>
          </div>
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
            1 Clique = {totalBobinas} Bobinas no Estoque
          </span>
        </div>

        <p className="text-xs text-emerald-900 dark:text-emerald-200">
          O sistema gera os códigos sequenciais seguidos automaticamente, cadastra cada bobina com seu peso individual e anexa a foto da NF em todas elas.
        </p>

        <Button
          type="button"
          size="lg"
          disabled={salvandoEmLote}
          onClick={() => onCadastrarEmLote && onCadastrarEmLote(dadosNF.bobinas)}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-sm shadow-md gap-2 cursor-pointer"
        >
          {salvandoEmLote ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Cadastrando as {totalBobinas} bobinas no sistema...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 text-emerald-200" />
              Cadastrar Todas as {totalBobinas} Bobinas de Uma Vez (Recomendado)
              <ArrowRight className="w-4 h-4 ml-auto" />
            </>
          )}
        </Button>
      </div>

      {/* Divisor de Opções */}
      <div className="relative flex items-center justify-center my-2">
        <div className="border-t border-border/80 w-full" />
        <span className="bg-background px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider absolute">
          ou Opção 2: Escolher apenas uma bobina abaixo
        </span>
      </div>

      {/* OPÇÃO 2: Lista individual para preenchimento único */}
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground font-medium">
          Se preferir cadastrar ou conferir uma por uma, clique em <strong>"Preencher Esta"</strong>:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
          {dadosNF.bobinas.map((b, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card/70 hover:border-primary/50 transition-all gap-2 text-xs"
            >
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold text-foreground">
                  <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-mono shrink-0">
                    #{idx + 1}
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-extrabold text-sm">
                    {Number(b.peso_kg || 0).toLocaleString("pt-BR")} kg
                  </span>
                  {b.chapa && <span className="text-muted-foreground text-[11px]">· Chapa {b.chapa}</span>}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {b.lote && <span>Lote: <strong className="font-mono text-foreground">{b.lote}</strong> · </span>}
                  {b.largura_mm && <span>{b.largura_mm}mm · </span>}
                  <span>{b.cor || "Cor padrão"}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={salvandoEmLote}
                onClick={() => onSelecionarIndividual && onSelecionarIndividual(b, idx)}
                className="shrink-0 text-xs h-8 px-2.5 hover:bg-primary hover:text-primary-foreground font-medium"
              >
                Preencher Esta
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
