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
      try {
        const [logsPorId, logsPorCod, logsRecentes] = await Promise.all([
          base44.entities.AuditLog.filter({ registro_id: bobina.id }, "-created_date", 100).catch(() => []),
          bobina.codigo ? base44.entities.AuditLog.filter({ registro_identificador: bobina.codigo }, "-created_date", 100).catch(() => []) : [],
          base44.entities.AuditLog.list("-created_date", 300).catch(() => [])
        ]);

        const map = new Map();
        [...logsPorId, ...logsPorCod, ...logsRecentes].forEach(l => {
          if (!l || !l.id) return;
          const match = (l.registro_id && l.registro_id === bobina.id) ||
            (l.registro_identificador && l.registro_identificador.toUpperCase() === (bobina.codigo || "").toUpperCase()) ||
            (l.detalhes && l.detalhes.toUpperCase().includes((bobina.codigo || "").toUpperCase()));
          if (match) {
            map.set(l.id, l);
          }
        });
        return Array.from(map.values());
      } catch (err) {
        console.warn("Erro ao buscar logs da timeline:", err);
        return [];
      }
    },
    enabled: open && !!bobina.id
  });

  // Busca pedidos de Telhas que usaram essa bobina
  const { data: pedidosTelhas = [] } = useQuery({
    queryKey: ["timeline-pedidos-telhas", bobina.id, bobina.codigo],
    queryFn: async () => {
      try {
        const [porSup, porInf, recentes] = await Promise.all([
          base44.entities.Pedido.filter({ bobina_superior_id: bobina.id }, "-data", 100).catch(() => []),
          base44.entities.Pedido.filter({ bobina_inferior_id: bobina.id }, "-data", 100).catch(() => []),
          base44.entities.Pedido.list("-data", 300).catch(() => [])
        ]);

        const map = new Map();
        [...porSup, ...porInf, ...recentes].forEach(p => {
          if (!p || !p.id) return;
          const matchSup = p.bobina_superior_id === bobina.id || (bobina.codigo && p.bobina_superior && String(p.bobina_superior).includes(bobina.codigo));
          const matchInf = p.bobina_inferior_id === bobina.id || (bobina.codigo && p.bobina_inferior && String(p.bobina_inferior).includes(bobina.codigo));
          const matchSec = p.bobina_secundaria_id === bobina.id || p.bobina_id === bobina.id;
          const matchVar = p.variacoes_telhas && (p.variacoes_telhas.includes(bobina.id) || (bobina.codigo && p.variacoes_telhas.includes(bobina.codigo)));

          if (matchSup || matchInf || matchSec || matchVar) {
            map.set(p.id, {
              ...p,
              _posicao: matchSup ? "Superior" : (matchInf ? "Inferior" : "Telhas"),
            });
          }
        });

        return Array.from(map.values());
      } catch (e) {
        console.warn("Erro ao buscar pedidos da bobina na timeline:", e);
        return [];
      }
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

    // 2. Evento de alteração/ajuste no servidor (detecta edições anteriores ao AuditLog ou diretas no banco)
    if (bobina.updated_date && bobina.created_date) {
      const createdMs = new Date(bobina.created_date).getTime();
      const updatedMs = new Date(bobina.updated_date).getTime();
      // Mais de 15 segundos de diferença indica alteração posterior à criação
      if (updatedMs - createdMs > 15000) {
        // Verifica se já existe um log de auditoria explícito próximo ao updated_date
        const temLogAudit = logs.some(l => {
          const logMs = new Date(l.data_hora || l.created_date || 0).getTime();
          return Math.abs(logMs - updatedMs) < 60000;
        });

        if (!temLogAudit) {
          const pesoMudou = bobina.peso_inicial && bobina.peso_kg && Number(bobina.peso_inicial) !== Number(bobina.peso_kg);
          const dif = pesoMudou ? Number(bobina.peso_kg) - Number(bobina.peso_inicial) : 0;
          
          let detalhesModificacao = "Bobina atualizada e dados salvos no sistema.";
          if (pesoMudou) {
            detalhesModificacao = `Peso alterado de ${Number(bobina.peso_inicial).toLocaleString("pt-BR")} kg para ${Number(bobina.peso_kg).toLocaleString("pt-BR")} kg (ajuste/consumo direto de ${dif > 0 ? `+${dif.toLocaleString("pt-BR")}` : dif.toLocaleString("pt-BR")} kg).`;
          }
          if (bobina.observacoes) {
            detalhesModificacao += ` Observação: "${bobina.observacoes}".`;
          }

          lista.push({
            tipo: "EDICAO",
            titulo: pesoMudou ? "Ajuste Manual de Peso / Alteração Cadastral" : "Alteração de Cadastro",
            data_hora: bobina.updated_date,
            usuario: bobina.updated_by || bobina.last_modified_by || bobina.created_by || "Operador / Sistema",
            icone: History,
            cor: "text-amber-700 bg-amber-100 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300",
            detalhes: detalhesModificacao
          });
        }
      }
    }

    // 3. Evento de reserva (se reservada)
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

    // 4. Evento de arquivamento (se encerrada)
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

    // 5. Logs de auditoria específicos
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

    // 6. Ordens de Produção de Telhas (Pedido)
    pedidosTelhas.forEach(p => {
      const kgUsado = p._posicao === "Inferior" 
        ? (p.kg_inferior || (p.kg_total ? p.kg_total / 2 : 0))
        : (p.kg_superior || p.kg_total || 0);

      const metrosUsado = p.metros || p.quantidade_telhas || 0;
      const statusLabel = p.status ? String(p.status).toUpperCase() : "PRODUÇÃO";

      lista.push({
        tipo: "PRODUCAO",
        titulo: `Produção de Telhas · Pedido #${p.numero_pedido || p.id?.slice(-5)}`,
        data_hora: p.data_producao || p.updated_date || (p.data ? `${p.data}T12:00:00Z` : p.created_date),
        usuario: p.operador_nome || p.usuario_nome || p.created_by || "Operador",
        icone: Factory,
        cor: "text-emerald-700 bg-emerald-50 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
        detalhes: `Cliente: ${p.cliente || 'Consumidor'} · Produto: ${p.produto || 'Telha'} (${p._posicao || 'Telhas'}). Consumo: ${Number(kgUsado).toLocaleString("pt-BR")} kg (${metrosUsado} m/peças). Máquina: ${p.maquina || 'TP-40'} · Status: ${statusLabel}.`
      });
    });

    // 7. Ordens de Desbobinadeira
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

    // 8. Ordens de Corte e Dobra
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
  }, [bobina, logs, pedidosTelhas, ordensDesbob, ordensCD]);

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
              Peso Atual: <strong className="text-primary">{Number(bobina.peso_kg || 0).toLocaleString("pt-BR")} kg</strong>
            </span>
            {bobina.peso_inicial && (
              <span className="bg-background border border-border px-2 py-1 rounded text-muted-foreground">
                Peso Inicial: <strong>{Number(bobina.peso_inicial).toLocaleString("pt-BR")} kg</strong>
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
            {bobina.created_date && (
              <span className="bg-muted/40 border border-border px-2 py-1 rounded text-[11px] text-muted-foreground">
                Cadastrada em: <strong>{formatarDataHora(bobina.created_date)}</strong> {bobina.created_by ? `(${bobina.created_by})` : ''}
              </span>
            )}
            {bobina.updated_date && bobina.updated_date !== bobina.created_date && (
              <span className="bg-amber-500/10 text-amber-900 dark:text-amber-300 border border-amber-300 dark:border-amber-700 px-2 py-1 rounded text-[11px]">
                Última Alteração: <strong>{formatarDataHora(bobina.updated_date)}</strong> {bobina.updated_by || bobina.last_modified_by ? `(${bobina.updated_by || bobina.last_modified_by})` : ''}
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
