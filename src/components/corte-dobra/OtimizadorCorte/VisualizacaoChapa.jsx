import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { corPeca } from "./types";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Package, Sparkles, CheckCircle2, Scissors } from "lucide-react";

const MAX_RENDER_W = 580; // largura máxima do canvas SVG
const MAX_RENDER_H = 400; // altura máxima

/**
 * Visualização 2D de uma chapa com peças encaixadas e retalhos úteis
 */
export default function VisualizacaoChapa({ chapaResult, index, devVinculado = null }) {
  const {
    chapa,
    pecas,
    retalhos = [],
    area_total,
    area_usada,
    area_retalhos_uteis = 0,
    area_sucata = 0,
    area_desperdicada,
    aproveitamento,
    aproveitamento_com_retalhos,
    n_cortes
  } = chapaResult;

  const [salvandoRetalhoId, setSalvandoRetalhoId] = useState(null);
  const [retalhosSalvos, setRetalhosSalvos] = useState({});
  const queryClient = useQueryClient();

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

  const retalhosUteis = retalhos.filter(r => r.ehUtil);

  const handleSalvarRetalho = async (ret) => {
    setSalvandoRetalhoId(ret.id);
    try {
      const espessura = devVinculado?.espessura_mm || chapa.espessura_mm || 1.5;
      const material = devVinculado?.material || chapa.material || "Aço galvanizado";
      const areaCm2 = Math.round(ret.area / 100);
      const volDm3 = (ret.w / 1000) * (ret.h / 1000) * (espessura / 1000) * 1000;
      const pesoEstimado = Number((volDm3 * 7.85).toFixed(2));

      await base44.entities.RetalhoCD.create({
        origem: "corte_chapa",
        material,
        espessura_mm: Number(espessura),
        comprimento_mm: ret.w,
        largura_mm: ret.h,
        area_cm2: areaCm2,
        peso_estimado_kg: pesoEstimado,
        status: "disponivel",
        data_entrada: new Date().toISOString().split("T")[0],
        observacoes: `Gerado via Otimizador de Corte (Chapa ${chapa.nome || `#${index + 1}`})`,
      });

      setRetalhosSalvos(prev => ({ ...prev, [ret.id]: true }));
      queryClient.invalidateQueries({ queryKey: ["retalhos-cd"] });
      toast.success(`Retalho ${ret.w}×${ret.h} mm cadastrado no estoque com sucesso!`);
    } catch (err) {
      console.error("Erro ao salvar retalho:", err);
      toast.error("Erro ao cadastrar retalho no estoque.");
    } finally {
      setSalvandoRetalhoId(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm space-y-0">
      {/* Header da chapa */}
      <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">Chapa #{index + 1}</span>
          <span className="text-xs text-muted-foreground">{chapa.nome || "Padrão"}</span>
          <Badge variant="outline" className="text-[10px] font-mono">
            {comp.toLocaleString("pt-BR")} × {larg.toLocaleString("pt-BR")} mm
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">{pecas.length} peça(s)</span>
          <span
            className="font-bold px-2 py-0.5 rounded-lg border text-sm"
            style={{ color: corAprov, backgroundColor: bgAprov, borderColor: bdAprov }}
            title="Aproveitamento direto das peças"
          >
            {aproveitamento}% útil
          </span>
          {aproveitamento_com_retalhos && parseFloat(aproveitamento_com_retalhos) > aprov && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px]" title="Peças + Retalhos Aproveitáveis">
              {aproveitamento_com_retalhos}% c/ retalhos
            </Badge>
          )}
        </div>
      </div>

      {/* SVG da visualização */}
      <div className="p-4 overflow-x-auto bg-slate-50/50">
        <svg
          width={svgW}
          height={svgH}
          style={{ display: "block", border: "1px solid #cbd5e1", borderRadius: "8px", background: "#f8fafc" }}
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

          {/* Retalhos remanescentes desenhados no fundo */}
          {retalhos.map((r) => {
            const rx = Math.round(r.x * scale);
            const ry = Math.round(r.y * scale);
            const rw = Math.max(Math.round(r.w * scale) - 1, 2);
            const rh = Math.max(Math.round(r.h * scale) - 1, 2);

            if (r.ehUtil) {
              return (
                <g key={r.id}>
                  <rect
                    x={rx}
                    y={ry}
                    width={rw}
                    height={rh}
                    fill="#10b981"
                    fillOpacity={0.15}
                    stroke="#10b981"
                    strokeWidth="1.2"
                    strokeDasharray="4,3"
                    rx={2}
                  />
                  {rw > 45 && rh > 18 && (
                    <text
                      x={rx + rw / 2}
                      y={ry + rh / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.min(rw / 7, rh / 2.5, 10)}
                      fill="#047857"
                      fontWeight="bold"
                      style={{ userSelect: "none" }}
                    >
                      Retalho {r.w}×{r.h}
                    </text>
                  )}
                </g>
              );
            } else {
              return (
                <rect
                  key={r.id}
                  x={rx}
                  y={ry}
                  width={rw}
                  height={rh}
                  fill="#fca5a5"
                  fillOpacity={0.12}
                  stroke="#ef4444"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                />
              );
            }
          })}

          {/* Peças Cortadas */}
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
                  fillOpacity={0.8}
                  stroke={cor}
                  strokeWidth="1.5"
                  strokeOpacity={0.95}
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
            fill="none" stroke="#475569" strokeWidth="2" rx={4} />

          {/* Dimensões externas */}
          <text x={svgW / 2} y={svgH - 4} textAnchor="middle" fontSize={9} fill="#475569" fontWeight="bold">
            {comp.toLocaleString("pt-BR")} mm
          </text>
          <text
            x={6} y={svgH / 2}
            textAnchor="middle"
            fontSize={9}
            fill="#475569"
            fontWeight="bold"
            transform={`rotate(-90, 8, ${svgH / 2})`}
          >
            {larg.toLocaleString("pt-BR")} mm
          </text>
        </svg>
      </div>

      {/* Stats e Retalhos da chapa */}
      <div className="p-4 space-y-3">
        {/* Métricas da chapa */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatBox label="Área Total" value={`${(area_total / 1e6).toFixed(3)} m²`} />
          <StatBox label="Área das Peças" value={`${(area_usada / 1e6).toFixed(3)} m²`} color="text-emerald-700" />
          <StatBox
            label="Retalhos Úteis"
            value={`${((area_retalhos_uteis || 0) / 1e6).toFixed(3)} m²`}
            color="text-teal-700"
          />
          <StatBox
            label="Sucata Residual"
            value={`${((area_sucata || area_desperdicada) / 1e6).toFixed(3)} m²`}
            color="text-red-600"
          />
        </div>

        {/* Retalhos Gerados Disponíveis para Salvar */}
        {retalhosUteis.length > 0 && (
          <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                Retalhos Úteis Gerados nesta Chapa ({retalhosUteis.length})
              </span>
              <span className="text-[10px] text-emerald-700 font-medium">
                Podem ser reaproveitados em outras ordens
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {retalhosUteis.map((r, i) => {
                const salvo = retalhosSalvos[r.id];
                const carregando = salvandoRetalhoId === r.id;

                return (
                  <div
                    key={r.id}
                    className="bg-white border border-emerald-200 rounded-lg p-2.5 flex items-center justify-between gap-2 shadow-xs"
                  >
                    <div>
                      <span className="text-xs font-black text-emerald-800 font-mono">
                        {r.w} mm × {r.h} mm
                      </span>
                      <p className="text-[10px] text-muted-foreground">
                        Área: {(r.area / 1e6).toFixed(3)} m² · {(r.area / 100).toFixed(0)} cm²
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant={salvo ? "secondary" : "outline"}
                      disabled={salvo || carregando}
                      onClick={() => handleSalvarRetalho(r)}
                      className={`h-7 text-xs gap-1 font-bold ${
                        salvo
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      {salvo ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Salvo no Estoque
                        </>
                      ) : carregando ? (
                        <div className="w-3 h-3 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Package className="w-3.5 h-3.5" /> Salvar Retalho
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color = "text-foreground" }) {
  return (
    <div className="bg-muted/30 rounded-lg px-3 py-2 border border-border/50">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`font-black text-sm ${color}`}>{value}</p>
    </div>
  );
}