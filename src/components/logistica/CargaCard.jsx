import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Truck, Plus, Trash2, CheckCircle2, Package, Loader2, X, Search } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import CarregamentoDialog from "@/components/logistica/CarregamentoDialog";

export default function CargaCard({ carga, pedidosDisponiveis, onSelectItem, mode = "montagem" }) {
  const isDespacho = mode === "despacho";
  const [showLink, setShowLink] = useState(false);
  const [busca, setBusca] = useState("");
  const [carregamentoItem, setCarregamentoItem] = useState(null);
  const [carregamentoTipo, setCarregamentoTipo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const queryClient = useQueryClient();

  const pedidosVinculados = useMemo(() => {
    if (!carga.pedidos_json) return [];
    try {
      return JSON.parse(carga.pedidos_json);
    } catch {
      return [];
    }
  }, [carga.pedidos_json]);

  const pedidosFiltrados = useMemo(() => {
    if (!busca.trim()) return pedidosDisponiveis;
    const q = busca.toLowerCase().trim();
    return pedidosDisponiveis.filter(p => (p.numero_pedido || "").toLowerCase().includes(q) || (p.cliente || "").toLowerCase().includes(q));
  }, [pedidosDisponiveis, busca]);

  const isCarregado = (p) => p.status_expedicao === "carregado" || p.status_expedicao === "em_transito" || p.status_expedicao === "expedido";

  const todosCarregados = pedidosVinculados.length > 0 && pedidosVinculados.every(p => isCarregado(p));

  const vincularMutation = useMutation({
    mutationFn: async (pedido) => {
      const novos = [...pedidosVinculados, { tipo: pedido._tipo, id: pedido.id, numero_pedido: pedido.numero_pedido, cliente: pedido.cliente }];
      const hist = carga.historico ? JSON.parse(carga.historico) : [];
      let usuario = "Logística";
      try {
        const user = await base44.auth.me();
        if (user?.full_name) usuario = user.full_name;
      } catch {}
      hist.push({ data: new Date().toISOString(), usuario, acao: "Pedido vinculado à carga", detalhes: `Pedido ${pedido.numero_pedido || "—"}` });

      await base44.entities.Carga.update(carga.id, {
        pedidos_json: JSON.stringify(novos),
        historico: JSON.stringify(hist),
      });

      // Atualizar o pedido/ordem com carga_id
      const entityName = pedido._tipo === "pedido" ? "Pedido" : pedido._tipo === "ordem_maquina" ? "OrdemMaquinaCD" : "OrdemDesbobinadeira";
      const histExp = pedido.historico_expedicao ? JSON.parse(pedido.historico_expedicao) : [];
      histExp.push({ data: new Date().toISOString(), usuario, acao: "Vinculado ao Caminhão", detalhes: `Motorista: ${carga.motorista_nome} · Placa: ${carga.placa || "—"}` });
      await base44.entities[entityName].update(pedido.id, {
        carga_id: carga.id,
        motorista_nome: carga.motorista_nome,
        historico_expedicao: JSON.stringify(histExp),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-cd"] });
    },
  });

  const desvincularMutation = useMutation({
    mutationFn: async (pedido) => {
      const novos = pedidosVinculados.filter(p => p.id !== pedido.id);
      await base44.entities.Carga.update(carga.id, { pedidos_json: JSON.stringify(novos) });
      const entityName = pedido.tipo === "pedido" ? "Pedido" : pedido.tipo === "ordem_maquina" ? "OrdemMaquinaCD" : "OrdemDesbobinadeira";
      const histExp = pedido.historico_expedicao ? JSON.parse(pedido.historico_expedicao) : [];
      histExp.push({ data: new Date().toISOString(), usuario: "Logística", acao: "Desvinculado do Caminhão", detalhes: "" });
      await base44.entities[entityName].update(pedido.id, {
        carga_id: "",
        motorista_nome: "",
        historico_expedicao: JSON.stringify(histExp),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-cd"] });
    },
  });

  const despacharMutation = useMutation({
    mutationFn: async () => {
      // Marcar todos os pedidos vinculados como em_transito
      for (const p of pedidosVinculados) {
        const entityName = p.tipo === "pedido" ? "Pedido" : p.tipo === "ordem_maquina" ? "OrdemMaquinaCD" : "OrdemDesbobinadeira";
        const histExp = p.historico_expedicao ? JSON.parse(p.historico_expedicao) : [];
        histExp.push({ data: new Date().toISOString(), usuario: "Logística", acao: "Despachado — Em Trânsito", detalhes: `Motorista: ${carga.motorista_nome}` });
        await base44.entities[entityName].update(p.id, {
          status_expedicao: "em_transito",
          historico_expedicao: JSON.stringify(histExp),
        });
      }
      // Atualizar carga
      const hist = carga.historico ? JSON.parse(carga.historico) : [];
      hist.push({ data: new Date().toISOString(), usuario: "Logística", acao: "Caminhão despachado", detalhes: "" });
      await base44.entities.Carga.update(carga.id, {
        status: "em_transito",
        data_saida: new Date().toISOString(),
        historico: JSON.stringify(hist),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-cd"] });
    },
  });

  const handleCarregar = (pedido) => {
    // Encontrar o pedido completo nos disponíveis
    const fullPedido = pedidosDisponiveis.find(p => p.id === pedido.id) || pedido;
    setCarregamentoItem(fullPedido);
    setCarregamentoTipo(pedido.tipo || fullPedido._tipo);
  };

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Desvincular todos os pedidos da carga antes de excluir
      for (const p of pedidosVinculados) {
        const entityName = p.tipo === "pedido" ? "Pedido" : p.tipo === "ordem_maquina" ? "OrdemMaquinaCD" : "OrdemDesbobinadeira";
        try {
          await base44.entities[entityName].update(p.id, {
            carga_id: "",
            motorista_nome: "",
          });
        } catch {}
      }
      await base44.entities.Carga.delete(carga.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-cd"] });
      queryClient.invalidateQueries({ queryKey: ["expedicao-telhas"] });
      queryClient.invalidateQueries({ queryKey: ["expedicao-cd-maq"] });
      setConfirmDelete(false);
    },
  });

  return (
    <div className={`bg-card border-2 rounded-xl overflow-hidden ${carga.status === "em_transito" ? "border-blue-300" : "border-border"}`}>
      {/* Header da carga */}
      <div className={`px-4 py-3 flex items-center justify-between ${carga.status === "em_transito" ? "bg-blue-50" : "bg-muted/50"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${carga.status === "em_transito" ? "bg-blue-500" : "bg-primary"}`}>
            <Truck className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">{carga.motorista_nome}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {carga.placa && <span className="font-mono">{carga.placa}</span>}
              {carga.transportadora && <span>· {carga.transportadora}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {carga.status === "carregando" ? (
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">Carregando</Badge>
          ) : carga.status === "em_transito" ? (
            <Badge className="bg-blue-500 text-white">🚚 Em Trânsito</Badge>
          ) : (
            <Badge variant="secondary">{carga.status}</Badge>
          )}
          <Badge variant="outline" className="text-xs">{pedidosVinculados.length} pedidos</Badge>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600"
            onClick={() => setConfirmDelete(true)}
            title="Excluir carga"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Pedidos vinculados */}
      <div className="p-4 space-y-2">
        {pedidosVinculados.length === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            <Package className="w-6 h-6 mx-auto mb-1 text-muted-foreground/20" />
            Nenhum pedido vinculado
          </div>
        ) : (
          pedidosVinculados.map((p, i) => {
            const carregado = isCarregado(p);
            return (
              <div key={i} className={`flex items-center justify-between rounded-lg border p-2 ${carregado ? "border-green-300 bg-green-50" : "border-border bg-muted/30"}`}>
                <button className="flex-1 text-left" onClick={() => onSelectItem(p, p.tipo)}>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm">{p.numero_pedido || "—"}</span>
                    <span className="text-xs text-muted-foreground truncate">{p.cliente || ""}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {carregado ? (
                      <Badge className="text-xs bg-green-500 text-white gap-0.5"><CheckCircle2 className="w-3 h-3" /> Carregado</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs">Aguardando foto</Badge>
                    )}
                  </div>
                </button>
                <div className="flex items-center gap-1">
                  {!carregado && carga.status === "carregando" && (
                    <Button size="sm" className="h-7 text-xs bg-blue-500 hover:bg-blue-600 gap-1" onClick={() => handleCarregar(p)}>
                      <Truck className="w-3 h-3" /> Carregar
                    </Button>
                  )}
                  {carga.status === "carregando" && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => desvincularMutation.mutate(p)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* Ações */}
        {carga.status === "carregando" && (
          <div className="flex items-center gap-2 pt-2">
            {!isDespacho && (
            <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => setShowLink(!showLink)}>
              <Plus className="w-3.5 h-3.5" /> Vincular Pedido
            </Button>
            )}
            {pedidosVinculados.length > 0 && (
              <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => {
                if (!todosCarregados) {
                  alert("Todos os pedidos precisam ter a foto de carregamento antes de despachar.");
                  return;
                }
                if (confirm(`Despachar caminhão de ${carga.motorista_nome}?`)) despacharMutation.mutate();
              }}>
                {despacharMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Truck className="w-3.5 h-3.5" />}
                Despachar Caminhão
              </Button>
            )}
          </div>
        )}

        {/* Lista de pedidos disponíveis para vincular */}
        {!isDespacho && showLink && carga.status === "carregando" && (
          <div className="border border-border rounded-lg p-2 space-y-2 bg-muted/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar pedido..."
                className="h-8 pl-7 pr-3 rounded-md border border-input bg-transparent text-xs w-full"
              />
            </div>
            {pedidosFiltrados.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">Nenhum pedido disponível</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1">
                {pedidosFiltrados.slice(0, 20).map(p => (
                  <button key={p.id} onClick={() => vincularMutation.mutate(p)}
                    className="w-full text-left flex items-center justify-between rounded-md border border-border px-2 py-1.5 hover:bg-primary/5 transition-colors">
                    <div>
                      <span className="text-xs font-bold">{p.numero_pedido || "—"}</span>
                      <span className="text-xs text-muted-foreground ml-2">{p.cliente || ""}</span>
                    </div>
                    <Plus className="w-3.5 h-3.5 text-primary" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <CarregamentoDialog
        open={!!carregamentoItem}
        onClose={() => { setCarregamentoItem(null); setCarregamentoTipo(null); }}
        item={carregamentoItem}
        tipo={carregamentoTipo}
        motoristaNome={carga.motorista_nome}
        cargaId={carga.id}
      />

      <AlertDialog open={confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" />
              Excluir Carga
            </AlertDialogTitle>
            <AlertDialogDescription>
              <p>Tem certeza que deseja excluir a carga de <strong>{carga.motorista_nome}</strong>?</p>
              {pedidosVinculados.length > 0 && (
                <p className="mt-2 text-amber-600">
                  ⚠️ {pedidosVinculados.length} pedido(s) vinculado(s) serão desvinculados.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">Esta ação é irreversível.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-1"
            >
              {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}