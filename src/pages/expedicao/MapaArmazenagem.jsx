import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Map, Plus, Settings, ChevronLeft, Package, Ruler,
  ArrowRight, Trash2, Save, X, Move, CheckCircle2,
  LayoutGrid, Box, List, Columns, Info
} from "lucide-react";

// ─── Constantes ────────────────────────────────────────────
const COMPRIMENTO_BARRA = 6; // metros

const COR_OCUPACAO = {
  vazio:   "bg-slate-100 border-slate-300 text-slate-400",
  parcial: "bg-amber-50 border-amber-300 text-amber-700",
  cheio:   "bg-emerald-50 border-emerald-400 text-emerald-700",
};

const POSICOES_PADRAO = [
  { id: "A1", rua: "A", posicao: "1", capacidade_barras: 20, descricao: "Rua A — Posição 1" },
  { id: "A2", rua: "A", posicao: "2", capacidade_barras: 20, descricao: "Rua A — Posição 2" },
  { id: "A3", rua: "A", posicao: "3", capacidade_barras: 20, descricao: "Rua A — Posição 3" },
  { id: "B1", rua: "B", posicao: "1", capacidade_barras: 15, descricao: "Rua B — Posição 1" },
  { id: "B2", rua: "B", posicao: "2", capacidade_barras: 15, descricao: "Rua B — Posição 2" },
  { id: "B3", rua: "B", posicao: "3", capacidade_barras: 15, descricao: "Rua B — Posição 3" },
  { id: "B4", rua: "B", posicao: "4", capacidade_barras: 15, descricao: "Rua B — Posição 4" },
  { id: "C1", rua: "C", posicao: "1", capacidade_barras: 30, descricao: "Rua C — Frisada/Bobinas" },
  { id: "C2", rua: "C", posicao: "2", capacidade_barras: 30, descricao: "Rua C — Posição 2" },
  { id: "D1", rua: "D", posicao: "1", capacidade_barras: 25, descricao: "Rua D — Posição 1" },
  { id: "D2", rua: "D", posicao: "2", capacidade_barras: 25, descricao: "Rua D — Posição 2" },
  { id: "E1", rua: "E", posicao: "1", capacidade_barras: 20, descricao: "Rua E — Posição 1" },
  { id: "E2", rua: "E", posicao: "2", capacidade_barras: 20, descricao: "Rua E — Posição 2" },
  { id: "PATIO", rua: "PÁTIO", posicao: "EXT", capacidade_barras: 100, descricao: "Pátio Externo" },
];

function getOccupancyColors(pct) {
  if (pct <= 0) return { top: "#f1f5f9", left: "#e2e8f0", right: "#cbd5e1", bar: "#94a3b8", floor: "#f8fafc" };
  if (pct >= 1) return { top: "#bbf7d0", left: "#4ade80", right: "#16a34a", bar: "#16a34a", floor: "#f0fdf4" };
  if (pct > 0.6) return { top: "#fde68a", left: "#f59e0b", right: "#d97706", bar: "#d97706", floor: "#fffbeb" };
  return { top: "#a7f3d0", left: "#34d399", right: "#059669", bar: "#059669", floor: "#ecfdf5" };
}

// ═══════════════════════════════════════════════════════════
// PLANTA INDUSTRIAL CAD (Estilo Porta-Paletes Vertical com Abas)
// ═══════════════════════════════════════════════════════════
function MapaPlantaCAD({ posicoes, getOcupacao, posicaoSel, onSelect }) {
  const [activeTab, setActiveTab] = useState("indice"); // "indice" | "nomenclatura" | ruaId

  // Agrupar posições por pares de estantes duplas (ex: A | B, C | D, E | F...)
  const todasRuas = [...new Set(posicoes.map(p => p.rua))];

  // Criar pares de estantes verticais
  const paresEstantes = [];
  for (let i = 0; i < todasRuas.length; i += 2) {
    if (i + 1 < todasRuas.length) {
      paresEstantes.push({ label: `${todasRuas[i]} ${todasRuas[i+1]}`, ruas: [todasRuas[i], todasRuas[i+1]] });
    } else {
      paresEstantes.push({ label: todasRuas[i], ruas: [todasRuas[i]] });
    }
  }

  // Filtrar posições conforme a aba selecionada
  const posicoesExibidas = activeTab === "indice" || activeTab === "nomenclatura"
    ? posicoes
    : posicoes.filter(p => p.rua === activeTab);

  return (
    <div className="rounded-2xl border-2 border-slate-700 bg-white dark:bg-slate-950 shadow-2xl overflow-hidden">
      {/* Top Banner CAD Header */}
      <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Columns className="w-5 h-5 text-teal-400" />
          <span className="font-bold text-sm tracking-wider uppercase">Planta de Porta-Paletes — Barracão de Armazenagem</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-600 inline-block" /> Livre</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Parcial</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-600 inline-block" /> Lotado</span>
        </div>
      </div>

      {/* Main CAD Canvas Area */}
      <div className="p-6 bg-slate-50 dark:bg-slate-900 overflow-x-auto min-h-[480px]">
        {activeTab === "nomenclatura" ? (
          /* Aba Nomenclatura / Regras de Endereçamento */
          <div className="max-w-2xl mx-auto space-y-4 py-4 text-slate-800 dark:text-slate-200">
            <h3 className="font-bold text-lg text-teal-600 flex items-center gap-2">
              <Info className="w-5 h-5" /> Nomenclatura de Endereçamento da Expedição
            </h3>
            <div className="bg-card border p-4 rounded-xl space-y-2 text-sm">
              <p>O barracão é organizado em <strong>Estantes Duplas Verticais (Racks)</strong> identificadas por letras (Rua A, B, C...):</p>
              <ul className="list-disc pl-5 space-y-1 text-xs text-muted-foreground">
                <li><strong>Letra da Rua:</strong> Identifica o corredor/estante (ex: A, B, C, D).</li>
                <li><strong>Número da Posição:</strong> Identifica o módulo da estante (ex: 1, 2, 3...).</li>
                <li><strong>ID Completo:</strong> Combina Rua + Posição (ex: <code>A1</code> = Rua A, Posição 1).</li>
                <li><strong>Barras Padrão:</strong> Capacidade calculada para barras de 6 metros.</li>
              </ul>
            </div>
          </div>
        ) : (
          /* Vista Principal da Planta — Estantes Verticais Duplas */
          <div className="flex gap-8 justify-start sm:justify-center items-start min-w-max pb-4">
            {paresEstantes.map((par, pIdx) => {
              // Verifica se deve exibir esse par (se a aba for a rua ou índice geral)
              const estaVisivel = activeTab === "indice" || par.ruas.includes(activeTab);
              if (!estaVisivel) return null;

              return (
                <div key={pIdx} className="flex flex-col items-center group">
                  {/* Top Badge com o Nome das Ruas em Par (ex: I J, K L, M N...) */}
                  <div className="bg-slate-900 border-2 border-slate-700 text-white font-extrabold text-base px-5 py-1.5 rounded-lg shadow-md mb-3 tracking-widest flex items-center gap-2">
                    {par.label}
                  </div>

                  {/* Conjunto da Estante Dupla Vertical */}
                  <div className="flex gap-1.5 p-2 bg-slate-200 dark:bg-slate-800/80 rounded-xl border-2 border-slate-400 dark:border-slate-700 shadow-inner">
                    {par.ruas.map((ruaId) => {
                      const posicoesRua = posicoes.filter(p => p.rua === ruaId);

                      return (
                        <div key={ruaId} className="flex flex-col gap-2 w-28">
                          <div className="text-[11px] font-bold text-center text-slate-700 dark:text-slate-300 border-b border-slate-400 pb-1">
                            RUA {ruaId}
                          </div>

                          {posicoesRua.length === 0 ? (
                            <div className="text-[10px] text-muted-foreground text-center py-6">Vazio</div>
                          ) : (
                            posicoesRua.map(pos => {
                              const { totalBarras, totalKg } = getOcupacao(pos.id);
                              const pct = Math.min(1, (totalBarras || 0) / pos.capacidade_barras);
                              const isSelected = posicaoSel?.id === pos.id;

                              // Estilo das células conforme ocupação (Vermelho/Amarelo/Azul/Livre estilo CAD)
                              let borderClass = "border-blue-600 bg-blue-50 text-blue-900";
                              let barClass    = "bg-blue-500";
                              let badgeColor  = "bg-blue-600 text-white";

                              if (pct >= 0.9) {
                                borderClass = "border-red-600 bg-red-50 text-red-900";
                                barClass    = "bg-red-600";
                                badgeColor  = "bg-red-600 text-white";
                              } else if (pct > 0.3) {
                                borderClass = "border-amber-500 bg-amber-50 text-amber-900";
                                barClass    = "bg-amber-500";
                                badgeColor  = "bg-amber-600 text-white";
                              }

                              return (
                                <button
                                  key={pos.id}
                                  onClick={() => onSelect(pos)}
                                  className={`relative border-2 rounded-lg p-2.5 text-left transition-all hover:scale-105 hover:z-10 shadow-sm ${borderClass} ${
                                    isSelected ? "ring-4 ring-teal-500 border-teal-600 shadow-lg scale-105" : ""
                                  }`}
                                >
                                  {/* ID Badge do Slot */}
                                  <div className="flex items-center justify-between mb-1">
                                    <span className={`font-mono font-extrabold text-xs px-1.5 py-0.5 rounded ${badgeColor}`}>
                                      {pos.id}
                                    </span>
                                    <span className="text-[9px] font-bold text-slate-500">
                                      {pos.capacidade_barras}b
                                    </span>
                                  </div>

                                  {/* Indicador Numérico de Ocupação */}
                                  <div className="text-[11px] font-bold mt-1">
                                    {totalBarras} barras
                                  </div>
                                  <div className="text-[9px] opacity-75 truncate">
                                    {(totalBarras * COMPRIMENTO_BARRA)}m lineares
                                  </div>

                                  {/* Progress bar visual do nicho */}
                                  <div className="w-full bg-slate-300 dark:bg-slate-700 rounded-full h-1.5 mt-1.5 overflow-hidden">
                                    <div className={`h-full ${barClass}`} style={{ width: `${pct * 100}%` }} />
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CAD Bottom Navigation Tabs (Estilo Planilha/CAD com Abas no Rodapé) */}
      <div className="bg-slate-200 dark:bg-slate-900 border-t-2 border-slate-700 px-3 py-1.5 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("indice")}
          className={`px-3 py-1.5 rounded-t-md text-xs font-bold transition-all ${
            activeTab === "indice"
              ? "bg-white dark:bg-slate-950 text-teal-600 border-t-2 border-x-2 border-teal-500 shadow-md"
              : "bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-400"
          }`}
        >
          📋 ÍNDICE GERAL
        </button>

        <button
          onClick={() => setActiveTab("nomenclatura")}
          className={`px-3 py-1.5 rounded-t-md text-xs font-bold transition-all ${
            activeTab === "nomenclatura"
              ? "bg-white dark:bg-slate-950 text-teal-600 border-t-2 border-x-2 border-teal-500 shadow-md"
              : "bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-400"
          }`}
        >
          📘 NOMENCLATURA
        </button>

        <div className="h-4 w-px bg-slate-400 mx-1" />

        {todasRuas.map(ruaId => (
          <button
            key={ruaId}
            onClick={() => setActiveTab(ruaId)}
            className={`px-3 py-1.5 rounded-t-md text-xs font-bold transition-all ${
              activeTab === ruaId
                ? "bg-white dark:bg-slate-950 text-teal-600 border-t-2 border-x-2 border-teal-500 shadow-md"
                : "bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-400"
            }`}
          >
            RUA {ruaId}
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2D FLOOR PLAN (SVG Top-Down)
// ═══════════════════════════════════════════════════════════
function Mapa2D({ posicoes, getOcupacao, posicaoSel, onSelect }) {
  const CELL_W = 110;
  const CELL_H = 75;
  const GAP_X = 10;
  const CORRIDOR = 44;
  const PAD_X = 70;
  const PAD_Y = 40;

  const ruas = [...new Set(posicoes.map(p => p.rua))];
  const maxCols = Math.max(...ruas.map(rua => posicoes.filter(p => p.rua === rua).length));

  const svgW = PAD_X * 2 + maxCols * (CELL_W + GAP_X) + 20;
  const svgH = PAD_Y * 2 + ruas.length * (CELL_H + CORRIDOR) - CORRIDOR + 30;

  return (
    <div className="overflow-auto rounded-2xl bg-slate-100 p-4 border border-slate-200 shadow-inner">
      <div className="text-xs text-muted-foreground mb-2 text-center font-semibold tracking-wide uppercase">
        Vista Superior — Planta Baixa
      </div>
      <svg width={svgW} height={svgH} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="2" dy="3" stdDeviation="3" floodOpacity="0.12" />
          </filter>
        </defs>

        <rect x={PAD_X / 2} y={PAD_Y / 2} width={svgW - PAD_X} height={svgH - PAD_Y}
          fill="white" stroke="#64748b" strokeWidth={2.5} rx={8} />
        <rect x={PAD_X / 2} y={PAD_Y / 2} width={svgW - PAD_X} height={20}
          fill="#1e293b" rx={8} />
        <text x={svgW / 2} y={PAD_Y / 2 + 14} textAnchor="middle" fontSize={10}
          fontWeight="bold" fill="white" letterSpacing="2">BARRACÃO — EXPEDIÇÃO</text>

        <text x={svgW / 2} y={svgH - 8} textAnchor="middle" fontSize={10} fill="#94a3b8"
          fontWeight="bold">↕ ENTRADA / SAÍDA</text>

        {ruas.map((rua, ruaIdx) => {
          const ruaPosicoes = posicoes.filter(p => p.rua === rua);
          const rowY = PAD_Y + ruaIdx * (CELL_H + CORRIDOR);

          return (
            <g key={rua}>
              <rect x={PAD_X / 2 + 4} y={rowY + CELL_H / 2 - 10} width={44} height={20}
                fill="#0f172a" rx={4} />
              <text x={PAD_X / 2 + 26} y={rowY + CELL_H / 2 + 5} textAnchor="middle"
                fontSize={9} fontWeight="bold" fill="white">Rua {rua}</text>

              {ruaIdx < ruas.length - 1 && (
                <g>
                  <rect x={PAD_X / 2 + 4} y={rowY + CELL_H} width={svgW - PAD_X - 8} height={CORRIDOR}
                    fill="#f8fafc" stroke="#e2e8f0" strokeWidth={0.5} />
                  <text x={svgW / 2} y={rowY + CELL_H + CORRIDOR / 2 + 4}
                    textAnchor="middle" fontSize={9} fill="#cbd5e1" fontStyle="italic">
                    ← corredor →
                  </text>
                </g>
              )}

              {ruaPosicoes.map((pos, colIdx) => {
                const x = PAD_X + colIdx * (CELL_W + GAP_X);
                const { totalBarras, totalKg } = getOcupacao(pos.id);
                const pct = Math.min(1, (totalBarras || 0) / pos.capacidade_barras);
                const colors = getOccupancyColors(pct);
                const isSelected = posicaoSel?.id === pos.id;

                return (
                  <g key={pos.id} onClick={() => onSelect(pos)} style={{ cursor: "pointer" }}>
                    <rect x={x + 3} y={rowY + 3} width={CELL_W} height={CELL_H}
                      fill="rgba(0,0,0,0.08)" rx={6} />
                    <rect x={x} y={rowY} width={CELL_W} height={CELL_H}
                      fill={colors.floor}
                      stroke={isSelected ? "#0d9488" : "#e2e8f0"}
                      strokeWidth={isSelected ? 2.5 : 1.5} rx={6}
                      filter="url(#shadow)" />
                    <rect x={x + 6} y={rowY + CELL_H - 10} width={CELL_W - 12} height={6}
                      fill="#e2e8f0" rx={3} />
                    {pct > 0 && (
                      <rect x={x + 6} y={rowY + CELL_H - 10} width={(CELL_W - 12) * pct} height={6}
                        fill={colors.bar} rx={3} />
                    )}
                    <text x={x + CELL_W / 2} y={rowY + 24} textAnchor="middle"
                      fontSize={16} fontWeight="bold" fill={isSelected ? "#0d9488" : "#1e293b"}>
                      {pos.id}
                    </text>
                    <text x={x + CELL_W / 2} y={rowY + 41} textAnchor="middle"
                      fontSize={11} fill="#475569">
                      {totalBarras}/{pos.capacidade_barras} barras
                    </text>
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3D ISOMETRIC VIEW (SVG Isometric projection)
// ═══════════════════════════════════════════════════════════
function Mapa3D({ posicoes, getOcupacao, posicaoSel, onSelect }) {
  const TILE_W = 90;
  const TILE_H = 45;
  const MAX_BOX_H = 70;
  const FLOOR_H = 8;
  const PADDING_COL = 1.2;
  const PADDING_ROW = 1.3;

  const ruas = [...new Set(posicoes.map(p => p.rua))];

  function iso(col, row, z = 0) {
    return {
      x: 500 + (col - row) * (TILE_W / 2),
      y: 200 + (col + row) * (TILE_H / 2) - z,
    };
  }

  function getGridPos(pos) {
    const ruaIdx = ruas.indexOf(pos.rua);
    const ruaPosicoes = posicoes.filter(p => p.rua === pos.rua);
    const colIdx = ruaPosicoes.findIndex(p => p.id === pos.id);
    return {
      row: ruaIdx * PADDING_ROW,
      col: colIdx * PADDING_COL,
    };
  }

  const sorted = [...posicoes].sort((a, b) => {
    const ga = getGridPos(a);
    const gb = getGridPos(b);
    return (gb.row + gb.col) - (ga.row + ga.col);
  });

  const allPts = posicoes.flatMap(pos => {
    const { row, col } = getGridPos(pos);
    return [
      iso(col, row),
      iso(col + 1, row),
      iso(col, row + 1),
      iso(col + 1, row + 1),
    ];
  });
  const maxX = Math.max(...allPts.map(p => p.x)) + 80;
  const svgW = Math.max(700, maxX + 160);

  return (
    <div className="overflow-auto rounded-2xl bg-gradient-to-b from-slate-800 to-slate-900 p-4 border border-slate-700 shadow-2xl">
      <div className="text-xs text-teal-400 mb-2 text-center font-bold tracking-widest uppercase">
        Vista 3D Isométrica — Barracão Expedição
      </div>
      <svg width={svgW} height={520} xmlns="http://www.w3.org/2000/svg">
        {posicoes.map(pos => {
          const { row, col } = getGridPos(pos);
          const tl = iso(col, row);
          const tr = iso(col + 1, row);
          const br = iso(col + 1, row + 1);
          const bl = iso(col, row + 1);

          return (
            <polygon key={`f-${pos.id}`}
              points={`${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`}
              fill="#1e293b" stroke="#334155" strokeWidth={1} />
          );
        })}

        {sorted.map(pos => {
          const { totalBarras } = getOcupacao(pos.id);
          const pct = Math.min(1, (totalBarras || 0) / pos.capacidade_barras);
          const { row, col } = getGridPos(pos);
          const boxH = pct > 0 ? Math.max(12, pct * MAX_BOX_H) : 0;
          const isSelected = posicaoSel?.id === pos.id;
          const colors = getOccupancyColors(pct);

          const inset = 0.06;
          const c0 = col + inset, c1 = col + 1 - inset;
          const r0 = row + inset, r1 = row + 1 - inset;

          const fbl = iso(c0, r1, 0);
          const fbr = iso(c1, r1, 0);
          const fbr_top = iso(c1, r1, FLOOR_H);
          const fbl_top = iso(c0, r1, FLOOR_H);
          const ftr = iso(c1, r0, 0);
          const ftr_top = iso(c1, r0, FLOOR_H);

          const bbl = iso(c0, r1, FLOOR_H);
          const bbr = iso(c1, r1, FLOOR_H);
          const btr = iso(c1, r0, FLOOR_H);
          const btl_top = iso(c0, r0, FLOOR_H + boxH);
          const btr_top = iso(c1, r0, FLOOR_H + boxH);
          const bbr_top = iso(c1, r1, FLOOR_H + boxH);
          const bbl_top = iso(c0, r1, FLOOR_H + boxH);

          const center = iso(col + 0.5, row + 0.5, FLOOR_H + boxH + 8);
          const selColor = isSelected ? "#0d9488" : null;

          return (
            <g key={pos.id} onClick={() => onSelect(pos)} style={{ cursor: "pointer" }}>
              <polygon points={`${fbl.x},${fbl.y} ${fbr.x},${fbr.y} ${fbr_top.x},${fbr_top.y} ${fbl_top.x},${fbl_top.y}`}
                fill={isSelected ? "#134e4a" : "#1e3a4a"} stroke={selColor || "#0f2336"} strokeWidth={0.5} />
              <polygon points={`${ftr.x},${ftr.y} ${fbr.x},${fbr.y} ${fbr_top.x},${fbr_top.y} ${ftr_top.x},${ftr_top.y}`}
                fill={isSelected ? "#115e59" : "#152d3a"} stroke={selColor || "#0f2336"} strokeWidth={0.5} />

              {boxH > 0 && (
                <>
                  <polygon points={`${bbl.x},${bbl.y} ${bbr.x},${bbr.y} ${bbr_top.x},${bbr_top.y} ${bbl_top.x},${bbl_top.y}`}
                    fill={isSelected ? "#0f766e" : colors.left} stroke={selColor || "rgba(0,0,0,0.2)"} strokeWidth={0.8} />
                  <polygon points={`${btr.x},${btr.y} ${bbr.x},${bbr.y} ${bbr_top.x},${bbr_top.y} ${btr_top.x},${btr_top.y}`}
                    fill={isSelected ? "#134e4a" : colors.right} stroke={selColor || "rgba(0,0,0,0.2)"} strokeWidth={0.8} />
                  <polygon points={`${btl_top.x},${btl_top.y} ${btr_top.x},${btr_top.y} ${bbr_top.x},${bbr_top.y} ${bbl_top.x},${bbl_top.y}`}
                    fill={isSelected ? "#2dd4bf" : colors.top} stroke={selColor || "rgba(0,0,0,0.1)"} strokeWidth={0.8} />
                </>
              )}

              <text x={center.x} y={center.y} textAnchor="middle" fontSize={11} fontWeight="bold"
                fill={isSelected ? "#99f6e4" : pct > 0 ? "#f8fafc" : "#64748b"}>
                {pos.id}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function MapaArmazenagem() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState("cad"); // "cad" | "2d" | "3d" | "lista"
  const [modoAdmin, setModoAdmin] = useState(false);
  const [posicoes, setPosicoes] = useState(POSICOES_PADRAO);
  const [posicaoSel, setPosicaoSel] = useState(null);
  const [dialogMover, setDialogMover] = useState(false);
  const [dialogNova, setDialogNova] = useState(false);
  const [novaPosicao, setNovaPosicao] = useState({ rua: "", posicao: "", capacidade_barras: 20, descricao: "" });
  const [movDestino, setMovDestino] = useState("");

  const { data: entradas = [] } = useQuery({
    queryKey: ["entradas-expedicao"],
    queryFn: () => base44.entities.EntradaMaterialExpedicao?.filter?.({}, "-created_date", 200) ?? [],
    retry: false,
  });

  function getOcupacao(posId) {
    const itens = entradas.filter(e => e.local_armazenagem === posId && e.status !== "movido" && e.status !== "zerado" && e.status !== "transferido");
    const totalBarras = itens.reduce((s, e) => s + (e.quantidade_barras_saldo ?? e.quantidade_barras ?? 0), 0);
    const totalKg = itens.reduce((s, e) => s + (e.peso_kg_saldo ?? e.peso_kg_balanca ?? 0), 0);
    return { itens, totalBarras, totalKg };
  }

  function handleRemoverPosicao(id) {
    const { totalBarras } = getOcupacao(id);
    if (totalBarras > 0) { toast.error("Esta posição tem material. Mova primeiro."); return; }
    setPosicoes(p => p.filter(pos => pos.id !== id));
    toast.success("Posição removida!");
  }

  function handleNovaPosicao() {
    if (!novaPosicao.rua || !novaPosicao.posicao) { toast.error("Informe Rua e Posição"); return; }
    const id = `${novaPosicao.rua}${novaPosicao.posicao}`.toUpperCase();
    if (posicoes.find(p => p.id === id)) { toast.error("Posição já existe"); return; }
    setPosicoes(p => [...p, { ...novaPosicao, id }]);
    setDialogNova(false);
    setNovaPosicao({ rua: "", posicao: "", capacidade_barras: 20, descricao: "" });
    toast.success(`Posição ${id} criada!`);
  }

  async function handleMoverMaterial() {
    if (!movDestino || !posicaoSel) return;
    try {
      const { itens } = getOcupacao(posicaoSel.id);
      for (const item of itens) {
        await base44.entities.EntradaMaterialExpedicao?.update?.(item.id, { local_armazenagem: movDestino });
      }
      queryClient.invalidateQueries({ queryKey: ["entradas-expedicao"] });
      toast.success(`✅ Material movido de ${posicaoSel.id} → ${movDestino}`);
      setDialogMover(false);
      setPosicaoSel(null);
      setMovDestino("");
    } catch { toast.error("Erro ao mover."); }
  }

  // Total stats
  const totalBarras = posicoes.reduce((s, p) => s + getOcupacao(p.id).totalBarras, 0);
  const totalCapacidade = posicoes.reduce((s, p) => s + p.capacidade_barras, 0);
  const pctGeral = totalCapacidade > 0 ? ((totalBarras / totalCapacidade) * 100).toFixed(0) : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <button onClick={() => navigate("/expedicao")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Map className="w-6 h-6 text-teal-600" /> Mapa de Armazenagem (Porta-Paletes)
          </h1>
          <p className="text-sm text-muted-foreground">
            Barras padrão: {COMPRIMENTO_BARRA}m · Ocupação: {pctGeral}% ({totalBarras}/{totalCapacidade} barras)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex border rounded-lg overflow-hidden text-sm">
            {[
              { mode: "cad",   icon: Columns,      label: "Planta CAD" },
              { mode: "2d",    icon: LayoutGrid,   label: "Vista 2D" },
              { mode: "3d",    icon: Box,          label: "Vista 3D" },
              { mode: "lista", icon: List,         label: "Lista" },
            ].map(({ mode, icon: Icon, label }) => (
              <button key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-2 transition-all ${
                  viewMode === mode
                    ? "bg-teal-600 text-white font-bold"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>

          <button
            onClick={() => setModoAdmin(m => !m)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-all ${
              modoAdmin ? "bg-orange-100 border-orange-400 text-orange-700 font-bold" : "border-muted text-muted-foreground hover:bg-muted"
            }`}>
            <Settings className="w-4 h-4" />
            {modoAdmin ? "Sair Admin" : "Configurar"}
          </button>

          {modoAdmin && (
            <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={() => setDialogNova(true)}>
              <Plus className="w-4 h-4" /> Nova Posição
            </Button>
          )}
        </div>
      </div>

      {/* View Content */}
      {viewMode === "cad" && (
        <MapaPlantaCAD
          posicoes={posicoes}
          getOcupacao={getOcupacao}
          posicaoSel={posicaoSel}
          onSelect={setPosicaoSel}
        />
      )}
      {viewMode === "2d" && (
        <Mapa2D
          posicoes={posicoes}
          getOcupacao={getOcupacao}
          posicaoSel={posicaoSel}
          onSelect={setPosicaoSel}
        />
      )}
      {viewMode === "3d" && (
        <Mapa3D
          posicoes={posicoes}
          getOcupacao={getOcupacao}
          posicaoSel={posicaoSel}
          onSelect={setPosicaoSel}
        />
      )}

      {/* Painel lateral da posição selecionada */}
      {posicaoSel && (() => {
        const { itens, totalBarras, totalKg } = getOcupacao(posicaoSel.id);
        return (
          <div className="border-2 border-teal-400 rounded-xl p-4 bg-teal-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-teal-600" />
                Posição {posicaoSel.id} — {posicaoSel.descricao}
              </h3>
              <button onClick={() => setPosicaoSel(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground text-xs">Barras</p>
                <p className="font-bold text-lg">{totalBarras}</p>
                <p className="text-xs text-muted-foreground">de {posicaoSel.capacidade_barras}</p>
              </div>
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground text-xs">Peso</p>
                <p className="font-bold text-lg">{(totalKg / 1000).toFixed(2)}t</p>
                <p className="text-xs text-muted-foreground">{totalKg.toLocaleString("pt-BR")} kg</p>
              </div>
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground text-xs">Metros</p>
                <p className="font-bold text-lg">{(totalBarras * COMPRIMENTO_BARRA).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">lineares</p>
              </div>
            </div>

            {itens.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Materiais nesta posição</p>
                {itens.map(item => (
                  <div key={item.id} className="bg-white border rounded-lg px-3 py-2 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold font-mono">NF {item.numero_nf}</span>
                      <span className="text-muted-foreground ml-2">— {item.produto}</span>
                    </div>
                    <span className="text-emerald-600 font-bold">{item.quantidade_barras_saldo ?? item.quantidade_barras} barras</span>
                  </div>
                ))}
              </div>
            )}

            {totalBarras > 0 && (
              <Button className="w-full gap-2" variant="outline" onClick={() => setDialogMover(true)}>
                <Move className="w-4 h-4" /> Mover Material para outra posição
              </Button>
            )}
          </div>
        );
      })()}

      {/* Dialog: Mover material */}
      <Dialog open={dialogMover} onOpenChange={setDialogMover}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="w-5 h-5 text-teal-600" /> Mover Material — {posicaoSel?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Selecione a posição de destino:</p>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={movDestino} onChange={e => setMovDestino(e.target.value)}>
              <option value="">Selecione destino...</option>
              {posicoes.filter(p => p.id !== posicaoSel?.id).map(p => (
                <option key={p.id} value={p.id}>{p.id} — {p.descricao}</option>
              ))}
            </select>
            {movDestino && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                <span>{posicaoSel?.id} → {movDestino}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMover(false)}>Cancelar</Button>
            <Button onClick={handleMoverMaterial} disabled={!movDestino} className="bg-teal-600 hover:bg-teal-700 gap-2">
              <CheckCircle2 className="w-4 h-4" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova posição */}
      <Dialog open={dialogNova} onOpenChange={setDialogNova}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-600" /> Nova Posição
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Rua *</Label>
                <Input value={novaPosicao.rua} onChange={e => setNovaPosicao(n => ({ ...n, rua: e.target.value.toUpperCase() }))}
                  placeholder="Ex: A, B, C" maxLength={5} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Posição *</Label>
                <Input value={novaPosicao.posicao} onChange={e => setNovaPosicao(n => ({ ...n, posicao: e.target.value.toUpperCase() }))}
                  placeholder="Ex: 1, 2" maxLength={5} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Capacidade (barras) *</Label>
              <Input type="number" value={novaPosicao.capacidade_barras}
                onChange={e => setNovaPosicao(n => ({ ...n, capacidade_barras: Number(e.target.value) }))} min={1} />
              <p className="text-[10px] text-muted-foreground">
                = {(novaPosicao.capacidade_barras * COMPRIMENTO_BARRA).toLocaleString("pt-BR")}m lineares
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input value={novaPosicao.descricao} onChange={e => setNovaPosicao(n => ({ ...n, descricao: e.target.value }))}
                placeholder="Ex: Rua A — Posição 1" />
            </div>
            <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs text-muted-foreground">
              ID: <strong>{(novaPosicao.rua + novaPosicao.posicao).toUpperCase() || "—"}</strong>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNova(false)}>Cancelar</Button>
            <Button onClick={handleNovaPosicao} className="bg-teal-600 hover:bg-teal-700 gap-2">
              <Save className="w-4 h-4" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
