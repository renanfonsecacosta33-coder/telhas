import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Trophy,
  Layers,
  ArrowRight,
  TrendingUp,
  Percent,
  Scissors,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Sliders,
  AlertCircle
} from "lucide-react";
import { calcularRankingPerfisParaChapa, analisarAproveitamentoChapa } from "@/lib/tabelaBlanksAJL";

/**
 * PainelAproveitamentoInteligente.jsx
 * 
 * Tecnologia de Ponta para Otimização de Corte da Chaparia:
 * 1. Análise em Tempo Real do Blank Atual na Chapa selecionada
 * 2. Visualizador Gráfico SVG do Plano de Corte da Chapa (Nesting de Tiras)
 * 3. Ranking Inteligente IA: Compara com toda a Tabela Física de Blanks da AJL
 *    e diz qual perfil tem o melhor rendimento comercial com menor sucata.
 * 4. Adoção rápida: 1 clique para preencher o perfil escolhido.
 */
export default function PainelAproveitamentoInteligente({
  chapa,
  blankAtual,
  nomePecaAtual,
  onAplicarPerfil,
}) {
  const [expandido, setExpandido] = useState(true);
  const [modoVisualizacao, setModoVisualizacao] = useState("nesting"); // "nesting" | "ranking"

  if (!chapa || !chapa.largura_mm) return null;

  const largChapa = parseFloat(chapa.largura_mm);
  const compChapa = parseFloat(chapa.comprimento_mm) || 3000;
  const espChapa = parseFloat(chapa.espessura_mm) || 2.0;
  const blankNum = parseFloat(blankAtual) || 0;

  // Análise do blank atual na chapa
  const analiseAtual = analisarAproveitamentoChapa(largChapa, blankNum);

  // Ranking de todos os perfis padronizados AJL para a largura desta chapa
  const ranking = calcularRankingPerfisParaChapa(largChapa, espChapa);
  const melhorPerfil = ranking.length > 0 ? ranking[0] : null;
  const ehMelhorAproveitamento = melhorPerfil && Math.abs(melhorPerfil.blank - blankNum) < 2;

  // Cálculos para o SVG de Nesting da Chapa
  const maxLargSvg = 650;
  const proporcao = Math.min(1, maxLargSvg / largChapa);
  const svgLargura = largChapa * proporcao;
  const svgAltura = 80;

  return (
    <div className="bg-slate-900 text-slate-100 rounded-2xl border-2 border-emerald-500/40 p-4 shadow-xl overflow-hidden relative">
      {/* Luz ambiente tecnológica */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Header do Painel */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-500/20">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Otimizador Industrial de Corte
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                Tabela AJL 100% Automática
              </Badge>
            </div>
            <p className="text-sm font-bold text-white">
              Chapa {chapa.codigo || "Estoque"} · {largChapa} × {compChapa} mm (e{espChapa}mm)
            </p>
          </div>
        </div>

        {/* Indicadores Principais de Desempenho */}
        <div className="flex items-center gap-2">
          {analiseAtual.qtdBlanks > 0 && (
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Aproveitamento</span>
                <span className="text-lg font-black text-emerald-400 font-mono">
                  {analiseAtual.aproveitamentoPerc}%
                </span>
              </div>
              <Badge
                className={`text-xs font-black px-2 py-1 ${
                  analiseAtual.classe === "A+"
                    ? "bg-emerald-500 text-slate-950"
                    : analiseAtual.classe === "A"
                    ? "bg-green-500 text-slate-950"
                    : "bg-amber-500 text-slate-950"
                }`}
              >
                {analiseAtual.classe}
              </Badge>
            </div>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setExpandido(!expandido)}
            className="text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9 p-0"
          >
            {expandido ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {expandido && (
        <div className="space-y-4">
          {/* Card Resumo do Blank Atual */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Blank Calculado</span>
              <span className="text-lg font-black text-white font-mono">
                {blankNum > 0 ? `${blankNum} mm` : "—"}
              </span>
              <span className="text-[10px] text-slate-500 block truncate">{nomePecaAtual || "Peça atual"}</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Tiras por Chapa</span>
              <span className="text-lg font-black text-emerald-400 font-mono">
                {analiseAtual.qtdBlanks} <span className="text-xs font-normal text-slate-400">peças</span>
              </span>
              <span className="text-[10px] text-emerald-500/80 block">Cortes na guilhotina</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Sobra de Material</span>
              <span className={`text-lg font-black font-mono ${analiseAtual.sobraMm <= 40 ? "text-emerald-400" : "text-amber-400"}`}>
                {analiseAtual.sobraMm} <span className="text-xs font-normal text-slate-400">mm</span>
              </span>
              <span className="text-[10px] text-slate-400 block truncate">
                {analiseAtual.sobraMm >= 40 ? "Retalho reaproveitável" : "Sucata mínima"}
              </span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Diagnóstico de Yield</span>
              <span className="text-xs font-black text-white block mt-1 leading-tight">
                {analiseAtual.label}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {ehMelhorAproveitamento ? "⭐ Máxima eficiência!" : "Existem perfis com menor sobra"}
              </span>
            </div>
          </div>

          {/* Seletor de visualização (Nesting Visual x Ranking de Perfis) */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800">
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setModoVisualizacao("nesting")}
                className={`text-xs px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  modoVisualizacao === "nesting"
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Scissors className="w-3.5 h-3.5" />
                Visual do Corte (Nesting 1D)
              </button>
              <button
                type="button"
                onClick={() => setModoVisualizacao("ranking")}
                className={`text-xs px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                  modoVisualizacao === "ranking"
                    ? "bg-emerald-500 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <Trophy className="w-3.5 h-3.5 text-amber-400" />
                Ranking de Aproveitamento AJL ({ranking.length})
              </button>
            </div>

            {melhorPerfil && !ehMelhorAproveitamento && onAplicarPerfil && (
              <Button
                size="sm"
                type="button"
                onClick={() => onAplicarPerfil(melhorPerfil)}
                className="bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs h-7 gap-1.5 shadow-lg shadow-orange-500/20"
              >
                <Trophy className="w-3.5 h-3.5" />
                Usar Perfil Campeão: {melhorPerfil.nome} ({melhorPerfil.aproveitamentoPerc}%)
              </Button>
            )}
          </div>

          {/* MODO 1: DIAGRAMA VISUAL SVG DA CHAPA DE CORTE */}
          {modoVisualizacao === "nesting" && (
            <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Largura Total da Chapa: <strong className="text-white">{largChapa} mm</strong></span>
                <span>Comprimento: <strong className="text-white">{compChapa} mm</strong></span>
              </div>

              {/* Representação SVG em Escala Real */}
              <div className="w-full overflow-x-auto py-1">
                <svg
                  width={svgLargura}
                  height={svgAltura}
                  className="rounded-lg border border-slate-700/80 mx-auto block bg-slate-900"
                  style={{ minWidth: "100%", maxWidth: "100%" }}
                  viewBox={`0 0 ${largChapa} 100`}
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="gradBlank" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#047857" stopOpacity="0.9" />
                    </linearGradient>
                    <linearGradient id="gradSobra" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                      <stop offset="100%" stopColor="#b45309" stopOpacity="0.9" />
                    </linearGradient>
                    <pattern id="stripes" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="10" stroke="#f59e0b" strokeWidth="2" strokeOpacity="0.4" />
                    </pattern>
                  </defs>

                  {/* Renderiza cada blank */}
                  {Array.from({ length: analiseAtual.qtdBlanks }).map((_, i) => {
                    const x = i * blankNum;
                    return (
                      <g key={i}>
                        <rect
                          x={x}
                          y={5}
                          width={blankNum}
                          height={90}
                          fill="url(#gradBlank)"
                          stroke="#064e3b"
                          strokeWidth="1"
                        />
                        {/* Linha divisória de corte da guilhotina */}
                        <line
                          x1={x + blankNum}
                          y1={0}
                          x2={x + blankNum}
                          y2={100}
                          stroke="#34d399"
                          strokeWidth="2"
                          strokeDasharray="4 2"
                        />
                        {blankNum >= 70 && (
                          <text
                            x={x + blankNum / 2}
                            y={55}
                            fill="#ffffff"
                            fontSize="14"
                            fontWeight="bold"
                            textAnchor="middle"
                            fontFamily="monospace"
                          >
                            #{i + 1} ({blankNum}mm)
                          </text>
                        )}
                      </g>
                    );
                  })}

                  {/* Renderiza a sobra */}
                  {analiseAtual.sobraMm > 0 && (
                    <g>
                      <rect
                        x={analiseAtual.qtdBlanks * blankNum}
                        y={5}
                        width={analiseAtual.sobraMm}
                        height={90}
                        fill="url(#gradSobra)"
                        stroke="#78350f"
                        strokeWidth="1"
                      />
                      <rect
                        x={analiseAtual.qtdBlanks * blankNum}
                        y={5}
                        width={analiseAtual.sobraMm}
                        height={90}
                        fill="url(#stripes)"
                      />
                      {analiseAtual.sobraMm >= 40 && (
                        <text
                          x={analiseAtual.qtdBlanks * blankNum + analiseAtual.sobraMm / 2}
                          y={55}
                          fill="#ffffff"
                          fontSize="13"
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          Sobra {analiseAtual.sobraMm}mm
                        </text>
                      )}
                    </g>
                  )}
                </svg>
              </div>

              {/* Legenda do Diagrama */}
              <div className="flex items-center justify-between text-[11px] pt-1 text-slate-400">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500 inline-block" />
                    <strong>{analiseAtual.qtdBlanks}×</strong> Blanks Úteis ({blankNum} mm cada)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-amber-500 inline-block" />
                    Sobra Final: <strong>{analiseAtual.sobraMm} mm</strong>
                  </span>
                </div>
                <span className="text-emerald-400 font-bold">
                  {analiseAtual.aproveitamentoPerc}% da chapa aproveitada
                </span>
              </div>
            </div>
          )}

          {/* MODO 2: RANKING INTELIGENTE DE TODOS OS PERFIS DA TABELA AJL */}
          {modoVisualizacao === "ranking" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-400 pb-1">
                <span>
                  Perfis da <strong>Tabela Física AJL</strong> ordenados pelo melhor rendimento nesta chapa:
                </span>
                <span className="text-[10px] text-emerald-400 font-semibold">
                  Clique em "Adotar" para preencher o croqui
                </span>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
                {ranking.map((item, index) => {
                  const isAtual = Math.abs(item.blank - blankNum) < 2;
                  const isTop1 = index === 0;

                  return (
                    <div
                      key={item.perfil}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        isAtual
                          ? "bg-emerald-950/60 border-emerald-500/80 shadow-md ring-1 ring-emerald-500/40"
                          : isTop1
                          ? "bg-slate-800/90 border-amber-500/60"
                          : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Medalha / Posição */}
                        <div className="w-6 text-center font-black text-sm shrink-0">
                          {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `${index + 1}º`}
                        </div>

                        {/* Dados do Perfil */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-white text-xs truncate">
                              {item.nome}
                            </span>
                            <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px]">
                              Blank: {item.blank} mm
                            </Badge>
                            {isAtual && (
                              <Badge className="bg-emerald-500 text-slate-950 text-[10px] font-black">
                                Peça Selecionada
                              </Badge>
                            )}
                            {isTop1 && !isAtual && (
                              <Badge className="bg-amber-500 text-slate-950 text-[10px] font-black">
                                ⭐ Campeão de Rendimento
                              </Badge>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                            <span>Tiras: <strong className="text-white">{item.qtdBlanks} pçs</strong></span>
                            <span>·</span>
                            <span>Sobra: <strong className={item.sobraMm <= 40 ? "text-emerald-400" : "text-amber-400"}>{item.sobraMm} mm</strong></span>
                            <span>·</span>
                            <span>{item.descricao}</span>
                          </div>
                        </div>
                      </div>

                      {/* Aproveitamento % e Botão de Ação */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-black text-emerald-400 font-mono block">
                            {item.aproveitamentoPerc}%
                          </span>
                          <span className="text-[10px] text-slate-400">rendimento</span>
                        </div>

                        {onAplicarPerfil && (
                          <Button
                            size="sm"
                            type="button"
                            variant={isAtual ? "outline" : "default"}
                            onClick={() => onAplicarPerfil(item)}
                            disabled={isAtual}
                            className={`h-7 px-2.5 text-xs font-bold ${
                              isAtual
                                ? "border-emerald-500 text-emerald-400 hover:bg-emerald-950"
                                : "bg-emerald-600 hover:bg-emerald-500 text-white"
                            }`}
                          >
                            {isAtual ? "Em uso" : "Adotar"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
