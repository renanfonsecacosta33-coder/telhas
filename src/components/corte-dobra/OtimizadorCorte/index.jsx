import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Play, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";

import PainelPecas from "./PainelPecas";
import PainelChapas from "./PainelChapas";
import PainelOpcoes from "./PainelOpcoes";
import VisualizadorChapa from "./VisualizadorChapa";
import StatsGlobais from "./StatsGlobais";
import { otimizarCorte } from "./algoritmo";
import { gerarId } from "./types";

const DEFAULT_OPCOES = { kerf: 3, permitirRotacao: true };

export default function OtimizadorCorte({ dev = null }) {
  const [pecas, setPecas] = useState(() => {
    if (dev) {
      return [{
        id: gerarId(),
        nome: dev.nome_peca || "Peça",
        comprimento: String(dev.comprimento_desenvolvido_mm || dev.comprimento_final_mm || ""),
        largura: String(dev.largura_mm || dev.largura_final_mm || ""),
        quantidade: String(dev.quantidade_peca || 1),
      }];
    }
    return [{ id: gerarId(), nome: "", comprimento: "", largura: "", quantidade: "1" }];
  });

  const [chapas, setChapas] = useState([
    { id: gerarId(), nome: "Chapa 3000×1200", comprimento: "3000", largura: "1200", quantidade: "5", origem: "manual" },
  ]);

  const [opcoes, setOpcoes] = useState(DEFAULT_OPCOES);
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [opcoesAberto, setOpcoesAberto] = useState(false);

  // Busca chapas do estoque ChapaCD
  const { data: chapasCDEstoque = [] } = useQuery({
    queryKey: ["chapas-cd-estoque"],
    queryFn: async () => {
      const todas = await base44.entities.ChapaCD.list("-created_date", 100);
      return todas.filter(c => c.status === "disponivel" || c.status === "parcial");
    },
  });

  const calcular = () => {
    const pecasValidas = pecas.filter(p => parseFloat(p.comprimento) > 0 && parseFloat(p.largura) > 0);
    const chapasValidas = chapas.filter(c => parseFloat(c.comprimento) > 0 && parseFloat(c.largura) > 0);

    if (pecasValidas.length === 0) {
      toast.error("Adicione pelo menos uma peça com dimensões válidas");
      return;
    }
    if (chapasValidas.length === 0) {
      toast.error("Adicione pelo menos uma chapa disponível");
      return;
    }

    setCalculando(true);
    // Pequeno timeout para dar feedback visual
    setTimeout(() => {
      const res = otimizarCorte(pecasValidas, chapasValidas, opcoes);
      setResultado(res);
      setCalculando(false);
      if (res.stats) {
        toast.success(
          `Otimização concluída — ${res.stats.aproveitamento_geral}% de aproveitamento`,
          { description: `${res.stats.chapas_usadas} chapa(s) utilizadas` }
        );
      }
    }, 200);
  };

  const limpar = () => {
    setResultado(null);
    setPecas([{ id: gerarId(), nome: "", comprimento: "", largura: "", quantidade: "1" }]);
    setChapas([{ id: gerarId(), nome: "Chapa 3000×1200", comprimento: "3000", largura: "1200", quantidade: "5", origem: "manual" }]);
  };

  return (
    <div className="flex flex-col gap-0 min-h-[600px]">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 rounded-t-xl">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-400" />
          <span className="text-white text-sm font-bold tracking-tight">Otimizador de Corte AJL</span>
          {dev && (
            <span className="text-[10px] bg-slate-700 text-slate-300 rounded px-2 py-0.5">
              {dev.nome_peca}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-700 gap-1"
            onClick={() => setOpcoesAberto(!opcoesAberto)}
          >
            Opções
            {opcoesAberto ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-700 gap-1"
            onClick={limpar}
          >
            <RotateCcw className="w-3 h-3" /> Limpar
          </Button>
          <Button
            size="sm"
            onClick={calcular}
            disabled={calculando}
            className="h-7 text-xs gap-1.5 bg-green-500 hover:bg-green-400 text-white font-bold px-4"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {calculando ? "Calculando..." : "Calcular"}
          </Button>
        </div>
      </div>

      {/* Opções colapsáveis */}
      {opcoesAberto && (
        <div className="border-x border-slate-200 bg-slate-50 px-4 py-3">
          <PainelOpcoes opcoes={opcoes} onChange={setOpcoes} />
        </div>
      )}

      {/* Layout split: esquerda (entrada) + direita (resultado) */}
      <div className="flex flex-col lg:flex-row border border-slate-200 border-t-0 rounded-b-xl overflow-hidden flex-1">

        {/* Painel esquerdo — Entrada */}
        <div className="lg:w-[400px] shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Seção Peças */}
            <PainelPecas pecas={pecas} onChange={setPecas} />

            <div className="border-t border-dashed border-slate-200" />

            {/* Seção Chapas */}
            <PainelChapas
              chapas={chapas}
              onChange={setChapas}
              chapasCDEstoque={chapasCDEstoque}
            />
          </div>
        </div>

        {/* Painel direito — Resultado */}
        <div className="flex-1 bg-zinc-50 overflow-y-auto">
          {!resultado ? (
            <div className="h-full flex flex-col items-center justify-center gap-4 p-8 text-center min-h-[400px]">
              <div className="w-16 h-16 rounded-2xl bg-slate-200 flex items-center justify-center">
                <Play className="w-7 h-7 text-slate-400 fill-current" />
              </div>
              <div>
                <p className="font-bold text-slate-600">Pronto para otimizar</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Preencha as peças e chapas disponíveis, depois clique em <strong>Calcular</strong>
                </p>
              </div>
              <div className="text-xs text-muted-foreground bg-white border border-border rounded-xl px-4 py-3 max-w-xs">
                💡 Use o <strong>Catálogo</strong> para adicionar peças do catálogo AJL com dimensões calculadas automaticamente, ou importe chapas do <strong>Estoque</strong>.
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-5">
              {/* Stats globais */}
              <StatsGlobais stats={resultado.stats} naoCouberam={resultado.naoCouberam} />

              {/* Chapas individuais */}
              {resultado.chapasUsadas.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-slate-700">
                    Plano de Corte — {resultado.chapasUsadas.length} chapa(s)
                  </h3>
                  {resultado.chapasUsadas.map((res, i) => (
                    <VisualizadorChapa key={i} resultado={res} indice={i} />
                  ))}
                </div>
              )}

              {resultado.chapasUsadas.length === 0 && (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhuma peça pôde ser encaixada. Verifique as dimensões.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}