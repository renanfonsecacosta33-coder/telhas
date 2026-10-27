import React from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Layers } from "lucide-react";
import { format, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link } from "react-router-dom";

/**
 * Faixa de navegação de semana/dia da Produção Telhas.
 * - modo "semana": carrossel completo com tiles de capacidade por dia.
 * - modo "dia": faixa compacta de chips de dia (troca rápida do dia selecionado).
 */
export default function FaixaSemanaProducao({
  dias = [],
  selectedDay,
  onSelectDia,
  onSemanaAnterior,
  onSemanaSeguinte,
  weekStart,
  weekEnd,
  totalSemana = 0,
  modo = "semana",
  onModoChange,
  onHoje,
  getResumoDia,
  mostrarModoToggle = true,
}) {
  const compacto = modo === "dia";

  return (
    <div className="bg-card border border-border rounded-xl p-2.5 sm:p-3">
      {/* Cabeçalho: navegação de semana + ações de visão */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={onSemanaAnterior} title="Semana anterior">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center min-w-[190px]">
            <p className="font-bold text-sm leading-tight">
              Semana de {format(weekStart, "dd 'de' MMM", { locale: ptBR })} a {format(weekEnd, "dd 'de' MMM yyyy", { locale: ptBR })}
            </p>
            <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px]">
              Total da semana: {totalSemana.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
            </Badge>
          </div>
          <Button variant="outline" size="icon" className="h-7 w-7" onClick={onSemanaSeguinte} title="Próxima semana">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {mostrarModoToggle && onModoChange && (
            <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
              <Button
                size="sm"
                variant={modo === "semana" ? "default" : "ghost"}
                onClick={() => onModoChange("semana")}
                className={`h-7 px-2.5 text-xs font-bold ${modo === "semana" ? "" : "text-muted-foreground"}`}
              >
                Visão Semana
              </Button>
              <Button
                size="sm"
                variant={modo === "dia" ? "default" : "ghost"}
                onClick={() => onModoChange("dia")}
                className={`h-7 px-2.5 text-xs font-bold ${modo === "dia" ? "" : "text-muted-foreground"}`}
              >
                Visão Dia
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={onHoje} className="gap-1 text-xs font-bold h-7">
            <Calendar className="w-3 h-3" />
            Hoje
          </Button>
          <Link to="/estoque-dashboard">
            <Button
              variant="outline"
              size="sm"
              className="gap-1 text-xs font-semibold h-7 text-teal-600 dark:text-teal-400 border-teal-300 dark:border-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40"
              title="Estoque por Espessura"
            >
              <Layers className="w-3 h-3 text-teal-500" />
              <span className="hidden sm:inline">Espessuras</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Faixa de dias */}
      {compacto ? (
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {dias.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const r = getResumoDia?.(diaStr) || { pedidos: 0, metros: 0, estourou: false, bateuMeta: false };
            const isSelected = selectedDay === diaStr;
            const hoje = isToday(dia);

            return (
              <button
                key={diaStr}
                onClick={() => onSelectDia?.(diaStr)}
                className={`shrink-0 min-w-[74px] px-2 py-1.5 rounded-lg border text-center transition-all ${
                  isSelected
                    ? "bg-primary text-primary-foreground border-primary shadow"
                    : r.estourou
                    ? "border-red-500 bg-red-500/10 text-red-900 dark:text-red-200 hover:bg-red-500/15"
                    : hoje
                    ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <span className="text-[10px] font-semibold uppercase block leading-none">
                  {format(dia, "EEE", { locale: ptBR })} {hoje && !isSelected ? "• hoje" : ""}
                </span>
                <span className="text-sm font-bold leading-tight block">{format(dia, "dd")}</span>
                {r.pedidos > 0 ? (
                  <span className={`text-[10px] block leading-none mt-0.5 ${isSelected ? "opacity-90" : "text-muted-foreground"}`}>
                    {r.pedidos}p · {r.metros.toFixed(0)}m
                  </span>
                ) : (
                  <span className={`text-[10px] block leading-none mt-0.5 ${isSelected ? "opacity-70" : "text-muted-foreground/60"}`}>
                    Livre
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {dias.map(dia => {
            const diaStr = format(dia, "yyyy-MM-dd");
            const r = getResumoDia?.(diaStr) || { pedidos: 0, metros: 0, estourou: false, bateuMeta: false };
            const isSelected = selectedDay === diaStr;
            const hoje = isToday(dia);

            return (
              <button
                key={diaStr}
                onClick={() => onSelectDia?.(diaStr)}
                className={`rounded-lg p-2 text-center transition-all border relative flex flex-col justify-between min-h-[72px] ${
                  isSelected
                    ? r.estourou
                      ? "bg-red-600 text-white border-red-700 shadow"
                      : "bg-primary text-primary-foreground border-primary shadow"
                    : r.estourou
                    ? "border-red-500 bg-red-500/10 text-red-900 dark:text-red-200 hover:bg-red-500/15"
                    : r.bateuMeta
                    ? "border-emerald-500/50 bg-emerald-500/5 hover:bg-emerald-500/10"
                    : hoje
                    ? "border-primary/50 bg-primary/5 hover:bg-primary/10"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <div>
                  <div className="flex items-center justify-center gap-1">
                    <p className="text-xs font-semibold uppercase">{format(dia, "EEE", { locale: ptBR })}</p>
                    {r.estourou && (
                      <span className={`text-[10px] ${isSelected ? "text-white" : "text-red-600 dark:text-red-400"}`} title="Capacidade máxima esgotada">
                        ⚠️
                      </span>
                    )}
                    {r.bateuMeta && !r.estourou && (
                      <span className={`text-[10px] ${isSelected ? "text-white" : "text-emerald-600 dark:text-emerald-400"}`} title="Meta atingida">
                        ✓
                      </span>
                    )}
                  </div>
                  <p className={`text-lg font-bold leading-tight ${isSelected ? "text-inherit" : r.estourou ? "text-red-700 dark:text-red-300" : hoje ? "text-primary" : ""}`}>
                    {format(dia, "dd")}
                  </p>
                </div>

                {r.pedidos > 0 ? (
                  <div className="w-full mt-1">
                    <div className={`text-[11px] leading-tight font-medium ${
                      isSelected ? "text-inherit opacity-90"
                        : r.estourou ? "text-red-600 dark:text-red-400 font-bold"
                        : r.bateuMeta ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "text-muted-foreground"
                    }`}>
                      {r.pedidos}p · {r.metros.toFixed(0)}m
                    </div>
                    <div className={`w-full ${isSelected ? "bg-white/25" : "bg-muted"} rounded-full h-1 mt-1 overflow-hidden`}>
                      <div
                        className={`h-full transition-all ${
                          r.estourou
                            ? (isSelected ? "bg-white" : "bg-red-500")
                            : r.bateuMeta
                            ? (isSelected ? "bg-white" : "bg-emerald-500")
                            : (isSelected ? "bg-white/70" : "bg-amber-400")
                        }`}
                        style={{ width: `${Math.min(100, (r.metros / 3500) * 100)}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="text-[10px] text-muted-foreground/60 mt-1">Livre</div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}