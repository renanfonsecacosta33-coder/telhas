import React, { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Play, RotateCcw, Settings2, ChevronDown, ChevronUp,
  Layers, Package, AlertTriangle, CheckCircle2, BarChart2, Scissors
} from "lucide-react";
import PainelPecas from "./PainelPecas";
import PainelChapas from "./PainelChapas";
import VisualizacaoChapa from "./VisualizacaoChapa";
import { otimizarCorte } from "./algoritmo";
import { gerarId, corPeca } from "./types";

export default function OtimizadorCorte({ devInicial = null }) {
  const [pecas, setPecas] = useState(() => {
    if (devInicial) {
      return [{
        id: gerarId(),
        nome: devInicial.nome_peca || "Peça",
        comprimento: String(devInicial.comprimento_desenvolvido_mm || devInicial.comprimento_final_mm || ""),
        largura: String(devInicial.largura_mm || devInicial.largura_final_mm || ""),
        quantidade: String(devInicial.quantidade_peca || "1"),
      }];
    }
    return [];
  });
  const [chapas, setChapas] = useState([
    { id: gerarId(), nome: "Padrão 3000×1200", comprimento: "3000", largura: "1200", quantidade: "5", origem: "manual" },
  ]);
  const [kerf, setKerf] = useState("3");
  const [permitirRotacao, setPermitirRotacao] = useState(true);
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [mostrarOpcoes, setMostrarOpcoes] = useState(false);
  const [chapaAtiva, setChapaAtiva] = useState(0);

  // Busca chapas do estoque CD
  const { data: chapasCDEstoque = [] } = useQuery({
    queryKey: ["chapas-cd-otimizador"],
    queryFn: () => base44.entities.ChapaCD.list("-data_corte", 100),
    select: (data) => data.filter(c =>
      c.status !== "consumido" && c.status !== "cancelado" &&
      c.comprimento_mm > 0 && c.largura_mm > 0
    ),
  });

  const calcular = useCallback(() => {
    setCalculando(true);
    // Simulação de delay para UX
    setTimeout(() => {
      const res = otimizarCorte(pecas, chapas, {
        kerf: parseFloat(kerf) || 0,
        permitirRotacao,
      });
      setResultado(res);
      setChapaAtiva(0);
      setCalculando(false);
    }, 200);
  }, [pecas, chapas, kerf, permitirRotacao]);

  const limpar = () => {
    setResultado(null);
    setPecas([]);
    setChapas([{ id: gerarId(), nome: "Padrão 3000×1200", comprimento: "3000", largura: "1200", quantidade: "5", origem: "manual" }]);
    setKerf("3");
  };

  const podeCalcular = pecas.some(p => parseFloat(p.comprimento) > 0 && parseFloat(p.largura) > 0 && parseInt(p.quantidade) > 0)
    && chapas.some(c => parseFloat(c.comprimento) > 0 && parseFloat(c.largura) > 0);

  const stats = resultado?.stats;

  return (
    <div className="flex flex-col gap-0 h-full min-h-[calc(100vh-200px)]">

      {/* Banner de desenvolvimento vinculado */}
      {devInicial && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center gap-2 text-xs text-blue-800">
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span>Vinculado ao desenvolvimento: <strong>{devInicial.nome_peca}</strong></span>
          {devInicial.comprimento_desenvolvido_mm && (
            <span className="text-blue-600">· Desenvolvido: {devInicial.comprimento_desenvolvido_mm}mm</span>
          )}
        </div>
      )}

      {/* Top bar — ações globais */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-card border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-orange-500" />
          <span className="font-bold text-sm">Otimizador de Corte</span>
          {resultado && (
            <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">
              {resultado.chapasUsadas.length} chapa(s) usada(s)
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarOpcoes(!mostrarOpcoes)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border border-border hover:border-foreground/30 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Opções
            {mostrarOpcoes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={limpar}>
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold px-4"
            onClick={calcular}
            disabled={!podeCalcular || calculando}
          >
            {calculando ? (
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white" />
            )}
            Calcular
          </Button>
        </div>
      </div>

      {/* Opções */}
      {mostrarOpcoes && (
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Espessura do corte (kerf):</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={kerf}
              onChange={e => setKerf(e.target.value)}
              className="h-7 w-20 text-xs"
            />
            <span className="text-xs text-muted-foreground">mm</span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Permitir rotação:</Label>
            <button
              onClick={() => setPermitirRotacao(!permitirRotacao)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${permitirRotacao ? "bg-orange-500" : "bg-muted-foreground/30"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${permitirRotacao ? "translate-x-4" : "translate-x-1"}`} />
            </button>
            <span className="text-xs text-muted-foreground">{permitirRotacao ? "Sim" : "Não"}</span>
          </div>
        </div>
      )}

      {/* Layout split */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* Coluna esquerda — inputs */}
        <div className="w-full lg:w-[420px] lg:min-w-[380px] border-r border-border overflow-y-auto">
          <div className="p-4 space-y-6">
            {/* Peças */}
            <PainelPecas pecas={pecas} onChange={setPecas} />

            <div className="border-t border-border" />

            {/* Chapas */}
            <PainelChapas chapas={chapas} onChange={setChapas} chapasCDEstoque={chapasCDEstoque} />
          </div>
        </div>

        {/* Coluna direita — resultado */}
        <div className="flex-1 overflow-y-auto bg-muted/20">
          {!resultado ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-center p-8 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center">
                <Scissors className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <p className="font-bold text-foreground">Pronto para otimizar</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Adicione peças e chapas no painel esquerdo,<br />depois clique em <strong>Calcular</strong>
                </p>
              </div>
              {!podeCalcular && pecas.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 max-w-xs text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  Preencha as dimensões de todas as peças e chapas
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-4">

              {/* Stats globais */}
              {stats && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-orange-500" />
                    <span className="font-bold text-sm">Estatísticas Globais</span>
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatGlobal
                      label="Chapas usadas"
                      value={stats.chapas_usadas}
                      icon={<Layers className="w-4 h-4 text-slate-500" />}
                    />
                    <StatGlobal
                      label="Peças encaixadas"
                      value={`${stats.pecas_encaixadas}/${stats.total_pecas}`}
                      icon={<Package className="w-4 h-4 text-emerald-500" />}
                      color={stats.nao_couberam === 0 ? "text-emerald-700" : "text-amber-700"}
                    />
                    <StatGlobal
                      label="Aproveitamento"
                      value={`${stats.aproveitamento_geral}%`}
                      icon={<CheckCircle2 className="w-4 h-4 text-orange-500" />}
                      color={
                        parseFloat(stats.aproveitamento_geral) >= 85 ? "text-emerald-700" :
                        parseFloat(stats.aproveitamento_geral) >= 65 ? "text-amber-700" : "text-red-600"
                      }
                      big
                    />
                    <StatGlobal
                      label="Área total"
                      value={`${(stats.area_total_mm2 / 1e6).toFixed(3)} m²`}
                      icon={null}
                    />
                    <StatGlobal
                      label="Área desperdiçada"
                      value={`${(stats.area_desperdicada_mm2 / 1e6).toFixed(3)} m²`}
                      icon={null}
                      color="text-red-600"
                    />
                    <StatGlobal
                      label="Total de cortes"
                      value={stats.total_cortes}
                      icon={<Scissors className="w-4 h-4 text-slate-400" />}
                    />
                  </div>
                </div>
              )}

              {/* Peças que não couberam */}
              {resultado.naoCouberam.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-bold text-sm text-red-700">
                      {resultado.naoCouberam.length} peça(s) não couberam
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resultado.naoCouberam.map((p, i) => (
                      <span key={i} className="text-xs bg-red-100 border border-red-200 text-red-700 rounded-lg px-2.5 py-1.5">
                        <span className="font-bold">{p.nome || `Peça`}</span>
                        <span className="text-red-500 ml-1">({p.comp}×{p.larg}mm)</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-red-600 mt-2">
                    Adicione mais chapas ou reduza as dimensões das peças
                  </p>
                </div>
              )}

              {/* Navegação de chapas */}
              {resultado.chapasUsadas.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">Ir para chapa:</span>
                  {resultado.chapasUsadas.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setChapaAtiva(i)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors border ${
                        chapaAtiva === i
                          ? "bg-orange-500 text-white border-orange-500"
                          : "bg-card border-border text-muted-foreground hover:border-orange-300"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Legenda de cores */}
              {pecas.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Legenda</p>
                  <div className="flex flex-wrap gap-2">
                    {pecas.filter(p => parseFloat(p.comprimento) > 0).map((p, idx) => (
                      <div key={p.id} className="flex items-center gap-1.5 text-xs">
                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: corPeca(idx) }} />
                        <span className="text-foreground">{p.nome || `Peça ${idx + 1}`}</span>
                        <span className="text-muted-foreground">({p.comprimento}×{p.largura}mm)</span>
                        <span className="bg-muted rounded px-1 text-[10px]">×{p.quantidade}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Visualizações das chapas */}
              {resultado.chapasUsadas.map((cr, i) => (
                <div key={i} id={`chapa-${i}`} className={i !== chapaAtiva && resultado.chapasUsadas.length > 1 ? "opacity-40 hover:opacity-100 transition-opacity" : ""}>
                  <VisualizacaoChapa chapaResult={cr} index={i} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatGlobal({ label, value, icon, color = "text-foreground", big = false }) {
  return (
    <div className="bg-muted/40 rounded-xl px-3 py-2.5 flex flex-col gap-1">
      {icon && <div>{icon}</div>}
      <p className={`font-black ${big ? "text-2xl" : "text-lg"} ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}