import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Play, CheckCircle2, Inbox, Scissors, Calendar, User, Loader2, Layers, Plus } from "lucide-react";
import InstrucaoVendedorCard from "@/components/pcp/InstrucaoVendedorCard";
import CroquiThumb from "@/components/pcp/CroquiThumb";
import {
  getItens, classGrupo, computePercentual, buildItensJson,
  statusPcpPorPercentual, STATUS_ITEM, MAQUINAS_CD
} from "@/lib/pedidoOdooHelper";
import { formatDataBR, diasUteisRestantes } from "@/lib/sla";
import { notificarStatus } from "@/lib/biNotificador";

export default function FilaPCPCorteDobra({ onNovaOrdem }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [atualizando, setAtualizando] = useState(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos-odoo-cd"],
    queryFn: () => base44.entities.PedidoOdoo.list("-data_recebimento", 200),
    refetchInterval: 10000
  });

  const { data: ordensMaquina = [] } = useQuery({
    queryKey: ["ordens-maquina-cd-todas"],
    queryFn: () => base44.entities.OrdemMaquinaCD.list("-data", 500),
    refetchInterval: 10000
  });

  const { data: ordensDesb = [] } = useQuery({
    queryKey: ["ordens-desb-todas"],
    queryFn: () => base44.entities.OrdemDesbobinadeira.list("-data", 500),
    refetchInterval: 10000
  });

  // Pedidos distribuídos/em produção com itens de CD
  const fila = pedidos
    .filter(p => ["distribuido", "em_producao"].includes(p.status_pcp))
    .filter(p => getItens(p).some(i => classGrupo(i) === "cd"));

  // Agrupar itens de CD por espessura (bitola) para otimizar setup de bobina
  const gruposEspessura = useMemo(() => {
    const mapa = new Map();
    fila.forEach(pedido => {
      const itens = getItens(pedido);
      itens.forEach(item => {
        if (classGrupo(item) !== "cd") return;
        const esp = item.espessura || "—";
        if (!mapa.has(esp)) mapa.set(esp, []);
        mapa.get(esp).push({ pedido, item, idx: item._idx });
      });
    });
    return Array.from(mapa.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([espessura, itens]) => ({ espessura, itens }));
  }, [fila]);

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
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-cd"] });
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

  if (gruposEspessura.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-8 flex flex-col items-center text-center">
        <Inbox className="w-10 h-10 text-slate-300 mb-2" />
        <p className="text-sm font-semibold text-slate-500">Nenhum pedido aguardando produção</p>
        <p className="text-xs text-slate-400 mt-1">Os pedidos distribuídos pela Central PCP aparecerão aqui agrupados por bitola.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scissors className="w-4 h-4 text-orange-500" />
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Fila PCP — Aguardando Produção (Corte & Dobra)</h2>
          <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30">{gruposEspessura.length} bitola(s)</Badge>
        </div>
      </div>

      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {gruposEspessura.map(grupo => (
          <div key={grupo.espessura} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Layers className="w-4 h-4 text-sky-500" />
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Chapa {grupo.espessura}mm</span>
              <Badge variant="outline" className="text-[10px] text-slate-500">{grupo.itens.length} peça(s)</Badge>
              <span className="text-[10px] text-slate-400 ml-auto">↑ Setup de bobina agrupado por bitola</span>
            </div>

            <div className="space-y-2">
              {grupo.itens.map(({ pedido, item, idx }) => {
                // Determina status real a partir das OPs de corte e dobra
                const opReal = ordensMaquina.find(o =>
                  o.numero_pedido && String(o.numero_pedido).trim().toUpperCase() === String(pedido.numero_pedido).trim().toUpperCase()
                ) || ordensDesb.find(o =>
                  o.numero_pedido && String(o.numero_pedido).trim().toUpperCase() === String(pedido.numero_pedido).trim().toUpperCase()
                );

                let statusItem = "pendente";
                let maquinaItem = item.maquina || "";

                if (opReal) {
                  maquinaItem = opReal.maquina || maquinaItem;
                  if (opReal.status === "finalizado") {
                    statusItem = "concluido";
                  } else if (["em_producao", "pausado", "aguardando_corte", "pendente"].includes(opReal.status)) {
                    statusItem = "em_producao";
                  }
                }

                const st = STATUS_ITEM[statusItem] || STATUS_ITEM.pendente;
                const emProd = statusItem === "em_producao";
                const concluido = statusItem === "concluido";
                const key = `${pedido.id}-${idx}`;
                const restantes = diasUteisRestantes(pedido.data_entrega);

                return (
                  <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/40 p-3 space-y-2">
                    <div className="flex items-start gap-3">
                    <CroquiThumb pedido={pedido} alt={`Croqui do pedido #${pedido.numero_pedido}`} />
                    <div className="flex-1 min-w-0 space-y-2">
                    <InstrucaoVendedorCard descricao={item.descricao || item.produto} quantidadeOdoo={item.quantidade} espessura={item.espessura} unidade="un" />
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.produto || "—"}</span>
                          <Badge className={`shrink-0 border text-[10px] ${st.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${st.dot} mr-1`} />{st.label}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                          <span className="font-mono">#{pedido.numero_pedido}</span>
                          <span className="flex items-center gap-1"><User className="w-3 h-3" />{pedido.cliente_nome || "—"}</span>
                          <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDataBR(pedido.data_entrega)}</span>
                          <span>{item.medida || "—"}</span>
                          <span className="font-semibold">Qtd: {item.quantidade}x</span>
                          <span className={restantes < 0 ? "text-red-600 font-semibold" : ""}>
                            {restantes < 0 ? `Atrasado ${restantes}d` : `${restantes}d úteis`}
                          </span>
                        </div>

                        {/* Checklist individual: máquina + medição + qtd produzida */}
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Select
                            value={maquinaItem || ""}
                            onValueChange={(v) => handleAtualizar(pedido, idx, { maquina: v })}
                            disabled={concluido}
                          >
                            <SelectTrigger className="h-8 w-[160px] text-xs">
                              <SelectValue placeholder="Selecionar máquina..." />
                            </SelectTrigger>
                            <SelectContent>
                              {MAQUINAS_CD.map(m => <SelectItem key={m} value={m} className="text-xs">{m}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input
                            type="text"
                            placeholder="Medição (mm)"
                            defaultValue={item.medicao || ""}
                            onBlur={(e) => {
                              const val = e.target.value;
                              if (val !== (item.medicao || "")) {
                                handleAtualizar(pedido, idx, { medicao: val });
                              }
                            }}
                            className="h-8 w-28 text-xs"
                            disabled={concluido}
                          />
                          <Input
                            type="number"
                            min="0"
                            placeholder="Qtd produzida"
                            value={item.quantidade_produzida || ""}
                            onChange={(e) => {}}
                            onBlur={(e) => {
                              const val = Number(e.target.value || 0);
                              if (val !== (item.quantidade_produzida || 0)) {
                                handleAtualizar(pedido, idx, { quantidade_produzida: val });
                              }
                            }}
                            defaultValue={item.quantidade_produzida || ""}
                            className="h-8 w-28 text-xs"
                            disabled={concluido}
                          />
                          {onNovaOrdem && (
                            <Button
                              size="sm"
                              onClick={() => {
                                notificarStatus(pedido, "revisando_ordem", {
                                  status_novo: "em_revisao",
                                  item_nome: item.produto || item.descricao || "",
                                  maquina_atual: maquinaItem || "PCP / C&D"
                                });
                                onNovaOrdem(pedido, { ...item, _idx: idx, maquina: maquinaItem });
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
                    </div>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}