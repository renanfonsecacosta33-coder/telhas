import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";
import {
  ShieldCheck,
  ShieldAlert,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  Factory,
  RefreshCw,
  Eye,
  Check,
  RotateCcw,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, addDays, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const EPIS_PADRAO = [
  { nome: "Luva de Vaqueta / Anticorte", ca: "36.214", validadePadrao: 30, icone: "🧤" },
  { nome: "Óculos de Proteção Incolor", ca: "19.652", validadePadrao: 90, icone: "🥽" },
  { nome: "Protetor Auricular Tipo Plug", ca: "28.533", validadePadrao: 30, icone: "🎧" },
  { nome: "Protetor Auricular Tipo Concha", ca: "14.235", validadePadrao: 180, icone: "🎧" },
  { nome: "Botina de Segurança c/ Bico de Aço", ca: "41.419", validadePadrao: 180, icone: "🥾" },
  { nome: "Máscara PFF2 / Poeiras", ca: "38.504", validadePadrao: 15, icone: "😷" },
  { nome: "Avental de Raspa Solda/Corte", ca: "26.118", validadePadrao: 120, icone: "🦺" },
];

export default function EPI() {
  const { filialAtiva } = useFilial();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos"); // todos | ativos | vencendo | vencidos
  const [dialogNovaEntrega, setDialogNovaEntrega] = useState(false);

  // Form de nova entrega
  const [colaboradorNome, setColaboradorNome] = useState("");
  const [tipoEpi, setTipoEpi] = useState(EPIS_PADRAO[0].nome);
  const [numeroCa, setNumeroCa] = useState(EPIS_PADRAO[0].ca);
  const [quantidade, setQuantidade] = useState(1);
  const [dataEntrega, setDataEntrega] = useState(format(new Date(), "yyyy-MM-dd"));
  const [validadeDias, setValidadeDias] = useState(EPIS_PADRAO[0].validadePadrao);
  const [setorColaborador, setSetorColaborador] = useState("corte_dobra");
  const [observacoes, setObservacoes] = useState("");

  // Buscar colaboradores / usuários para preencher rápido
  const { data: usuarios = [] } = useQuery({
    queryKey: ["equipe-epi"],
    queryFn: () => base44.entities.User.list("-full_name", 100)
  });

  // Buscar entregas registradas
  const { data: entregas = [], isLoading } = useQuery({
    queryKey: ["entregas-epi", filialAtiva],
    queryFn: async () => {
      try {
        const q = filialAtiva && filialAtiva !== "Todas" ? { unidade: filialAtiva } : {};
        return await base44.entities.EntregaEPI.filter(q, "-data_entrega", 300);
      } catch {
        return [];
      }
    },
    refetchInterval: 15000
  });

  // Processar status e dias restantes
  const entregasProcessadas = useMemo(() => {
    const hoje = new Date();
    return entregas.map((e) => {
      let diasRestantes = null;
      let statusCalculado = e.status || "ativo";

      if (e.data_entrega) {
        try {
          const dEntr = parseISO(e.data_entrega);
          const dVal = addDays(dEntr, Number(e.validade_dias || 60));
          diasRestantes = differenceInDays(dVal, hoje);

          if (e.status === "ativo") {
            if (diasRestantes < 0) {
              statusCalculado = "vencido";
            } else if (diasRestantes <= 7) {
              statusCalculado = "vencendo";
            }
          }
        } catch {}
      }

      return {
        ...e,
        _diasRestantes: diasRestantes,
        _statusCalculado: statusCalculado
      };
    });
  }, [entregas]);

  // Contadores KPIs
  const kpis = useMemo(() => {
    const total = entregasProcessadas.length;
    const ativos = entregasProcessadas.filter(e => e._statusCalculado === "ativo").length;
    const vencendo = entregasProcessadas.filter(e => e._statusCalculado === "vencendo").length;
    const vencidos = entregasProcessadas.filter(e => e._statusCalculado === "vencido").length;
    return { total, ativos, vencendo, vencidos };
  }, [entregasProcessadas]);

  // Filtragem
  const filtradas = useMemo(() => {
    return entregasProcessadas.filter((e) => {
      if (filtroStatus === "ativos" && e._statusCalculado !== "ativo") return false;
      if (filtroStatus === "vencendo" && e._statusCalculado !== "vencendo") return false;
      if (filtroStatus === "vencidos" && e._statusCalculado !== "vencido") return false;

      if (busca) {
        const b = busca.toLowerCase();
        const nome = (e.nome_colaborador || "").toLowerCase();
        const epi = (e.tipo_epi || "").toLowerCase();
        const ca = (e.numero_ca || "").toLowerCase();
        return nome.includes(b) || epi.includes(b) || ca.includes(b);
      }
      return true;
    });
  }, [entregasProcessadas, filtroStatus, busca]);

  // Mutation para cadastrar entrega
  const criarEntregaMutation = useMutation({
    mutationFn: async (payload) => {
      return await base44.entities.EntregaEPI.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas-epi"] });
      toast.success("Entrega de EPI registrada com sucesso!");
      setDialogNovaEntrega(false);
      setColaboradorNome("");
      setObservacoes("");
    },
    onError: (err) => {
      toast.error("Erro ao registrar entrega: " + (err?.message || "Tente novamente"));
    }
  });

  // Mutation para trocar EPI
  const trocarEpiMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.EntregaEPI.update(id, {
        status: "trocado",
        data_troca: format(new Date(), "yyyy-MM-dd")
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entregas-epi"] });
      toast.success("EPI marcado como trocado / substituído!");
    }
  });

  const handleSalvarEntrega = () => {
    if (!colaboradorNome.trim()) {
      toast.error("Informe o nome do colaborador");
      return;
    }

    const dEntr = parseISO(dataEntrega);
    const dTroca = format(addDays(dEntr, Number(validadeDias || 60)), "yyyy-MM-dd");

    criarEntregaMutation.mutate({
      nome_colaborador: colaboradorNome.trim(),
      setor: setorColaborador,
      unidade: filialAtiva || "Matriz AJL",
      tipo_epi: tipoEpi,
      numero_ca: numeroCa,
      quantidade: Number(quantidade) || 1,
      data_entrega: dataEntrega,
      validade_dias: Number(validadeDias) || 60,
      data_prevista_troca: dTroca,
      status: "ativo",
      observacoes: observacoes.trim()
    });
  };

  const handleSelecionarEpiPredefinido = (epi) => {
    setTipoEpi(epi.nome);
    setNumeroCa(epi.ca);
    setValidadeDias(epi.validadePadrao);
    setDialogNovaEntrega(true);
  };

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Controle de EPI Digital
              </h1>
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] py-0 font-bold">
                NR-6 Compliance
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Ficha digital de entrega, controle de CA e alerta de validade para o chão de fábrica
            </p>
          </div>
        </div>

        <Button
          onClick={() => setDialogNovaEntrega(true)}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 shadow-xs shrink-0"
        >
          <Plus className="w-4 h-4" /> Registrar Nova Entrega
        </Button>
      </div>

      {/* Cards de Métricas & Alertas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-muted-foreground block mb-1">Total de Entregas</span>
          <p className="text-2xl font-black text-foreground">{kpis.total}</p>
          <span className="text-[10px] text-muted-foreground mt-0.5 block">Histórico de registros</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block mb-1">🟢 No Prazo (Ativos)</span>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{kpis.ativos}</p>
          <span className="text-[10px] text-muted-foreground mt-0.5 block">Equipamentos válidos</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-amber-600 dark:text-amber-400 font-bold block mb-1">🟡 Vencendo em 7 dias</span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{kpis.vencendo}</p>
          <span className="text-[10px] text-muted-foreground mt-0.5 block">Programar substituição</span>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs">
          <span className="text-xs text-rose-600 dark:text-rose-400 font-bold block mb-1">🔴 Vencidos / Troca Imediata</span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{kpis.vencidos}</p>
          <span className="text-[10px] text-muted-foreground mt-0.5 block">Requer troca urgente</span>
        </div>
      </div>

      {/* Catálogo Rápido de EPIs da Fábrica */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Entrega Rápida — Equipamentos Mais Utilizados
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {EPIS_PADRAO.map((epi) => (
            <button
              key={epi.nome}
              type="button"
              onClick={() => handleSelecionarEpiPredefinido(epi)}
              className="bg-card hover:bg-muted/40 border border-border rounded-xl p-2.5 text-left transition-all hover:scale-[1.02] shadow-xs group"
            >
              <span className="text-xl block mb-1">{epi.icone}</span>
              <strong className="text-xs text-foreground block truncate group-hover:text-primary transition-colors">
                {epi.nome}
              </strong>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                CA {epi.ca} · {epi.validadePadrao} dias
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Tabela de Entregas e Filtros */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          {/* Filtro de Status */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setFiltroStatus("todos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filtroStatus === "todos" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Todos ({kpis.total})
            </button>
            <button
              onClick={() => setFiltroStatus("ativos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filtroStatus === "ativos" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              No Prazo ({kpis.ativos})
            </button>
            <button
              onClick={() => setFiltroStatus("vencendo")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filtroStatus === "vencendo" ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Vencendo ({kpis.vencendo})
            </button>
            <button
              onClick={() => setFiltroStatus("vencidos")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                filtroStatus === "vencidos" ? "bg-rose-600 text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              Vencidos ({kpis.vencidos})
            </button>
          </div>

          {/* Busca por Colaborador ou EPI */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar colaborador ou CA..."
              className="pl-8 h-8 text-xs"
            />
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-3 px-4">Colaborador</th>
                <th className="py-3 px-4">Equipamento (EPI)</th>
                <th className="py-3 px-4">CA</th>
                <th className="py-3 px-4">Data Entrega</th>
                <th className="py-3 px-4">Dias Restantes</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nenhuma entrega de EPI encontrada com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                filtradas.map((e) => {
                  const dias = e._diasRestantes;
                  const isVencido = e._statusCalculado === "vencido";
                  const isVencendo = e._statusCalculado === "vencendo";
                  const isTrocado = e.status === "trocado";

                  return (
                    <tr key={e.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4">
                        <strong className="text-foreground block">{e.nome_colaborador}</strong>
                        <span className="text-[10px] text-muted-foreground capitalize">
                          {e.setor?.replace("_", " ")} · {e.unidade || "AJL"}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-bold text-foreground block">{e.tipo_epi}</span>
                        {e.observacoes && (
                          <span className="text-[10px] text-muted-foreground truncate block max-w-xs">
                            {e.observacoes}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-mono font-bold text-primary">
                        {e.numero_ca || "—"}
                      </td>

                      <td className="py-3 px-4 text-muted-foreground">
                        {e.data_entrega || "—"}
                      </td>

                      <td className="py-3 px-4">
                        {isTrocado ? (
                          <span className="text-muted-foreground">Substituído</span>
                        ) : dias !== null ? (
                          <span className={isVencido ? "text-rose-600 font-bold" : isVencendo ? "text-amber-600 font-bold" : "text-emerald-600"}>
                            {dias < 0 ? `Vencido há ${Math.abs(dias)} dias` : `${dias} dias restantes`}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-3 px-4 text-center">
                        {isTrocado ? (
                          <Badge variant="outline" className="text-[10px] py-0 text-muted-foreground">Trocado</Badge>
                        ) : isVencido ? (
                          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] py-0 font-bold">
                            Vencido
                          </Badge>
                        ) : isVencendo ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[10px] py-0 font-bold">
                            Vence em breve
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] py-0 font-bold">
                            No Prazo
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {!isTrocado && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => trocarEpiMutation.mutate(e.id)}
                            disabled={trocarEpiMutation.isPending}
                            className="h-7 text-xs gap-1 border-border hover:border-primary"
                            title="Marcar como trocado / renovado"
                          >
                            <RotateCcw className="w-3 h-3" /> Trocar EPI
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Registro de Nova Entrega */}
      <Dialog open={dialogNovaEntrega} onOpenChange={setDialogNovaEntrega}>
        <DialogContent className="max-w-md font-sans">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              Registrar Entrega de EPI (NR-6)
            </DialogTitle>
            <DialogDescription className="text-xs">
              Cadastre a entrega individual com número de CA e prazo estimado de troca.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-2">
            {/* Colaborador */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Nome do Colaborador *</Label>
              <Input
                placeholder="Ex: João Silva ou selecione abaixo..."
                value={colaboradorNome}
                onChange={(e) => setColaboradorNome(e.target.value)}
                className="h-9 text-xs"
              />
              {/* Sugestões rápidas de operadores */}
              {usuarios.length > 0 && !colaboradorNome && (
                <div className="flex flex-wrap gap-1 pt-1 max-h-20 overflow-y-auto">
                  {usuarios.slice(0, 8).map(u => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setColaboradorNome(u.full_name || u.email)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-muted hover:bg-muted/80 border border-border"
                    >
                      {u.full_name || u.email}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Setor */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Setor do Colaborador</Label>
              <Select value={setorColaborador} onValueChange={setSetorColaborador}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="corte_dobra">Corte e Dobra</SelectItem>
                  <SelectItem value="telhas">Telhas</SelectItem>
                  <SelectItem value="expedicao">Expedição & Logística</SelectItem>
                  <SelectItem value="manutencao">Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de EPI & CA */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Equipamento (EPI) *</Label>
                <Input
                  value={tipoEpi}
                  onChange={(e) => setTipoEpi(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Certificado (CA) *</Label>
                <Input
                  value={numeroCa}
                  onChange={(e) => setNumeroCa(e.target.value)}
                  placeholder="Ex: 36.214"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Data de Entrega e Validade em Dias */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Data da Entrega</Label>
                <Input
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Validade Estimada (dias)</Label>
                <Input
                  type="number"
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(e.target.value)}
                  placeholder="Ex: 30, 60, 90..."
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Observações / Motivo (Opcional)</Label>
              <Input
                placeholder="Ex: Substituição por desgaste, admissão..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDialogNovaEntrega(false)}>
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSalvarEntrega}
              disabled={criarEntregaMutation.isPending || !colaboradorNome.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Confirmar Entrega
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}