import React, { useState } from "react";
import { corPeca } from "./types";

const CANVAS_W = 520;
const CANVAS_H = 320;

/**
 * Renderiza a visualização SVG de uma chapa com as peças posicionadas
 */
export default function VisualizadorChapa({ resultado, indice }) {
  const [hoverId, setHoverId] = useState(null);

  const { chapa, pecas, aproveitamento, area_total, area_usada, area_desperdicada } = resultado;

  const compChapa = parseFloat(chapa.comprimento);
  const largChapa = parseFloat(chapa.largura);

  // Escala para caber no canvas mantendo proporção
  const scaleX = CANVAS_W / compChapa;
  const scaleY = CANVAS_H / largChapa;
  const scale = Math.min(scaleX, scaleY) * 0.95;

  const svgW = compChapa * scale;
  const svgH = largChapa * scale;

  const corAprov = parseFloat(aproveitamento) >= 85
    ? "#16a34a"
    : parseFloat(aproveitamento) >= 65
    ? "#d97706"
    : "#dc2626";

  return (
    <div className="border border-border rounded-xl bg-white overflow-hidden">
      {/* Header da chapa */}
      <div className="px-4 py-2.5 bg-slate-50 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">
            Chapa {indice + 1}
          </span>
          {chapa.nome && (
            <span className="text-[10px] text-muted-foreground">{chapa.nome}</span>
          )}
          <span className="text-[10px] bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">
            {compChapa.toLocaleString("pt-BR")} × {largChapa.toLocaleString("pt-BR")} mm
          </span>
          {chapa.origem === "estoque" && (
            <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-semibold">
              Estoque
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{pecas.length} peças</span>
          <span className="font-bold text-lg" style={{ color: corAprov }}>
            {aproveitamento}%
          </span>
        </div>
      </div>

      {/* Canvas SVG */}
      <div className="p-3 flex justify-center bg-zinc-50">
        <svg
          width={svgW}
          height={svgH}
          viewBox={`0 0 ${svgW} ${svgH}`}
          style={{ border: "2px solid #e2e8f0", borderRadius: 6, background: "#f8fafc", display: "block" }}
        >
          {/* Fundo — área desperdiçada */}
          <rect x={0} y={0} width={svgW} height={svgH} fill="#fef2f2" />

          {/* Hatch pattern para área desperdiçada */}
          <defs>
            <pattern id={`hatch-${indice}`} patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="#fecaca" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x={0} y={0} width={svgW} height={svgH} fill={`url(#hatch-${indice})`} />

          {/* Peças */}
          {pecas.map((p, i) => {
            const px = p.x * scale;
            const py = p.y * scale;
            const pw = p.w * scale;
            const ph = p.h * scale;
            const cor = corPeca(p.pecaIdx !== undefined ? p.pecaIdx : i);
            const isHover = hoverId === p.id;

            return (
              <g key={p.id}
                onMouseEnter={() => setHoverId(p.id)}
                onMouseLeave={() => setHoverId(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={px + 0.5}
                  y={py + 0.5}
                  width={Math.max(pw - 1, 1)}
                  height={Math.max(ph - 1, 1)}
                  fill={cor}
                  fillOpacity={isHover ? 0.9 : 0.75}
                  stroke={cor}
                  strokeWidth={isHover ? 2 : 1}
                  rx={1}
                />
                {/* Label se espaço suficiente */}
                {pw > 35 && ph > 14 && (
                  <text
                    x={px + pw / 2}
                    y={py + ph / 2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={Math.min(10, ph * 0.35, pw * 0.12)}
                    fill="white"
                    fontWeight="600"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {p.rotacionado ? "↺ " : ""}{p.w}×{p.h}
                  </text>
                )}
              </g>
            );
          })}

          {/* Bordas da chapa */}
          <rect x={0} y={0} width={svgW} height={svgH}
            fill="none" stroke="#94a3b8" strokeWidth="1.5" rx={2} />
        </svg>
      </div>

      {/* Tooltip hover */}
      {hoverId && (() => {
        const p = pecas.find(x => x.id === hoverId);
        if (!p) return null;
        return (
          <div className="px-4 py-2 bg-slate-800 text-white text-xs flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: corPeca(p.pecaIdx) }} />
            <span className="font-semibold">{p.nome || `Peça`}</span>
            <span className="text-slate-300">{p.w} × {p.h} mm</span>
            {p.rotacionado && <span className="text-amber-300 text-[10px]">↺ Rotacionada 90°</span>}
          </div>
        );
      })()}

      {/* Stats da chapa */}
      <div className="px-4 py-2.5 border-t border-border grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Área usada</p>
          <p className="text-xs font-bold text-green-700">{(area_usada / 1e6).toFixed(4)} m²</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Desperdício</p>
          <p className="text-xs font-bold text-red-600">{(area_desperdicada / 1e6).toFixed(4)} m²</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cortes est.</p>
          <p className="text-xs font-bold">{resultado.n_cortes}</p>
        </div>
      </div>
    </div>
  );
}