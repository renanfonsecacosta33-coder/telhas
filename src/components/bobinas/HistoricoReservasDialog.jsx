import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Lock, 
  Search, 
  Clock, 
  User, 
  Calendar, 
  FileText, 
  AlertCircle,
  CheckCircle2,
  Filter,
  History,
  Layers,
  ArrowUpDown
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

function formatarDataHora(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return isoString;
  }
}

function formatarData(dataStr) {
  if (!dataStr) return "—";
  if (dataStr.includes("T")) return formatarDataHora(dataStr);
  const parts = dataStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dataStr;
}

export default function HistoricoReservasDialog({ open, onOpenChange, setorFiltro = "todos" }) {
  const [busca, setBusca] = useState("");
  const [filtroSetor, setFiltroSetor] = useState(setorFiltro || "todos");

  // Busca bobinas reservadas
  const { data: bobinas = [], isLoading: loadingBobinas } = useQuery({
    queryKey: ["historico-reservas-bobinas"],
    queryFn: async () => {
      return base44.entities.Bobina.filter({ reservada: true }, "-updated_date", 500);
    },
    enabled: open
  });

  // Combina e filtra os dados
  const listaReservas = useMemo(() => {
    let list = bobinas.map(b => {
      // Determina o timestamp mais fidedigno de quando a reserva foi feita
      const dataHoraExata = b.reserva_data_hora || b.updated_date || b.created_date;
      return {
        id: b.id,
        codigo: b.codigo || "S/CÓD",
        setor: b.setor || "telhas",
        unidade: b.unidade || "Matriz AJL",
        cor: b.cor,
        chapa: b.chapa,
        peso_kg: b.peso_kg,
        reserva_tipo: b.reserva_tipo || "inteira",
        reserva_kg: b.reserva_kg,
        reserva_motivo: b.reserva_motivo || "Não especificado",
        reserva_autorizado_por: b.reserva_autorizado_por || "Não informado",
        reserva_numero_pedido: b.reserva_numero_pedido || null,
        reserva_data: b.reserva_data,
        data_hora_registro: dataHoraExata,
        usuario_registro: b.reserva_usuario || b.created_by || "Sistema",
        reservada_ativa: b.reservada
      };
    });

    if (filtroSetor !== "todos") {
      list = list.filter(item => item.setor === filtroSetor);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(item => 
        (item.codigo && item.codigo.toLowerCase().includes(q)) ||
        (item.reserva_motivo && item.reserva_motivo.toLowerCase().includes(q)) ||
        (item.reserva_autorizado_por && item.reserva_autorizado_por.toLowerCase().includes(q)) ||
        (item.reserva_numero_pedido && item.reserva_numero_pedido.toLowerCase().includes(q)) ||
        (item.reserva_data && item.reserva_data.includes(q))
      );
    }

    // Ordena pelo timestamp mais recente
    list.sort((a, b) => {
      const timeA = new Date(a.data_hora_registro || a.reserva_data || 0).getTime();
      const timeB = new Date(b.data_hora_registro || b.reserva_data || 0).getTime();
      return timeB - timeA;
    });

    return list;
  }, [bobinas, filtroSetor, busca]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center">
                <History className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  Histórico de Reservas de Bobinas
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 font-medium">
                    {listaReservas.length} reserva(s)
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Auditoria com data, horário exato do sistema (timestamp) e responsável por cada reserva.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-wrap items-center gap-2 mt-4">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por código (ex: CD0157), motivo, pedido ou autorizador..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant={filtroSetor === "todos" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroSetor("todos")}
                className="h-9 text-xs"
              >
                Todos
              </Button>
              <Button
                variant={filtroSetor === "telhas" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroSetor("telhas")}
                className="h-9 text-xs"
              >
                Telhas
              </Button>
              <Button
                variant={filtroSetor === "corte_dobra" ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltroSetor("corte_dobra")}
                className="h-9 text-xs"
              >
                Corte & Dobra
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Lista de Reservas com Auditoria */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loadingBobinas ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-8 h-8 border-4 border-muted border-t-purple-600 rounded-full animate-spin mb-3" />
              <p className="text-xs">Carregando histórico de reservas e dados de auditoria...</p>
            </div>
          ) : listaReservas.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-border rounded-xl p-6">
              <Lock className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
              <p className="font-semibold text-sm text-foreground">Nenhuma reserva encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                {busca ? "Tente alterar os termos da busca." : "Nenhuma bobina está com reserva registrada no momento."}
              </p>
            </div>
          ) : (
            listaReservas.map(item => (
              <div
                key={item.id}
                className="bg-card border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 shadow-sm hover:shadow-md transition-all space-y-3"
              >
                {/* Linha superior: Código, Tipo de reserva, Data e Hora Exata */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-base text-purple-700 dark:text-purple-400">
                      {item.codigo}
                    </span>
                    <Badge variant="outline" className="text-[11px] font-semibold border-purple-300 text-purple-700 bg-purple-50 dark:bg-purple-950/40">
                      <Lock className="w-3 h-3 mr-1 inline" />
                      {item.reserva_tipo === "inteira" ? "Bobina Inteira" : `Parcial (${item.reserva_kg} kg)`}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {item.setor === "corte_dobra" ? "Corte & Dobra" : "Telhas"} · {item.unidade}
                    </Badge>
                    {item.chapa && (
                      <span className="text-xs text-muted-foreground">
                        Chapa: <strong>{item.chapa} mm</strong>
                      </span>
                    )}
                    {item.peso_kg > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Peso: <strong>{item.peso_kg.toLocaleString("pt-BR")} kg</strong>
                      </span>
                    )}
                  </div>

                  {/* Carimbo de Data/Hora Exata de Auditoria */}
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60">
                    <Clock className="w-3.5 h-3.5 text-purple-600" />
                    <span className="font-medium text-foreground">
                      Carimbo do Sistema:
                    </span>
                    <span className="font-semibold text-purple-800 dark:text-purple-300">
                      {formatarDataHora(item.data_hora_registro)}
                    </span>
                  </div>
                </div>

                {/* Detalhes da Reserva */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-purple-50/50 dark:bg-purple-950/20 p-3 rounded-lg border border-purple-100 dark:border-purple-900/30">
                  <div>
                    <span className="text-muted-foreground block font-medium">Motivo / Cliente:</span>
                    <span className="font-semibold text-foreground break-words">{item.reserva_motivo}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Autorizado por:</span>
                    <span className="font-semibold text-foreground">{item.reserva_autorizado_por}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Nº Pedido:</span>
                    <span className="font-semibold text-foreground">{item.reserva_numero_pedido || "Não vinculado"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Data Declarada:</span>
                    <span className="font-semibold text-foreground">{formatarData(item.reserva_data)}</span>
                  </div>
                </div>

                {/* Rodapé: Usuário que registrou no banco */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-muted-foreground" />
                    <span>Cadastrado por: <strong className="text-foreground">{item.usuario_registro}</strong></span>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    ID: {item.id}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
