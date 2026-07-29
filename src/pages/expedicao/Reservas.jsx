import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  BookmarkCheck, Plus, Search, Clock, CheckCircle2, XCircle, AlertTriangle,
  Package, Weight, Printer, QrCode, Filter, RefreshCw, ShieldAlert, UserCheck, Calendar, Info
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInHours, differenceInMinutes, parseISO, isAfter } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFilial } from "@/contexts/FilialContext";
import { useOutletContext } from "react-router-dom";

const STATUS_CONFIG = {
  pendente:  { label: "Pendente de Aprovação", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: Clock },
  aprovada:  { label: "Aprovada & Reservada",  color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
  separada:  { label: "Separada no Pátio",     color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30", icon: Package },
  faturada:  { label: "Faturada / Expedida",   color: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30", icon: BookmarkCheck },
  recusada:  { label: "Recusada",              color: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30", icon: XCircle },
  expirada:  { label: "Expirada (72h SLA)",    color: "bg-slate-500/10 text-slate-500 border-slate-500/30", icon: ShieldAlert },
};

// Componente do Cronômetro de Validade SLA 72h
function CronometroSLA({ dataValidade, status }) {
  if (status === "faturada" || status === "recusada" || status === "expirada") {
    return <span className="text-xs text-muted-foreground font-medium">—</span>;
  }

  if (!dataValidade) return null;

  try {
    const dataFim = typeof dataValidade === "string" ? parseISO(dataValidade) : new Date(dataValidade);
    const agora = new Date();

    if (isAfter(agora, dataFim)) {
      return (
        <span className="text-xs font-bold text-red-500 flex items-center gap-1 animate-pulse">
          <ShieldAlert className="w-3.5 h-3.5" /> Expirada
        </span>
      );
    }

    const horasRestantes = differenceInHours(dataFim, agora);
    const minutosRestantes = differenceInMinutes(dataFim, agora) % 60;

    const ehCritico = horasRestantes < 12;

    return (
      <div className={`text-xs font-bold flex items-center gap-1 ${ehCritico ? "text-amber-500 animate-pulse" : "text-emerald-500"}`}>
        <Clock className="w-3.5 h-3.5" />
        <span>{horasRestantes}h {minutosRestantes}m restantes</span>
      </div>
    );
  } catch {
    return null;
  }
}

export default function ReservasExpedicao() {
  const { filialAtiva } = useFilial();
  const context = useOutletContext() || {};
  const user = context.user || null;
  const isAdmin = context.isAdmin || user?.role === "admin" || user?.role === "super_admin";

  const [abaAtiva, setAbaAtiva] = useState("todas");
  const [search, setSearch] = useState("");
  const [dialogNova, setDialogNova] = useState(false);
  const [solicitacaoAvaliar, setSolicitacaoAvaliar] = useState(null);
  const [etiquetaImprimir, setEtiquetaImprimir] = useState(null);

  const queryClient = useQueryClient();

  // Buscar Reservas da Expedição
  const { data: reservas = [], isLoading } = useQuery({
    queryKey: ["reservas-expedicao", filialAtiva],
    queryFn: async () => {
      const result = await base44.entities.SolicitacaoReserva.filter({ setor: "expedicao" }, "-created_date", 500);
      return result || [];
    },
    refetchInterval: 15000,
  });

  // Buscar itens do Estoque da Expedição para reserva
  const { data: estoqueExpedicao = [] } = useQuery({
    queryKey: ["estoque-expedicao-combo", filialAtiva],
    queryFn: async () => {
      const result = await base44.entities.EstoqueExpedicao.list("-created_date", 200);
      return result || [];
    },
  });

  // Form State da Nova Reserva
  const [formReserva, setFormReserva] = useState({
    item_id: "",
    vendedor_nome: user?.full_name || user?.email || "",
    cliente_nome: "",
    numero_pedido: "",
    tipo_reserva: "parcial", // "total" ou "parcial"
    quantidade_reservada: "",
    unidade_medida: "UN",
    motivo_reserva: "",
    validade_horas: 72, // SLA Padrão de 72h conforme alinhado
  });

  // Material selecionado no combo
  const itemSelecionado = estoqueExpedicao.find(i => i.id === formReserva.item_id);

  // Calcular Saldo Disponível do item selecionado
  const reservasAtivasItem = reservas.filter(r => r.item_id === formReserva.item_id && (r.status === "aprovada" || r.status === "pendente" || r.status === "separada"));
  const totalReservadoItem = reservasAtivasItem.reduce((acc, r) => acc + (parseFloat(r.quantidade_reservada) || 0), 0);
  const estoqueFisicoItem = parseFloat(itemSelecionado?.quantidade || 0);
  const saldoDisponivelItem = Math.max(0, estoqueFisicoItem - totalReservadoItem);

  // Mutation para Criar Reserva (Sempre entra como Pendente de Aprovação)
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const qtdNum = parseFloat(data.quantidade_reservada) || 0;
      if (data.tipo_reserva === "parcial" && qtdNum > saldoDisponivelItem) {
        throw new Error(`Quantidade solicitada (${qtdNum}) é maior do que o Saldo Disponível (${saldoDisponivelItem} ${itemSelecionado?.unidade || 'UN'}).`);
      }

      // Calcular Data de Validade SLA (72 horas por padrão)
      const dataValidade = new Date();
      dataValidade.setHours(dataValidade.getHours() + (parseInt(data.validade_horas, 10) || 72));

      const payload = {
        setor: "expedicao",
        unidade: filialAtiva || "Matriz AJL",
        item_id: data.item_id,
        bobina_descricao: itemSelecionado ? `${itemSelecionado.produto_nome || itemSelecionado.codigo} (${itemSelecionado.descricao || ''})` : "Material Expedição",
        vendedor_nome: data.vendedor_nome,
        vendedor_id: user?.id || "",
        cliente: data.cliente_nome,
        numero_pedido: data.numero_pedido,
        reserva_tipo: data.tipo_reserva,
        quantidade_reservada: qtdNum,
        reserva_kg: itemSelecionado?.peso_kg ? (qtdNum * itemSelecionado.peso_kg) : undefined,
        unidade_medida: itemSelecionado?.unidade || "UN",
        motivo: data.motivo_reserva,
        status: "pendente", // 🔒 TODA RESERVA REQUER APROVAÇÃO CONFORME DIRETRIZ
        data_validade: dataValidade.toISOString(),
        historico_log: JSON.stringify([
          { data: new Date().toLocaleString("pt-BR"), acao: `Solicitada pelo vendedor ${data.vendedor_nome} (Aguardando Aprovação da Expedição - SLA 72h)` }
        ])
      };

      return await base44.entities.SolicitacaoReserva.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservas-expedicao"] });
      setDialogNova(false);
      setFormReserva({
        item_id: "",
        vendedor_nome: user?.full_name || user?.email || "",
        cliente_nome: "",
        numero_pedido: "",
        tipo_reserva: "parcial",
        quantidade_reservada: "",
        unidade_medida: "UN",
        motivo_reserva: "",
        validade_horas: 72,
      });
      toast.success("Solicitação de reserva registrada com sucesso! Encaminhada para aprovação da Expedição.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao registrar reserva.");
    }
  });

  // Mutation de Avaliação pela Gerência/Expedição (Aprovar / Recusar)
  const avaliarMutation = useMutation({
    mutationFn: async ({ id, decisao, justificativa }) => {
      const sol = reservas.find(r => r.id === id);
      if (!sol) throw new Error("Solicitação não encontrada.");

      const log = sol.historico_log ? JSON.parse(sol.historico_log) : [];
      log.push({
        data: new Date().toLocaleString("pt-BR"),
        acao: decisao === "aprovada"
          ? `Aprovada por ${user?.full_name || user?.email || 'Gerência'}`
          : `Recusada por ${user?.full_name || user?.email || 'Gerência'}. Motivo: ${justificativa || 'Sem justificativa'}`
      });

      return await base44.entities.SolicitacaoReserva.update(id, {
        status: decisao,
        resposta_admin: justificativa,
        admin_nome: user?.full_name || user?.email || "Expedição",
        data_avaliacao: new Date().toISOString(),
        historico_log: JSON.stringify(log)
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["reservas-expedicao"] });
      setSolicitacaoAvaliar(null);
      toast.success(variables.decisao === "aprovada" ? "Reserva aprovada e alocada com sucesso!" : "Reserva recusada.");
    },
    onError: (err) => {
      toast.error(err.message || "Erro ao avaliar reserva.");
    }
  });

  // Filtragem de Reservas
  const reservasFiltradas = reservas.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.cliente?.toLowerCase().includes(q) ||
      r.numero_pedido?.toLowerCase().includes(q) ||
      r.vendedor_nome?.toLowerCase().includes(q) ||
      r.bobina_descricao?.toLowerCase().includes(q);

    if (!matchSearch) return false;

    if (abaAtiva === "pendentes") return r.status === "pendente";
    if (abaAtiva === "aprovadas") return r.status === "aprovada" || r.status === "separada";
    if (abaAtiva === "faturadas") return r.status === "faturada";
    if (abaAtiva === "expiradas") return r.status === "expirada" || r.status === "recusada";

    return true;
  });

  // KPIs
  const totalAtivas = reservas.filter(r => r.status === "aprovada" || r.status === "separada");
  const totalPendentes = reservas.filter(r => r.status === "pendente");
  const totalFaturadas = reservas.filter(r => r.status === "faturada");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight">Reservas de Materiais</h1>
            <Badge variant="outline" className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30">
              Expedição AJL
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Gestão delicada de reservas de estoque para vendas com trava anti-duplicata e SLA de 72h
          </p>
        </div>

        <Button
          onClick={() => setDialogNova(true)}
          className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shadow-md rounded-xl font-bold"
        >
          <Plus className="w-4 h-4" /> Nova Solicitação de Reserva
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Reservas Ativas</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
              <BookmarkCheck className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-black">{totalAtivas.length}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">Estoque alocado no pátio</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Pendentes Aprovação</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
          </div>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{totalPendentes.length}</p>
          <p className="text-xs text-muted-foreground font-semibold mt-1">Requer aprovação da expedição</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">SLA de Validade</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
              <ShieldAlert className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">72h</p>
          <p className="text-xs text-muted-foreground font-semibold mt-1">Tempo limite sem faturamento</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Faturadas / Carregadas</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{totalFaturadas.length}</p>
          <p className="text-xs text-muted-foreground font-semibold mt-1">Convertidas em vendas</p>
        </div>
      </div>

      {/* Filtros e Abas */}
      <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Abas */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto no-scrollbar">
            {[
              { id: "todas", label: "Todas" },
              { id: "pendentes", label: `Pendentes (${totalPendentes.length})` },
              { id: "aprovadas", label: `Aprovadas (${totalAtivas.length})` },
              { id: "faturadas", label: "Faturadas" },
              { id: "expiradas", label: "Expiradas / Recusadas" },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id)}
                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap touch-manipulation min-h-[40px] ${
                  abaAtiva === tab.id
                    ? "bg-teal-600 text-white shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar pedido, cliente, vendedor..."
              className="pl-9 h-10 rounded-xl text-xs"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Reservas */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase tracking-wider font-bold">
              <tr>
                <th className="p-3.5">Pedido / Cliente</th>
                <th className="p-3.5">Material Solicitado</th>
                <th className="p-3.5">Vendedor</th>
                <th className="p-3.5">Quantidade</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Validade (72h SLA)</th>
                <th className="p-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Carregando solicitações de reserva...
                  </td>
                </tr>
              ) : reservasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    Nenhuma reserva encontrada nesta visualização.
                  </td>
                </tr>
              ) : (
                reservasFiltradas.map(res => {
                  const statusInfo = STATUS_CONFIG[res.status] || STATUS_CONFIG.pendente;
                  const StatusIcon = statusInfo.icon;

                  return (
                    <tr key={res.id} className="hover:bg-muted/40 transition-colors">
                      <td className="p-3.5 font-medium">
                        <p className="font-bold text-foreground">{res.numero_pedido ? `PEDIDO #${res.numero_pedido}` : "Sem Pedido"}</p>
                        <p className="text-[11px] text-muted-foreground truncate max-w-[180px]">{res.cliente || "Cliente não informado"}</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-foreground truncate max-w-[220px]">{res.bobina_descricao}</p>
                        <span className="text-[10px] text-muted-foreground">
                          {res.reserva_tipo === "parcial" ? "Reserva Parcial" : "Reserva Total do Lote"}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <p className="font-semibold text-foreground">{res.vendedor_nome}</p>
                        <p className="text-[10px] text-muted-foreground">{res.unidade || filialAtiva}</p>
                      </td>
                      <td className="p-3.5">
                        <p className="font-black text-sm text-foreground">
                          {res.quantidade_reservada} <span className="text-xs font-normal text-muted-foreground">{res.unidade_medida || 'UN'}</span>
                        </p>
                        {res.reserva_kg && <p className="text-[10px] text-muted-foreground">~{res.reserva_kg} kg</p>}
                      </td>
                      <td className="p-3.5">
                        <Badge variant="outline" className={`gap-1.5 font-bold ${statusInfo.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="p-3.5">
                        <CronometroSLA dataValidade={res.data_validade} status={res.status} />
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Botão de Avaliar para Gerência/Expedição */}
                          {res.status === "pendente" && (isAdmin || user?.setor === "expedicao") && (
                            <Button
                              size="sm"
                              onClick={() => setSolicitacaoAvaliar(res)}
                              className="h-8 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg gap-1"
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Avaliar
                            </Button>
                          )}

                          {/* Botão de Imprimir Etiqueta Física */}
                          {(res.status === "aprovada" || res.status === "separada") && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEtiquetaImprimir(res)}
                              className="h-8 text-xs font-semibold rounded-lg gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                              title="Imprimir Etiqueta Física com QR Code"
                            >
                              <Printer className="w-3.5 h-3.5" /> Tag Física
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: Nova Solicitação de Reserva (Vendedor) */}
      <Dialog open={dialogNova} onOpenChange={setDialogNova}>
        <DialogContent className="sm:max-w-lg font-sans">
          <DialogHeader>
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <BookmarkCheck className="w-5 h-5 text-teal-600" />
              Solicitar Reserva de Material
            </DialogTitle>
            <DialogDescription className="text-xs">
              Toda reserva requer aprovação prévia da Expedição e possui SLA de validade de 72h.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={e => { e.preventDefault(); createMutation.mutate(formReserva); }} className="space-y-4 py-2">
            {/* Seleção do Material */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Material no Estoque da Expedição *</Label>
              <Select
                value={formReserva.item_id}
                onValueChange={val => setFormReserva(f => ({ ...f, item_id: val }))}
              >
                <SelectTrigger className="h-10 rounded-xl text-xs">
                  <SelectValue placeholder="Selecione o produto no estoque..." />
                </SelectTrigger>
                <SelectContent className="max-h-60 font-sans">
                  {estoqueExpedicao.map(item => (
                    <SelectItem key={item.id} value={item.id} className="text-xs">
                      {item.codigo ? `[${item.codigo}] ` : ''}{item.produto_nome || item.descricao} — Qtd Físico: {item.quantidade} {item.unidade || 'UN'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Painel de Saldo Transparente */}
            {itemSelecionado && (
              <div className="bg-muted/60 border border-border rounded-xl p-3 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Estoque Físico no Pátio:</span>
                  <span className="font-bold">{itemSelecionado.quantidade} {itemSelecionado.unidade || 'UN'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Reservado em Outros Pedidos:</span>
                  <span className="font-bold text-amber-600">{totalReservadoItem} {itemSelecionado.unidade || 'UN'}</span>
                </div>
                <div className="flex items-center justify-between pt-1.5 border-t border-border">
                  <span className="font-bold text-foreground">Saldo Disponível Real:</span>
                  <span className={`font-black text-sm ${saldoDisponivelItem > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                    {saldoDisponivelItem} {itemSelecionado.unidade || 'UN'}
                  </span>
                </div>
              </div>
            )}

            {/* Dados do Cliente e Pedido */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Número do Pedido *</Label>
                <Input
                  required
                  placeholder="Ex: PED-10492"
                  value={formReserva.numero_pedido}
                  onChange={e => setFormReserva(f => ({ ...f, numero_pedido: e.target.value }))}
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Cliente *</Label>
                <Input
                  required
                  placeholder="Nome do cliente/obra"
                  value={formReserva.cliente_nome}
                  onChange={e => setFormReserva(f => ({ ...f, cliente_nome: e.target.value }))}
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            {/* Quantidade a Reservar e Validade SLA */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold">Quantidade a Reservar *</Label>
                <Input
                  type="number"
                  step="any"
                  required
                  placeholder={`Em ${itemSelecionado?.unidade || 'UN'}`}
                  value={formReserva.quantidade_reservada}
                  onChange={e => setFormReserva(f => ({ ...f, quantidade_reservada: e.target.value }))}
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Validade Padrão (SLA)</Label>
                <Select
                  value={String(formReserva.validade_horas)}
                  onValueChange={v => setFormReserva(f => ({ ...f, validade_horas: parseInt(v, 10) }))}
                >
                  <SelectTrigger className="h-10 rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-sans">
                    <SelectItem value="24" className="text-xs">24 horas (Urgente)</SelectItem>
                    <SelectItem value="48" className="text-xs">48 horas (Normal)</SelectItem>
                    <SelectItem value="72" className="text-xs">72 horas (Padrão Alinhado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Observações / Motivo */}
            <div className="space-y-1">
              <Label className="text-xs font-bold">Motivo / Observações</Label>
              <Textarea
                placeholder="Aguardando confirmação de pagamento ou logística do cliente..."
                value={formReserva.motivo_reserva}
                onChange={e => setFormReserva(f => ({ ...f, motivo_reserva: e.target.value }))}
                className="rounded-xl text-xs min-h-[60px]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogNova(false)} className="rounded-xl text-xs">
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || !formReserva.item_id || !formReserva.quantidade_reservada}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold"
              >
                {createMutation.isPending ? "Registrando..." : "Solicitar Reserva"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Avaliação pela Gerência / Expedição */}
      {solicitacaoAvaliar && (
        <Dialog open onOpenChange={() => setSolicitacaoAvaliar(null)}>
          <DialogContent className="sm:max-w-md font-sans">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-amber-500" />
                Avaliar Solicitação de Reserva
              </DialogTitle>
              <DialogDescription className="text-xs">
                Examine os detalhes antes de autorizar a trava física no estoque.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="bg-muted/60 rounded-xl p-3 space-y-1.5">
                <p className="font-bold text-foreground text-sm">{solicitacaoAvaliar.bobina_descricao}</p>
                <p className="text-muted-foreground">Vendedor: <span className="font-bold text-foreground">{solicitacaoAvaliar.vendedor_nome}</span></p>
                <p className="text-muted-foreground">Cliente: <span className="font-bold text-foreground">{solicitacaoAvaliar.cliente}</span></p>
                <p className="text-muted-foreground">Pedido: <span className="font-bold text-foreground">{solicitacaoAvaliar.numero_pedido}</span></p>
                <p className="text-muted-foreground">Quantidade Solicitada: <span className="font-black text-emerald-600">{solicitacaoAvaliar.quantidade_reservada} {solicitacaoAvaliar.unidade_medida || 'UN'}</span></p>
                {solicitacaoAvaliar.motivo && <p className="text-muted-foreground italic">Obs: "{solicitacaoAvaliar.motivo}"</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold">Justificativa / Observação do Avaliador</Label>
                <Input
                  id="justificativa-input"
                  placeholder="Ex: Aprovado para carregamento até sexta-feira"
                  className="h-10 rounded-xl text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="destructive"
                onClick={() => {
                  const just = document.getElementById("justificativa-input")?.value;
                  avaliarMutation.mutate({ id: solicitacaoAvaliar.id, decisao: "recusada", justificativa: just });
                }}
                disabled={avaliarMutation.isPending}
                className="rounded-xl text-xs font-bold"
              >
                🔴 Recusar Reserva
              </Button>
              <Button
                onClick={() => {
                  const just = document.getElementById("justificativa-input")?.value;
                  avaliarMutation.mutate({ id: solicitacaoAvaliar.id, decisao: "aprovada", justificativa: just });
                }}
                disabled={avaliarMutation.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
              >
                🟢 Aprovar & Reservar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* MODAL 3: Impressão de Etiqueta Física de Reserva com QR Code */}
      {etiquetaImprimir && (
        <Dialog open onOpenChange={() => setEtiquetaImprimir(null)}>
          <DialogContent className="sm:max-w-md font-sans">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2">
                <Printer className="w-5 h-5 text-amber-500" />
                Etiqueta Física de Reserva
              </DialogTitle>
              <DialogDescription className="text-xs">
                Etiqueta para ser impressa e fixada no fardo/pacote no pátio da expedição.
              </DialogDescription>
            </DialogHeader>

            {/* Tag amarela industrial */}
            <div className="bg-amber-400 text-slate-950 p-4 rounded-2xl border-4 border-slate-950 space-y-3 font-mono text-xs shadow-2xl">
              <div className="flex items-center justify-between border-b-2 border-slate-950 pb-2">
                <div className="flex items-center gap-1.5 font-black text-sm">
                  <ShieldAlert className="w-5 h-5 text-red-700" />
                  <span>MATERIAL RESERVADO</span>
                </div>
                <span className="font-extrabold text-[10px] bg-slate-950 text-white px-2 py-0.5 rounded">AJL LOGÍSTICA</span>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-slate-800">PEDIDO DE VENDA:</p>
                <p className="text-xl font-black tracking-widest">{etiquetaImprimir.numero_pedido || 'PED-XXXX'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <p className="font-bold text-slate-800">CLIENTE:</p>
                  <p className="font-black truncate">{etiquetaImprimir.cliente}</p>
                </div>
                <div>
                  <p className="font-bold text-slate-800">VENDEDOR:</p>
                  <p className="font-black truncate">{etiquetaImprimir.vendedor_nome}</p>
                </div>
              </div>

              <div className="border-t-2 border-dashed border-slate-950 pt-2 flex items-center justify-between">
                <div>
                  <p className="font-bold text-[10px]">QUANTIDADE RESERVADA:</p>
                  <p className="font-black text-base">{etiquetaImprimir.quantidade_reservada} {etiquetaImprimir.unidade_medida || 'UN'}</p>
                </div>
                <div className="w-12 h-12 bg-slate-950 rounded flex items-center justify-center text-white">
                  <QrCode className="w-8 h-8" />
                </div>
              </div>

              <div className="bg-red-700 text-white text-[10px] font-black text-center py-1 rounded tracking-wider uppercase">
                ⚠️ PROIBIDO CARREGAR EM OUTRO PEDIDO
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => { window.print(); setEtiquetaImprimir(null); }}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold gap-2"
              >
                <Printer className="w-4 h-4" /> Imprimir Etiqueta Física
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
