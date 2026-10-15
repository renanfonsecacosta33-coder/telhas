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
  Maximize2
} from "lucide-react";
import { getPopPorMaquina, POPS_DATA } from "@/data/popsData";

export default function GuiaOperacionalModal({
  open,
  onClose,
  maquinaNome = "TP - 40",
  popDataPersonalizado = null
}) {
  const [tabAtiva, setTabAtiva] = useState("fluxograma");
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
            
            {/* ABA 1: FLUXOGRAMA VISUAL */}
            <TabsContent value="fluxograma" className="m-0 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Esteira Operacional Sequencial
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Siga o fluxo da esquerda para a direita (ou de cima para baixo) para garantir conformidade e zero refugo.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">
                  {pop.fluxo?.length || 0} Etapas Padronizadas
                </Badge>
              </div>

              {/* Grid de Etapas do Fluxograma */}
              <div className="space-y-3 relative before:absolute before:top-4 before:bottom-4 before:left-[19px] before:w-0.5 before:bg-border/80">
                {pop.fluxo?.map((etapa, idx) => {
                  const isUltimo = idx === pop.fluxo.length - 1;
                  const isDecisao = etapa.tipo === "decisao";
                  const isInspecao = etapa.tipo === "inspecao";
                  const isFinalizacao = etapa.tipo === "finalizacao";

                  return (
                    <div key={idx} className="relative flex items-start gap-4 pl-1 group">
                      {/* Nó / Ícone */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 z-10 shadow-sm border-2 transition-transform group-hover:scale-110 ${
                        isFinalizacao 
                          ? "bg-emerald-600 text-white border-emerald-500" 
                          : isDecisao 
                            ? "bg-amber-500 text-white border-amber-400" 
                            : isInspecao 
                              ? "bg-blue-600 text-white border-blue-500" 
                              : "bg-card text-foreground border-border"
                      }`}>
                        {etapa.passo}
                      </div>

                      {/* Card da Etapa */}
                      <div className={`flex-1 rounded-xl p-4 border transition-all ${
                        isDecisao 
                          ? "bg-amber-500/5 border-amber-500/30 hover:border-amber-500" 
                          : isFinalizacao 
                            ? "bg-emerald-500/5 border-emerald-500/30 hover:border-emerald-500" 
                            : "bg-card border-border/80 hover:border-primary/50"
                      }`}>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-foreground">
                              {etapa.titulo}
                            </span>
                            <Badge variant="outline" className="text-[10px] py-0 px-2 font-mono">
                              📍 {etapa.posto}
                            </Badge>
                          </div>
                          {etapa.tempo && (
                            <span className="text-xs text-muted-foreground font-mono flex items-center gap-1 shrink-0">
                              <Clock className="w-3.5 h-3.5" /> {etapa.tempo}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {etapa.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* ABA 2: PASSO A PASSO DETALHADO */}
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
