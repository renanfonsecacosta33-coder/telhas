import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Archive, Eye, AlertTriangle, Layers, Clock } from "lucide-react";
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
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
              <th className="py-2.5 px-3">Código / ID</th>
              <th className="py-2.5 px-3">Espessura (Chapa)</th>
              <th className="py-2.5 px-3">Cor / Qualidade</th>
              <th className="py-2.5 px-3">Fornecedor</th>
              <th className="py-2.5 px-3 text-right">Peso Atual (Líquido)</th>
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
              const metrosEst = Math.round((pesoAtual / (parseFloat(String(b.chapa || "0.43").replace(",", ".")) * 7.85 * 1.2 || 4.05)));

              return (
                <tr
                  key={b.id}
                  className={`hover:bg-muted/40 transition-colors ${
                    alerta.ativo ? "bg-amber-500/5 dark:bg-amber-950/20" : ""
                  }`}
                >
                  <td className="py-2.5 px-3 font-mono font-bold text-foreground">
                    <div className="flex items-center gap-1.5">
                      <span>{b.codigo_bobina || b.codigo || b.id?.slice(0, 8)}</span>
                      {alerta.ativo && (
                        <span title={alerta.texto} className="text-amber-500">
                          <AlertTriangle className="w-3.5 h-3.5 inline" />
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-foreground">
                    {b.chapa ? `${b.chapa} mm` : "—"}
                  </td>
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
                        <Badge variant="outline" className="text-[10px] py-0 px-1">
                          {b.qualidade}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-muted-foreground">{b.fornecedor || "—"}</td>
                  <td className="py-2.5 px-3 text-right font-black font-mono text-foreground text-sm">
                    {pesoAtual.toLocaleString("pt-BR")} kg
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                    {metrosEst > 0 ? `${metrosEst.toLocaleString("pt-BR")} m` : "—"}
                  </td>
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
                  <td className="py-2.5 px-3 text-center text-muted-foreground">
                    {b.unidade || "Matriz AJL"}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {preKg > 0 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-amber-600 hover:text-amber-700"
                          onClick={() => onVerOps?.(b)}
                          title="Ver OPs na pré-baixa"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onEdit?.(b)}
                        title="Editar Bobina"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        onClick={() => onArquivar?.(b.id, !b.arquivada)}
                        title={b.arquivada ? "Desarquivar Bobina" : "Arquivar Bobina"}
                      >
                        <Archive className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => onDelete?.(b)}
                        title="Excluir Bobina"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
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
