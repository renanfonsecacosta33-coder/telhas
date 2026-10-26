import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Edit2, 
  Trash2, 
  Archive, 
  Eye, 
  AlertTriangle, 
  Layers, 
  Clock, 
  DollarSign, 
  EyeOff, 
  FileText, 
  Calendar,
  Ruler,
  TrendingDown,
  Building2
} from "lucide-react";
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

function getCustoUnitarioBobina(b) {
  const raw = b.custo ?? b.custo_kg;
  if (raw !== undefined && raw !== null && raw !== "") {
    const num = typeof raw === "number" ? raw : parseFloat(String(raw).replace(",", "."));
    if (!isNaN(num) && num > 0) return num;
  }
  if (b.custo_total && b.peso_kg && Number(b.peso_kg) > 0) {
    const num = Number(b.custo_total) / Number(b.peso_kg);
    if (!isNaN(num) && num > 0) return num;
  }
  return null;
}

function getCustoTotalBobina(b) {
  const cUnit = getCustoUnitarioBobina(b);
  const peso = Number(b.peso_kg) || 0;
  if (cUnit && peso > 0) return cUnit * peso;
  if (b.custo_total && Number(b.custo_total) > 0) return Number(b.custo_total);
  return null;
}

export default function BobinaTabelaView({
  bobinas = [],
  statusColors = {},
  preBaixaMap = {},
  preBaixaMetrosMap = {},
  preBaixaOpsMap = {},
  statusMap = {},
  onVerOps,
  onEdit,
  onDelete,
  onArquivar,
  podeGerenciar = true,
}) {
  // Controle para exibir ou ocultar dados de custo
  const [mostrarCustos, setMostrarCustos] = useState(() => {
    try {
      const salvo = localStorage.getItem("ajl_mostrar_custos_bobinas");
      return salvo !== null ? salvo === "true" : true;
    } catch {
      return true;
    }
  });

  const toggleMostrarCustos = () => {
    setMostrarCustos(prev => {
      const novo = !prev;
      try {
        localStorage.setItem("ajl_mostrar_custos_bobinas", String(novo));
      } catch {}
      return novo;
    });
  };

  // Cálculos consolidados para o rodapé
  const totais = useMemo(() => {
    let pesoTotalKg = 0;
    let metrosTotal = 0;
    let preBaixaTotalKg = 0;
    let valorTotalEstoque = 0;
    let bobinasComCusto = 0;

    bobinas.forEach(b => {
      const pesoAtual = Number(b.peso_kg) || 0;
      const chapaNum = parseFloat(String(b.chapa || "0.43").replace(",", ".")) || 0.43;
      const metros = Math.round(pesoAtual / (chapaNum * 7.85 * 1.2 || 4.05));
      const preKg = preBaixaMap[b.id] || 0;

      const custoTotalBobina = getCustoTotalBobina(b) || 0;

      pesoTotalKg += pesoAtual;
      metrosTotal += metros;
      preBaixaTotalKg += preKg;

      if (custoTotalBobina > 0) {
        valorTotalEstoque += custoTotalBobina;
        bobinasComCusto++;
      }
    });

    return {
      quantidade: bobinas.length,
      pesoTotalKg,
      metrosTotal,
      preBaixaTotalKg,
      valorTotalEstoque,
      bobinasComCusto,
    };
  }, [bobinas, preBaixaMap]);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs space-y-0">
      {/* Barra de Controles Rápidos da Tabela */}
      <div className="p-3 bg-muted/40 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-3">
          <span className="font-bold text-foreground flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-primary" />
            Visão Tabela Detalhada
          </span>
          <span className="text-muted-foreground">
            Exibindo <strong>{bobinas.length}</strong> bobina(s)
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Botão de Alternar Exibição de Custos */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={toggleMostrarCustos}
            className={`h-7 px-2.5 text-xs gap-1.5 font-bold transition-all ${
              mostrarCustos 
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800"
                : "text-muted-foreground"
            }`}
            title="Ocultar ou mostrar custos na tabela"
          >
            {mostrarCustos ? (
              <>
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Custos Visíveis</span>
              </>
            ) : (
              <>
                <EyeOff className="w-3.5 h-3.5" />
                <span>Mostrar Custos</span>
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse min-w-[950px]">
          <thead>
            <tr className="bg-muted/60 border-b border-border text-muted-foreground font-bold tracking-tight">
              <th className="py-2.5 px-3">Código / ID</th>
              <th className="py-2.5 px-3">Espessura & Largura</th>
              <th className="py-2.5 px-3">Cor / Qualidade</th>
              <th className="py-2.5 px-3">Fornecedor / NF</th>
              {mostrarCustos && (
                <>
                  <th className="py-2.5 px-3 text-right text-emerald-800 dark:text-emerald-400 bg-emerald-500/5">
                    Custo (R$/kg)
                  </th>
                  <th className="py-2.5 px-3 text-right text-emerald-800 dark:text-emerald-400 bg-emerald-500/5">
                    Valor Total (R$)
                  </th>
                </>
              )}
              <th className="py-2.5 px-3 text-right">Peso Atual (Líq.)</th>
              <th className="py-2.5 px-3 text-right">Metros Est.</th>
              <th className="py-2.5 px-3 text-right">Pré-Baixa / OPs</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-center">Filial / Local</th>
              <th className="py-2.5 px-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {bobinas.map((b) => {
              const alerta = extrairAlerta(b);
              const preKg = preBaixaMap[b.id] || 0;
              const preM = preBaixaMetrosMap[b.id] || 0;
              const preOps = preBaixaOpsMap[b.id] || [];
              const pesoAtual = Number(b.peso_kg) || 0;
              const pesoInicial = Number(b.peso_inicial) || 0;
              const chapaNum = parseFloat(String(b.chapa || "0.43").replace(",", ".")) || 0.43;
              const metrosEst = Math.round((pesoAtual / (chapaNum * 7.85 * 1.2 || 4.05)));
              const custoKg = getCustoUnitarioBobina(b);
              const custoTotal = getCustoTotalBobina(b);

              return (
                <tr
                  key={b.id}
                  className={`hover:bg-muted/40 transition-colors ${
                    alerta.ativo ? "bg-amber-500/5 dark:bg-amber-950/20" : ""
                  }`}
                >
                  {/* 1. Código / ID */}
                  <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{b.codigo_bobina || b.codigo || b.id?.slice(0, 8)}</span>
                      {alerta.ativo && (
                        <span title={alerta.texto} className="text-amber-500">
                          <AlertTriangle className="w-3.5 h-3.5 inline" />
                        </span>
                      )}
                    </div>
                    {b.sub_cod && (
                      <span className="text-[10px] text-muted-foreground block font-mono">
                        Sub: {b.sub_cod}
                      </span>
                    )}
                  </td>

                  {/* 2. Espessura & Largura */}
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-foreground">
                      {b.chapa ? `${b.chapa} mm` : "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Ruler className="w-3 h-3 text-muted-foreground" />
                      <span>{b.largura_mm ? `${b.largura_mm} mm` : "1.200 mm"}</span>
                    </div>
                  </td>

                  {/* 3. Cor & Qualidade */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
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
                      <span className="font-medium text-foreground">{b.cor || "Natural"}</span>
                      {b.qualidade && (
                        <Badge variant="outline" className="text-[10px] py-0 px-1 font-bold">
                          {b.qualidade}
                        </Badge>
                      )}
                    </div>
                    {b.origem && (
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {b.origem}
                      </span>
                    )}
                  </td>

                  {/* 4. Fornecedor / NF */}
                  <td className="py-2.5 px-3">
                    <div className="text-foreground font-medium truncate max-w-[160px]" title={b.fornecedor}>
                      {b.fornecedor || "—"}
                    </div>
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2 flex-wrap">
                      {b.nf && (
                        <span className="flex items-center gap-0.5">
                          <FileText className="w-2.5 h-2.5" /> NF {b.nf}
                        </span>
                      )}
                      {b.data_recebimento && (
                        <span className="flex items-center gap-0.5">
                          <Calendar className="w-2.5 h-2.5" /> {b.data_recebimento}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* 5. Custo (R$/kg) */}
                  {mostrarCustos && (
                    <td className="py-2.5 px-3 text-right bg-emerald-500/5 font-mono">
                      {custoKg > 0 ? (
                        <span className="font-bold text-emerald-700 dark:text-emerald-400">
                          R$ {custoKg.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/kg
                        </span>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  )}

                  {/* 6. Valor Total em Estoque (R$) */}
                  {mostrarCustos && (
                    <td className="py-2.5 px-3 text-right bg-emerald-500/5 font-mono">
                      {custoTotal > 0 ? (
                        <div className="font-black text-emerald-800 dark:text-emerald-300">
                          R$ {custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  )}

                  {/* 7. Peso Atual (Líquido) */}
                  <td className="py-2.5 px-3 text-right font-mono">
                    <div className="font-black text-foreground text-sm">
                      {pesoAtual.toLocaleString("pt-BR")} kg
                    </div>
                    {pesoInicial > 0 && pesoInicial !== pesoAtual && (
                      <span className="text-[10px] text-muted-foreground flex items-center justify-end gap-0.5" title={`Início: ${pesoInicial.toLocaleString("pt-BR")} kg`}>
                        <TrendingDown className="w-2.5 h-2.5 text-orange-500" />
                        de {pesoInicial.toLocaleString("pt-BR")} kg
                      </span>
                    )}
                  </td>

                  {/* 8. Metros Estimados */}
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {metrosEst > 0 ? `${metrosEst.toLocaleString("pt-BR")} m` : "—"}
                  </td>

                  {/* 9. Pré-Baixa / OPs */}
                  <td className="py-2.5 px-3 text-right font-mono">
                    {preKg > 0 ? (
                      <button
                        type="button"
                        onClick={() => onVerOps?.(b)}
                        className="text-amber-600 dark:text-amber-400 font-bold hover:underline inline-flex items-center gap-1"
                        title={`Clique para ver ${preOps.length} OP(s) vinculadas`}
                      >
                        <Clock className="w-3 h-3" />
                        {preKg.toLocaleString("pt-BR")} kg ({preM}m)
                      </button>
                    ) : (
                      <span className="text-muted-foreground/40">—</span>
                    )}
                  </td>

                  {/* 10. Status */}
                  <td className="py-2.5 px-3 text-center">
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold px-2 py-0.5 border ${
                        statusColors[b.status] || "bg-slate-100 text-slate-700 border-slate-300"
                      }`}
                    >
                      {b.status || "Disponível"}
                    </Badge>
                  </td>

                  {/* 11. Filial / Local */}
                  <td className="py-2.5 px-3 text-center text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-muted-foreground" />
                      {b.unidade || "Matriz AJL"}
                    </span>
                  </td>

                  {/* 12. Ações */}
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {preKg > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-amber-600 hover:text-amber-700 cursor-pointer"
                          onClick={() => onVerOps?.(b)}
                          title="Ver OPs na pré-baixa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      {podeGerenciar ? (
                        <>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => onEdit?.(b)}
                            title="Corrigir estoque (PCP/Admin)"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground cursor-pointer"
                            onClick={() => onArquivar?.(b.id, !b.arquivada)}
                            title={b.arquivada ? "Desarquivar Bobina" : "Arquivar Bobina"}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive cursor-pointer"
                            onClick={() => onDelete?.(b)}
                            title="Excluir Bobina (PCP/Admin)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* ═══════════════════════════════════════════════════════════════
              RODAPÉ CONSOLIDADO: TOTAIS DO ESTOQUE
          ═══════════════════════════════════════════════════════════════ */}
          <tfoot>
            <tr className="bg-muted/80 border-t-2 border-border font-bold text-foreground">
              <td className="py-3 px-3 text-xs" colSpan={4}>
                <div className="flex items-center gap-2">
                  <span className="uppercase text-[11px] tracking-wider text-muted-foreground">
                    Totais Consolidados:
                  </span>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {totais.quantidade} {totais.quantidade === 1 ? "bobina" : "bobinas"}
                  </Badge>
                </div>
              </td>

              {mostrarCustos && (
                <>
                  <td className="py-3 px-3 text-right text-[11px] text-muted-foreground bg-emerald-500/10 font-mono">
                    {totais.pesoTotalKg > 0 && totais.valorTotalEstoque > 0 ? (
                      <span title="Custo Médio Ponderado por kg">
                        Méd: R$ {(totais.valorTotalEstoque / totais.pesoTotalKg).toFixed(2)}/kg
                      </span>
                    ) : "—"}
                  </td>
                  <td className="py-3 px-3 text-right bg-emerald-500/10 font-mono">
                    <div className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                      R$ {totais.valorTotalEstoque.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-normal block">
                      Valor Total Patrimonial
                    </span>
                  </td>
                </>
              )}

              <td className="py-3 px-3 text-right font-black font-mono text-sm text-foreground">
                {totais.pesoTotalKg.toLocaleString("pt-BR")} kg
              </td>

              <td className="py-3 px-3 text-right font-mono text-muted-foreground">
                {totais.metrosTotal.toLocaleString("pt-BR")} m
              </td>

              <td className="py-3 px-3 text-right font-mono text-amber-600 dark:text-amber-400">
                {totais.preBaixaTotalKg > 0 ? `${totais.preBaixaTotalKg.toLocaleString("pt-BR")} kg` : "—"}
              </td>

              <td className="py-3 px-3 text-center" colSpan={3}>
                <span className="text-[10px] text-muted-foreground">
                  Estoque atualizado em tempo real
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}