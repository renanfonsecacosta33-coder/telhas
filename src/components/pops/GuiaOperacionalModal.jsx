import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  GitBranch, 
  ListOrdered, 
  ShieldAlert, 
  Wrench, 
  Users, 
  Clock, 
  Printer, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronRight, 
  Tablet, 
  Layers, 
  Sparkles,
  Info,
  Maximize2,
  Camera,
  Scale,
  Scissors,
  FileCheck,
  Search,
  Send,
  RefreshCw,
  Play,
  ArrowDown,
  HelpCircle,
  Laptop,
  LayoutGrid
} from "lucide-react";
import { getPopPorMaquina, POPS_DATA } from "@/data/popsData";

/**
 * Renderiza um mini-mockup visual simulando a tela real ou o posto da máquina
 */
function MiniMockupVisual({ etapa, popId }) {
  const t = String(etapa.titulo || "").toLowerCase();
  const d = String(etapa.desc || "").toLowerCase();

  // 1. Leitura de Nota Fiscal com IA
  if (t.includes("leitura") || t.includes("ia") || t.includes("ocr") || t.includes("nota fiscal") || d.includes("camera") || d.includes("foto")) {
    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-gradient-to-r from-blue-950/80 to-indigo-950/80 border border-blue-500/40 text-blue-100 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-blue-300">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            Interface: Leitura Automática com IA (Base44)
          </span>
          <span className="px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 text-[10px]">OCR Ativo</span>
        </div>
        <div className="flex items-center gap-2 pt-0.5">
          <div className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-[10px] flex items-center gap-1 shadow-sm">
            <Camera className="w-3 h-3" /> 📸 Tirar Foto da NF
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-[10px] flex items-center gap-1">
            📎 Anexar PDF / Imagem
          </div>
        </div>
      </div>
    );
  }

  // 2. Múltiplas Bobinas / Lote
  if (t.includes("lote") || t.includes("multiplas") || t.includes("múltiplas") || d.includes("cadastrar todas em lote") || d.includes("te0150")) {
    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-100 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            Card: MultiplasBobinasNFCard
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-mono font-bold">Sequência TE####</span>
        </div>
        <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg text-[10px]">
          <span className="text-slate-300">Detectadas: <strong className="text-emerald-300">TE0158, TE0159, TE0160</strong></span>
          <span className="px-2 py-1 rounded bg-emerald-600 text-white font-bold text-[10px] shadow">
            ⚡ Cadastrar Todas em Lote
          </span>
        </div>
      </div>
    );
  }

  // 3. Pesagem Balança & Metragem
  if (t.includes("pesagem") || t.includes("balança") || t.includes("balanca") || t.includes("pesar") || d.includes("metragem") || d.includes("7850")) {
    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-blue-400" />
            Painel da Balança Industrial AJL
          </span>
          <span className="text-[10px] text-amber-400 font-mono">Tolerância Máx ±3%</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Peso Líquido Aferido</span>
            <span className="text-sm font-mono font-bold text-emerald-400">4.850 kg</span>
          </div>
          <div className="bg-slate-950 p-1.5 rounded-lg border border-slate-800">
            <span className="text-[10px] text-slate-400 block">Metragem Calculada</span>
            <span className="text-sm font-mono font-bold text-blue-400">1.197 metros</span>
          </div>
        </div>
      </div>
    );
  }

  // 4. Mandril / Setup de Máquina / Balancim
  if (t.includes("mandril") || t.includes("içamento") || t.includes("balancim") || t.includes("castanha") || d.includes("desbobinador") || d.includes("ponte rolante")) {
    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-indigo-950/80 border border-indigo-500/40 text-indigo-100 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-indigo-300">
          <span className="flex items-center gap-1.5">
            <Wrench className="w-3.5 h-3.5 text-indigo-400" />
            Setup do Mandril Expansivo (NR-11 & NR-12)
          </span>
          <span className="px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px]">Trava Mecânica</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <div className="bg-black/30 p-1.5 rounded border border-indigo-900/60 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>4 Castanhas C-Hook 100% Cravadas</span>
          </div>
          <div className="bg-black/30 p-1.5 rounded border border-indigo-900/60 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Disco Lateral Anti-Deslizamento OK</span>
          </div>
        </div>
      </div>
    );
  }

  // 5. Corte da Fita / Braço Pressor
  if (t.includes("braço pressor") || t.includes("fita") || t.includes("arqueação") || d.includes("pressor pneumático")) {
    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-amber-950/80 border border-amber-500/40 text-amber-100 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-bold text-amber-300">
          <span className="flex items-center gap-1.5">
            <Scissors className="w-3.5 h-3.5 text-amber-400" />
            Segurança no Corte da Cinta de Aço
          </span>
          <span className="px-1.5 py-0.5 rounded bg-red-500/30 text-red-300 text-[10px] font-bold">Risco de Efeito Mola</span>
        </div>
        <p className="text-[10px] text-amber-200/90 leading-tight">
          Braço pneumático abaixado com firmeza sobre o rolo antes de cortar a primeira fita metálica.
        </p>
      </div>
    );
  }

  // 6. Confirmação no Tablet / OP
  if (t.includes("tablet") || t.includes("introdução") || t.includes("confirmação") || t.includes("salvar") || d.includes("confirmar bobina")) {
    return (
      <div className="mt-2.5 p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300">
          <span className="flex items-center gap-1.5">
            <Tablet className="w-3.5 h-3.5 text-blue-400" />
            Tela do Operador: Diálogo de Conferência
          </span>
          <span className="text-[10px] text-emerald-400 font-bold">● Pronto p/ Produzir</span>
        </div>
        <div className="flex items-center justify-between bg-black/40 p-2 rounded-lg text-[10px]">
          <span className="text-slate-300">Código validado: <strong className="text-white font-mono">TE0158 (0,43 mm)</strong></span>
          <span className="px-2.5 py-1 rounded-md bg-blue-600 text-white font-bold flex items-center gap-1 shadow">
            <Play className="w-2.5 h-2.5" /> Confirmar Bobina
          </span>
        </div>
      </div>
    );
  }

  return null;
}

export default function GuiaOperacionalModal({
  open,
  onClose,
  maquinaNome = "TP - 40",
  popDataPersonalizado = null
}) {
  const [tabAtiva, setTabAtiva] = useState("fluxograma");
  const [modoVisualFluxo, setModoVisualFluxo] = useState("blocos"); // "blocos" | "esteira"
  const pop = popDataPersonalizado || getPopPorMaquina(maquinaNome);

  if (!pop) return null;

  const handleImprimir = () => {
    window.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-2 border-border/80 shadow-2xl">
        {/* Header Estilizado */}
        <div className={`p-6 bg-gradient-to-r ${pop.corHeader} text-white flex-shrink-0 relative overflow-hidden`}>
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-4 opacity-10 pointer-events-none">
            <GitBranch className="w-56 h-56 text-white" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge className="bg-white/20 hover:bg-white/30 text-white border-white/30 text-xs font-mono font-bold tracking-wider">
                  {pop.id}
                </Badge>
                <Badge className="bg-black/30 hover:bg-black/40 text-white/90 border-transparent text-xs">
                  {pop.setor}
                </Badge>
                <span className="text-white/80 text-xs flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> {pop.equipePadrao}
                </span>
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {pop.titulo}
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs sm:text-sm mt-0.5 max-w-2xl">
                {pop.subtitulo}
              </DialogDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleImprimir}
              className="bg-white/10 hover:bg-white/20 text-white border-white/30 gap-1.5 self-start sm:self-auto text-xs shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Ficha</span>
            </Button>
          </div>
        </div>

        {/* Abas de Navegação */}
        <Tabs value={tabAtiva} onValueChange={setTabAtiva} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b border-border bg-muted/40 px-6 pt-2 shrink-0">
            <TabsList className="bg-background/80 border border-border/60 p-1 rounded-xl h-auto flex flex-wrap sm:inline-flex">
              <TabsTrigger value="fluxograma" className="gap-2 text-xs sm:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
                <GitBranch className="w-4 h-4" />
                <span>Fluxograma Visual</span>
              </TabsTrigger>
              <TabsTrigger value="passos" className="gap-2 text-xs sm:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
                <ListOrdered className="w-4 h-4" />
                <span>Passo a Passo (1 a 6)</span>
              </TabsTrigger>
              <TabsTrigger value="seguranca" className="gap-2 text-xs sm:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
                <ShieldAlert className="w-4 h-4" />
                <span>Segurança & EPIs</span>
              </TabsTrigger>
              <TabsTrigger value="defeitos" className="gap-2 text-xs sm:text-sm py-2 px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold">
                <Wrench className="w-4 h-4" />
                <span>Solução de Defeitos</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Conteúdo das Abas */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* ABA 1: FLUXOGRAMA VISUAL COM BLOCOS GRÁFICOS, BIFURCAÇÕES E MOCKUPS */}
            <TabsContent value="fluxograma" className="m-0 space-y-5">
              
              {/* Barra de Ferramentas do Fluxograma */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/30 p-3 rounded-xl border border-border/60">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                    Diagrama de Blocos Gráfico com Conectores
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Sequência padronizada com bifurcações de decisão (SIM/NÃO) e mini-mockups das telas reais.
                  </p>
                </div>

                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <Button
                    type="button"
                    size="sm"
                    variant={modoVisualFluxo === "blocos" ? "default" : "outline"}
                    onClick={() => setModoVisualFluxo("blocos")}
                    className="h-7 text-xs font-bold gap-1 px-2.5"
                  >
                    <GitBranch className="w-3.5 h-3.5" />
                    <span>Diagrama Gráfico</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={modoVisualFluxo === "esteira" ? "default" : "outline"}
                    onClick={() => setModoVisualFluxo("esteira")}
                    className="h-7 text-xs font-bold gap-1 px-2.5"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>Esteira Linear</span>
                  </Button>
                </div>
              </div>

              {/* RENDERIZAÇÃO DO DIAGRAMA DE BLOCOS GRÁFICO (FLUXOGRAMA OFICIAL) */}
              {modoVisualFluxo === "blocos" ? (
                <div className="space-y-4 max-w-3xl mx-auto">
                  {pop.fluxo?.map((etapa, idx) => {
                    const isUltimo = idx === pop.fluxo.length - 1;
                    const isDecisao = etapa.tipo === "decisao";
                    const isInspecao = etapa.tipo === "inspecao";
                    const isFinalizacao = etapa.tipo === "finalizacao";

                    return (
                      <div key={idx} className="flex flex-col items-center">
                        {/* Bloco do Fluxograma */}
                        <div className={`w-full rounded-2xl border-2 p-4 sm:p-5 transition-all shadow-md ${
                          isDecisao
                            ? "bg-amber-500/10 border-amber-400 dark:border-amber-500 hover:shadow-amber-500/10"
                            : isFinalizacao
                              ? "bg-emerald-500/10 border-emerald-500 hover:shadow-emerald-500/10"
                              : isInspecao
                                ? "bg-blue-500/10 border-blue-400 dark:border-blue-500 hover:shadow-blue-500/10"
                                : "bg-card border-border hover:border-primary/50"
                        }`}>
                          {/* Cabeçalho do Bloco */}
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-2.5 mb-2.5">
                            <div className="flex items-center gap-2.5">
                              <span className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shadow-sm ${
                                isFinalizacao
                                  ? "bg-emerald-600 text-white"
                                  : isDecisao
                                    ? "bg-amber-500 text-white"
                                    : isInspecao
                                      ? "bg-blue-600 text-white"
                                      : "bg-primary text-primary-foreground"
                              }`}>
                                {etapa.passo}
                              </span>
                              <div>
                                <span className="font-bold text-sm sm:text-base text-foreground block">
                                  {etapa.titulo}
                                </span>
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  📍 Posto: {etapa.posto}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isDecisao && (
                                <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-400/40 text-[10px] uppercase font-bold">
                                  Bifurcação de Decisão
                                </Badge>
                              )}
                              {isInspecao && (
                                <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-400/40 text-[10px] uppercase font-bold">
                                  Inspeção de Qualidade
                                </Badge>
                              )}
                              {isFinalizacao && (
                                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-400/40 text-[10px] uppercase font-bold">
                                  Conclusão & Gravação
                                </Badge>
                              )}
                              {etapa.tempo && (
                                <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 bg-muted/60 px-2 py-0.5 rounded-md">
                                  <Clock className="w-3 h-3" /> {etapa.tempo}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Descrição Operacional */}
                          <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-medium">
                            {etapa.desc}
                          </p>

                          {/* Se for Decisão: Renderiza bifurcação gráfica SIM / NÃO */}
                          {isDecisao && (
                            <div className="mt-3 pt-3 border-t border-amber-300/40 dark:border-amber-700/40 space-y-2">
                              <span className="text-[11px] font-bold text-amber-900 dark:text-amber-300 flex items-center gap-1">
                                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                                Escolha do Fluxo Conforme Cenário da Fábrica:
                              </span>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200 space-y-1">
                                  <span className="font-bold flex items-center gap-1 text-emerald-700 dark:text-emerald-400 text-[11px]">
                                    🟢 ROTA 1: SIM / RECOMENDADO
                                  </span>
                                  <p className="text-[11px] leading-tight">
                                    Múltiplas bobinas ou conformidade total $\rightarrow$ Seguir com importação em lote e geração automática de códigos.
                                  </p>
                                </div>
                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-950 dark:text-amber-200 space-y-1">
                                  <span className="font-bold flex items-center gap-1 text-amber-700 dark:text-amber-400 text-[11px]">
                                    🟠 ROTA 2: NÃO / CONTINGÊNCIA
                                  </span>
                                  <p className="text-[11px] leading-tight">
                                    Falta de laudo ou divergência $\rightarrow$ Acionar justificativa com assinatura do encarregado ou conferência física.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Mini-Mockup Visual da Tela ou Posto */}
                          <MiniMockupVisual etapa={etapa} popId={pop.id} />
                        </div>

                        {/* Seta Conectora Visual Direcional SVG entre os nós */}
                        {!isUltimo && (
                          <div className="flex flex-col items-center my-1">
                            <div className="w-0.5 h-6 bg-gradient-to-b from-primary via-blue-500 to-indigo-500 animate-pulse"></div>
                            <div className="w-3 h-3 rotate-45 border-r-2 border-b-2 border-primary -mt-1.5"></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* MODO ESTEIRA LINEAR COMPACTA */
                <div className="space-y-3 relative before:absolute before:top-4 before:bottom-4 before:left-[19px] before:w-0.5 before:bg-border/80">
                  {pop.fluxo?.map((etapa, idx) => (
                    <div key={idx} className="relative flex items-start gap-4 pl-1 group">
                      <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0 z-10 shadow-sm border-2 border-background">
                        {etapa.passo}
                      </div>
                      <div className="flex-1 rounded-xl p-4 border bg-card border-border hover:border-primary/50 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm text-foreground">{etapa.titulo}</span>
                          <span className="text-xs text-muted-foreground font-mono">📍 {etapa.posto} · {etapa.tempo}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{etapa.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </TabsContent>

            {/* ABA 2: PASSO A PASSO DETALHADO COM MINI-MOCKUPS DAS TELAS */}
            <TabsContent value="passos" className="m-0 space-y-4">
              <div className="space-y-4">
                {pop.passosDetalhados?.map((passo, idx) => (
                  <div key={idx} className="bg-card border border-border rounded-xl p-5 shadow-xs space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary font-bold text-sm flex items-center justify-center shrink-0">
                        {passo.numero}
                      </div>
                      <h4 className="font-bold text-base text-foreground">
                        {passo.titulo}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {/* O que fazer na máquina */}
                      <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-lg p-3 space-y-1">
                        <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          ⚙️ No Posto Físico / Máquina:
                        </span>
                        <p className="text-muted-foreground leading-relaxed">
                          {passo.acaoFisica}
                        </p>
                      </div>

                      {/* O que fazer no Tablet */}
                      <div className="bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg p-3 space-y-1">
                        <span className="font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                          📱 No Tablet AJL (App Base44):
                        </span>
                        <p className="text-blue-950/80 dark:text-blue-200/80 leading-relaxed">
                          {passo.acaoTablet}
                        </p>
                      </div>
                    </div>

                    {/* Mini Mockup Visual ilustrativo no passo */}
                    <MiniMockupVisual etapa={{ titulo: passo.titulo, desc: passo.acaoTablet }} popId={pop.id} />

                    {passo.criterioQualidade && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-800 dark:text-emerald-300 text-xs">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span><strong>Critério de Aceite:</strong> {passo.criterioQualidade}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* ABA 3: SEGURANÇA & EPIS */}
            <TabsContent value="seguranca" className="m-0 space-y-6">
              {/* Regras Críticas de Segurança */}
              <div className="bg-rose-500/10 border-2 border-rose-500/30 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                  <ShieldAlert className="w-5 h-5" />
                  <span>Regras de Ouro de Segurança (Tolerância Zero)</span>
                </div>
                <ul className="space-y-2">
                  {pop.regrasSeguranca?.map((regra, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-rose-950 dark:text-rose-200 leading-relaxed">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{regra}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Grid de EPIs Obrigatórios */}
              <div className="space-y-3">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  🛡️ EPIs de Uso Obrigatório no Posto
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {pop.epis?.map((epi, idx) => (
                    <div key={idx} className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-xs text-foreground leading-tight">
                          {epi.nome}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 shrink-0">
                          {epi.norma}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {epi.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* ABA 4: SOLUÇÃO DE DEFEITOS */}
            <TabsContent value="defeitos" className="m-0 space-y-4">
              <div>
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-primary" />
                  Guia Rápido de Resolução de Não-Conformidades
                </h4>
                <p className="text-xs text-muted-foreground">
                  Identificou algum desvio visual ou dimensional? Aplique a correção imediata recomendada.
                </p>
              </div>

              <div className="space-y-3">
                {pop.defeitos?.map((def, idx) => (
                  <div key={idx} className="bg-card border border-border rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs sm:text-sm">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Sintoma: {def.sintoma}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
                        <span className="font-semibold text-muted-foreground block mb-0.5">Causa Provável:</span>
                        <span className="text-foreground">{def.causa}</span>
                      </div>
                      <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                        <span className="font-semibold text-emerald-800 dark:text-emerald-300 block mb-0.5">Ação Corretiva:</span>
                        <span className="text-emerald-950 dark:text-emerald-200">{def.solucao}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
