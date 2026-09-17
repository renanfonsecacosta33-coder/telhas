import React, { useState, useMemo } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import KanbanCard from "./KanbanCard";
import { Search, Filter, Layers, CheckCircle2, Clock, Truck, PlayCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const COLUNAS = [
  {
    id: "pendente",
    titulo: "Aguardando / Pendente",
    icon: Clock,
    badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    headerBg: "bg-amber-500/10 border-amber-500/20",
    statusList: ["pendente", "aguardando_material"]
  },
  {
    id: "em_producao",
    titulo: "Em Produção",
    icon: PlayCircle,
    badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
    headerBg: "bg-blue-500/10 border-blue-500/20",
    statusList: ["em_producao", "pausado"]
  },
  {
    id: "finalizado",
    titulo: "Finalizado / Pronto",
    icon: CheckCircle2,
    badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
    headerBg: "bg-emerald-500/10 border-emerald-500/20",
    statusList: ["finalizado"]
  },
  {
    id: "expedido",
    titulo: "Expedido / Rota",
    icon: Truck,
    badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
    headerBg: "bg-purple-500/10 border-purple-500/20",
    statusList: ["expedido", "carregado", "em_transito"]
  }
];

export default function KanbanBoard({
  itens = [],
  tipoSetor = "corte_dobra",
  onStatusChange,
  onOpenDetails
}) {
  const [busca, setBusca] = useState("");
  const [filtroMaquina, setFiltroMaquina] = useState("todas");

  // Lista única de máquinas presentes nos itens
  const maquinasDisponiveis = useMemo(() => {
    const set = new Set();
    itens.forEach((it) => {
      const m = it.maquina || it.maquina_inicial;
      if (m) set.add(m);
    });
    return Array.from(set).sort();
  }, [itens]);

  // Itens filtrados por busca e máquina
  const itensFiltrados = useMemo(() => {
    return itens.filter((it) => {
      if (filtroMaquina !== "todas") {
        const m = it.maquina || it.maquina_inicial;
        if (m !== filtroMaquina) return false;
      }
      if (busca.trim()) {
        const q = busca.toLowerCase().trim();
        const num = String(it.numero_pedido || "").toLowerCase();
        const cli = String(it.cliente || "").toLowerCase();
        const prod = String(it.produto || it.tipo_peca || "").toLowerCase();
        return num.includes(q) || cli.includes(q) || prod.includes(q);
      }
      return true;
    });
  }, [itens, filtroMaquina, busca]);

  // Agrupamento por coluna
  const itensPorColuna = useMemo(() => {
    const mapa = {
      pendente: [],
      em_producao: [],
      finalizado: [],
      expedido: []
    };

    itensFiltrados.forEach((it) => {
      const st = (it.status || "pendente").toLowerCase();
      if (st === "em_producao" || st === "pausado") {
        mapa.em_producao.push(it);
      } else if (st === "finalizado") {
        mapa.finalizado.push(it);
      } else if (st === "expedido" || st === "carregado" || st === "em_transito") {
        mapa.expedido.push(it);
      } else {
        mapa.pendente.push(it);
      }
    });

    return mapa;
  }, [itensFiltrados]);

  const handleDragEnd = (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    const itemEncontrado = itens.find(it => String(it.id) === String(draggableId));
    if (itemEncontrado && onStatusChange) {
      onStatusChange(itemEncontrado, destination.droppableId);
    }
  };

  return (
    <div className="space-y-4 font-sans">
      {/* Barra de Filtros do Kanban */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Máquina:
          </span>
          <button
            onClick={() => setFiltroMaquina("todas")}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              filtroMaquina === "todas"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Todas ({itens.length})
          </button>
          {maquinasDisponiveis.map((m) => (
            <button
              key={m}
              onClick={() => setFiltroMaquina(m)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                filtroMaquina === m
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar pedido, cliente..."
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      {/* Board com 4 Colunas */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-start">
          {COLUNAS.map((col) => {
            const Icone = col.icon;
            const listaCards = itensPorColuna[col.id] || [];

            return (
              <div
                key={col.id}
                className="bg-muted/30 border border-border/80 rounded-2xl p-3 flex flex-col min-h-[500px]"
              >
                {/* Cabeçalho da Coluna */}
                <div className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border mb-3 ${col.headerBg}`}>
                  <div className="flex items-center gap-2">
                    <Icone className="w-4 h-4 text-foreground" />
                    <span className="text-xs font-bold text-foreground">
                      {col.titulo}
                    </span>
                  </div>
                  <Badge className={`text-[10px] font-bold ${col.badgeColor}`}>
                    {listaCards.length}
                  </Badge>
                </div>

                {/* Área de Drops */}
                <Droppable droppableId={col.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-2.5 rounded-xl transition-colors p-1 ${
                        snapshot.isDraggingOver ? "bg-primary/5 ring-2 ring-primary/20" : ""
                      }`}
                    >
                      {listaCards.length === 0 ? (
                        <div className="h-32 flex flex-col items-center justify-center text-center p-3 text-muted-foreground/60 border-2 border-dashed border-border/50 rounded-xl">
                          <span className="text-xs">Nenhum item</span>
                        </div>
                      ) : (
                        listaCards.map((it, idx) => (
                          <Draggable key={String(it.id)} draggableId={String(it.id)} index={idx}>
                            {(prov, snap) => (
                              <KanbanCard
                                item={it}
                                tipoSetor={tipoSetor}
                                onStatusChange={onStatusChange}
                                onOpenDetails={onOpenDetails}
                                provided={prov}
                                isDragging={snap.isDragging}
                              />
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
    </div>
  );
}
