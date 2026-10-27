import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, ShieldAlert, Search } from "lucide-react";

function Metrica({ label, valor, destaque = false, destaqueClasse = "" }) {
  return (
    <div className={`rounded-lg p-2 border ${destaque ? destaqueClasse : "bg-muted/40 border-border"}`}>
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block leading-none">
        {label}
      </span>
      <span className="text-sm font-extrabold block mt-1 leading-tight">{valor}</span>
    </div>
  );
}

/**
 * Cartão-resumo do dia da Produção Telhas (Visão Dia).
 * Concentra em um único cartão: data, OPs, concluídas, metragem,
 * capacidade vs metas e as ações do dia (Novo Pedido / Ajustar Metas).
 */
export default function ResumoDiaProducaoCard({
  titulo,
  ehHoje = false,
  qtdPedidos = 0,
  qtdConcluidos = 0,
  totalMetros = 0,
  metaGeral,
  statusDia,
  temFiltroAtivo = false,
  onAjustarMetas,
  onNovoPedido,
}) {
  const pctConcluido = qtdPedidos > 0 ? Math.round((qtdConcluidos / qtdPedidos) * 100) : 0;
  const estourou = totalMetros > 0 && statusDia?.status === "limite_estourado";
  const metrosFmt = totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <div className="bg-card border border-border rounded-xl p-3.5 space-y-3 shadow-xs">
      {/* Linha 1: Título do dia + ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold flex items-center gap-2">
            {temFiltroAtivo && <Search className="w-5 h-5 text-blue-600" />}
            {titulo}
          </h2>
          {ehHoje && !temFiltroAtivo && (
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px]">
              Hoje
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAjustarMetas}
            className="h-7 px-2 text-xs text-orange-600 dark:text-orange-400 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/30"
          >
            Ajustar Metas
          </Button>
          {!temFiltroAtivo && onNovoPedido && (
            <Button size="sm" onClick={onNovoPedido} className="gap-1 h-7">
              <Plus className="w-3 h-3" />
              Novo Pedido
            </Button>
          )}
        </div>
      </div>

      {/* Linha 2: Métricas do dia */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="OPs do dia" valor={qtdPedidos} />
        <Metrica
          label="Concluídas"
          valor={`${qtdConcluidos} · ${pctConcluido}%`}
          destaque
          destaqueClasse="bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
        />
        <Metrica label="Metragem total" valor={`${metrosFmt}m`} />
        <Metrica
          label="Meta mín · teto"
          valor={`${metaGeral?.min?.toLocaleString("pt-BR") || 0}m · ${metaGeral?.max?.toLocaleString("pt-BR") || 0}m`}
        />
      </div>

      {/* Linha 3: Barra de capacidade + status */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Badge variant={statusDia?.badgeVariant} className={`text-[11px] font-semibold ${statusDia?.bgClass}`}>
              {statusDia?.label}
            </Badge>
            {metaGeral?.travarMaximo && (
              <Badge variant="outline" className="text-[10px] gap-1 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700">
                <ShieldAlert className="w-3 h-3 text-red-500" />
                Trava Ativa
              </Badge>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">
            Capacidade: <strong>{metrosFmt}m</strong> de {(metaGeral?.max || 0).toLocaleString("pt-BR")}m
          </span>
        </div>

        <div className="relative w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${statusDia?.barClass}`}
            style={{ width: `${Math.min(100, (totalMetros / (metaGeral?.max || 3500)) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>0m</span>
          <span>Meta Mín: {(metaGeral?.min || 0).toLocaleString("pt-BR")}m</span>
          <span>Teto Máx: {(metaGeral?.max || 0).toLocaleString("pt-BR")}m</span>
        </div>

        {estourou && (
          <div className="flex items-center gap-2 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50 p-2 rounded-lg border border-red-200 dark:border-red-900/50">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              Capacidade diária esgotada! Excesso de <strong>+{(statusDia?.excesso || 0).toLocaleString("pt-BR")}m</strong> além do limite ({(metaGeral?.max || 0).toLocaleString("pt-BR")}m).
              {metaGeral?.travarMaximo ? " Novos agendamentos para este dia estão bloqueados." : " Trava desativada nas configurações."}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}