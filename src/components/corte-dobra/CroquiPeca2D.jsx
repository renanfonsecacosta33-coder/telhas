import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Eye, Ruler, RotateCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

/**
 * Predefinições geométricas de perfis comuns da AJL
 */
export const PRESETS_PERFIL = [
  {
    id: "perfil_u",
    nome: "Perfil U Simples",
    categoria: "Estrutural",
    abasPadrao: [25, 50, 25],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", descricao: "Aba 1" },
      { angulo: 90, direcao: "cima", descricao: "Aba 2" },
    ],
  },
  {
    id: "perfil_c",
    nome: "Perfil C Enrijecido",
    categoria: "Estrutural",
    abasPadrao: [15, 40, 75, 40, 15],
    dobrasPadrao: [
      { angulo: 90, direcao: "dentro", descricao: "Enrijecedor 1" },
      { angulo: 90, direcao: "cima", descricao: "Aba 1" },
      { angulo: 90, direcao: "cima", descricao: "Alma" },
      { angulo: 90, direcao: "dentro", descricao: "Aba 2" },
    ],
  },
  {
    id: "cantoneira_l",
    nome: "Cantoneira / Perfil L",
    categoria: "Cantoneira",
    abasPadrao: [50, 50],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", descricao: "Dobra 90°" },
    ],
  },
  {
    id: "rufo_pingadeira",
    nome: "Rufo com Pingadeira",
    categoria: "Cobertura",
    abasPadrao: [15, 120, 40, 15],
    dobrasPadrao: [
      { angulo: 135, direcao: "fora", descricao: "Bainha/Pingadeira" },
      { angulo: 90, direcao: "baixo", descricao: "Parede" },
      { angulo: 90, direcao: "fora", descricao: "Gota final" },
    ],
  },
  {
    id: "perfil_cartola",
    nome: "Perfil Cartola (Ômega)",
    categoria: "Estrutural",
    abasPadrao: [20, 30, 40, 30, 20],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", descricao: "Aba base esq" },
      { angulo: 90, direcao: "cima", descricao: "Lateral esq" },
      { angulo: 90, direcao: "baixo", descricao: "Topo" },
      { angulo: 90, direcao: "baixo", descricao: "Lateral dir" },
    ],
  },
  {
    id: "perfil_z",
    nome: "Perfil Z",
    categoria: "Estrutural",
    abasPadrao: [25, 60, 25],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", descricao: "Aba sup" },
      { angulo: 90, direcao: "baixo", descricao: "Aba inf" },
    ],
  },
];

/**
 * Constrói os pontos 2D (x, y) de um perfil de chapa baseado em abas e ângulos relativos
 */
function calcularPontosPerfil(abas = [], dobras = [], espessura = 1.5) {
  if (!abas || abas.length === 0) return { pontos: [], minX: 0, maxX: 100, minY: 0, maxY: 100 };

  const pontos = [];
  let curX = 0;
  let curY = 0;
  let curAngleDeg = 0; // Começa apontando para a direita (0°)

  pontos.push({ x: curX, y: curY, dobraIndex: null, comprimento: abas[0] || 0 });

  for (let i = 0; i < abas.length; i++) {
    const comp = Math.max(1, Number(abas[i]) || 10);
    const rad = (curAngleDeg * Math.PI) / 180;
    curX += comp * Math.cos(rad);
    curY += comp * Math.sin(rad);

    const dobra = dobras[i];
    pontos.push({
      x: curX,
      y: curY,
      dobraIndex: i,
      angulo: dobra?.angulo || 90,
      comprimento: abas[i + 1] || 0,
    });

    if (dobra) {
      const ang = Number(dobra.angulo) || 90;
      // Direção da dobra (positivo gira para cima / sentido anti-horário, negativo para baixo)
      const sentido = dobra.direcao === "baixo" || dobra.direcao === "dentro" ? -1 : 1;
      curAngleDeg += (180 - ang) * sentido;
    }
  }

  // Encontrar limites para centralização automática (Bounding Box)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pontos.forEach((p) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });

  return { pontos, minX, maxX, minY, maxY };
}

export default function CroquiPeca2D({
  abas = [25, 50, 25],
  dobras = [{ angulo: 90 }, { angulo: 90 }],
  espessura_mm = 1.5,
  nomePeca = "Peça Dobrada",
  larguraPlanificada = 100,
  comprimento_mm = 3000,
  className = "",
}) {
  const [modoVisualizacao, setModoVisualizacao] = useState("perfil"); // "perfil" ou "planificado"
  const [zoom, setZoom] = useState(1);

  const { pontos, minX, maxX, minY, maxY } = useMemo(() => {
    return calcularPontosPerfil(abas, dobras, espessura_mm);
  }, [abas, dobras, espessura_mm]);

  // Dimensões do SVG com padding
  const padding = 45;
  const widthReal = Math.max(80, maxX - minX);
  const heightReal = Math.max(80, maxY - minY);
  const viewBoxX = minX - padding;
  const viewBoxY = minY - padding;
  const viewBoxW = widthReal + padding * 2;
  const viewBoxH = heightReal + padding * 2;

  // Path SVG da linha central
  const pathD = useMemo(() => {
    if (pontos.length === 0) return "";
    return pontos.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}` : `${acc} L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }, "");
  }, [pontos]);

  return (
    <div className={`bg-slate-900 text-white rounded-xl border border-slate-800 p-4 shadow-lg flex flex-col ${className}`}>
      {/* Barra de Ferramentas / Cabeçalho do Croqui */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Croqui Técnico 2D Interativo
          </span>
          <Badge variant="outline" className="text-[10px] bg-slate-800/80 text-orange-400 border-orange-500/30">
            e = {espessura_mm || 1.5} mm
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Alternar Perfil Dobrado vs Blank Planificado */}
          <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setModoVisualizacao("perfil")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                modoVisualizacao === "perfil"
                  ? "bg-orange-500 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Perfil Dobrado
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao("planificado")}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
                modoVisualizacao === "planificado"
                  ? "bg-orange-500 text-white shadow"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Blank Planificado
            </button>
          </div>

          {/* Controles de Zoom */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2, z + 0.15))}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.15))}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white"
            title="Resetar Zoom"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Área de Desenho SVG */}
      <div className="relative w-full h-64 sm:h-72 bg-gradient-to-b from-slate-950 to-slate-900 rounded-lg border border-slate-800/80 overflow-hidden flex items-center justify-center select-none">
        {/* Grade técnica sutil de fundo (Grid) */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        {modoVisualizacao === "perfil" ? (
          /* Visualização do Perfil Dobrado em Corte Transversal */
          <div
            className="w-full h-full flex items-center justify-center p-2 transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            <svg
              viewBox={`${viewBoxX} ${viewBoxY} ${viewBoxW} ${viewBoxH}`}
              className="w-full h-full max-h-full"
              style={{ overflow: "visible" }}
            >
              <defs>
                {/* Marcador de seta para cotas */}
                <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#f97316" />
                </marker>
              </defs>

              {/* Linha externa da chapa (espessura realista) */}
              <path
                d={pathD}
                fill="none"
                stroke="#38bdf8"
                strokeWidth={Math.max(2.5, Number(espessura_mm) * 1.5)}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_8px_rgba(56,189,248,0.4)]"
              />

              {/* Segmentos e Cotas de cada Aba */}
              {pontos.slice(0, -1).map((p1, idx) => {
                const p2 = pontos[idx + 1];
                const midX = (p1.x + p2.x) / 2;
                const midY = (p1.y + p2.y) / 2;
                const comp = abas[idx] || 0;

                // Deslocamento da cota para fora do traço
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                const nx = -dy / len;
                const ny = dx / len;
                const cotaDist = 16;

                return (
                  <g key={`aba-${idx}`}>
                    {/* Linha guia de cota */}
                    <line
                      x1={midX + nx * 4}
                      y1={midY + ny * 4}
                      x2={midX + nx * cotaDist}
                      y2={midY + ny * cotaDist}
                      stroke="#64748b"
                      strokeWidth="0.8"
                      strokeDasharray="2,2"
                    />

                    {/* Texto com a medida da Aba */}
                    <rect
                      x={midX + nx * cotaDist - 16}
                      y={midY + ny * cotaDist - 9}
                      width="32"
                      height="18"
                      rx="4"
                      fill="#0f172a"
                      stroke="#f97316"
                      strokeWidth="1"
                    />
                    <text
                      x={midX + nx * cotaDist}
                      y={midY + ny * cotaDist + 4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {comp}
                    </text>
                  </g>
                );
              })}

              {/* Marcadores de Dobra (D1, D2, D3...) */}
              {pontos.slice(1, -1).map((p, idx) => {
                const dobra = dobras[idx];
                const ang = dobra?.angulo || 90;

                return (
                  <g key={`dobra-node-${idx}`}>
                    {/* Círculo indicador no vértice da dobra */}
                    <circle cx={p.x} cy={p.y} r="6" fill="#f97316" stroke="#ffffff" strokeWidth="1.5" />
                    <text
                      x={p.x}
                      y={p.y + 3.5}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8"
                      fontWeight="black"
                    >
                      {idx + 1}
                    </text>

                    {/* Badge de Ângulo */}
                    <text
                      x={p.x + 12}
                      y={p.y - 10}
                      fill="#fb923c"
                      fontSize="10"
                      fontWeight="bold"
                    >
                      {ang}°
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        ) : (
          /* Visualização do Blank Planificado (Chapa Desdobrada) */
          <div
            className="w-full h-full flex flex-col items-center justify-center p-4 transition-transform duration-200"
            style={{ transform: `scale(${zoom})` }}
          >
            <div className="w-full max-w-lg bg-slate-800/80 border-2 border-emerald-500/70 rounded-md p-4 relative shadow-2xl">
              <div className="text-center mb-3">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                  Faixa Planificada (Blank para Corte na Guilhotina)
                </span>
                <p className="text-[11px] text-slate-400">
                  Largura total a ser cortada:{" "}
                  <strong className="text-emerald-300 font-mono text-sm">{larguraPlanificada || abas.reduce((a, b) => a + (Number(b) || 0), 0)} mm</strong>{" "}
                  × Comprimento: <strong className="text-emerald-300 font-mono">{comprimento_mm} mm</strong>
                </p>
              </div>

              {/* Faixa com as linhas de dobra pontilhadas */}
              <div className="h-20 w-full bg-slate-900 border border-slate-700 rounded flex relative overflow-hidden items-center">
                {abas.map((aba, i) => {
                  const total = abas.reduce((acc, v) => acc + (Number(v) || 0), 0) || 1;
                  const pct = ((Number(aba) || 0) / total) * 100;
                  return (
                    <div
                      key={i}
                      style={{ width: `${pct}%` }}
                      className="h-full border-r border-dashed border-amber-400/80 relative flex flex-col items-center justify-center px-1 text-center group hover:bg-slate-800/50"
                    >
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Aba {i + 1}</span>
                      <span className="text-xs font-black text-amber-300">{aba} mm</span>
                      {i < abas.length - 1 && (
                        <div className="absolute -right-2.5 top-1 z-10 bg-amber-500 text-black text-[9px] font-black px-1 rounded-full shadow">
                          D{i + 1}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rodapé informativo com dimensões e legenda */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-800/60 rounded-lg p-2 border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase">Largura Planificada</p>
          <p className="text-sm font-bold text-orange-400">{larguraPlanificada} mm</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2 border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase">Qtd. de Dobras</p>
          <p className="text-sm font-bold text-sky-400">{dobras.length} dobra(s)</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2 border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase">Espessura Chapa</p>
          <p className="text-sm font-bold text-emerald-400">{espessura_mm} mm</p>
        </div>
        <div className="bg-slate-800/60 rounded-lg p-2 border border-slate-800">
          <p className="text-[10px] text-slate-400 uppercase">Comprimento Barra</p>
          <p className="text-sm font-bold text-purple-400">{comprimento_mm} mm</p>
        </div>
      </div>
    </div>
  );
}
