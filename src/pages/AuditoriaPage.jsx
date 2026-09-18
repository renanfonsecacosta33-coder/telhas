import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Calendar,
  Clock,
  User,
  Activity,
  FileText,
  Sliders,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Building2,
  Layers,
  ArrowRightLeft
} from "lucide-react";
import { format, subDays, isToday, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACAO_CONFIG } from "@/lib/auditHelper";
import { useFilial } from "@/contexts/FilialContext";
import { toast } from "sonner";

const FILIAIS = ["Todas", "Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];

export default function AuditoriaPage() {
  const { filialAtiva } = useFilial();
  const [filialFiltro, setFilialFiltro] = useState("Todas");
  const [acaoFiltro, setAcaoFiltro] = useState("todos");
  const [entidadeFiltro, setEntidadeFiltro] = useState("todos");
  const [periodoFiltro, setPeriodoFiltro] = useState("7dias"); // 'hoje' | '7dias' | '30dias' | 'todos'
  const [busca, setBusca] = useState("");

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => base44.entities.AuditLog.list("-created_date", 1000),
    refetchInterval: 15000,
  });

  // Filtragem dos eventos
  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      // Filtro Filial
      if (filialFiltro !== "Todas" && log.unidade !== filialFiltro) return false;

      // Filtro Ação
      if (acaoFiltro !== "todos" && log.acao !== acaoFiltro) return false;

      // Filtro Entidade
      if (entidadeFiltro !== "todos" && log.entidade !== entidadeFiltro) return false;

      // Filtro Período
      if (periodoFiltro !== "todos" && log.data_hora) {
        try {
          const d = parseISO(log.data_hora);
          const agora = new Date();
          if (periodoFiltro === "hoje" && !isToday(d)) return false;
          if (periodoFiltro === "7dias" && d < subDays(agora, 7)) return false;
          if (periodoFiltro === "30dias" && d < subDays(agora, 30)) return false;
        } catch {}
      }

      // Busca por texto
      if (busca.trim()) {
        const q = busca.toLowerCase().trim();
        const texto = `${log.usuario_nome} ${log.usuario_email} ${log.registro_identificador} ${log.detalhes} ${log.entidade} ${log.unidade}`.toLowerCase();
        if (!texto.includes(q)) return false;
      }

      return true;
    });
  }, [logs, filialFiltro, acaoFiltro, entidadeFiltro, periodoFiltro, busca]);

  // Estatísticas rápidas
  const stats = useMemo(() => {
    const total = logsFiltrados.length;
    const setups = logsFiltrados.filter(l => l.acao === "setup").length;
    const statusMudancas = logsFiltrados.filter(l => l.acao === "status").length;
    const usuariosUnicos = new Set(logsFiltrados.map(l => l.usuario_nome)).size;
    return { total, setups, statusMudancas, usuariosUnicos };
  }, [logsFiltrados]);

  // Exportar para CSV
  const exportarCSV = () => {
    if (!logsFiltrados.length) {
      toast.error("Nenhum registro para exportar.");
      return;
    }

    const headers = ["Data/Hora", "Filial", "Usuário", "Perfil", "Ação", "Entidade", "Identificador", "Detalhes"];
    const rows = logsFiltrados.map(l => [
      l.data_hora ? format(parseISO(l.data_hora), "dd/MM/yyyy HH:mm:ss") : "—",
      `"${l.unidade || "—"}"`,
      `"${l.usuario_nome || "—"}"`,
      `"${l.usuario_role || "—"}"`,
      `"${l.acao || "—"}"`,
      `"${l.entidade || "—"}"`,
      `"${l.registro_identificador || "—"}"`,
      `"${(l.detalhes || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `auditoria_ajl_${format(new Date(), "yyyyMMdd_HHmm")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório de Auditoria exportado com sucesso!");
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto font-sans pb-16">
      {/* Header Executivo */}
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                Auditoria Centralizada
              </h1>
              <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border-indigo-300 text-xs font-bold">
                Audit Log
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rastreabilidade global de quem alterou o quê, quando e em qual unidade da AJL
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="text-xs gap-1.5 h-9"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </Button>

          <Button
            size="sm"
            onClick={exportarCSV}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs gap-1.5 h-9 shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            Eventos Filtrados
          </span>
          <span className="text-2xl font-black text-foreground">
            {stats.total.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            Mudanças de Status
          </span>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400">
            {stats.statusMudancas.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            Setups Registrados
          </span>
          <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400">
            {stats.setups.toLocaleString("pt-BR")}
          </span>
        </div>
        <div className="bg-card border border-border rounded-xl p-3.5 shadow-2xs">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
            Usuários / Operadores
          </span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {stats.usuariosUnicos}
          </span>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por operador, OP (#299371), bobina, filial ou detalhe..."
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap sm:flex-nowrap">
            {/* Filial */}
            <Select value={filialFiltro} onValueChange={setFilialFiltro}>
              <SelectTrigger className="h-9 text-xs w-full sm:w-36">
                <Building2 className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Filial" />
              </SelectTrigger>
              <SelectContent>
                {FILIAIS.map((f) => (
                  <SelectItem key={f} value={f} className="text-xs">
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Ação */}
            <Select value={acaoFiltro} onValueChange={setAcaoFiltro}>
              <SelectTrigger className="h-9 text-xs w-full sm:w-36">
                <SelectValue placeholder="Ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Todas as Ações</SelectItem>
                <SelectItem value="status" className="text-xs">Mudança Status</SelectItem>
                <SelectItem value="setup" className="text-xs">Setup Máquina</SelectItem>
                <SelectItem value="criacao" className="text-xs">Criação</SelectItem>
                <SelectItem value="edicao" className="text-xs">Edição</SelectItem>
                <SelectItem value="transferencia" className="text-xs">Transferência</SelectItem>
                <SelectItem value="exclusao" className="text-xs">Exclusão</SelectItem>
              </SelectContent>
            </Select>

            {/* Período */}
            <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
              <SelectTrigger className="h-9 text-xs w-full sm:w-32">
                <Calendar className="w-3.5 h-3.5 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hoje" className="text-xs">Hoje</SelectItem>
                <SelectItem value="7dias" className="text-xs">Últimos 7 dias</SelectItem>
                <SelectItem value="30dias" className="text-xs">Últimos 30 dias</SelectItem>
                <SelectItem value="todos" className="text-xs">Todo o Período</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Timeline de Eventos */}
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-border">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Timeline de Ações Auditadas
          </h2>
          <span className="text-xs text-muted-foreground">
            {logsFiltrados.length} registro(s) encontrado(s)
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-xs animate-pulse">
            Carregando histórico de auditoria...
          </div>
        ) : logsFiltrados.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs">
            Nenhum registro de auditoria corresponde aos filtros selecionados.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {logsFiltrados.map((log) => {
              const cfg = ACAO_CONFIG[log.acao] || ACAO_CONFIG.status;
              const dataFormatada = log.data_hora
                ? format(parseISO(log.data_hora), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })
                : "Data não registrada";

              return (
                <div key={log.id} className="relative group">
                  {/* Ponto na timeline */}
                  <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-primary border-2 border-background ring-2 ring-primary/20 group-hover:scale-125 transition-transform" />

                  <div className="bg-muted/30 hover:bg-muted/60 border border-border rounded-xl p-3.5 transition-all">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`${cfg.badge} text-[10px] font-bold uppercase`}>
                          {cfg.label}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] font-semibold border-slate-300">
                          {log.unidade || "Matriz"}
                        </Badge>
                        {log.entidade && (
                          <span className="text-xs font-mono font-bold text-foreground bg-white dark:bg-slate-800 px-1.5 py-0.5 rounded border border-border">
                            {log.entidade}: {log.registro_identificador || log.registro_id}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{dataFormatada}</span>
                      </div>
                    </div>

                    <p className="text-xs font-medium text-foreground leading-relaxed mt-1">
                      {log.detalhes}
                    </p>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/60">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span>
                        Operador/Usuário: <strong>{log.usuario_nome || log.usuario_email}</strong> ({log.usuario_role || "operador"})
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
