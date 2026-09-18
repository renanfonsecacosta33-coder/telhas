import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useFilial } from "@/contexts/FilialContext";
import { 
  Truck, 
  ArrowLeft, 
  Search, 
  ShieldCheck, 
  Calendar, 
  User, 
  Camera, 
  Sparkles,
  RefreshCw,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import TimelineCarregamentoViewer from "@/components/logistica/TimelineCarregamentoViewer";

export default function TimelineCarregamentoPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { filialSelecionada } = useFilial();

  const rotaIdUrl = searchParams.get("rotaId") || "";

  // Filtros de busca de rotas
  const [filtroTexto, setFiltroTexto] = useState("");
  const [rotaSelecionadaId, setRotaSelecionadaId] = useState(rotaIdUrl);
  const [placaManual, setPlacaManual] = useState("");
  const [motoristaManual, setMotoristaManual] = useState("");

  // Buscar lista de rotas de entrega
  const { data: rotas = [], isLoading: loadingRotas, refetch: refetchRotas } = useQuery({
    queryKey: ["rotas-entrega-timeline", filialSelecionada],
    queryFn: async () => {
      try {
        const todas = await base44.entities.RotaEntrega.list("-created_at", 30);
        return todas || [];
      } catch (err) {
        console.error("Erro ao buscar rotas para timeline:", err);
        return [];
      }
    }
  });

  // Atualizar quando URL mudar
  useEffect(() => {
    if (rotaIdUrl && rotaIdUrl !== rotaSelecionadaId) {
      setRotaSelecionadaId(rotaIdUrl);
    }
  }, [rotaIdUrl]);

  // Se tiver rotas e nenhuma selecionada, selecionar a primeira
  useEffect(() => {
    if (!rotaSelecionadaId && rotas.length > 0) {
      setRotaSelecionadaId(rotas[0].id);
      setSearchParams({ rotaId: rotas[0].id });
    }
  }, [rotas, rotaSelecionadaId]);

  const rotaAtiva = rotas.find(r => r.id === rotaSelecionadaId);

  const handleSelecionarRota = (id) => {
    setRotaSelecionadaId(id);
    setSearchParams({ rotaId: id });
  };

  const rotasFiltradas = rotas.filter(r => {
    if (!filtroTexto.trim()) return true;
    const q = filtroTexto.toLowerCase();
    return (
      (r.titulo || "").toLowerCase().includes(q) ||
      (r.id || "").toLowerCase().includes(q) ||
      (r.unidade || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Topo / Barra de Navegação */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-lg"
            title="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                <Truck className="h-6 w-6 text-primary" />
                Timeline de Carregamento & Vistoria
              </h1>
              <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                Fase 6 · Pátio & Amarração
              </Badge>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
              Auditoria fotográfica sequencial de 5 etapas para eliminação de contestações em entregas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/corte-dobra/logistica")}
            className="gap-1.5 text-xs"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Abrir Calendário de Logística
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetchRotas()}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title="Atualizar rotas"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Conteúdo Principal: Seletor de Rota e Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Painel Lateral: Lista de Rotas */}
        <div className="lg:col-span-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" /> Rotas de Expedição
            </h2>
            <span className="text-[11px] text-muted-foreground">
              {rotasFiltradas.length} encontrada(s)
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar rota, destino ou código..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="pl-8 text-xs h-9"
            />
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {loadingRotas ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                Carregando rotas de carregamento...
              </div>
            ) : rotasFiltradas.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-lg">
                Nenhuma rota encontrada para o filtro.
              </div>
            ) : (
              rotasFiltradas.map((r) => {
                const isSelected = r.id === rotaSelecionadaId;
                return (
                  <button
                    key={r.id}
                    onClick={() => handleSelecionarRota(r.id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary text-primary-foreground shadow-sm ring-1 ring-primary/30"
                        : "bg-card border-border hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-bold text-xs text-foreground line-clamp-1">
                        {r.titulo || `Rota #${r.id.slice(-6)}`}
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
                        {r.unidade || "Matriz"}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                      <span>Embarque: {r.embarque_date || "Hoje"}</span>
                      {r.total_valor && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-foreground">{r.total_valor}</span>
                        </>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Painel Central: Timeline da Rota Selecionada */}
        <div className="lg:col-span-8 space-y-4">
          {rotaAtiva ? (
            <>
              {/* Informações da Carga/Caminhão */}
              <Card className="border-border shadow-xs">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground font-semibold">
                        ID: {rotaAtiva.id}
                      </span>
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                        {rotaAtiva.unidade || "Matriz AJL"}
                      </Badge>
                    </div>
                    <h2 className="text-base font-bold text-foreground">
                      {rotaAtiva.titulo || "Rota de Entrega"}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Previsão de embarque: <span className="font-semibold text-foreground">{rotaAtiva.embarque_date || "Não informada"}</span>
                      {rotaAtiva.entrega_date && ` · Entrega prevista: ${rotaAtiva.entrega_date}`}
                    </p>
                  </div>

                  {/* Dados adicionais do caminhão/motorista para agilizar preenchimento */}
                  <div className="grid grid-cols-2 gap-2 text-xs min-w-[240px]">
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Placa Veículo:</label>
                      <Input
                        placeholder="Ex: ABC-1D23"
                        value={placaManual}
                        onChange={(e) => setPlacaManual(e.target.value.toUpperCase())}
                        className="h-8 text-xs font-mono font-bold mt-0.5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground font-medium">Motorista:</label>
                      <Input
                        placeholder="Nome motorista"
                        value={motoristaManual}
                        onChange={(e) => setMotoristaManual(e.target.value)}
                        className="h-8 text-xs mt-0.5"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Viewer da Timeline com as 5 Etapas */}
              <TimelineCarregamentoViewer
                rotaId={rotaAtiva.id}
                placaVeiculo={placaManual}
                motoristaNome={motoristaManual}
                unidade={rotaAtiva.unidade || "Matriz AJL"}
                user={user}
                permitirEdicao={true}
              />
            </>
          ) : (
            <div className="bg-card border border-dashed border-border rounded-2xl p-12 text-center space-y-3">
              <Camera className="h-10 w-10 text-muted-foreground mx-auto opacity-50" />
              <h3 className="text-base font-semibold text-foreground">Nenhuma rota selecionada</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Selecione uma rota de entrega na coluna lateral para visualizar ou registrar as fotos das 5 etapas de carregamento.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
