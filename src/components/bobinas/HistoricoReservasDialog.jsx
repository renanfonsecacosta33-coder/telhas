import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
  ArrowUpDown,
  Activity,
  Edit3,
  PlusCircle,
  Trash2,
  ArrowRightLeft,
  Building2,
  RefreshCw,
  Eye,
  Sliders,
  Package
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

const ACAO_BADGES = {
  criacao: { label: "Criação", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300", icon: PlusCircle },
  edicao: { label: "Alteração / Edição", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300", icon: Edit3 },
  status: { label: "Status", color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300", icon: RefreshCw },
  exclusao: { label: "Exclusão", color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300", icon: Trash2 },
  transferencia: { label: "Transferência", color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300", icon: ArrowRightLeft },
  aprovacao: { label: "Aprovação", color: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300", icon: CheckCircle2 },
  setup: { label: "Setup / Máquina", color: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300", icon: Sliders },
};

export default function HistoricoReservasDialog({ open, onOpenChange, setorFiltro = "todos" }) {
  const [tabAtiva, setTabAtiva] = useState("geral"); // 'geral' | 'reservas' | 'bobina'
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("todas");
  const [filtroSetor, setFiltroSetor] = useState(setorFiltro || "todos");
  const [bobinaBuscaCodigo, setBobinaBuscaCodigo] = useState("");
  const [detalhesJsonModal, setDetalhesJsonModal] = useState(null);

  // 1. Busca todos os registros de Auditoria (AuditLog)
  const { data: todosLogs = [], isLoading: loadingLogs, refetch: refetchLogs } = useQuery({
    queryKey: ["historico-geral-audit-logs"],
    queryFn: async () => {
      return base44.entities.AuditLog.list("-created_date", 1000);
    },
    enabled: open,
    refetchInterval: 15000
  });

  // 2. Busca todas as bobinas cadastradas (para cruzar com histórico e reservas)
  const { data: todasBobinas = [], isLoading: loadingBobinas } = useQuery({
    queryKey: ["historico-geral-todas-bobinas"],
    queryFn: async () => {
      return base44.entities.Bobina.filter({}, "-created_date", 2000);
    },
    enabled: open
  });

  // Lista filtrada de auditoria geral (Tudo e Todos)
  const logsFiltrados = useMemo(() => {
    let list = todosLogs;

    if (filtroAcao !== "todas") {
      list = list.filter(l => l.acao === filtroAcao);
    }

    if (busca.trim()) {
      const q = busca.toLowerCase();
      list = list.filter(l => 
        (l.registro_identificador && l.registro_identificador.toLowerCase().includes(q)) ||
        (l.detalhes && l.detalhes.toLowerCase().includes(q)) ||
        (l.usuario_nome && l.usuario_nome.toLowerCase().includes(q)) ||
        (l.usuario_email && l.usuario_email.toLowerCase().includes(q)) ||
        (l.unidade && l.unidade.toLowerCase().includes(q))
      );
    }

    return list;
  }, [todosLogs, filtroAcao, busca]);

  // Lista de Reservas
  const listaReservas = useMemo(() => {
    const reservadas = todasBobinas.filter(b => b.reservada);
    let list = reservadas.map(b => {
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

    list.sort((a, b) => {
      const timeA = new Date(a.data_hora_registro || a.reserva_data || 0).getTime();
      const timeB = new Date(b.data_hora_registro || b.reserva_data || 0).getTime();
      return timeB - timeA;
    });

    return list;
  }, [todasBobinas, filtroSetor, busca]);

  // Histórico específico da bobina consultada
  const bobinaSelecionada = useMemo(() => {
    if (!bobinaBuscaCodigo.trim()) return null;
    const cod = bobinaBuscaCodigo.trim().toUpperCase();
    return todasBobinas.find(b => b.codigo && b.codigo.toUpperCase() === cod) || null;
  }, [todasBobinas, bobinaBuscaCodigo]);

  const logsDaBobinaSelecionada = useMemo(() => {
    if (!bobinaSelecionada) return [];
    return todosLogs.filter(l => 
      (l.registro_id && l.registro_id === bobinaSelecionada.id) ||
      (l.registro_identificador && l.registro_identificador.toUpperCase() === bobinaSelecionada.codigo.toUpperCase()) ||
      (l.detalhes && l.detalhes.toUpperCase().includes(bobinaSelecionada.codigo.toUpperCase()))
    );
  }, [todosLogs, bobinaSelecionada]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-3 border-b border-border bg-muted/20">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
                <History className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                  Histórico Geral & Auditoria do Sistema
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-xs">
                    Tudo & Todos
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Registro completo de horários, usuários e alterações de bobinas, pesos, status e reservas.
                </DialogDescription>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchLogs()}
              className="gap-1.5 text-xs h-8"
              title="Atualizar dados agora"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Atualizar
            </Button>
          </div>

          {/* Abas */}
          <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="mt-4">
            <TabsList className="grid grid-cols-3 max-w-md h-9">
              <TabsTrigger value="geral" className="text-xs gap-1.5 font-semibold">
                <Activity className="w-3.5 h-3.5" /> Todas Alterações
              </TabsTrigger>
              <TabsTrigger value="reservas" className="text-xs gap-1.5 font-semibold">
                <Lock className="w-3.5 h-3.5" /> Reservas ({listaReservas.length})
              </TabsTrigger>
              <TabsTrigger value="bobina" className="text-xs gap-1.5 font-semibold">
                <Package className="w-3.5 h-3.5" /> Por Bobina
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {/* Conteúdo das Abas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* ================= ABA 1: TODAS AS ALTERAÇÕES (AUDITORIA GERAL) ================= */}
          {tabAtiva === "geral" && (
            <div className="space-y-4">
              {/* Barra de Filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por código (ex: CD0157), usuário, detalhes..."
                    value={busca}
                    onChange={e => setBusca(e.target.value)}
                    className="pl-9 h-9 text-xs"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {["todas", "edicao", "criacao", "status", "exclusao"].map(acao => (
                    <Button
                      key={acao}
                      variant={filtroAcao === acao ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFiltroAcao(acao)}
                      className="h-8 text-xs capitalize"
                    >
                      {acao === "todas" ? "Todas Ações" : acao === "edicao" ? "Edições" : acao === "criacao" ? "Criações" : acao === "status" ? "Status" : "Exclusões"}
                    </Button>
                  ))}
                </div>
              </div>

              {loadingLogs ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <div className="w-8 h-8 border-4 border-muted border-t-purple-600 rounded-full animate-spin mb-3" />
                  <p className="text-xs">Carregando registros de auditoria...</p>
                </div>
              ) : logsFiltrados.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-xl p-6">
                  <Activity className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="font-semibold text-sm text-foreground">Nenhum evento registrado</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {busca ? "Tente alterar os termos da busca." : "Nenhuma ação registrada com esse filtro."}
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logsFiltrados.map((log) => {
                    const cfg = ACAO_BADGES[log.acao] || { label: log.acao, color: "bg-gray-100 text-gray-800", icon: Clock };
                    const IconComp = cfg.icon || Clock;
                    return (
                      <div
                        key={log.id}
                        className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all space-y-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-xs font-semibold ${cfg.color}`}>
                              <IconComp className="w-3 h-3 mr-1 inline" />
                              {cfg.label}
                            </Badge>
                            {log.registro_identificador && (
                              <span className="font-mono font-bold text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300 px-2 py-0.5 rounded">
                                {log.registro_identificador}
                              </span>
                            )}
                            <Badge variant="secondary" className="text-[10px]">
                              {log.entidade} · {log.unidade}
                            </Badge>
                          </div>

                          {/* Carimbo oficial de data e hora */}
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60">
                            <Clock className="w-3.5 h-3.5 text-purple-600" />
                            <span>{formatarDataHora(log.data_hora || log.created_date)}</span>
                          </div>
                        </div>

                        {/* Descrição humana da alteração */}
                        <p className="text-xs text-foreground font-medium leading-relaxed">
                          {log.detalhes}
                        </p>

                        {/* Rodapé: quem fez a alteração */}
                        <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/30 gap-2">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span>
                              Usuário: <strong className="text-foreground">{log.usuario_nome || log.usuario_email || "Sistema"}</strong>
                              {log.usuario_role && ` (${log.usuario_role})`}
                            </span>
                          </div>

                          {(log.dados_anteriores || log.dados_novos) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDetalhesJsonModal(log)}
                              className="h-6 px-2 text-[10px] text-purple-700 hover:bg-purple-50 gap-1 font-semibold"
                            >
                              <Eye className="w-3 h-3" /> Ver detalhes técnicos
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ================= ABA 2: RESERVAS ================= */}
          {tabAtiva === "reservas" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar reserva por código, motivo, pedido..."
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

              {listaReservas.length === 0 ? (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-xl p-6">
                  <Lock className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="font-semibold text-sm text-foreground">Nenhuma bobina reservada</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {listaReservas.map(item => (
                    <div
                      key={item.id}
                      className="bg-card border border-purple-200 dark:border-purple-900/50 rounded-xl p-4 shadow-sm space-y-3"
                    >
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

                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border/60">
                          <Clock className="w-3.5 h-3.5 text-purple-600" />
                          <span className="font-medium text-foreground">Carimbo do Sistema:</span>
                          <span className="font-semibold text-purple-800 dark:text-purple-300">
                            {formatarDataHora(item.data_hora_registro)}
                          </span>
                        </div>
                      </div>

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

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span>Cadastrado por: <strong className="text-foreground">{item.usuario_registro}</strong></span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setBobinaBuscaCodigo(item.codigo);
                            setTabAtiva("bobina");
                          }}
                          className="h-6 text-[10px] text-purple-700 font-semibold"
                        >
                          Ver Linha do Tempo Desta Bobina →
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= ABA 3: POR BOBINA ESPECÍFICA ================= */}
          {tabAtiva === "bobina" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Digite o código da bobina (ex: CD0157, TE0172, CD0177)..."
                    value={bobinaBuscaCodigo}
                    onChange={e => setBobinaBuscaCodigo(e.target.value)}
                    className="pl-9 h-10 text-xs font-mono uppercase"
                  />
                </div>
              </div>

              {!bobinaSelecionada ? (
                <div className="text-center py-16 border-2 border-dashed border-border rounded-xl p-6">
                  <Package className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
                  <p className="font-semibold text-sm text-foreground">
                    {bobinaBuscaCodigo ? `Nenhuma bobina encontrada com o código "${bobinaBuscaCodigo}"` : "Digite o código de qualquer bobina para ver seu ciclo de vida completo"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Você poderá auditar exatamente quem cadastrou, que horas cada alteração foi feita, reservas e consumos.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Resumo da Bobina */}
                  <div className="bg-muted/30 border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-mono font-bold text-foreground">{bobinaSelecionada.codigo}</span>
                        <Badge variant="outline">{bobinaSelecionada.setor === "corte_dobra" ? "Corte & Dobra" : "Telhas"}</Badge>
                        <Badge variant="secondary">{bobinaSelecionada.unidade || "Matriz AJL"}</Badge>
                        {bobinaSelecionada.reservada && (
                          <Badge className="bg-purple-600 text-white">Reservada</Badge>
                        )}
                        {bobinaSelecionada.arquivada && (
                          <Badge variant="outline" className="border-amber-400 text-amber-800">Arquivada</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Chapa: <strong>{bobinaSelecionada.chapa} mm</strong> · Peso Atual: <strong>{Number(bobinaSelecionada.peso_kg || 0).toLocaleString("pt-BR")} kg</strong> · NF: <strong>{bobinaSelecionada.nf || "—"}</strong> · Fornecedor: <strong>{bobinaSelecionada.fornecedor || "—"}</strong>
                      </p>
                    </div>

                    <div className="text-right text-xs">
                      <p className="text-muted-foreground">Cadastrada em:</p>
                      <p className="font-semibold text-foreground">{formatarDataHora(bobinaSelecionada.created_date)}</p>
                      <p className="text-muted-foreground text-[10px]">Por: {bobinaSelecionada.created_by || "Sistema"}</p>
                    </div>
                  </div>

                  {/* Linha do tempo de eventos da bobina */}
                  <div className="space-y-3 pt-2">
                    <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-purple-600" />
                      Linha do Tempo e Alterações Registradas ({logsDaBobinaSelecionada.length + (bobinaSelecionada.reservada ? 1 : 0) + 1} registros)
                    </h4>

                    <div className="relative border-l-2 border-purple-200 dark:border-purple-900 ml-3 space-y-4">
                      {/* Ponto: Criação inicial */}
                      <div className="relative pl-6">
                        <div className="absolute -left-[13px] top-1 w-6 h-6 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-emerald-700 text-xs">
                          <Package className="w-3 h-3" />
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3 text-xs space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="font-bold text-foreground">Entrada da Bobina no Estoque</span>
                            <span className="text-purple-700 font-medium">{formatarDataHora(bobinaSelecionada.created_date)}</span>
                          </div>
                          <p className="text-muted-foreground">
                            Bobina cadastrada com {Number(bobinaSelecionada.peso_inicial || bobinaSelecionada.peso_kg || 0).toLocaleString("pt-BR")} kg. Chapa: {bobinaSelecionada.chapa} mm, NF: {bobinaSelecionada.nf || "—"}, Fornecedor: {bobinaSelecionada.fornecedor || "—"}.
                          </p>
                          <p className="text-[11px] text-muted-foreground pt-1">
                            Responsável: <strong>{bobinaSelecionada.created_by || "Sistema"}</strong>
                          </p>
                        </div>
                      </div>

                      {/* Ponto: Reserva (se houver) */}
                      {bobinaSelecionada.reservada && (
                        <div className="relative pl-6">
                          <div className="absolute -left-[13px] top-1 w-6 h-6 rounded-full bg-purple-100 border-2 border-purple-400 flex items-center justify-center text-purple-700 text-xs">
                            <Lock className="w-3 h-3" />
                          </div>
                          <div className="bg-card border border-purple-200 rounded-lg p-3 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-purple-800">Reserva de Bobina Registrada</span>
                              <span className="text-purple-700 font-medium">{formatarDataHora(bobinaSelecionada.reserva_data_hora || bobinaSelecionada.updated_date)}</span>
                            </div>
                            <p className="text-purple-900">
                              Tipo: {bobinaSelecionada.reserva_tipo === "inteira" ? "Bobina Inteira" : `Parcial (${bobinaSelecionada.reserva_kg} kg)`}. Motivo: "{bobinaSelecionada.reserva_motivo}". Autorizado por: {bobinaSelecionada.reserva_autorizado_por || "—"}.
                            </p>
                            <p className="text-[11px] text-muted-foreground pt-1">
                              Registrado por: <strong>{bobinaSelecionada.reserva_usuario || bobinaSelecionada.created_by || "Sistema"}</strong>
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Ponto: Logs de auditoria específicos */}
                      {logsDaBobinaSelecionada.map((log, idx) => (
                        <div key={idx} className="relative pl-6">
                          <div className="absolute -left-[13px] top-1 w-6 h-6 rounded-full bg-blue-100 border-2 border-blue-400 flex items-center justify-center text-blue-700 text-xs">
                            <Activity className="w-3 h-3" />
                          </div>
                          <div className="bg-card border border-border rounded-lg p-3 text-xs space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-foreground">Alteração / Evento: {log.acao.toUpperCase()}</span>
                              <span className="text-purple-700 font-medium">{formatarDataHora(log.data_hora || log.created_date)}</span>
                            </div>
                            <p className="text-foreground">{log.detalhes}</p>
                            <p className="text-[11px] text-muted-foreground pt-1">
                              Usuário: <strong>{log.usuario_nome || log.usuario_email}</strong> ({log.usuario_role || "operador"})
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal de Detalhes Técnicos JSON (se solicitado) */}
        {detalhesJsonModal && (
          <Dialog open={!!detalhesJsonModal} onOpenChange={() => setDetalhesJsonModal(null)}>
            <DialogContent className="max-w-lg text-xs">
              <DialogHeader>
                <DialogTitle className="text-sm font-bold">Detalhes Técnicos da Alteração</DialogTitle>
                <DialogDescription className="text-xs">
                  Valores anteriores e novos gravados no banco de dados
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2 max-h-[60vh] overflow-y-auto font-mono text-[11px]">
                {detalhesJsonModal.dados_anteriores && (
                  <div>
                    <span className="font-bold text-destructive block mb-1">Dados Anteriores:</span>
                    <pre className="bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">{detalhesJsonModal.dados_anteriores}</pre>
                  </div>
                )}
                {detalhesJsonModal.dados_novos && (
                  <div>
                    <span className="font-bold text-emerald-600 block mb-1">Dados Novos:</span>
                    <pre className="bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">{detalhesJsonModal.dados_novos}</pre>
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}
