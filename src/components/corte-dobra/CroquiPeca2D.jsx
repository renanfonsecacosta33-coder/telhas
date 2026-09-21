import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers, Eye, Ruler, RotateCw, ZoomIn, ZoomOut, Maximize2, Compass
} from "lucide-react";

/**
 * Predefinições geométricas de perfis industriais comuns da AJL
 */
export const PRESETS_PERFIL = [
  {
    id: "perfil_u",
    nome: "Perfil U Simples",
    categoria: "Estrutural",
    abasPadrao: [25, 50, 25],
    anguloInicial: -90, // Começa descendo flange esquerdo
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", descricao: "Flange esquerdo" },
      { angulo: 90, direcao: "cima", descricao: "Flange direito" },
    ],
  },
  {
    id: "perfil_c",
    nome: "Perfil C Enrijecido",
    categoria: "Estrutural",
    abasPadrao: [15, 40, 75, 40, 15],
    anguloInicial: 90, // Começa subindo no enrijecedor superior
    dobrasPadrao: [
      { angulo: 90, direcao: "baixo", descricao: "Enrijecedor sup." },
      { angulo: 90, direcao: "baixo", descricao: "Flange superior" },
      { angulo: 90, direcao: "baixo", descricao: "Alma principal" },
      { angulo: 90, direcao: "baixo", descricao: "Flange inferior" },
    ],
  },
  {
    id: "cantoneira_l",
    nome: "Cantoneira / Perfil L",
    categoria: "Cantoneira",
    abasPadrao: [50, 50],
    anguloInicial: -90, // Desce vertical
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", descricao: "Dobra central 90°" },
    ],
  },
  {
    id: "rufo_pingadeira",
    nome: "Rufo com Pingadeira",
    categoria: "Cobertura",
    abasPadrao: [15, 120, 50, 15],
    anguloInicial: -45,
    dobrasPadrao: [
      { angulo: 135, direcao: "cima", descricao: "Bainha/Pingadeira" },
      { angulo: 90, direcao: "baixo", descricao: "Parede principal" },
      { angulo: 90, direcao: "cima", descricao: "Aba fixação" },
    ],
  },
  {
    id: "perfil_cartola",
    nome: "Perfil Cartola (Ômega)",
    categoria: "Estrutural",
    abasPadrao: [20, 35, 50, 35, 20],
    anguloInicial: 0,
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", descricao: "Aba base esq." },
      { angulo: 90, direcao: "baixo", descricao: "Lateral esq." },
      { angulo: 90, direcao: "baixo", descricao: "Topo" },
      { angulo: 90, direcao: "cima", descricao: "Lateral dir." },
    ],
  },
  {
    id: "perfil_z",
    nome: "Perfil Z",
    categoria: "Estrutural",
    abasPadrao: [25, 60, 25],
    anguloInicial: 180,
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", descricao: "Aba superior" },
      { angulo: 90, direcao: "baixo", descricao: "Alma vertical" },
    ],
  },
];

/**
 * Constrói os pontos 2D (x, y) no plano milimétrico (CAD space)
 */
function calcularPontosPerfil(abas = [], dobras = [], startAngleDeg = 0) {
  if (!abas || abas.length === 0) return { pontos: [], minX: 0, maxX: 100, minY: 0, maxY: 100 };

  const pontos = [];
  let curX = 0;
  let curY = 0;
  let curAngleDeg = startAngleDeg;

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
      // Direção da dobra (cima/dentro = gira anti-horário; baixo/fora = gira horário)
      const sentido = dobra.direcao === "baixo" || dobra.direcao === "fora" ? -1 : 1;
      curAngleDeg += (180 - ang) * sentido;
    }
  }

  // Bounding box em milímetros
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
  const [modoVisualizacao, setModoVisualizacao] = useState("perfil"); // "perfil" | "planificado"
  const [zoom, setZoom] = useState(1);
  const [rotacaoGraus, setRotacaoGraus] = useState(0);

  // Dimensões fixas do canvas em pixels de tela
  const CANVAS_W = 660;
  const CANVAS_H = 340;

  // Calcula pontos no plano CAD milimétrico
  const { pontosMm, shapeW, shapeH, centerMmX, centerMmY } = useMemo(() => {
    const { pontos, minX, maxX, minY, maxY } = calcularPontosPerfil(abas, dobras, rotacaoGraus);
    const w = Math.max(1, maxX - minX);
    const h = Math.max(1, maxY - minY);
    return {
      pontosMm: pontos,
      shapeW: w,
      shapeH: h,
      centerMmX: (minX + maxX) / 2,
      centerMmY: (minY + maxY) / 2,
    };
  }, [abas, dobras, rotacaoGraus]);

  // Fator de escala dinâmico para preencher 75% da tela sem distorcer
  const scale = useMemo(() => {
    const marginX = 140; // margem para acomodar cotas
    const marginY = 100;
    const availW = CANVAS_W - marginX;
    const availH = CANVAS_H - marginY;
    const s = Math.min(availW / shapeW, availH / shapeH) * zoom;
    return Math.max(0.5, Math.min(s, 6.0));
  }, [shapeW, shapeH, zoom]);

  // Transforma coordenadas de milímetros para pixels de tela (SVG pixel space)
  const pontosScreen = useMemo(() => {
    const centerX = CANVAS_W / 2;
    const centerY = CANVAS_H / 2;

    return pontosMm.map((p) => ({
      ...p,
      sx: centerX + (p.x - centerMmX) * scale,
      sy: centerY - (p.y - centerMmY) * scale, // Invertido: Y positivo para cima
    }));
  }, [pontosMm, centerMmX, centerMmY, scale]);

  // Path SVG suave da linha de centro
  const pathD = useMemo(() => {
    if (pontosScreen.length === 0) return "";
    return pontosScreen.reduce((acc, p, idx) => {
      return idx === 0 ? `M ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}` : `${acc} L ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`;
    }, "");
  }, [pontosScreen]);

  return (
    <div className={`bg-slate-900 text-white rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col ${className}`}>
      {/* Barra de Ferramentas / Controles Superiores */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Croqui Técnico CAD 2D
          </span>
          <Badge variant="outline" className="text-[10px] bg-slate-800 text-sky-400 border-sky-500/30 font-mono">
            Espessura: {espessura_mm || 1.5} mm
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Alternar Perfil Dobrado vs Blank Planificado */}
          <div className="flex bg-slate-800/90 rounded-lg p-0.5 border border-slate-700">
            <button
              type="button"
              onClick={() => setModoVisualizacao("perfil")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                modoVisualizacao === "perfil"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Perfil Dobrado
            </button>
            <button
              type="button"
              onClick={() => setModoVisualizacao("planificado")}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                modoVisualizacao === "planificado"
                  ? "bg-orange-500 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Blank Planificado
            </button>
          </div>

          {/* Girar 90° */}
          <button
            type="button"
            onClick={() => setRotacaoGraus((r) => (r + 90) % 360)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1"
            title="Girar visualização 90°"
          >
            <RotateCw className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-[10px] hidden sm:inline">Girar</span>
          </button>

          {/* Zoom */}
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
            title="Diminuir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { setZoom(1); setRotacaoGraus(0); }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700"
            title="Resetar Enquadramento"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Área Gráfica SVG */}
      <div className="relative w-full h-72 sm:h-80 bg-[#0b1120] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center select-none shadow-inner">
        {/* Grade técnica milimétrica (Blueprint Grid) */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {modoVisualizacao === "perfil" ? (
          /* ── MODO 1: PERFIL DOBRADO COM COTAS TÉCNICAS PROFISSIONAIS ── */
          <svg
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            className="w-full h-full max-h-full"
            style={{ display: "block" }}
          >
            <defs>
              {/* Ponta de seta para linha de cota */}
              <marker
                id="cota-arrow-end"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f97316" />
              </marker>
              <marker
                id="cota-arrow-start"
                viewBox="0 0 10 10"
                refX="1"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#f97316" />
              </marker>
            </defs>

            {/* Chapa de Aço (Traço Principal com Espessura Real) */}
            <path
              d={pathD}
              fill="none"
              stroke="#0284c7"
              strokeWidth={Math.max(4, Math.min(10, Number(espessura_mm) * scale * 0.8))}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.4}
            />
            <path
              d={pathD}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={Math.max(2.5, Math.min(7, Number(espessura_mm) * scale * 0.5))}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_0_10px_rgba(56,189,248,0.5)]"
            />

            {/* Cotas Técnicas de Cada Aba (Dimension Lines) */}
            {pontosScreen.slice(0, -1).map((p1, idx) => {
              const p2 = pontosScreen[idx + 1];
              const comp = abas[idx] || 0;

              // Vetores do segmento
              const dx = p2.sx - p1.sx;
              const dy = p2.sy - p1.sy;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;

              // Vetor normal apontando para fora do segmento
              const nx = -dy / len;
              const ny = dx / len;

              // Distância da linha de cota em pixels
              const distCota = 28;

              // Coordenadas da cota
              const c1x = p1.sx + nx * distCota;
              const c1y = p1.sy + ny * distCota;
              const c2x = p2.sx + nx * distCota;
              const c2y = p2.sy + ny * distCota;

              const midX = (c1x + c2x) / 2;
              const midY = (c1y + c2y) / 2;

              return (
                <g key={`cota-aba-${idx}`} className="select-none">
                  {/* Linhas de chamada (extension lines) */}
                  <line
                    x1={p1.sx + nx * 5}
                    y1={p1.sy + ny * 5}
                    x2={p1.sx + nx * (distCota + 6)}
                    y2={p1.sy + ny * (distCota + 6)}
                    stroke="#64748b"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <line
                    x1={p2.sx + nx * 5}
                    y1={p2.sy + ny * 5}
                    x2={p2.sx + nx * (distCota + 6)}
                    y2={p2.sy + ny * (distCota + 6)}
                    stroke="#64748b"
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />

                  {/* Linha de cota principal com setas */}
                  <line
                    x1={c1x}
                    y1={c1y}
                    x2={c2x}
                    y2={c2y}
                    stroke="#f97316"
                    strokeWidth="1.2"
                    markerStart="url(#cota-arrow-start)"
                    markerEnd="url(#cota-arrow-end)"
                  />

                  {/* Badge da Cota com Dimensão (Ex: 25 mm) */}
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x={-22}
                      y={-10}
                      width={44}
                      height={20}
                      rx={4}
                      fill="#0f172a"
                      stroke="#f97316"
                      strokeWidth="1"
                      className="shadow-md"
                    />
                    <text
                      x={0}
                      y={4}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {comp}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Marcadores de Vértices de Dobra (D1, D2...) com Ângulos */}
            {pontosScreen.slice(1, -1).map((p, idx) => {
              const dobra = dobras[idx];
              const ang = dobra?.angulo || 90;

              return (
                <g key={`dobra-marker-${idx}`} className="select-none">
                  {/* Círculo indicador na dobra */}
                  <circle
                    cx={p.sx}
                    cy={p.sy}
                    r={9}
                    fill="#ea580c"
                    stroke="#ffffff"
                    strokeWidth="2"
                    className="drop-shadow-md"
                  />
                  <text
                    x={p.sx}
                    y={p.sy + 3.5}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="9"
                    fontWeight="black"
                  >
                    D{idx + 1}
                  </text>

                  {/* Pill com o ângulo da dobra */}
                  <g transform={`translate(${p.sx + 14}, ${p.sy - 14})`}>
                    <rect
                      x={-4}
                      y={-8}
                      width={32}
                      height={16}
                      rx={8}
                      fill="#1e293b"
                      stroke="#f97316"
                      strokeWidth="0.8"
                    />
                    <text
                      x={12}
                      y={4}
                      textAnchor="middle"
                      fill="#fb923c"
                      fontSize="9"
                      fontWeight="bold"
                    >
                      {ang}°
                    </text>
                  </g>
                </g>
              );
            })}
          </svg>
        ) : (
          /* ── MODO 2: BLANK PLANIFICADO (FAIXA ESTICADA) ── */
          <div className="w-full h-full flex flex-col items-center justify-center p-6">
            <div className="w-full max-w-xl bg-slate-900/90 border border-slate-700 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Ruler className="w-4 h-4 text-emerald-500" />
                  Blank Desenvolvido para Corte na Guilhotina
                </span>
                <Badge className="bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-mono">
                  Largura: {larguraPlanificada} mm
                </Badge>
              </div>

              {/* Barra Planificada com Linhas de Dobra */}
              <div className="h-20 w-full bg-slate-950 border-2 border-emerald-500/80 rounded-lg flex relative overflow-hidden shadow-inner">
                {abas.map((aba, i) => {
                  const total = abas.reduce((acc, v) => acc + (Number(v) || 0), 0) || 1;
                  const pct = ((Number(aba) || 0) / total) * 100;
                  return (
                    <div
                      key={i}
                      style={{ width: `${pct}%` }}
                      className="h-full border-r border-dashed border-amber-400/80 relative flex flex-col items-center justify-center px-1 text-center group hover:bg-slate-800/60 transition-colors"
                    >
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Aba {i + 1}</span>
                      <span className="text-xs font-black text-amber-300 font-mono">{aba} mm</span>
                      {i < abas.length - 1 && (
                        <div
                          className="absolute -right-3 top-1 z-10 bg-orange-500 text-white text-[9px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md border border-slate-900"
                          title={`Dobra D${i + 1}`}
                        >
                          D{i + 1}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Comprimento de corte: <strong className="text-white">{comprimento_mm} mm</strong></span>
                <span>Área do blank: <strong className="text-emerald-400">{((larguraPlanificada * comprimento_mm) / 1e6).toFixed(3)} m²</strong></span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Métricas Inferiores */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/80">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Largura Planificada</p>
          <p className="text-base font-black text-orange-400 font-mono mt-0.5">{larguraPlanificada} mm</p>
        </div>
        <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/80">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Qtd. de Dobras</p>
          <p className="text-base font-black text-sky-400 font-mono mt-0.5">{dobras.length} dobra(s)</p>
        </div>
        <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/80">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Espessura Chapa</p>
          <p className="text-base font-black text-emerald-400 font-mono mt-0.5">{espessura_mm} mm</p>
        </div>
        <div className="bg-slate-800/80 rounded-lg p-2.5 border border-slate-700/80">
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Comprimento Barra</p>
          <p className="text-base font-black text-purple-400 font-mono mt-0.5">{comprimento_mm} mm</p>
        </div>
      </div>
    </div>
  );
}
