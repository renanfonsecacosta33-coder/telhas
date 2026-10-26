import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Eye, AlertTriangle, Layers, Clock, CheckCircle2, Cog, Lock, PackageX } from "lucide-react";
import { getAlertaNivel } from "@/components/bobinas/BobinaCardShared";

function extrairAlerta(bobina) {
  const nivel = getAlertaNivel(bobina);
  if (!nivel) return { ativo: false, texto: "", nivel: null };
  return {
    ativo: true,
    texto: nivel === "critico" ? "Estoque crítico (abaixo do mínimo)" : "Estoque em atenção",
    nivel,
  };
}

const COLUNAS_KANBAN = [
  {
    id: "disponivel",
    titulo: "🟢 Disponível no Estoque",
    corBadge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300",
    headerBg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200",
    icon: CheckCircle2,
    filtro: (b) => {
      const st = (b.status || "").toLowerCase();
      const arq = Boolean(b.arquivada);
      const peso = Number(b.peso_kg) || 0;
      return !arq && peso > 0 && (st === "aberta" || st === "fechada" || st === "disponível" || st === "disponivel" || !st);
    },
  },
  {
    id: "em_uso",
    titulo: "⚙️ Em Uso na Máquina",
    corBadge: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-300",
    headerBg: "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-200",
    icon: Cog,
    filtro: (b) => {
      const st = (b.status || "").toLowerCase();
      const arq = Boolean(b.arquivada);
      return !arq && (st.startsWith("na ") || st.includes("tp40") || st.includes("bobininha") || st.includes("produção") || st.includes("producao"));
    },
  },
  {
    id: "reservada",
    titulo: "🔒 Reservada / Pré-baixa",
    corBadge: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-300",
    headerBg: "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-200",
    icon: Lock,
    filtro: (b, preKg) => {
      const st = (b.status || "").toLowerCase();
      const arq = Boolean(b.arquivada);
      return !arq && (st === "reservada" || preKg > 0);
    },
  },
  {
    id: "esgotada",
    titulo: "⚪ Esgotada / Retalho",
    corBadge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300",
    headerBg: "bg-slate-500/10 border-slate-500/30 text-slate-800 dark:text-slate-200",
    icon: PackageX,
    filtro: (b) => {
      const st = (b.status || "").toLowerCase();
      const arq = Boolean(b.arquivada);
      const peso = Number(b.peso_kg) || 0;
      return arq || peso <= 0 || st === "finalizada" || st === "zerada";
    },
  },
];

export default function BobinaKanbanView({
  bobinas = [],
  statusColors = {},
  preBaixaMap = {},
  preBaixaMetrosMap = {},
  preBaixaOpsMap = {},
  onVerOps,
  onEdit,
  podeGerenciar = true,
}) {
  const colunasComItens = useMemo(() => {
    return COLUNAS_KANBAN.map((col) => {
      const itens = bobinas.filter((b) => {
        const preKg = preBaixaMap[b.id] || 0;
        // Para coluna reservada, se tiver preKg > 0 e não estiver em_uso ou esgotada
        if (col.id === "reservada") {
          const st = (b.status || "").toLowerCase();
          const arq = Boolean(b.arquivada);
          const peso = Number(b.peso_kg) || 0;
          if (arq || peso <= 0 || st === "finalizada") return false;
          return st === "reservada" || preKg > 0;
        }
        return col.filtro(b, preKg);
      });

      const pesoTotalCol = itens.reduce((acc, b) => acc + (Number(b.peso_kg) || 0), 0);

      return {
        ...col,
        itens,
        pesoTotalCol,
      };
    });
  }, [bobinas, preBaixaMap]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 items-start">
      {colunasComItens.map((col) => {
        const IconComponent = col.icon;
        return (
          <div
            key={col.id}
            className="bg-card/70 border border-border rounded-xl flex flex-col max-h-[calc(100vh-250px)] shadow-xs"
          >
            {/* Header da Coluna */}
            <div className={`p-3 rounded-t-xl border-b flex items-center justify-between ${col.headerBg}`}>
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <IconComponent className="w-4 h-4 shrink-0" />
                <span>{col.titulo}</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className={`text-[10px] font-black ${col.corBadge}`}>
                  {col.itens.length}
                </Badge>
              </div>
            </div>

            {/* Subtotais da coluna */}
            <div className="px-3 py-1.5 bg-muted/30 border-b border-border/50 text-[11px] font-semibold text-muted-foreground flex justify-between">
              <span>Peso acumulado:</span>
              <span className="font-mono font-bold text-foreground">
                {col.pesoTotalCol.toLocaleString("pt-BR")} kg
              </span>
            </div>

            {/* Lista de Cards da Coluna */}
            <div className="p-2 space-y-2 overflow-y-auto flex-1">
              {col.itens.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground/60 text-xs italic">
                  Nenhuma bobina nesta coluna
                </div>
              ) : (
                col.itens.map((b) => {
                  const alerta = extrairAlerta(b);
                  const preKg = preBaixaMap[b.id] || 0;
                  const pesoAtual = Number(b.peso_kg) || 0;
                  const espNum = parseFloat(String(b.chapa || "0.43").replace(",", ".")) || 0.43;
                  const metrosEst = Math.round(pesoAtual / (espNum * 7.85 * 1.2));

                  return (
                    <div
                      key={b.id}
                      onClick={() => podeGerenciar && onEdit?.(b)}
                      className="bg-card border border-border hover:border-orange-400/60 rounded-lg p-2.5 shadow-2xs space-y-2 cursor-pointer transition-all hover:scale-[1.01]"
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="min-w-0">
                          <span className="font-mono font-black text-xs text-foreground block truncate">
                            {b.codigo_bobina || b.codigo || b.id?.slice(0, 8)}
                          </span>
                          <span className="text-[11px] font-semibold text-muted-foreground">
                            {b.chapa ? `${b.chapa} mm` : "—"} • {b.qualidade || "Galv"}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[9px] py-0 px-1 font-bold ${
                            statusColors[b.status] || "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {b.status || "Disponível"}
                        </Badge>
                      </div>

                      {/* Cor e fornecedor */}
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span
                          className="w-2 h-2 rounded-full border border-black/20 shrink-0"
                          style={{
                            backgroundColor:
                              b.cor?.toLowerCase() === "branco"
                                ? "#ffffff"
                                : b.cor?.toLowerCase() === "preto"
                                ? "#1e293b"
                                : b.cor?.toLowerCase() === "azul"
                                ? "#2563eb"
                                : b.cor?.toLowerCase() === "vermelho"
                                ? "#dc2626"
                                : "#94a3b8",
                          }}
                        />
                        <span className="truncate">{b.cor || "Natural"}</span>
                        {b.fornecedor && (
                          <span className="text-[10px] text-muted-foreground/60 truncate">
                            ({b.fornecedor})
                          </span>
                        )}
                      </div>

                      {/* Peso e Metros */}
                      <div className="flex items-baseline justify-between pt-1 border-t border-border/50 text-xs">
                        <div>
                          <span className="font-black font-mono text-sm text-foreground">
                            {pesoAtual.toLocaleString("pt-BR")} kg
                          </span>
                          {metrosEst > 0 && (
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              ~{metrosEst} metros
                            </span>
                          )}
                        </div>

                        {preKg > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onVerOps?.(b);
                            }}
                            className="text-right text-amber-600 dark:text-amber-400 font-bold hover:underline text-[10px] flex items-center gap-0.5"
                          >
                            <Clock className="w-3 h-3" />
                            <span>-{preKg}kg</span>
                          </button>
                        )}
                      </div>

                      {alerta.ativo && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{alerta.texto}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}