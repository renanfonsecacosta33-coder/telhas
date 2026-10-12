import React, { useMemo, useState } from "react";
import { format, addDays, subDays, isSameDay, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Truck, Package, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const MESES_PT = { jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5, jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11 };

function parseDataFlexivel(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : new Date().getFullYear();
    return new Date(ano, +m[2] - 1, +m[1]);
  }
  m = s.match(/^(\d{1,2})\/([a-zç]{3})/);
  if (m) {
    const mes = MESES_PT[m[2]];
    if (mes === undefined) return null;
    return new Date(new Date().getFullYear(), mes, +m[1]);
  }
  return null;
}

export default function DateNavigatorStrip({
  dataSelecionada = null, // "YYYY-MM-DD" ou null para todas
  onSelectData = () => {},
  rotas = [],
  pedidos = [],
  diasVisiveis = 10
}) {
  const [dataInicio, setDataInicio] = useState(new Date());

  // Mapeia rotas e pedidos por data "YYYY-MM-DD"
  const estatisticasPorDia = useMemo(() => {
    const mapa = {};

    rotas.forEach((r) => {
      const d = parseDataFlexivel(r.entrega_date || r.embarque_date);
      if (!d) return;
      const chave = format(d, "yyyy-MM-dd");
      if (!mapa[chave]) mapa[chave] = { rotas: 0, pedidos: 0, valorTotal: 0 };
      mapa[chave].rotas += 1;
      try {
        const itens = Array.isArray(r.itens_json) ? r.itens_json : JSON.parse(r.itens_json || "[]");
        mapa[chave].pedidos += itens.length;
      } catch {}
    });

    pedidos.forEach((p) => {
      const d = parseDataFlexivel(p.data_entrega || p.data_finalizacao || p.data);
      if (!d) return;
      const chave = format(d, "yyyy-MM-dd");
      if (!mapa[chave]) mapa[chave] = { rotas: 0, pedidos: 0, valorTotal: 0 };
      mapa[chave].pedidos += 1;
    });

    return mapa;
  }, [rotas, pedidos]);

  // Lista de dias a exibir a partir de dataInicio
  const listaDias = useMemo(() => {
    const dias = [];
    // Começa 1 dia antes da dataInicio para dar contexto imediato do dia anterior
    const base = subDays(dataInicio, 1);
    for (let i = 0; i < diasVisiveis; i++) {
      const d = addDays(base, i);
      const chave = format(d, "yyyy-MM-dd");
      const info = estatisticasPorDia[chave] || { rotas: 0, pedidos: 0 };
      dias.push({
        date: d,
        chave,
        diaSemana: format(d, "EEE", { locale: ptBR }).replace(".", ""),
        diaMes: format(d, "dd/MMM", { locale: ptBR }),
        rotasCount: info.rotas,
        pedidosCount: info.pedidos,
        ehHoje: isToday(d),
      });
    }
    return dias;
  }, [dataInicio, diasVisiveis, estatisticasPorDia]);

  const avancarSemana = () => setDataInicio((prev) => addDays(prev, 5));
  const voltarSemana = () => setDataInicio((prev) => subDays(prev, 5));
  const irParaHoje = () => {
    setDataInicio(new Date());
    onSelectData(format(new Date(), "yyyy-MM-dd"));
  };

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-3 shadow-xs space-y-2.5">
      {/* Barra de controle superior */}
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
              Navegação de Entregas por Calendário
              {dataSelecionada && (
                <Badge variant="outline" className="text-[10px] py-0 border-primary/40 text-primary font-bold">
                  Filtrado: {format(parseISO(dataSelecionada), "dd/MM/yyyy")}
                </Badge>
              )}
            </h3>
            <p className="text-[11px] text-muted-foreground hidden sm:block">
              Selecione um dia para ver apenas as rotas e cargas programadas naquela data
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={dataSelecionada === null ? "default" : "outline"}
            onClick={() => onSelectData(null)}
            className="h-8 text-xs font-bold gap-1 px-3 shadow-2xs"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Todas as Datas</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={irParaHoje}
            className="h-8 text-xs font-bold gap-1 px-3"
            title="Voltar para a data de hoje"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Hoje</span>
          </Button>

          <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5 bg-muted/40">
            <Button
              size="icon"
              variant="ghost"
              onClick={voltarSemana}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Voltar dias"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={avancarSemana}
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              title="Avançar dias"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Faixa deslizante de pílulas diárias */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-border">
        {listaDias.map((item) => {
          const isAtivo = dataSelecionada === item.chave;
          const temAtividade = item.rotasCount > 0 || item.pedidosCount > 0;

          return (
            <button
              key={item.chave}
              onClick={() => onSelectData(isAtivo ? null : item.chave)}
              className={`flex-1 min-w-[92px] max-w-[130px] rounded-xl p-2.5 flex flex-col items-center justify-between text-center transition-all border relative ${
                isAtivo
                  ? "bg-primary text-primary-foreground border-primary shadow-sm scale-102 ring-2 ring-primary/30"
                  : item.ehHoje
                  ? "bg-amber-500/10 hover:bg-amber-500/15 text-foreground border-amber-500/40 font-bold"
                  : temAtividade
                  ? "bg-card hover:bg-muted/70 text-foreground border-border hover:border-primary/40"
                  : "bg-muted/20 hover:bg-muted/40 text-muted-foreground border-transparent hover:border-border"
              }`}
            >
              {/* Badge HOJE */}
              {item.ehHoje && (
                <span
                  className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded-full mb-1 ${
                    isAtivo ? "bg-white text-primary" : "bg-amber-500 text-white shadow-2xs"
                  }`}
                >
                  Hoje
                </span>
              )}

              {/* Dia da semana */}
              <span className={`text-[10px] uppercase font-extrabold ${isAtivo ? "text-primary-foreground/90" : "text-muted-foreground"}`}>
                {item.diaSemana}
              </span>

              {/* Dia do mês */}
              <span className={`text-sm font-black leading-tight ${isAtivo ? "text-white" : "text-foreground"}`}>
                {item.diaMes}
              </span>

              {/* Indicadores de rotas e pedidos */}
              <div className="mt-1.5 flex items-center justify-center gap-1 w-full">
                {item.rotasCount > 0 ? (
                  <Badge
                    variant="outline"
                    className={`text-[10px] py-0 px-1.5 font-black gap-0.5 ${
                      isAtivo
                        ? "bg-white/20 text-white border-white/30"
                        : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30"
                    }`}
                  >
                    <Truck className="w-2.5 h-2.5" />
                    <span>{item.rotasCount}</span>
                  </Badge>
                ) : (
                  <span className={`text-[10px] opacity-40 ${isAtivo ? "text-white" : ""}`}>—</span>
                )}

                {item.pedidosCount > 0 && item.rotasCount === 0 && (
                  <Badge
                    variant="outline"
                    className={`text-[9px] py-0 px-1 font-bold ${
                      isAtivo
                        ? "bg-white/20 text-white border-white/30"
                        : "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30"
                    }`}
                  >
                    <Package className="w-2.5 h-2.5" />
                    <span>{item.pedidosCount}</span>
                  </Badge>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
