import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  FileSpreadsheet,
  PackageCheck,
  Archive,
  Layers,
  Sparkles,
  Loader2,
  Building2,
  Check
} from "lucide-react";
import { exportarPlanilhaBobinasOdoo } from "@/lib/exportarBobinasHelper";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useFilial } from "@/contexts/FilialContext";

export default function ExportarBobinasDialog({
  open,
  onOpenChange,
  setorInicial = "todos" // "todos" | "telhas" | "corte_dobra"
}) {
  const { filialAtiva } = useFilial();

  // Estados de seleção
  const [status, setStatus] = useState("ativas"); // "ativas" | "arquivadas" | "todas"
  const [setor, setSetor] = useState(setorInicial === "todos" ? "todos" : setorInicial); // "todos" | "telhas" | "corte_dobra"
  const [filialFiltro, setFilialFiltro] = useState("todas"); // "todas" | "ativa"
  const [exportando, setExportando] = useState(false);

  // Busca todas as bobinas do sistema para dar feedback instantâneo da contagem
  const { data: todasBobinas = [], isLoading } = useQuery({
    queryKey: ["todas-bobinas-exportacao"],
    queryFn: () => base44.entities.Bobina.filter({}, "codigo", 4000),
    staleTime: 60000,
    enabled: open
  });

  // Filial efetiva para o filtro
  const filialAplicada = filialFiltro === "ativa" ? (filialAtiva || "Matriz AJL") : "todas";

  // Bobinas filtradas de acordo com as opções selecionadas
  const bobinasSelecionadas = useMemo(() => {
    let list = todasBobinas;

    // Filtro de setor
    if (setor !== "todos") {
      list = list.filter(b => b.setor === setor);
    }

    // Filtro de filial
    if (filialAplicada !== "todas") {
      list = list.filter(b => (b.unidade || "Matriz AJL") === filialAplicada);
    }

    // Filtro de status
    if (status === "ativas") {
      list = list.filter(b => !b.arquivada);
    } else if (status === "arquivadas") {
      list = list.filter(b => b.arquivada);
    }

    return list;
  }, [todasBobinas, setor, filialAplicada, status]);

  // Estatísticas da seleção
  const totalKg = useMemo(() => {
    return bobinasSelecionadas.reduce((acc, b) => acc + (Number(b.peso_kg) || 0), 0);
  }, [bobinasSelecionadas]);

  // Aplica um atalho rápido pré-definido
  const aplicarAtalho = (novoStatus, novoSetor, novaFilial = "todas") => {
    setStatus(novoStatus);
    setSetor(novoSetor);
    setFilialFiltro(novaFilial);
  };

  // Dispara a exportação com os parâmetros atuais
  const handleExecutarExportacao = async () => {
    if (bobinasSelecionadas.length === 0) {
      toast.warning("Nenhuma bobina encontrada para os filtros selecionados.");
      return;
    }

    setExportando(true);
    try {
      const res = await exportarPlanilhaBobinasOdoo({
        setor,
        status,
        filial: filialAplicada,
        dadosPrecarregados: todasBobinas
      });

      toast.success(
        `Planilha gerada com sucesso! ${res.total} bobina(s) exportada(s).`,
        { description: `Arquivo baixado: ${res.nomeArquivo}` }
      );
      onOpenChange(false);
    } catch (err) {
      console.error("Erro ao exportar bobinas:", err);
      toast.error(err?.message || "Falha ao gerar planilha de bobinas.");
    } finally {
      setExportando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-slate-800 dark:text-slate-100">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            Exportar Planilha de Bobinas (Odoo / Excel)
          </DialogTitle>
          <DialogDescription>
            Escolha os critérios desejados para extrair o inventário de bobinas formatado com delimitador e acentuação brasileira.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* ATALHOS RÁPIDOS EM 1 CLIQUE */}
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Atalhos Rápidos de Exportação
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => aplicarAtalho("ativas", "todos")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between gap-1 ${
                  status === "ativas" && setor === "todos"
                    ? "border-emerald-500 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 ring-2 ring-emerald-500/20"
                    : "border-border hover:border-emerald-400/60 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                    Ambas Ativas
                  </span>
                  {status === "ativas" && setor === "todos" && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <span className="text-[11px] text-muted-foreground">Telhas + CD em estoque</span>
              </button>

              <button
                type="button"
                onClick={() => aplicarAtalho("ativas", "telhas")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between gap-1 ${
                  status === "ativas" && setor === "telhas"
                    ? "border-blue-500 bg-blue-50/80 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20"
                    : "border-border hover:border-blue-400/60 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-blue-600" />
                    Ativas de Telhas
                  </span>
                  {status === "ativas" && setor === "telhas" && <Check className="w-3.5 h-3.5 text-blue-600" />}
                </div>
                <span className="text-[11px] text-muted-foreground">Estoque perfiladeiras</span>
              </button>

              <button
                type="button"
                onClick={() => aplicarAtalho("ativas", "corte_dobra")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between gap-1 ${
                  status === "ativas" && setor === "corte_dobra"
                    ? "border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                    : "border-border hover:border-indigo-400/60 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-indigo-600" />
                    Ativas de Corte & Dobra
                  </span>
                  {status === "ativas" && setor === "corte_dobra" && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                </div>
                <span className="text-[11px] text-muted-foreground">Estoque de CD</span>
              </button>

              <button
                type="button"
                onClick={() => aplicarAtalho("arquivadas", "telhas")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between gap-1 ${
                  status === "arquivadas" && setor === "telhas"
                    ? "border-amber-500 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 ring-2 ring-amber-500/20"
                    : "border-border hover:border-amber-400/60 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5 text-amber-600" />
                    Arquivadas de Telhas
                  </span>
                  {status === "arquivadas" && setor === "telhas" && <Check className="w-3.5 h-3.5 text-amber-600" />}
                </div>
                <span className="text-[11px] text-muted-foreground">Encerradas de telhas</span>
              </button>

              <button
                type="button"
                onClick={() => aplicarAtalho("arquivadas", "corte_dobra")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between gap-1 ${
                  status === "arquivadas" && setor === "corte_dobra"
                    ? "border-orange-500 bg-orange-50/80 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 ring-2 ring-orange-500/20"
                    : "border-border hover:border-orange-400/60 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <Archive className="w-3.5 h-3.5 text-orange-600" />
                    Arquivadas de CD
                  </span>
                  {status === "arquivadas" && setor === "corte_dobra" && <Check className="w-3.5 h-3.5 text-orange-600" />}
                </div>
                <span className="text-[11px] text-muted-foreground">Encerradas de CD</span>
              </button>

              <button
                type="button"
                onClick={() => aplicarAtalho("todas", "todos")}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all flex flex-col justify-between gap-1 ${
                  status === "todas" && setor === "todos"
                    ? "border-purple-500 bg-purple-50/80 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 ring-2 ring-purple-500/20"
                    : "border-border hover:border-purple-400/60 bg-card hover:bg-muted/40"
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                    Todas do Sistema
                  </span>
                  {status === "todas" && setor === "todos" && <Check className="w-3.5 h-3.5 text-purple-600" />}
                </div>
                <span className="text-[11px] text-muted-foreground">Geral (Ativas + Histórico)</span>
              </button>
            </div>
          </div>

          {/* FILTROS DETALHADOS CUSTOMIZÁVEIS */}
          <div className="p-4 rounded-xl border border-border bg-slate-50/60 dark:bg-slate-900/40 space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Personalizar Critérios
            </span>

            {/* 1. Status */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Status das Bobinas:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={status === "ativas" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatus("ativas")}
                  className={`text-xs h-8 ${
                    status === "ativas"
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                      : "bg-card"
                  }`}
                >
                  <PackageCheck className="w-3.5 h-3.5 mr-1.5" />
                  Somente Ativas
                </Button>

                <Button
                  type="button"
                  variant={status === "arquivadas" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatus("arquivadas")}
                  className={`text-xs h-8 ${
                    status === "arquivadas"
                      ? "bg-amber-600 hover:bg-amber-700 text-white font-bold"
                      : "bg-card"
                  }`}
                >
                  <Archive className="w-3.5 h-3.5 mr-1.5" />
                  Somente Arquivadas
                </Button>

                <Button
                  type="button"
                  variant={status === "todas" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatus("todas")}
                  className={`text-xs h-8 ${
                    status === "todas"
                      ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 font-bold"
                      : "bg-card"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 mr-1.5" />
                  Todas (Ambas)
                </Button>
              </div>
            </div>

            {/* 2. Setor */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Setor de Destino:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={setor === "todos" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSetor("todos")}
                  className={`text-xs h-8 ${
                    setor === "todos"
                      ? "bg-primary text-primary-foreground font-bold"
                      : "bg-card"
                  }`}
                >
                  Ambos Setores
                </Button>

                <Button
                  type="button"
                  variant={setor === "telhas" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSetor("telhas")}
                  className={`text-xs h-8 ${
                    setor === "telhas"
                      ? "bg-blue-600 hover:bg-blue-700 text-white font-bold"
                      : "bg-card"
                  }`}
                >
                  Fábrica de Telhas
                </Button>

                <Button
                  type="button"
                  variant={setor === "corte_dobra" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSetor("corte_dobra")}
                  className={`text-xs h-8 ${
                    setor === "corte_dobra"
                      ? "bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
                      : "bg-card"
                  }`}
                >
                  Corte & Dobra
                </Button>
              </div>
            </div>

            {/* 3. Filial */}
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">
                Abrangência de Filial:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={filialFiltro === "todas" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilialFiltro("todas")}
                  className={`text-xs h-8 ${
                    filialFiltro === "todas"
                      ? "bg-slate-700 text-white font-bold dark:bg-slate-300 dark:text-slate-900"
                      : "bg-card"
                  }`}
                >
                  Todas as Filiais
                </Button>

                <Button
                  type="button"
                  variant={filialFiltro === "ativa" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilialFiltro("ativa")}
                  className={`text-xs h-8 ${
                    filialFiltro === "ativa"
                      ? "bg-slate-700 text-white font-bold dark:bg-slate-300 dark:text-slate-900"
                      : "bg-card"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 mr-1" />
                  Apenas {filialAtiva || "Filial Ativa"}
                </Button>
              </div>
            </div>
          </div>

          {/* PRÉVIA / RESUMO DO QUE SERÁ BAIXADO */}
          <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                  {isLoading ? (
                    <span className="flex items-center gap-1 text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando prévia...
                    </span>
                  ) : (
                    `${bobinasSelecionadas.length} bobina(s) selecionada(s)`
                  )}
                </span>
                <Badge className="bg-emerald-600 text-white text-[11px] font-bold">
                  {status === "ativas" ? "Ativas" : status === "arquivadas" ? "Arquivadas" : "Todas"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Setor: <strong className="text-foreground">{setor === "todos" ? "Ambos" : setor === "telhas" ? "Telhas" : "Corte e Dobra"}</strong>
                {" · "}
                Filial: <strong className="text-foreground">{filialAplicada === "todas" ? "Todas" : filialAplicada}</strong>
                {totalKg > 0 && ` · Peso Total: ≈ ${totalKg.toLocaleString("pt-BR")} kg`}
              </p>
            </div>

            <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-mono bg-emerald-500/20 px-2 py-1 rounded">
              .CSV (Excel / Odoo)
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={exportando}>
            Cancelar
          </Button>

          <Button
            onClick={handleExecutarExportacao}
            disabled={exportando || isLoading || bobinasSelecionadas.length === 0}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2 shadow-sm"
          >
            {exportando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando Planilha...
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Baixar Planilha ({bobinasSelecionadas.length} bobinas)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
