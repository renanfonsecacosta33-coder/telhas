import React, { useState, useMemo, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Layers, Eye, Ruler, RotateCw, ZoomIn, ZoomOut, Maximize2, Compass, Move, Sparkles,
  AlertTriangle, CheckCircle2, XCircle, Wrench, ShieldAlert, ChevronDown, ChevronUp, Info
} from "lucide-react";
import { analisarViabilidadeDobra } from "./CalculadoraForcaDobra";

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
  material = "Aço galvanizado",
  maquinaNome = "DOBRA FUNDO 6M",
  onUpdateAba = null,
  className = "",
}) {
  const [modoVisualizacao, setModoVisualizacao] = useState("perfil"); // "perfil" | "planificado"
  const [zoom, setZoom] = useState(1);
  const [rotacaoGraus, setRotacaoGraus] = useState(0);
  const [mostrarParecer, setMostrarParecer] = useState(true);

  // Estado de arrasto interativo
  const [dragState, setDragState] = useState(null);

  // Análise em tempo real do Especialista em Dobra
  const analise = useMemo(() => {
    return analisarViabilidadeDobra({
      abas,
      dobras,
      espessura_mm,
      comprimento_mm,
      material,
      maquinaNome,
    });
  }, [abas, dobras, espessura_mm, comprimento_mm, material, maquinaNome]);

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

  // Fator de escala dinâmico para preencher ~75% da tela sem distorcer
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

  // ── Handlers de Arrastar Interativo ──
  const handlePointerDown = useCallback((e, abaIdx, tipo = "cota") => {
    if (!onUpdateAba) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    const p1 = pontosScreen[abaIdx];
    const p2 = pontosScreen[abaIdx + 1];
    if (!p1 || !p2) return;

    const dx = p2.sx - p1.sx;
    const dy = p2.sy - p1.sy;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;

    setDragState({
      abaIdx,
      tipo,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startValue: Number(abas[abaIdx]) || 10,
      dirX: dx / len,
      dirY: dy / len,
      isReversed: tipo === "tip_start",
    });
  }, [onUpdateAba, pontosScreen, abas]);

  const handlePointerMove = useCallback((e) => {
    if (!dragState || !onUpdateAba) return;
    const deltaX = e.clientX - dragState.startClientX;
    const deltaY = e.clientY - dragState.startClientY;

    // Projeta o movimento do mouse na direção do segmento da aba
    let proj = deltaX * dragState.dirX + deltaY * dragState.dirY;
    if (dragState.isReversed) {
      proj = -proj;
    }

    const deltaMm = proj / scale;
    const novoValor = Math.max(5, Math.round(dragState.startValue + deltaMm));

    if (novoValor !== abas[dragState.abaIdx]) {
      onUpdateAba(dragState.abaIdx, novoValor);
    }
  }, [dragState, onUpdateAba, scale, abas]);

  const handlePointerUp = useCallback((e) => {
    if (dragState) {
      try {
        e.currentTarget.releasePointerCapture(dragState.pointerId);
      } catch {}
      setDragState(null);
    }
  }, [dragState]);

  return (
    <div className={`bg-slate-900 text-white rounded-xl border border-slate-800 p-4 shadow-xl flex flex-col ${className}`}>
      {/* Barra de Ferramentas / Controles Superiores */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Badge de Viabilidade do Especialista em Dobra */}
          {analise.status === "inviavel" ? (
            <Badge className="bg-red-500/20 text-red-400 border border-red-500 font-bold gap-1 animate-pulse">
              <XCircle className="w-3.5 h-3.5 text-red-500" />
              NÃO DÁ PRA DOBRAR ({analise.erros.length} erro)
            </Badge>
          ) : analise.status === "aviso" ? (
            <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500 font-bold gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              DOBRÁVEL C/ ATENÇÃO ({analise.avisos.length} aviso)
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500 font-bold gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              100% DOBRÁVEL NA MÁQUINA
            </Badge>
          )}

          <Badge variant="outline" className="text-[10px] bg-slate-800 text-sky-400 border-sky-500/30 font-mono">
            e = {espessura_mm || 1.5} mm · Matriz V{analise.vRecomendado}
          </Badge>

          {onUpdateAba && (
            <span className="text-[11px] text-slate-400 hidden lg:inline flex items-center gap-1">
              <Move className="w-3 h-3 text-orange-400 inline" />
              Arraste as cotas ou pontas para ajustar medidas
            </span>
          )}
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
      <div
        className="relative w-full h-72 sm:h-80 bg-[#0b1120] rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center select-none shadow-inner"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Grade técnica milimétrica (Blueprint Grid) */}
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(to right, #38bdf8 1px, transparent 1px), linear-gradient(to bottom, #38bdf8 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* Indicador flutuante de arrasto ativo */}
        {dragState && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-orange-600/90 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg border border-orange-400 flex items-center gap-1.5 animate-pulse">
            <Move className="w-3.5 h-3.5" />
            <span>Arrastando Aba {dragState.abaIdx + 1}: {abas[dragState.abaIdx]} mm</span>
          </div>
        )}

        {modoVisualizacao === "perfil" ? (
          /* ── MODO 1: PERFIL DOBRADO INTERATIVO COM DIAGNÓSTICO VISUAL ── */
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

              {/* Setas em vermelho para erros */}
              <marker
                id="cota-arrow-end-err"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
              </marker>
              <marker
                id="cota-arrow-start-err"
                viewBox="0 0 10 10"
                refX="1"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#ef4444" />
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

            {/* Destaque em VERMELHO para abas inválidas (menores que a aba mínima) */}
            {pontosScreen.slice(0, -1).map((p1, idx) => {
              const p2 = pontosScreen[idx + 1];
              const ehInvalido = analise.statusPorAba[idx]?.valido === false;
              if (!ehInvalido) return null;

              return (
                <line
                  key={`err-line-${idx}`}
                  x1={p1.sx}
                  y1={p1.sy}
                  x2={p2.sx}
                  y2={p2.sy}
                  stroke="#ef4444"
                  strokeWidth={Math.max(4, Math.min(10, Number(espessura_mm) * scale))}
                  strokeLinecap="round"
                  className="animate-pulse drop-shadow-[0_0_8px_rgba(239,68,68,0.9)]"
                />
              );
            })}

            {/* Cotas Técnicas de Cada Aba (Arrastáveis e com Feedback de Viabilidade) */}
            {pontosScreen.slice(0, -1).map((p1, idx) => {
              const p2 = pontosScreen[idx + 1];
              const comp = abas[idx] || 0;
              const isDraggingThis = dragState?.abaIdx === idx;
              const ehInvalido = analise.statusPorAba[idx]?.valido === false;

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
                    stroke={ehInvalido ? "#ef4444" : "#64748b"}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />
                  <line
                    x1={p2.sx + nx * 5}
                    y1={p2.sy + ny * 5}
                    x2={p2.sx + nx * (distCota + 6)}
                    y2={p2.sy + ny * (distCota + 6)}
                    stroke={ehInvalido ? "#ef4444" : "#64748b"}
                    strokeWidth="1"
                    strokeDasharray="2,2"
                  />

                  {/* Linha de cota principal com setas */}
                  <line
                    x1={c1x}
                    y1={c1y}
                    x2={c2x}
                    y2={c2y}
                    stroke={ehInvalido ? "#ef4444" : isDraggingThis ? "#f97316" : "#fb923c"}
                    strokeWidth={ehInvalido || isDraggingThis ? 2 : 1.2}
                    markerStart={ehInvalido ? "url(#cota-arrow-start-err)" : "url(#cota-arrow-start)"}
                    markerEnd={ehInvalido ? "url(#cota-arrow-end-err)" : "url(#cota-arrow-end)"}
                  />

                  {/* Badge da Cota com Dimensão (CLICÁVEL E ARRASTÁVEL!) */}
                  <g
                    transform={`translate(${midX}, ${midY})`}
                    className="cursor-ew-resize group"
                    onPointerDown={(e) => handlePointerDown(e, idx, "cota")}
                  >
                    <rect
                      x={-24}
                      y={-12}
                      width={48}
                      height={24}
                      rx={6}
                      fill={ehInvalido ? "#7f1d1d" : isDraggingThis ? "#c2410c" : "#0f172a"}
                      stroke={ehInvalido ? "#ef4444" : isDraggingThis ? "#ffffff" : "#f97316"}
                      strokeWidth={ehInvalido || isDraggingThis ? 2 : 1.2}
                      className="shadow-lg transition-colors group-hover:fill-slate-800"
                    />
                    <text
                      x={0}
                      y={4.5}
                      textAnchor="middle"
                      fill={ehInvalido ? "#fca5a5" : "#ffffff"}
                      fontSize="11"
                      fontWeight="black"
                      fontFamily="monospace"
                      className="pointer-events-none"
                    >
                      {comp}
                    </text>

                    {/* Alerta de erro na cota */}
                    {ehInvalido && (
                      <g transform="translate(0, -18)">
                        <circle cx={0} cy={0} r={7} fill="#ef4444" stroke="#ffffff" strokeWidth="1" />
                        <text x={0} y={3} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="black">!</text>
                      </g>
                    )}

                    {/* Indicador de arraste em peças válidas */}
                    {!ehInvalido && (
                      <>
                        <circle cx={18} cy={-8} r={3} fill="#f97316" className="animate-ping opacity-75" />
                        <circle cx={18} cy={-8} r={2.5} fill="#f97316" />
                      </>
                    )}
                  </g>
                </g>
              );
            })}

            {/* Handle Arrastável na Ponta da Primeira Aba (P0) */}
            {pontosScreen.length > 0 && onUpdateAba && (
              <g
                className="cursor-move group"
                onPointerDown={(e) => handlePointerDown(e, 0, "tip_start")}
              >
                <circle
                  cx={pontosScreen[0].sx}
                  cy={pontosScreen[0].sy}
                  r={8}
                  fill={analise.statusPorAba[0]?.valido === false ? "#ef4444" : "#f97316"}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="shadow-md transition-transform group-hover:scale-125 group-active:scale-110"
                />
                <circle
                  cx={pontosScreen[0].sx}
                  cy={pontosScreen[0].sy}
                  r={14}
                  fill="none"
                  stroke={analise.statusPorAba[0]?.valido === false ? "#ef4444" : "#f97316"}
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  className="animate-spin opacity-60"
                />
              </g>
            )}

            {/* Handle Arrastável na Ponta da Última Aba (P_last) */}
            {pontosScreen.length > 1 && onUpdateAba && (
              <g
                className="cursor-move group"
                onPointerDown={(e) => handlePointerDown(e, abas.length - 1, "tip_end")}
              >
                <circle
                  cx={pontosScreen[pontosScreen.length - 1].sx}
                  cy={pontosScreen[pontosScreen.length - 1].sy}
                  r={8}
                  fill={analise.statusPorAba[abas.length - 1]?.valido === false ? "#ef4444" : "#f97316"}
                  stroke="#ffffff"
                  strokeWidth="2"
                  className="shadow-md transition-transform group-hover:scale-125 group-active:scale-110"
                />
                <circle
                  cx={pontosScreen[pontosScreen.length - 1].sx}
                  cy={pontosScreen[pontosScreen.length - 1].sy}
                  r={14}
                  fill="none"
                  stroke={analise.statusPorAba[abas.length - 1]?.valido === false ? "#ef4444" : "#f97316"}
                  strokeWidth="1.5"
                  strokeDasharray="3,3"
                  className="animate-spin opacity-60"
                />
              </g>
            )}

            {/* Marcadores de Vértices de Dobra (D1, D2...) com Ângulos */}
            {pontosScreen.slice(1, -1).map((p, idx) => {
              const dobra = dobras[idx];
              const ang = dobra?.angulo || 90;
              const dobraAviso = analise.statusPorDobra[idx]?.valido === false;

              return (
                <g key={`dobra-marker-${idx}`} className="select-none">
                  {/* Círculo indicador na dobra */}
                  <circle
                    cx={p.sx}
                    cy={p.sy}
                    r={9}
                    fill={dobraAviso ? "#d97706" : "#ea580c"}
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
                      stroke={dobraAviso ? "#f59e0b" : "#f97316"}
                      strokeWidth="0.8"
                    />
                    <text
                      x={12}
                      y={4}
                      textAnchor="middle"
                      fill={dobraAviso ? "#fbbf24" : "#fb923c"}
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

      {/* ── PAINEL DO ESPECIALISTA EM DOBRA EM TEMPO REAL ── */}
      <div className="mt-3 bg-slate-800/80 border border-slate-700/80 rounded-xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-200">
              Parecer Técnico do Especialista em Dobra
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              (Canal V: <strong>V{analise.vRecomendado} mm</strong> · Aba Mínima Exigida: <strong>{analise.abaMinimaMm} mm</strong>)
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMostrarParecer(!mostrarParecer)}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
          >
            {mostrarParecer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {mostrarParecer && (
          <div className="space-y-2 pt-1 border-t border-slate-700/60">
            {/* Erros impeditivos */}
            {analise.erros.map((err, i) => (
              <div
                key={`err-${i}`}
                className="bg-red-500/10 border border-red-500/40 rounded-lg p-2.5 flex items-start gap-2.5 text-xs"
              >
                <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold text-red-300">{err.titulo}</span>
                  <p className="text-[11px] text-red-200/90 mt-0.5">{err.msg}</p>
                </div>
              </div>
            ))}

            {/* Avisos de atenção e setup */}
            {analise.avisos.map((av, i) => (
              <div
                key={`av-${i}`}
                className="bg-amber-500/10 border border-amber-500/40 rounded-lg p-2.5 flex items-start gap-2.5 text-xs"
              >
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="font-bold text-amber-300">{av.titulo}</span>
                  <p className="text-[11px] text-amber-200/90 mt-0.5">{av.msg}</p>
                </div>
              </div>
            ))}

            {/* Tudo 100% OK */}
            {analise.ehDobravel && analise.avisos.length === 0 && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 flex items-center gap-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-300">Todas as medidas são 100% viáveis para dobra!</span>
                  <p className="text-[11px] text-emerald-200/80">
                    Apoio nos dois ombros do canal V{analise.vRecomendado} garantido. Força estimada de {analise.tonsTotal} t dentro da capacidade da {maquinaNome}.
                  </p>
                </div>
              </div>
            )}
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
          <p className="text-[10px] text-slate-400 uppercase font-semibold">Força Estimada</p>
          <p className="text-base font-black text-purple-400 font-mono mt-0.5">{analise.tonsTotal} t</p>
        </div>
      </div>
    </div>
  );
}
