import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Play, CheckCircle2, Inbox, Factory, Calendar, User, Loader2, Plus } from "lucide-react";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";
import CroquiThumb from "@/components/pcp/CroquiThumb";
import {
  getItens, itensPorGrupo, computePercentual, computePercentualGrupo,
  buildItensJson, statusPcpPorPercentual, STATUS_ITEM, saoPedidosIguais
} from "@/lib/pedidoOdooHelper";
import { formatDataBR, slaDiasPorCategoria, diasUteisRestantes } from "@/lib/sla";
import { notificarStatus } from "@/lib/biNotificador";

export default function FilaPCPTelhas({ onNovaOrdem }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [atualizando, setAtualizando] = useState(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-odoo-telhas"],
    queryFn: () => base44.entities.PedidoOdoo.list("-data_recebimento", 200),
    refetchInterval: 10000
  });

  // Consulta as Ordens de Produção reais nas máquinas da fábrica
  const { data: pedidosProducao = [] } = useQuery({
    queryKey: ["pedidos-producao-todos"],
    queryFn: () => base44.entities.Pedido.list("-data", 500),
    refetchInterval: 10000
  });

  // Apenas pedidos distribuídos/em produção com itens de telha
  const fila = pedidos
    .filter(p => ["distribuido", "em_producao"].includes(p.status_pcp))
    .filter(p => itensPorGrupo(getItens(p), "telha").length > 0)
    .sort((a, b) => new Date(a.data_recebimento || 0) - new Date(b.data_recebimento || 0));

  const handleAtualizar = async (pedido, idx, updates) => {
    setAtualizando(`${pedido.id}-${idx}`);
    try {
      const itens = getItens(pedido);
      itens[idx] = { ...itens[idx], ...updates };
      const percentual = computePercentual(itens);
      const status_pcp = statusPcpPorPercentual(percentual, pedido.status_pcp);
      await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: buildItensJson(itens),
        percentual_concluido: percentual,
        status_pcp
      });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
    } catch (e) {
      toast({ title: "Erro ao atualizar item", description: e.message, variant: "destructive" });
    } finally {
      setAtualizando(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex items-center gap-3 text-slate-400">
        <Loader2 className="w-5 h-5 animate-spin" /> Carregando fila PCP...
      </div>
    );
  }

  if (fila.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center text-center">
        <Inbox className="w-10 h-10 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-500">Nenhum pedido aguardando produção</p>
        <p className="text-xs text-slate-400 mt-1">Os pedidos distribuídos pela Central PCP aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Fila PCP — Aguardando Produção (Telhas)</h2>
          <Badge className="bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30">{fila.length} pedido(s)</Badge>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {fila.map(pedido => {
          const itens = getItens(pedido);
          const telhas = itensPorGrupo(itens, "telha");

          // Busca se existe Ordem de Produção real criada para este pedido na fábrica
          const opsDoPedido = pedidosProducao.filter(op =>
            op.numero_pedido &&
            saoPedidosIguais(op.numero_pedido, pedido.numero_pedido) &&
            String(op.status || "").toLowerCase() !== "cancelado"
          );

          let somaProgresso = 0;
          telhas.forEach((t, idx) => {
            const op = opsDoPedido[idx] || opsDoPedido.find(o => String(o.produto).toUpperCase().includes(String(t.produto).toUpperCase())) || opsDoPedido[0];
            if (op) {
              if (op.status === "finalizado") somaProgresso += 1.0;
              else if (op.status === "aguardando_colagem") somaProgresso += 0.75;
              else if (op.status === "em_producao") somaProgresso += 0.50;
              else if (op.status === "pausado") somaProgresso += 0.40;
              else if (op.status === "pendente") somaProgresso += 0.30;
              else somaProgresso += 0.25;
            } else if (t.status === "concluido") {
              somaProgresso += 1.0;
            } else if (t.status === "em_producao" || t.maquina) {
              somaProgresso += 0.30;
            }
          });

          const pctTelha = telhas.length > 0
            ? Math.min(100, Math.round((somaProgresso / telhas.length) * 100))
            : (pedido.percentual_concluido || 0);
          const pctGeral = Math.max(pctTelha, computePercentual(itens), pedido.percentual_concluido || 0);
          const sla = slaDiasPorCategoria(pedido);
          const restantes = diasUteisRestantes(pedido.data_entrega);
          const pacoteConcluido = pctTelha === 100;

          return (
            <div key={pedido.id} className={`p-4 ${pacoteConcluido ? "bg-emerald-50/40 dark:bg-emerald-950/10" : ""}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <CroquiThumb pedido={pedido} alt={`Croqui do pedido #${pedido.numero_pedido}`} className="mt-1" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">#{pedido.numero_pedido}</span>
                    {pacoteConcluido ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40 text-[10px]">
                        <CheckCircle2 className="w-3 h-3 mr-0.5" />Pacote Telhas Concluído
                      </Badge>
                    ) : opsDoPedido.length > 0 ? (
                      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 text-[10px]">
                        ⚙️ Em Produção na Fábrica
                      </Badge>
                    ) : (
                      <Badge className="bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/40 text-[10px]">
                        Aguardando Criação de OP
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1"><User className="w-3 h-3" />{pedido.cliente_nome || "—"}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDataBR(pedido.data_entrega)}</span>
                    <span className={restantes < 0 ? "text-red-600 font-semibold" : "text-slate-500"}>
                      {restantes < 0 ? `Atrasado ${restantes}d` : `${restantes}d úteis`}
                    </span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="text-[10px] text-slate-400">Telhas</span>
                    <span className="text-sm font-bold text-orange-600">{pctTelha}%</span>
                  </div>
                  <div className="flex items-center gap-2 justify-end mt-0.5">
                    <span className="text-[10px] text-slate-400">Geral</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{pctGeral}%</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                {telhas.map((item, idx) => {
                  // Determina o status real do item com base na OP da máquina
                  const opDoItem = opsDoPedido[idx] || opsDoPedido[0] || null;
                  let statusItem = "pendente";
                  let maquinaItem = item.maquina || "";

                  if (opDoItem) {
                    maquinaItem = opDoItem.maquina || maquinaItem;
                    if (opDoItem.status === "finalizado") {
                      statusItem = "concluido";
                    } else if (["em_producao", "pausado", "aguardando_colagem", "pendente"].includes(opDoItem.status)) {
                      statusItem = "em_producao";
                    }
                  }

                  const st = STATUS_ITEM[statusItem] || STATUS_ITEM.pendente;
                  const emProd = statusItem === "em_producao";
                  const concluido = statusItem === "concluido";

                  return (
                    <div key={idx} className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/40 space-y-2">
                      <InstrucaoVendedorCard descricao={item.descricao || item.produto} quantidadeOdoo={item.quantidade} espessura={item.espessura} unidade="MT" />
                      <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.produto || "—"}</p>
                          <p className="text-[11px] text-slate-400">
                            {item.medida || "—"} · {item.quantidade}x{item.espessura ? ` · ${item.espessura}mm` : ""}
                            {maquinaItem ? <strong className="text-orange-600 dark:text-orange-400 ml-1.5">· Máquina: {maquinaItem}</strong> : ""}
                            {item.data_programada ? <span className="text-blue-600 dark:text-blue-400 ml-1.5 font-semibold">· Previsto: {formatDataBR(item.data_programada)}</span> : ""}
                          </p>
                        </div>
                        <Badge className={`shrink-0 border text-[10px] ${st.cls}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${st.dot} mr-1`} />{st.label}
                        </Badge>
                        {onNovaOrdem && (
                          <Button
                            size="sm"
                            onClick={() => {
                              notificarStatus(pedido, "revisando_ordem", {
                                status_novo: "em_revisao",
                                item_nome: item.produto || item.descricao || "",
                                maquina_atual: maquinaItem || "PCP / Fábrica"
                              });
                              onNovaOrdem(pedido, {
                                ...item,
                                _idx: idx,
                                maquina: maquinaItem,
                                data: item.data_programada || pedido.data_entrega,
                                existingOp: opDoItem
                              });
                            }}
                            className={
                              concluido
                                ? "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 h-8 px-3 gap-1.5 text-xs font-semibold"
                                : emProd
                                ? "bg-amber-500 hover:bg-amber-600 text-white h-8 px-3 gap-1.5 text-xs font-semibold shadow-sm"
                                : "bg-orange-500 hover:bg-orange-600 text-white h-8 px-3 gap-1.5 text-xs font-semibold shadow-sm"
                            }
                          >
                            {concluido ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Ver / Revisar Ordem</span>
                              </>
                            ) : emProd ? (
                              <>
                                <span>⚙️</span>
                                <span>Revisar Ordem ({maquinaItem || "Em Produção"})</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Revisar Ordem</span>
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}