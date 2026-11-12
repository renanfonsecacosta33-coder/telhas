import React, { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
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
  ArrowLeftRight,
  CheckCircle2,
  AlertTriangle,
  Factory,
  Layers,
  Scissors,
  TrendingDown,
  Building2,
  FileText,
  MessageSquare,
  Scale
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function formatarDataHora(isoString) {
  if (!isoString) return "Data não informada";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return String(isoString);
    return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return String(isoString);
  }
}

export default function TimelineBobinaModal({ open, onClose, bobina }) {
  const bobinaId = bobina?.id;
  const bobinaCodigo = bobina?.codigo;

  // 1. Busca Transferências entre filiais desta bobina
  const { data: transferencias = [] } = useQuery({
    queryKey: ["timeline-transferencias-bobina", bobinaId],
    queryFn: async () => {
      if (!bobinaId) return [];
      try {
        const porId = await base44.entities.Transferencia.filter({ item_id: bobinaId }, "-created_date", 50).catch(() => []);
        return porId || [];
      } catch (err) {
        console.warn("Erro ao buscar transferências da bobina:", err);
        return [];
      }
    },
    enabled: open && !!bobinaId
  });

  // 2. Busca logs de auditoria no banco para esta bobina
  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["timeline-logs", bobinaId, bobinaCodigo],
    queryFn: async () => {
      try {
        const [logsPorId, logsPorCod, logsRecentes] = await Promise.all([
          base44.entities.AuditLog.filter({ registro_id: bobinaId }, "-created_date", 100).catch(() => []),
          bobinaCodigo ? base44.entities.AuditLog.filter({ registro_identificador: bobinaCodigo }, "-created_date", 100).catch(() => []) : [],
          base44.entities.AuditLog.list("-created_date", 200).catch(() => [])
        ]);

        const map = new Map();
        [...logsPorId, ...logsPorCod, ...logsRecentes].forEach((l) => {
          if (!l || !l.id) return;
          const match =
            (l.registro_id && l.registro_id === bobinaId) ||
            (l.registro_identificador && l.registro_identificador.toUpperCase() === (bobinaCodigo || "").toUpperCase()) ||
            (l.detalhes && l.detalhes.toUpperCase().includes((bobinaCodigo || "").toUpperCase()));
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
    enabled: open && !!bobinaId
  });

  // 3. Busca pedidos de Telhas que consumiram essa bobina
  const { data: pedidosTelhas = [] } = useQuery({
    queryKey: ["timeline-pedidos-telhas", bobinaId, bobinaCodigo],
    queryFn: async () => {
      try {
        const [porSup, porInf] = await Promise.all([
          base44.entities.Pedido.filter({ bobina_superior_id: bobinaId }, "-data", 100).catch(() => []),
          base44.entities.Pedido.filter({ bobina_inferior_id: bobinaId }, "-data", 100).catch(() => [])
        ]);

        const map = new Map();
        [...porSup, ...porInf].forEach((p) => {
          if (!p || !p.id) return;
          const matchSup = p.bobina_superior_id === bobinaId;
          const matchInf = p.bobina_inferior_id === bobinaId;
          map.set(p.id, {
            ...p,
            _posicao: matchSup && matchInf ? "Superior + Inferior" : matchSup ? "Superior" : "Inferior"
          });
        });

        return Array.from(map.values());
      } catch (e) {
        console.warn("Erro ao buscar pedidos da bobina na timeline:", e);
        return [];
      }
    },
    enabled: open && !!bobinaId
  });

  // 4. Busca ordens de desbobinadeira que usaram essa bobina
  const { data: ordensDesbob = [] } = useQuery({
    queryKey: ["timeline-ordens-desbob", bobinaId],
    queryFn: async () => {
      return base44.entities.OrdemDesbobinadeira.filter({ bobina_id: bobinaId }, "-created_date", 50).catch(() => []);
    },
    enabled: open && !!bobinaId
  });

  // 5. Busca ordens de máquina CD que usaram essa bobina
  const { data: ordensCD = [] } = useQuery({
    queryKey: ["timeline-ordens-cd", bobinaId],
    queryFn: async () => {
      return base44.entities.OrdemMaquinaCD.filter({ bobina_id: bobinaId }, "-created_date", 50).catch(() => []);
    },
    enabled: open && !!bobinaId
  });

  // 6. Busca reservas de vendedores
  const { data: reservas = [] } = useQuery({
    queryKey: ["timeline-reservas-bobina", bobinaId],
    queryFn: async () => {
      return base44.entities.ReservaBobina.filter({ bobina_id: bobinaId }, "-created_date", 20).catch(() => []);
    },
    enabled: open && !!bobinaId
  });

  // Monta a lista consolidada de eventos
  const { eventos, ultimaTransferencia } = useMemo(() => {
    if (!bobina) return { eventos: [], ultimaTransferencia: null };
    const lista = [];
    let transDestaque = null;

    // A. Transferências registradas
    transferencias.forEach((t) => {
      const dataHora = t.created_date || t.data_avaliacao;
      const statusLabel =
        t.status === "concluida"
          ? "Concluída"
          : t.status === "em_transito"
          ? "Em Trânsito"
          : t.status === "aprovada"
          ? "Aprovada"
          : t.status === "recusada"
          ? "Recusada"
          : "Pendente";

      if (!transDestaque || new Date(dataHora || 0) > new Date(transDestaque.data || 0)) {
        transDestaque = {
          de: t.unidade_origem,
          para: t.unidade_destino,
          usuario: t.solicitante_nome || t.admin_nome || "Operador",
          aprovador: t.admin_nome,
          data: dataHora,
          motivo: t.motivo || t.resposta_admin || "Transferência de bobina entre filiais",
          status: statusLabel
        };
      }

      lista.push({
        tipo: "TRANSFERENCIA",
        titulo: `Transferência de Filial (${statusLabel})`,
        data_hora: dataHora,
        usuario: t.solicitante_nome || t.admin_nome || "PCP",
        icone: ArrowLeftRight,
        corBadge: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700",
        iconeCor: "border-amber-500 text-amber-500",
        detalhes: `Transferida de ${t.unidade_origem} para ${t.unidade_destino}.${t.motivo ? ` Motivo: "${t.motivo}".` : ""}${t.admin_nome ? ` Avaliado por: ${t.admin_nome}.` : ""}`
      });
    });

    // Se bobina tiver campo legado de transferência e não foi capturada acima
    if (bobina.unidade_transferida_de && !transDestaque) {
      transDestaque = {
        de: bobina.unidade_transferida_de,
        para: bobina.unidade || "Matriz AJL",
        usuario: bobina.usuario_transferencia || "PCP",
        aprovador: null,
        data: bobina.data_transferencia || bobina.updated_date,
        motivo: bobina.motivo_transferencia || "Transferência registrada no sistema",
        status: "Concluída"
      };

      lista.push({
        tipo: "TRANSFERENCIA",
        titulo: "Transferência de Filial (Concluída)",
        data_hora: transDestaque.data,
        usuario: transDestaque.usuario,
        icone: ArrowLeftRight,
        corBadge: "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-700",
        iconeCor: "border-amber-500 text-amber-500",
        detalhes: `Transferida de ${transDestaque.de} para ${transDestaque.para}. Motivo: "${transDestaque.motivo}".`
      });
    }

    // B. Consumos em Produção de Telhas
    pedidosTelhas.forEach((p) => {
      lista.push({
        tipo: "TELHAS",
        titulo: `Consumo Telhas · Pedido #${p.numero_pedido || "—"} (${p._posicao})`,
        data_hora: p.data ? `${p.data}T12:00:00Z` : p.created_date,
        usuario: p.operador_nome || p.operador || "Operador de Perfiladeira",
        icone: Factory,
        corBadge: "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200 dark:border-blue-700",
        iconeCor: "border-blue-500 text-blue-500",
        detalhes: `Produção de ${p.quantidade_telhas || 0} telhas (${p.metros || 0} m, ~${Number(p.peso_kg || 0).toLocaleString("pt-BR")} kg). Cliente: ${p.cliente || "Não informado"}. Perfiladeira: ${p.maquina || "Padrão"}.`
      });
    });

    // C. Ordens de Desbobinadeira
    ordensDesbob.forEach((o) => {
      lista.push({
        tipo: "DESBOBINADEIRA",
        titulo: `Corte na Desbobinadeira · OP #${o.numero_ordem || o.codigo || o.id?.slice(-4)}`,
        data_hora: o.created_date || (o.data ? `${o.data}T12:00:00Z` : null),
        usuario: o.operador_nome || "Operador Desbobinador",
        icone: Layers,
        corBadge: "bg-indigo-100 text-indigo-900 border-indigo-300 dark:bg-indigo-950 dark:text-indigo-200 dark:border-indigo-700",
        iconeCor: "border-indigo-500 text-indigo-500",
        detalhes: `Corte de ${Number(o.peso_gasto_kg || o.peso_kg || 0).toLocaleString("pt-BR")} kg (${o.metragem_cortada_m || o.metragem || 0} m). Máquina: ${o.maquina || "Desbobinadeira"}. Pedido: #${o.numero_pedido || "Estoque"}.`
      });
    });

    // D. Ordens de Corte e Dobra
    ordensCD.forEach((o) => {
      lista.push({
        tipo: "CORTE_DOBRA",
        titulo: `Corte & Dobra · Máquina ${o.maquina || "CD"}`,
        data_hora: o.created_date || (o.data ? `${o.data}T12:00:00Z` : null),
        usuario: o.operador_nome || "Operador C&D",
        icone: Scissors,
        corBadge: "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:border-orange-700",
        iconeCor: "border-orange-500 text-orange-500",
        detalhes: `Consumo de ${Number(o.peso_utilizado_kg || o.peso_kg || 0).toLocaleString("pt-BR")} kg na produção de ${o.produto_nome || o.descricao || "peças de C&D"}. Pedido: #${o.numero_pedido || "—"}.`
      });
    });

    // E. Reservas de Vendedor
    reservas.forEach((r) => {
      lista.push({
        tipo: "RESERVA",
        titulo: `Reserva Efetuada · ${r.cliente || "Venda"}`,
        data_hora: r.created_date || r.data,
        usuario: r.solicitante_nome || r.usuario || "Vendedor",
        icone: Lock,
        corBadge: "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-700",
        iconeCor: "border-purple-500 text-purple-500",
        detalhes: `Reserva de ${Number(r.peso_kg || 0).toLocaleString("pt-BR")} kg para o pedido #${r.numero_pedido || "—"}. Status: ${r.status || "ativa"}.`
      });
    });

    // F. Ajustes de Inventário / Logs de Auditoria
    logs.forEach((l) => {
      if (l.acao === "transferencia_filial_concluida") return; // já tratado
      lista.push({
        tipo: "AUDITORIA",
        titulo: l.acao === "ajuste_peso" ? "Ajuste de Peso / Inventário" : (l.acao || "Alteração Cadastral"),
        data_hora: l.data_hora || l.created_date,
        usuario: l.usuario || "Operador / Gestor",
        icone: Scale,
        corBadge: "bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
        iconeCor: "border-slate-500 text-slate-500",
        detalhes: l.detalhes || "Dados da bobina atualizados."
      });
    });

    // G. Evento de Entrada / Cadastro Inicial no Estoque
    if (bobina.created_date) {
      lista.push({
        tipo: "ENTRADA",
        titulo: "Entrada da Bobina no Estoque",
        data_hora: bobina.created_date,
        usuario: bobina.created_by || "Almoxarifado / Recebimento",
        icone: Package,
        corBadge: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-700",
        iconeCor: "border-emerald-500 text-emerald-500",
        detalhes: `Bobina cadastrada com ${Number(bobina.peso_inicial || bobina.peso_kg || 0).toLocaleString("pt-BR")} kg. Chapa: ${bobina.chapa || "—"} mm, Cor: ${bobina.cor || "Natural"}, NF: ${bobina.nf || "Não informada"}, Fornecedor: ${bobina.fornecedor || "Não informado"}.`
      });
    }

    // Ordenar do evento mais recente para o mais antigo
    lista.sort((a, b) => {
      const timeA = new Date(a.data_hora || 0).getTime();
      const timeB = new Date(b.data_hora || 0).getTime();
      return timeB - timeA;
    });

    return { eventos: lista, ultimaTransferencia: transDestaque };
  }, [bobina, transferencias, pedidosTelhas, ordensDesbob, ordensCD, reservas, logs]);

  if (!bobina) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[88vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        
        {/* Topo do Modal */}
        <DialogHeader className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
                <History className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <span>Histórico & Linha do Tempo da Bobina</span>
                <Badge variant="outline" className="text-xs font-mono font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200">
                  {bobina.codigo || `ID #${bobina.id.slice(-6)}`}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Chapa: <strong className="text-slate-700 dark:text-slate-300">{bobina.chapa} mm</strong> · Peso Atual: <strong className="text-blue-600 dark:text-blue-400">{Number(bobina.peso_kg || 0).toLocaleString("pt-BR")} kg</strong> (Início: {Number(bobina.peso_inicial || bobina.peso_kg || 0).toLocaleString("pt-BR")} kg) · Filial: <strong className="text-slate-800 dark:text-slate-200">{bobina.unidade || "Matriz AJL"}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Corpo com Scroll */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1 text-slate-700 dark:text-slate-200">
          
          {/* Card Destacado Superior se a bobina foi transferida */}
          {ultimaTransferencia && (
            <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/30 space-y-2">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-sm">
                <ArrowLeftRight className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Detalhes da Transferência de Filial ({ultimaTransferencia.status})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">De ➔ Para:</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {ultimaTransferencia.de} ➔ {ultimaTransferencia.para}
                  </span>
                </div>

                <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Responsável / Solicitante:</span>
                  <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-500" />
                    {ultimaTransferencia.usuario || "Operador"}
                  </span>
                </div>
              </div>

              <div className="bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-amber-200/60 dark:border-amber-800/40 text-xs">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium flex items-center gap-1">
                  <MessageSquare className="w-3 h-3 text-amber-600" />
                  Motivo / Justificativa informada:
                </span>
                <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 italic">
                  "{ultimaTransferencia.motivo || "Transferência de bobina entre filiais sem justificativa descrita."}"
                </p>
                <span className="text-[10.5px] text-slate-400 dark:text-slate-500 block mt-1">
                  Data: {formatarDataHora(ultimaTransferencia.data)}
                </span>
              </div>
            </div>
          )}

          {/* Linha do Tempo Vertical de Eventos */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              Linha do Tempo da Bobina ({eventos.length} registro{eventos.length !== 1 ? "s" : ""})
            </h4>

            {loadingLogs ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <div className="w-7 h-7 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-2" />
                <p className="text-xs font-medium">Carregando histórico completo...</p>
              </div>
            ) : eventos.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-300 dark:border-slate-800 rounded-xl">
                <Clock className="w-8 h-8 text-slate-400 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Nenhum registro histórico localizado para esta bobina.
                </p>
              </div>
            ) : (
              <div className="relative border-l-2 border-slate-200 dark:border-slate-700 ml-3.5 space-y-4 py-1">
                {eventos.map((ev, index) => {
                  const IconComponent = ev.icone || Clock;
                  return (
                    <div key={index} className="relative pl-6">
                      {/* Marcador no eixo vertical */}
                      <span className={`absolute -left-2.5 top-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center bg-white dark:bg-slate-900 ${ev.iconeCor}`}>
                        <IconComponent className="w-2.5 h-2.5" />
                      </span>

                      {/* Card do Evento */}
                      <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-1">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${ev.corBadge}`}>
                            {ev.titulo}
                          </span>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                            {formatarDataHora(ev.data_hora)}
                          </span>
                        </div>

                        <p className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                          {ev.detalhes}
                        </p>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 pt-0.5">
                          <User className="w-3 h-3 text-slate-400" />
                          <span>Responsável: <strong className="text-slate-800 dark:text-slate-200">{ev.usuario}</strong></span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        {/* Rodapé */}
        <DialogFooter className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs font-bold px-4"
          >
            Fechar
          </Button>
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
