import React, { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { corPeca } from "./types";

const MAX_RENDER_W = 560; // largura máxima do canvas SVG
const MAX_RENDER_H = 400; // altura máxima

/**
 * Visualização 2D de uma chapa com as peças encaixadas
 */
export default function VisualizacaoChapa({ chapaResult, index }) {
  const { chapa, pecas, area_total, area_usada, area_desperdicada, aproveitamento, n_cortes } = chapaResult;

  const comp = parseFloat(chapa.comprimento);
  const larg = parseFloat(chapa.largura);

  // Escala para caber no container
  const scaleX = MAX_RENDER_W / comp;
  const scaleY = MAX_RENDER_H / larg;
  const scale = Math.min(scaleX, scaleY, 1);

  const svgW = Math.round(comp * scale);
  const svgH = Math.round(larg * scale);

  const aprov = parseFloat(aproveitamento);
  const corAprov = aprov >= 85 ? "#16a34a" : aprov >= 65 ? "#d97706" : "#dc2626";
  const bgAprov = aprov >= 85 ? "#f0fdf4" : aprov >= 65 ? "#fffbeb" : "#fef2f2";
  const bdAprov = aprov >= 85 ? "#bbf7d0" : aprov >= 65 ? "#fde68a" : "#fecaca";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header da chapa */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">Chapa #{index + 1}</span>
          <span className="text-xs text-muted-foreground">{chapa.nome || "Manual"}</span>
          <Badge variant="outline" className="text-[10px] font-mono">
            {comp.toLocaleString("pt-BR")} × {larg.toLocaleString("pt-BR")} mm
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{pecas.length} peça(s)</span>
          <span
            className="font-bold px-2 py-0.5 rounded-lg border text-sm"
            style={{ color: corAprov, backgroundColor: bgAprov, borderColor: bdAprov }}
          >
            {aproveitamento}%
          </span>
        </div>
      </div>

      {/* SVG da visualização */}
      <div className="p-4 overflow-x-auto">
        <svg
          width={svgW}
          height={svgH}
          style={{ display: "block", border: "1px solid #e2e8f0", borderRadius: "6px", background: "#f8fafc" }}
        >
          {/* Fundo da chapa */}
          <rect x={0} y={0} width={svgW} height={svgH} fill="#f1f5f9" />

          {/* Grid de referência sutil */}
          {Array.from({ length: Math.floor(comp / 500) }).map((_, i) => (
            <line key={`vl-${i}`} x1={(i + 1) * 500 * scale} y1={0} x2={(i + 1) * 500 * scale} y2={svgH}
              stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3,3" />
          ))}
          {Array.from({ length: Math.floor(larg / 200) }).map((_, i) => (
            <line key={`hl-${i}`} x1={0} y1={(i + 1) * 200 * scale} x2={svgW} y2={(i + 1) * 200 * scale}
              stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="3,3" />
          ))}

          {/* Peças */}
          {pecas.map((p, i) => {
            const px = Math.round(p.x * scale);
            const py = Math.round(p.y * scale);
            const pw = Math.max(Math.round(p.w * scale) - 1, 2);
            const ph = Math.max(Math.round(p.h * scale) - 1, 2);
            const cor = corPeca(p.pecaIdx !== undefined ? p.pecaIdx : i);
            const labelComp = p.rotacionado ? p.h : p.w;
            const labelLarg = p.rotacionado ? p.w : p.h;
            const showLabel = pw > 28 && ph > 14;

            return (
              <g key={p.id}>
                <rect
                  x={px} y={py} width={pw} height={ph}
                  fill={cor}
                  fillOpacity={0.75}
                  stroke={cor}
                  strokeWidth="1.5"
                  strokeOpacity={0.9}
                  rx={2}
                />
                {showLabel && (
                  <text
                    x={px + pw / 2}
                    y={py + ph / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={Math.min(pw / 6, ph / 2.5, 11)}
                    fill="white"
                    fontWeight="700"
                    style={{ userSelect: "none", pointerEvents: "none" }}
                  >
                    {labelComp}×{labelLarg}
                  </text>
                )}
                {p.rotacionado && pw > 16 && ph > 10 && (
                  <text
                    x={px + pw - 4}
                    y={py + 6}
                    fontSize={7}
                    fill="white"
                    textAnchor="end"
                    style={{ userSelect: "none" }}
                  >↻</text>
                )}
              </g>
            );
          })}

          {/* Borda da chapa */}
          <rect x={0} y={0} width={svgW} height={svgH}
            fill="none" stroke="#64748b" strokeWidth="2" />

          {/* Dimensões */}
          <text x={svgW / 2} y={svgH - 4} textAnchor="middle" fontSize={9} fill="#64748b" fontWeight="600">
            {comp.toLocaleString("pt-BR")} mm
          </text>
          <text
            x={5} y={svgH / 2}
            textAnchor="middle"
            fontSize={9}
            fill="#64748b"
            fontWeight="600"
            transform={`rotate(-90, 7, ${svgH / 2})`}
          >
            {larg.toLocaleString("pt-BR")} mm
          </text>
        </svg>
      </div>

      {/* Stats da chapa */}
      <div className="px-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatBox label="Área Total" value={`${(area_total / 1e6).toFixed(4)} m²`} />
        <StatBox label="Área Usada" value={`${(area_usada / 1e6).toFixed(4)} m²`} color="text-emerald-700" />
        <StatBox label="Desperdício" value={`${(area_desperdicada / 1e6).toFixed(4)} m²`} color="text-red-600" />
        <StatBox label="Cortes est." value={n_cortes} />
      </div>
    </div>
  );
}

function StatBox({ label, value, color = "text-foreground" }) {
  return (
    <div className="bg-muted/30 rounded-lg px-3 py-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`font-bold text-sm ${color}`}>{value}</p>
    </div>
  );
}