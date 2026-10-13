import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ExternalLink, History, Zap, CheckCircle2, Clock, AlertTriangle,
  Layers, Star, Eye, RefreshCw, Scissors, Home, Wind, Package
} from "lucide-react";
import { stripHtml } from "@/lib/stripHtml";
import { classGrupo, normalizarUnidadeMedidaItem, obterStatusDescritivoItem } from "@/lib/pedidoOdooHelper";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { verificarEstoqueItem, extrairDemandaItem } from "@/lib/estoqueMaterialHelper";
import { PrioridadeBadge } from "@/lib/prioridadeHelper";

export default function FilaPCPTabelaView({
  pedidos = [],
  estoqueContext = null,
  pedidosProducao = [],
  ordensCD = [],
  onOpenDetalhe,
  onDistribuir,
  onOpenHistorico,
  onSincronizarOdoo,
}) {
  // Aplaina pedidos em linhas de itens/OFs individuais
  const linhasItens = useMemo(() => {
    const linhas = [];

    pedidos.forEach((ped) => {
      let itens = [];
      try {
        const arr = JSON.parse(ped.itens_json || "[]");
        itens = Array.isArray(arr) ? arr : [];
      } catch {
        itens = [];
      }

      if (itens.length === 0) {
        // Se pedido não tiver itens parseáveis, gera uma linha com os dados gerais
        linhas.push({
          id: `${ped.id}-geral`,
          pedido: ped,
          item: null,
          itemIdx: 0,
          categoria: "telha",
          produto: ped.produto || "Pedido sem itens descritos",
          qtdPecas: 1,
          medidaIndividual: "—",
          metrosTotais: Number(ped.metros) || 0,
          statusItem: ped.status_pcp || "pendente",
          estoqueItem: null,
        });
        return;
      }

      itens.forEach((it, idx) => {
        const g = classGrupo(it);
        const desc = stripHtml(it.descricao || it.produto || "Item sem descrição");
        const unidade = normalizarUnidadeMedidaItem(it, g);

        // Verificação de Matéria-Prima em Tempo Real e Demanda Física
        const estoqueItem = estoqueContext ? verificarEstoqueItem(it, estoqueContext, ped) : null;
        const demanda = estoqueItem?.demanda || extrairDemandaItem(it);

        const espTec = extrairEspecificacao(`${it.observacao || ""} ${it.descricao || ""} ${it.produto || ""}`, it.quantidade, unidade);

        const pecasReal = (demanda?.pecas && demanda.pecas > 0) ? demanda.pecas : (espTec?.pecas > 0 ? espTec.pecas : null);
        const isUnidadeMetro = ["MT", "M", "METRO", "METROS"].includes(unidade) || (g === "telha" && demanda?.metros > 0);

        let qtdPecas = pecasReal || Number(it.quantidade) || 1;
        let totalM = demanda?.metros || espTec?.metragem_total || (isUnidadeMetro ? Number(it.quantidade) : 0);

        // Medida individual formatada
        let individualTexto = "—";
        if (espTec?.comprimento_mm > 0) {
          const mm = espTec.comprimento_mm;
          const mUnit = (mm / 1000).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          individualTexto = `${mm.toLocaleString("pt-BR")} mm (${mUnit} m)`;
          if (!totalM) totalM = qtdPecas * (mm / 1000);
        } else if (espTec?.comprimento_m > 0) {
          individualTexto = `${espTec.comprimento_m} m`;
          if (!totalM) totalM = qtdPecas * espTec.comprimento_m;
        } else if (totalM > 0 && qtdPecas > 0) {
          const mUnit = totalM / qtdPecas;
          individualTexto = `${(mUnit * 1000).toFixed(0)} mm (${mUnit.toFixed(2)} m)`;
        }

        linhas.push({
          id: `${ped.id}-${idx}`,
          pedido: ped,
          item: it,
          itemIdx: idx,
          categoria: g,
          produto: it.produto || it.descricao || "Item",
          qtdPecas,
          individualTexto,
          metrosTotais: totalM,
          estoqueItem,
        });
      });
    });

    return linhas;
  }, [pedidos, estoqueContext]);

  if (linhasItens.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
        <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="font-semibold text-base">Nenhum item na fila para os filtros selecionados</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-muted/60 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
              <th className="py-2.5 px-3">Pedido</th>
              <th className="py-2.5 px-3">Cliente / Vendedor</th>
              <th className="py-2.5 px-3">Setor</th>
              <th className="py-2.5 px-3">Produto / Especificação</th>
              <th className="py-2.5 px-3 text-center">Peças × Medida Individual</th>
              <th className="py-2.5 px-3 text-right">Metragem Total</th>
              <th className="py-2.5 px-3 text-center">Estoque MP</th>
              <th className="py-2.5 px-3 text-center">Status PCP</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {linhasItens.map((linha) => {
              const { pedido, item, itemIdx, categoria, produto, qtdPecas, individualTexto, metrosTotais, estoqueItem } = linha;
              const isUrgente = pedido.prioridade || pedido.urgente;

              const setorBadge = (() => {
                if (categoria === "telha") return { label: "Telha", cor: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300" };
                if (categoria === "cd") return { label: "C&D", cor: "bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/40 dark:text-orange-300" };
                if (categoria === "frisada") return { label: "Frisada", cor: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/40 dark:text-teal-300" };
                return { label: "Avulso", cor: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-300" };
              })();

              const statusDesc = pedido.status_pcp || "pendente";

              return (
                <tr
                  key={linha.id}
                  className={`hover:bg-muted/40 transition-colors ${
                    isUrgente ? "bg-amber-500/5 dark:bg-amber-950/20" : ""
                  }`}
                >
                  {/* Pedido */}
                  <td className="py-2.5 px-3 font-mono font-bold">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-primary font-black text-sm">
                        #{pedido.numero_pedido || pedido.id?.slice(0, 8)}
                      </span>
                      {isUrgente && (
                        <PrioridadeBadge prioridade={pedido.prioridade_tipo || "P1"} />
                      )}
                    </div>
                  </td>

                  {/* Cliente / Vendedor */}
                  <td className="py-2.5 px-3 max-w-[200px]">
                    <div className="font-semibold text-foreground truncate" title={pedido.cliente}>
                      {pedido.cliente || "—"}
                    </div>
                    {pedido.vendedor && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        Vend: {pedido.vendedor}
                      </div>
                    )}
                  </td>

                  {/* Setor */}
                  <td className="py-2.5 px-3">
                    <Badge variant="outline" className={`text-[10px] font-bold ${setorBadge.cor}`}>
                      {setorBadge.label}
                    </Badge>
                  </td>

                  {/* Produto */}
                  <td className="py-2.5 px-3 max-w-[220px]">
                    <div className="font-medium text-foreground truncate" title={produto}>
                      {produto}
                    </div>
                    {item?.observacao && (
                      <div className="text-[10px] text-muted-foreground truncate" title={item.observacao}>
                        Obs: {item.observacao}
                      </div>
                    )}
                  </td>

                  {/* Coluna 1: Peças × Medida Individual */}
                  <td className="py-2.5 px-3 text-center">
                    <div className="inline-flex items-center gap-1.5 bg-muted/60 px-2 py-1 rounded-md border border-border font-mono text-xs shadow-2xs">
                      <strong className="text-foreground">{qtdPecas} pç{qtdPecas > 1 ? "s" : ""}</strong>
                      <span className="text-muted-foreground">×</span>
                      <span className="text-muted-foreground font-semibold">{individualTexto}</span>
                    </div>
                  </td>

                  {/* Coluna 2: Metragem Total */}
                  <td className="py-2.5 px-3 text-right">
                    <span className="font-black font-mono text-blue-600 dark:text-blue-400 text-sm">
                      {metrosTotais > 0 ? `${Number(metrosTotais).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} m` : "—"}
                    </span>
                  </td>

                  {/* Estoque MP */}
                  <td className="py-2.5 px-3 text-center">
                    {estoqueItem?.status === "sem_estoque" ? (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 border-red-300 text-[10px] font-bold">
                        Falta MP
                      </Badge>
                    ) : estoqueItem?.status === "disponivel" ? (
                      <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold">
                        100% OK
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">—</span>
                    )}
                  </td>

                  {/* Status PCP */}
                  <td className="py-2.5 px-3 text-center">
                    <Badge variant="outline" className="text-[10px] font-bold capitalize">
                      {statusDesc.replace(/_/g, " ")}
                    </Badge>
                  </td>

                  {/* Ações */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {onDistribuir && (
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 text-xs px-2 gap-1 bg-blue-600 hover:bg-blue-700 text-white font-bold"
                          onClick={() => onDistribuir(pedido, item, itemIdx)}
                          title="Distribuir / Iniciar Produção"
                        >
                          <Zap className="w-3 h-3" /> Distribuir
                        </Button>
                      )}
                      {onOpenDetalhe && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onOpenDetalhe(pedido)}
                          title="Ver Detalhes do Pedido"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {onOpenHistorico && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-foreground"
                          onClick={() => onOpenHistorico(pedido.numero_pedido || pedido.id)}
                          title="Histórico / Timeline"
                        >
                          <History className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
