import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  GitBranch, 
  Search, 
  ArrowLeft, 
  Sparkles, 
  BookOpen, 
  Layers, 
  ShieldCheck, 
  Clock, 
  Users, 
  ChevronRight, 
  Filter,
  FileText,
  Printer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { POPS_DATA } from "@/data/popsData";
import GuiaOperacionalModal from "@/components/pops/GuiaOperacionalModal";

const SETORES_FILTRO = [
  { key: "todos", label: "Todos os Setores" },
  { key: "telhas", label: "Barracão Telhas" },
  { key: "corte_dobra", label: "Corte e Dobra" },
  { key: "expedicao", label: "Expedição & Recebimento" },
  { key: "logistica", label: "Logística & Frota" },
];

export default function CentralPopsPage() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState("");
  const [setorAtivo, setSetorAtivo] = useState("todos");
  const [popSelecionado, setPopSelecionado] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  const listaPops = useMemo(() => {
    return Object.values(POPS_DATA);
  }, []);

  const popsFiltrados = useMemo(() => {
    return listaPops.filter(pop => {
      // Filtro por setor
      if (setorAtivo !== "todos" && pop.setorKey !== setorAtivo) {
        return false;
      }
      // Filtro por busca
      if (!busca.trim()) return true;
      const q = busca.toLowerCase();
      return (
        pop.id.toLowerCase().includes(q) ||
        pop.titulo.toLowerCase().includes(q) ||
        pop.subtitulo.toLowerCase().includes(q) ||
        pop.setor.toLowerCase().includes(q) ||
        pop.maquinasCompativeis?.some(m => m.toLowerCase().includes(q))
      );
    });
  }, [listaPops, setorAtivo, busca]);

  const handleAbrirGuia = (pop) => {
    setPopSelecionado(pop);
    setModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 sm:p-6 lg:p-10 space-y-8 max-w-7xl mx-auto select-none">
      {/* Topo / Navegação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/seletor-setor")}
            className="h-10 w-10 rounded-xl bg-card shadow-xs"
            title="Voltar ao Hub Principal"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20 text-xs font-bold gap-1 px-2.5 py-0.5">
                <GitBranch className="w-3.5 h-3.5" /> POPs & Fluxogramas Industriais
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">AJL Ferro & Aço</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground mt-1">
              Central de Procedimentos Operacionais Padrão
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Instruções de trabalho, fluxogramas visuais, regras de segurança e matrizes de defeito de todas as fábricas.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="bg-card shadow-xs gap-1.5 self-start sm:self-auto text-xs shrink-0 cursor-pointer"
        >
          <Printer className="w-4 h-4 text-primary" />
          <span>Imprimir Manual Geral</span>
        </Button>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Pílulas de Setores */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
          {SETORES_FILTRO.map(s => {
            const isAtivo = setorAtivo === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSetorAtivo(s.key)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  isAtivo
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : "bg-card border border-border/70 text-muted-foreground hover:text-foreground hover:border-primary/40"
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Input de Busca */}
        <div className="relative w-full md:w-80 shrink-0">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por máquina, POP ou peça..."
            className="pl-9 bg-card rounded-xl text-xs h-9"
          />
        </div>
      </div>

      {/* Grid de Cards de POPs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {popsFiltrados.map((pop) => (
          <div
            key={pop.id}
            onClick={() => handleAbrirGuia(pop)}
            className="group bg-card border border-border hover:border-primary/60 rounded-2xl p-5 shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between cursor-pointer relative overflow-hidden"
          >
            {/* Faixa colorida superior */}
            <div className={`h-1.5 w-full absolute top-0 left-0 bg-gradient-to-r ${pop.corHeader}`} />

            <div>
              {/* Badges superiores */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <Badge className={`text-[11px] font-mono font-bold border ${pop.corBadge}`}>
                  {pop.id}
                </Badge>
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  {pop.setor}
                </Badge>
              </div>

              {/* Título e Subtítulo */}
              <h3 className="font-bold text-base sm:text-lg text-foreground group-hover:text-primary transition-colors leading-snug mb-1">
                {pop.titulo}
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-4">
                {pop.subtitulo}
              </p>

              {/* Informações da Máquina */}
              <div className="space-y-1.5 pt-2 border-t border-border/60 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{pop.equipePadrao}</span>
                </div>
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Layers className="w-3.5 h-3.5 text-primary shrink-0" />
                  <span className="truncate">{pop.fluxo?.length || 0} Etapas Padronizadas</span>
                </div>
              </div>
            </div>

            {/* Rodapé do Card */}
            <div className="mt-5 pt-3 border-t border-border/60 flex items-center justify-between text-xs font-bold text-primary group-hover:translate-x-1 transition-transform">
              <span>Abrir Guia Interativo</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        ))}
      </div>

      {/* Modal Interativo do Guia */}
      <GuiaOperacionalModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        popDataPersonalizado={popSelecionado}
        maquinaNome={popSelecionado?.maquinasCompativeis?.[0] || "TP - 40"}
      />
    </div>
  );
}
