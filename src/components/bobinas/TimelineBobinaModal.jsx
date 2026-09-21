import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Clock, 
  Calendar, 
  User, 
  Package, 
  Lock, 
  History, 
  ArrowRightLeft, 
  Activity, 
  CheckCircle2, 
  Archive, 
  FileText,
  AlertTriangle,
  Factory,
  Building2,
  X
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

export default function TimelineBobinaModal({ open, onClose, bobina }) {
  if (!bobina) return null;

  // Busca logs de auditoria no banco para esta bobina
  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["timeline-logs", bobina.id, bobina.codigo],
    queryFn: async () => {
      const allLogs = await base44.entities.AuditLog.list("-created_date", 500);
      return allLogs.filter(l => 
        (l.registro_id && l.registro_id === bobina.id) ||
        (l.registro_identificador && l.registro_identificador.toUpperCase() === (bobina.codigo || "").toUpperCase()) ||
        (l.detalhes && l.detalhes.toUpperCase().includes((bobina.codigo || "").toUpperCase()))
      );
    },
    enabled: open && !!bobina.id
  });

  // Busca ordens de desbobinadeira que usaram essa bobina
  const { data: ordensDesbob = [] } = useQuery({
    queryKey: ["timeline-ordens-desbob", bobina.id],
    queryFn: async () => {
      return base44.entities.OrdemDesbobinadeira.filter({ bobina_id: bobina.id }, "-created_date", 50);
    },
    enabled: open && !!bobina.id
  });

  // Busca ordens de máquina CD que usaram essa bobina
  const { data: ordensCD = [] } = useQuery({
    queryKey: ["timeline-ordens-cd", bobina.id],
    queryFn: async () => {
      return base44.entities.OrdemMaquinaCD.filter({ bobina_id: bobina.id }, "-created_date", 50);
    },
    enabled: open && !!bobina.id
  });

  // Monta a lista unificada de eventos em ordem cronológica decrescente
  const eventos = useMemo(() => {
    const lista = [];

    // 1. Evento de criação no estoque
    if (bobina.created_date) {
      lista.push({
        tipo: "CRIACAO",
        titulo: "Entrada da Bobina no Estoque",
        data_hora: bobina.created_date,
        usuario: bobina.created_by || "Sistema",
        icone: Package,
        cor: "text-emerald-600 bg-emerald-100 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
        detalhes: `Bobina cadastrada no estoque com ${Number(bobina.peso_inicial || bobina.peso_kg || 0).toLocaleString("pt-BR")} kg. Chapa: ${bobina.chapa || "—"} mm, Qualidade: ${bobina.qualidade || "GV"}, Cor: ${bobina.cor || "Sem cor"}, NF: ${bobina.nf || "Não informada"}, Fornecedor: ${bobina.fornecedor || "Não informado"}.`
      });
    }

    // 2. Evento de reserva (se reservada)
    if (bobina.reservada) {
      const dataHoraReserva = bobina.reserva_data_hora || (bobina.reserva_data ? `${bobina.reserva_data}T12:00:00Z` : bobina.updated_date);
      lista.push({
        tipo: "RESERVA",
        titulo: `Reserva Efetuada (${bobina.reserva_tipo === "inteira" ? "Bobina Inteira" : `Parcial ${bobina.reserva_kg} kg`})`,
        data_hora: dataHoraReserva,
        usuario: bobina.reserva_usuario || bobina.reserva_autorizado_por || bobina.created_by || "Operador",
        icone: Lock,
        cor: "text-purple-600 bg-purple-100 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
        detalhes: `Reserva registrada no sistema. Motivo: "${bobina.reserva_motivo || 'N/A'}". Autorizado por: ${bobina.reserva_autorizado_por || 'N/A'}${bobina.reserva_numero_pedido ? ` · Pedido: ${bobina.reserva_numero_pedido}` : ''}.`
      });
    }

    // 3. Evento de arquivamento (se encerrada)
    if (bobina.arquivada) {
      lista.push({
        tipo: "ARQUIVAMENTO",
        titulo: "Bobina Arquivada / Finalizada",
        data_hora: bobina.data_encerramento ? `${bobina.data_encerramento}T18:00:00Z` : bobina.updated_date,
        usuario: "Sistema / Operador",
        icone: Archive,
        cor: "text-gray-600 bg-gray-100 border-gray-300 dark:bg-gray-800 dark:text-gray-300",
        detalhes: "Bobina finalizada e movida para o histórico de arquivadas."
      });
    }

    // 4. Logs de auditoria específicos
    logs.forEach(l => {
      lista.push({
        tipo: "AUDITORIA",
        titulo: `Ação no Sistema: ${l.acao.toUpperCase()}`,
        data_hora: l.data_hora || l.created_date,
        usuario: `${l.usuario_nome || l.usuario_email || 'Usuário'} (${l.usuario_role || 'operador'})`,
        icone: Activity,
        cor: "text-blue-600 bg-blue-100 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300",
        detalhes: l.detalhes || "Registro de auditoria efetuado."
      });
    });

    // 5. Ordens de Desbobinadeira
    ordensDesbob.forEach(o => {
      lista.push({
        tipo: "PRODUCAO",
        titulo: `Produção na Desbobinadeira · OP ${o.numero_ordem || o.codigo || o.id.slice(-4)}`,
        data_hora: o.created_date || (o.data ? `${o.data}T12:00:00Z` : null),
        usuario: o.operador_nome || "Operador",
        icone: Factory,
        cor: "text-amber-600 bg-amber-100 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
        detalhes: `Corte/consumo de ${Number(o.peso_gasto_kg || o.peso_kg || 0).toLocaleString("pt-BR")} kg (${o.metragem_cortada_m || o.metragem || 0} m). Status: ${o.status || 'finalizada'}.`
      });
    });

    // 6. Ordens de Corte e Dobra
    ordensCD.forEach(o => {
      lista.push({
        tipo: "PRODUCAO",
        titulo: `Corte e Dobra · Máquina ${o.maquina || 'CD'}`,
        data_hora: o.created_date || (o.data ? `${o.data}T12:00:00Z` : null),
        usuario: o.operador_nome || "Operador",
        icone: Factory,
        cor: "text-orange-600 bg-orange-100 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300",
        detalhes: `Consumo de ${Number(o.peso_utilizado_kg || o.peso_kg || 0).toLocaleString("pt-BR")} kg na produção de ${o.produto_nome || o.descricao || 'peças CD'}.`
      });
    });

    // Ordenar pelo horário mais recente primeiro
    lista.sort((a, b) => {
      const timeA = new Date(a.data_hora || 0).getTime();
      const timeB = new Date(b.data_hora || 0).getTime();
      return timeB - timeA;
    });

    return lista;
  }, [bobina, logs, ordensDesbob, ordensCD]);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                <History className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  Histórico e Auditoria: {bobina.codigo}
                  {bobina.reservada && (
                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-[10px]">
                      <Lock className="w-2.5 h-2.5 mr-1" /> Reservada
                    </Badge>
                  )}
                  {bobina.arquivada && (
                    <Badge variant="secondary" className="text-[10px]">
                      Arquivada
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Linha do tempo com data, horário e usuário de cada registro e alteração desta bobina.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Dados rápidos da bobina */}
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60 text-xs">
            <span className="bg-background border border-border px-2 py-1 rounded">
              Chapa: <strong>{bobina.chapa} mm</strong>
            </span>
            <span className="bg-background border border-border px-2 py-1 rounded">
              Peso Atual: <strong>{Number(bobina.peso_kg || 0).toLocaleString("pt-BR")} kg</strong>
            </span>
            {bobina.peso_inicial && (
              <span className="bg-background border border-border px-2 py-1 rounded text-muted-foreground">
                Peso Inicial: {Number(bobina.peso_inicial).toLocaleString("pt-BR")} kg
              </span>
            )}
            <span className="bg-background border border-border px-2 py-1 rounded">
              Filial: <strong>{bobina.unidade || "Matriz AJL"}</strong>
            </span>
            {bobina.nf && (
              <span className="bg-background border border-border px-2 py-1 rounded">
                NF: <strong>{bobina.nf}</strong>
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Linha do tempo visual */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loadingLogs ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <div className="w-8 h-8 border-4 border-muted border-t-purple-600 rounded-full animate-spin mb-2" />
              <p className="text-xs">Carregando histórico do servidor...</p>
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              Nenhum evento histórico encontrado para esta bobina.
            </div>
          ) : (
            <div className="relative border-l-2 border-purple-200 dark:border-purple-900 ml-4 space-y-6">
              {eventos.map((ev, idx) => {
                const IconComponent = ev.icone || Clock;
                return (
                  <div key={idx} className="relative pl-6">
                    {/* Marcador do ponto na linha do tempo */}
                    <div className={`absolute -left-[17px] top-0.5 w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-sm ${ev.cor}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>

                    <div className="bg-card border border-border rounded-xl p-3.5 shadow-sm space-y-1.5">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-bold text-xs text-foreground">
                          {ev.titulo}
                        </span>
                        <span className="text-[11px] font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                          <Clock className="w-3 h-3" />
                          {formatarDataHora(ev.data_hora)}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {ev.detalhes}
                      </p>

                      <div className="flex items-center gap-1.5 pt-1 text-[11px] text-muted-foreground border-t border-border/40">
                        <User className="w-3 h-3 text-muted-foreground" />
                        <span>Responsável: <strong className="text-foreground">{ev.usuario}</strong></span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
