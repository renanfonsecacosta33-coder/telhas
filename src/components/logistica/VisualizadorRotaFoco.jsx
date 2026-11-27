import React, { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Truck, Calendar, Layers, MapPin, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import RotaEntregaCard from "@/components/logistica/RotaEntregaCard";

export default function VisualizadorRotaFoco({
  rotas = [],
  departamento,
  allowDelete = false,
  mapaExecucaoPorId,
  dataSelecionada,
}) {
  const [indiceAtivo, setIndiceAtivo] = useState(0);

  // Garante que o índice sempre esteja dentro do limite se a lista de rotas mudar
  useEffect(() => {
    if (indiceAtivo >= rotas.length) {
      setIndiceAtivo(Math.max(0, rotas.length - 1));
    }
  }, [rotas.length, indiceAtivo]);

  // Navegação por teclado (Setas esquerda e direita)
  const navegarAnterior = useCallback(() => {
    setIndiceAtivo((i) => Math.max(0, i - 1));
  }, []);

  const navegarProxima = useCallback(() => {
    setIndiceAtivo((i) => Math.min(rotas.length - 1, i + 1));
  }, [rotas.length]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignora se estiver digitando em um input ou textarea
      if (["INPUT", "TEXTAREA"].includes(e.target?.tagName)) return;
      if (e.key === "ArrowLeft") {
        navegarAnterior();
      } else if (e.key === "ArrowRight") {
        navegarProxima();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navegarAnterior, navegarProxima]);

  if (!rotas || rotas.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-dashed border-border p-12 text-center space-y-3">
        <Truck className="w-12 h-12 text-muted-foreground/40 mx-auto" />
        <h3 className="text-lg font-bold text-foreground">Nenhuma rota de entrega encontrada</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Não há cargas registradas para os filtros ou data selecionada. Adicione uma nova rota para começar.
        </p>
      </div>
    );
  }

  const rotaAtual = rotas[indiceAtivo] || rotas[0];
  const temAnterior = indiceAtivo > 0;
  const temProxima = indiceAtivo < rotas.length - 1;

  return (
    <div className="space-y-4">
      {/* Barra de Status e Contagem da Navegação Focada */}
      <div className="flex items-center justify-between gap-3 bg-card px-4 py-3 rounded-xl border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <Badge className="bg-primary text-primary-foreground font-black px-2.5 py-1 text-xs uppercase tracking-wide">
            Carga {indiceAtivo + 1} de {rotas.length}
          </Badge>
          <span className="text-sm font-bold text-foreground truncate max-w-[280px] sm:max-w-md">
            {rotaAtual.titulo || "Rota de Entrega"}
          </span>
        </div>

        {/* Controles de Navegação no Topo */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={navegarAnterior}
            disabled={!temAnterior}
            className="h-9 px-3 gap-1 font-bold cursor-pointer"
            title="Rota anterior (Atalho: Seta Esquerda)"
          >
            <ChevronLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Anterior</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={navegarProxima}
            disabled={!temProxima}
            className="h-9 px-3 gap-1 font-bold cursor-pointer"
            title="Próxima rota (Atalho: Seta Direita)"
          >
            <span className="hidden sm:inline">Próxima</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Container Principal: Setas Laterais Grandes + Card da Rota Focada */}
      <div className="relative flex items-center gap-2 sm:gap-4">
        {/* Seta Lateral Esquerda Grande */}
        <button
          type="button"
          onClick={navegarAnterior}
          disabled={!temAnterior}
          aria-label="Carga Anterior"
          className={`shrink-0 z-10 w-12 h-24 sm:w-14 sm:h-36 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md border ${
            temAnterior
              ? "bg-card hover:bg-primary hover:text-white border-border text-foreground hover:scale-105"
              : "opacity-20 cursor-not-allowed bg-muted/40 border-transparent text-muted-foreground"
          }`}
          title="Ver carga anterior (←)"
        >
          <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
        </button>

        {/* Card Grande Centralizado da Rota */}
        <div className="flex-1 min-w-0">
          <RotaEntregaCard
            key={rotaAtual.id}
            rota={rotaAtual}
            departamento={departamento}
            allowDelete={allowDelete}
            mapaExecucaoPorId={mapaExecucaoPorId}
            numeroCarga={rotaAtual.numero_carga || String(indiceAtivo + 1).padStart(2, "0")}
          />
        </div>

        {/* Seta Lateral Direita Grande */}
        <button
          type="button"
          onClick={navegarProxima}
          disabled={!temProxima}
          aria-label="Próxima Carga"
          className={`shrink-0 z-10 w-12 h-24 sm:w-14 sm:h-36 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-md border ${
            temProxima
              ? "bg-card hover:bg-primary hover:text-white border-border text-foreground hover:scale-105"
              : "opacity-20 cursor-not-allowed bg-muted/40 border-transparent text-muted-foreground"
          }`}
          title="Ver próxima carga (→)"
        >
          <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
        </button>
      </div>

      {/* Barra de Miniaturas / Saltos Rápidos no Rodapé */}
      {rotas.length > 1 && (
        <div className="bg-card p-3 rounded-xl border border-border space-y-2">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">
            Todas as Cargas do Dia ({rotas.length}) — Clique para abrir diretamente:
          </span>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
            {rotas.map((r, idx) => {
              const estaAtiva = idx === indiceAtivo;
              const cidadeMotorista = `${r.cidade_destino || r.titulo || "Rota"} • ${r.motorista_nome || "S/ Motorista"}`;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setIndiceAtivo(idx)}
                  className={`px-3 py-2 rounded-lg text-left text-xs transition-all shrink-0 border cursor-pointer flex items-center gap-2 ${
                    estaAtiva
                      ? "bg-primary text-primary-foreground border-primary shadow-sm font-bold scale-[1.02]"
                      : "bg-muted/40 hover:bg-muted border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                    estaAtiva ? "bg-white text-primary" : "bg-border text-foreground"
                  }`}>
                    {idx + 1}
                  </span>
                  <div className="truncate max-w-[160px]">
                    <div className="font-bold truncate">{r.titulo || `Carga #${idx + 1}`}</div>
                    <div className="text-[10px] opacity-80 truncate">{r.motorista_nome || "—"}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
