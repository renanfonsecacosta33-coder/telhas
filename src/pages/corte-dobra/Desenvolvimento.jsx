import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Calculator, Plus, Search, CheckCircle2, Clock, AlertTriangle,
  ChevronDown, ChevronUp, Layers, Ruler, Settings, ShoppingCart, Eye, BarChart2, Scissors
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import DesenvolvimentoFormDialog from "@/components/corte-dobra/DesenvolvimentoFormDialog";
import AproveitamentoBlank from "@/components/corte-dobra/AproveitamentoBlank";
import OtimizadorCorte from "@/components/corte-dobra/OtimizadorCorte/OtimizadorCorte";

const STATUS_CONFIG = {
  rascunho:    { label: "Rascunho",     className: "bg-slate-100 text-slate-600 border-slate-200",  icon: Clock },
  aprovado:    { label: "Aprovado",     className: "bg-green-100 text-green-700 border-green-200",  icon: CheckCircle2 },
  em_producao: { label: "Em Produção",  className: "bg-amber-100 text-amber-700 border-amber-200",  icon: Settings },
  concluido:   { label: "Concluído",    className: "bg-blue-100 text-blue-700 border-blue-200",     icon: CheckCircle2 },
  cancelado:   { label: "Cancelado",    className: "bg-red-100 text-red-600 border-red-200",        icon: AlertTriangle },
};

export default function DesenvolvimentoCD() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [aba, setAba] = useState("lista"); // "lista" | "aproveitamento" | "otimizador"
  const [devAproveitamento, setDevAproveitamento] = useState(null);
  const [devOtimizador, setDevOtimizador] = useState(null);
  const queryClient = useQueryClient();

  const { data: desenvolvimentos = [], isLoading } = useQuery({
    queryKey: ["desenvolvimentos-cd"],
    queryFn: () => base44.entities.DesenvolvimentoCD.list("-created_date", 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.DesenvolvimentoCD.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["desenvolvimentos-cd"] });
      setDialogOpen(false);
      toast.success("Desenvolvimento criado!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DesenvolvimentoCD.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["desenvolvimentos-cd"] });
      setDialogOpen(false);
      toast.success("Desenvolvimento atualizado!");
    },
  });

  const handleSave = (data) => {
    if (editItem?.id) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  };

  const filtrados = desenvolvimentos.filter(d =>
    !search ||
    d.nome_peca?.toLowerCase().includes(search.toLowerCase()) ||
    d.numero_pedido?.toLowerCase().includes(search.toLowerCase()) ||
    d.cliente?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: desenvolvimentos.length,
    aprovados: desenvolvimentos.filter(d => d.status === "aprovado").length,
    rascunhos: desenvolvimentos.filter(d => d.status === "rascunho").length,
    em_producao: desenvolvimentos.filter(d => d.status === "em_producao").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="w-6 h-6 text-orange-500" />
            Desenvolvimento de Peças
          </h1>
          <p className="text-sm text-muted-foreground">Planificação, Fator K e parâmetros técnicos antes da OP</p>
        </div>
        {aba === "lista" && (
          <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2 bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4" /> Novo Desenvolvimento
          </Button>
        )}
      </div>

      {/* Abas */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        <button
          onClick={() => setAba("lista")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === "lista" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Calculator className="w-4 h-4" /> Desenvolvimentos
        </button>
        <button
          onClick={() => { setAba("aproveitamento"); setDevAproveitamento(null); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === "aproveitamento" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <BarChart2 className="w-4 h-4" /> Aproveitamento
        </button>
        <button
          onClick={() => setAba("otimizador")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${aba === "otimizador" ? "bg-white shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Scissors className="w-4 h-4" /> Otimizador de Corte
        </button>
      </div>

      {/* Aba Aproveitamento */}
      {aba === "aproveitamento" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold flex items-center gap-2">
              <BarChart2 className="w-5 h-5 text-orange-500" />
              Calculadora de Aproveitamento de Blank
            </h2>
            {devAproveitamento && (
              <Button variant="outline" size="sm" onClick={() => setDevAproveitamento(null)} className="text-xs">
                Limpar vinculo
              </Button>
            )}
          </div>
          <AproveitamentoBlank dev={devAproveitamento} />
        </div>
      )}

      {/* Aba Otimizador */}
      {aba === "otimizador" && (
        <div className="bg-card border border-border rounded-xl overflow-hidden -mx-1">
          <OtimizadorCorte devInicial={devOtimizador} />
        </div>
      )}

      {aba === "lista" && <>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total" value={stats.total} color="text-foreground" />
        <StatCard label="Aprovados" value={stats.aprovados} color="text-green-600" />
        <StatCard label="Rascunhos" value={stats.rascunhos} color="text-slate-500" />
        <StatCard label="Em Produção" value={stats.em_producao} color="text-amber-600" />
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar por peça, pedido ou cliente..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Calculator className="w-12 h-12 text-muted-foreground/20 mx-auto" />
          <p className="text-muted-foreground">Nenhum desenvolvimento encontrado.</p>
          <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2 bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4" /> Criar Primeiro Desenvolvimento
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrados.map(dev => {
            const statusCfg = STATUS_CONFIG[dev.status] || STATUS_CONFIG.rascunho;
            const StatusIcon = statusCfg.icon;
            const isExpanded = expandedId === dev.id;
            const dobras = dev.dobras_json ? JSON.parse(dev.dobras_json) : [];

            return (
              <div key={dev.id} className="bg-card border border-border rounded-xl overflow-hidden">
                {/* Linha principal */}
                <div className="px-4 py-3 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-base">{dev.nome_peca}</span>
                      <Badge className={`border text-xs ${statusCfg.className}`}>
                        <StatusIcon className="w-3 h-3 mr-1" />{statusCfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      {dev.numero_pedido && (
                        <span className="flex items-center gap-1"><ShoppingCart className="w-3 h-3 text-blue-500" /><strong className="text-blue-700">#{dev.numero_pedido}</strong>{dev.cliente && ` — ${dev.cliente}`}</span>
                      )}
                      {dev.material && <span><Layers className="w-3 h-3 inline mr-1" />{dev.material}</span>}
                      {dev.espessura_mm && <span>e={dev.espessura_mm}mm</span>}
                      {dev.comprimento_desenvolvido_mm && (
                        <span className="flex items-center gap-1 text-orange-600 font-bold">
                          <Ruler className="w-3 h-3" />Planif.: {dev.comprimento_desenvolvido_mm}mm
                        </span>
                      )}
                      {dev.numero_dobras > 0 && <span>{dev.numero_dobras} dobra(s)</span>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(dev.created_date), "dd/MM/yyyy", { locale: ptBR })}
                      {dev.responsavel && ` · ${dev.responsavel}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-8 text-xs gap-1" onClick={() => { setEditItem(dev); setDialogOpen(true); }}>
                      <Eye className="w-3.5 h-3.5" /> Editar
                    </Button>
                    <button onClick={() => setExpandedId(isExpanded ? null : dev.id)} className="p-2 text-muted-foreground hover:text-foreground">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Detalhe expandido */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 px-4 py-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <InfoBox label="Espessura" value={dev.espessura_mm ? `${dev.espessura_mm} mm` : "—"} />
                      <InfoBox label="Fator K" value={dev.fator_k || "—"} />
                      <InfoBox label="Comprimento Final" value={dev.comprimento_final_mm ? `${dev.comprimento_final_mm} mm` : "—"} />
                      <InfoBox label="Comprimento Desenvolvido" value={dev.comprimento_desenvolvido_mm ? `${dev.comprimento_desenvolvido_mm} mm` : "—"} highlight />
                      <InfoBox label="Largura Final" value={dev.largura_final_mm ? `${dev.largura_final_mm} mm` : "—"} />
                      <InfoBox label="Altura Final" value={dev.altura_final_mm ? `${dev.altura_final_mm} mm` : "—"} />
                      <InfoBox label="Raio Dobra" value={dev.raio_dobra_mm ? `${dev.raio_dobra_mm} mm` : "—"} />
                      <InfoBox label="Qtd. Peças" value={dev.quantidade_peca || "—"} />
                    </div>

                    {dobras.length > 0 && (
                      <div>
                        <p className="text-xs font-bold mb-2">Dobras:</p>
                        <div className="flex flex-wrap gap-2">
                          {dobras.map((d, i) => (
                            <div key={i} className="bg-white border border-border rounded-lg px-3 py-1.5 text-xs">
                              <span className="font-bold text-orange-600">D{i + 1}</span>
                              <span className="text-muted-foreground ml-2">{d.angulo}°</span>
                              {d.raio && <span className="text-muted-foreground ml-1">R{d.raio}</span>}
                              {d.descricao && <span className="ml-2 text-foreground">{d.descricao}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {(dev.maquina_corte || dev.maquina_dobra) && (
                      <div className="flex flex-wrap gap-2 text-xs">
                        {dev.maquina_corte && <span className="bg-purple-100 text-purple-700 border border-purple-200 rounded-md px-2 py-1">Corte: {dev.maquina_corte}</span>}
                        {dev.maquina_dobra && <span className="bg-blue-100 text-blue-700 border border-blue-200 rounded-md px-2 py-1">Dobra: {dev.maquina_dobra}</span>}
                      </div>
                    )}

                    {dev.sequencia_dobras && (
                      <div className="text-xs">
                        <span className="font-bold">Sequência: </span>
                        <span className="text-muted-foreground">{dev.sequencia_dobras}</span>
                      </div>
                    )}

                    {dev.observacoes_tecnicas && (
                      <div className="bg-white border border-border rounded-lg p-3 text-xs text-muted-foreground italic">
                        {dev.observacoes_tecnicas}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {dev.status === "rascunho" && (
                        <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1 text-xs"
                          onClick={() => updateMutation.mutate({ id: dev.id, data: { status: "aprovado" } })}>
                          <CheckCircle2 className="w-3 h-3" /> Aprovar Desenvolvimento
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="gap-1 text-xs border-orange-200 text-orange-700 hover:bg-orange-50"
                        onClick={() => { setDevAproveitamento(dev); setAba("aproveitamento"); }}>
                        <BarChart2 className="w-3 h-3" /> Aproveitamento
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                        onClick={() => { setDevOtimizador(dev); setAba("otimizador"); }}>
                        <Scissors className="w-3 h-3" /> Otimizar Corte
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </>}

      <DesenvolvimentoFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
      />
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 text-center">
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function InfoBox({ label, value, highlight }) {
  return (
    <div className="bg-white border border-border rounded-lg px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`font-bold mt-0.5 ${highlight ? "text-orange-600" : "text-foreground"}`}>{value}</p>
    </div>
  );
}