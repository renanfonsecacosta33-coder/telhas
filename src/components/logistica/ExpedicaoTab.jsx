import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Truck, CheckCircle2, Clock, Search, X, Package } from "lucide-react";
import AuditSidebar from "@/components/logistica/AuditSidebar";

export default function ExpedicaoTab({ tipo, filialAtiva }) {
  const [busca, setBusca] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [selectedTipo, setSelectedTipo] = useState(null);
  const queryClient = useQueryClient();

  const isCD = tipo === "cd";

  // Fetch finalized orders
  const { data: pedidosTelhas = [], isLoading: loadingTelhas } = useQuery({
    queryKey: ["expedicao-telhas", filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ unidade: filialAtiva, status: "finalizado" }, "-data_finalizacao", 200),
    enabled: !isCD,
    refetchInterval: 15000,
  });

  const { data: ordensMaq = [], isLoading: loadingMaq } = useQuery({
    queryKey: ["expedicao-cd-maq", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva, status: "finalizado" }, "-data_finalizacao", 200),
    enabled: isCD,
    refetchInterval: 15000,
  });

  const { data: ordensDesb = [], isLoading: loadingDesb } = useQuery({
    queryKey: ["expedicao-cd-desb", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva, status: "finalizado" }, "-data_finalizacao", 200),
    enabled: isCD,
    refetchInterval: 15000,
  });

  const itens = useMemo(() => {
    let all = [];
    if (!isCD) {
      all = pedidosTelhas.map(p => ({ ...p, _tipo: "pedido", _label: p.produto || "Telha" }));
    } else {
      all = [
        ...ordensMaq.map(o => ({ ...o, _tipo: "ordem_maquina", _label: o.tipo_peca || o.maquina || "Peça CD" })),
        ...ordensDesb.map(o => ({ ...o, _tipo: "ordem_desb", _label: o.destino === "pedido_direto" ? "Chapa p/ Cliente" : "Chapa p/ Estoque" })),
      ];
    }
    if (busca.trim()) {
      const q = busca.toLowerCase().trim();
      all = all.filter(i => (i.numero_pedido || "").toLowerCase().includes(q) || (i.cliente || "").toLowerCase().includes(q));
    }
    return all;
  }, [pedidosTelhas, ordensMaq, ordensDesb, isCD, busca]);

  const isLoading = loadingTelhas || loadingMaq || loadingDesb;

  const expedidos = itens.filter(i => i.status_expedicao === "em_transito" || i.status_expedicao === "expedido");
  const aguardando = itens.filter(i => !i.status_expedicao || i.status_expedicao === "aguardando" || i.status_expedicao === "carregado");

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por pedido ou cliente..."
            className="h-9 pl-8 pr-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-64"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Badge variant="secondary" className="gap-1">
          <Package className="w-3.5 h-3.5" /> {aguardando.length} no pátio
        </Badge>
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1">
          <Truck className="w-3.5 h-3.5" /> {expedidos.length} em trânsito
        </Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
      ) : aguardando.length === 0 && expedidos.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
          Nenhuma OP finalizada aguardando expedição
        </div>
      ) : (
        <div className="space-y-6">
          {/* No pátio */}
          {aguardando.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> No Pátio — Aguardando Carga
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {aguardando.map(item => (
                  <button key={item.id} onClick={() => { setSelectedItem(item); setSelectedTipo(item._tipo); }}
                    className="text-left bg-card border border-border rounded-lg p-3 hover:border-primary/50 hover:shadow transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">{item.numero_pedido || "—"}</span>
                      {item.status_expedicao === "carregado" && <Badge className="text-xs bg-amber-100 text-amber-700 border-amber-200">Carregado</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{item.cliente || "—"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <Badge variant="secondary" className="text-xs">{item._label}</Badge>
                      {item.quantidade != null && <span className="text-xs text-muted-foreground">{item.quantidade} pç</span>}
                    </div>
                    {item.data_finalizacao && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {format(new Date(item.data_finalizacao + "T12:00:00"), "dd/MM", { locale: ptBR })}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Em trânsito */}
          {expedidos.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Truck className="w-4 h-4 text-blue-500" /> Em Trânsito / Expedido
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {expedidos.map(item => (
                  <button key={item.id} onClick={() => { setSelectedItem(item); setSelectedTipo(item._tipo); }}
                    className="text-left bg-blue-50 border border-blue-200 rounded-lg p-3 hover:shadow transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-blue-800">{item.numero_pedido || "—"}</span>
                      <Badge className="text-xs bg-blue-500 text-white">🚚 {item.status_expedicao === "em_transito" ? "Em Trânsito" : "Expedido"}</Badge>
                    </div>
                    <p className="text-xs text-blue-600 truncate">{item.cliente || "—"}</p>
                    {item.motorista_nome && (
                      <p className="text-xs text-blue-700 mt-1 font-medium flex items-center gap-1">
                        <Truck className="w-3 h-3" /> Motorista: {item.motorista_nome}
                      </p>
                    )}
                    {item.foto_carregamento_url && (
                      <img src={item.foto_carregamento_url} alt="Carregamento" className="w-full h-16 object-cover rounded mt-1.5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AuditSidebar open={!!selectedItem} onClose={() => setSelectedItem(null)} item={selectedItem} tipo={selectedTipo} />
    </div>
  );
}