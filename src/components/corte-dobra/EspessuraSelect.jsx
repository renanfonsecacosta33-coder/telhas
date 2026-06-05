import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ESPESSURAS_CHAPA } from "@/lib/catalogo-cd";

// Cores por tipo de material
const TIPO_COR = {
  FF:     "bg-blue-100 text-blue-800",
  GALV:   "bg-green-100 text-green-700",
  chapa:  "bg-slate-100 text-slate-700",
};

const ORIGEM_LABEL = {
  bobina:  "",
  slitter: "Slitter",
  chapa:   "Chapa",
};

// Agrupa espessuras por origem + tipo para exibição
function agrupar(lista) {
  const grupos = {};
  for (const e of lista) {
    const key = e.origem === "chapa" ? "Chapas Grossas / Laminadas" :
                e.origem === "slitter" ? `${e.tipo} — Slitter` :
                `${e.tipo} — Bobina Padrão`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(e);
  }
  return grupos;
}

/**
 * EspessuraSelect — select rico de espessuras com busca e agrupamento
 * Props:
 *   value: string (label da espessura selecionada)
 *   onChange: (label, valor_num) => void
 *   className: string
 */
export default function EspessuraSelect({ value, onChange, className = "" }) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const filtradas = useMemo(() => {
    if (!busca) return ESPESSURAS_CHAPA;
    const q = busca.toLowerCase().replace(",", ".");
    return ESPESSURAS_CHAPA.filter(e =>
      e.label.toLowerCase().replace(",", ".").includes(q) ||
      e.tipo.toLowerCase().includes(q) ||
      e.origem.toLowerCase().includes(q)
    );
  }, [busca]);

  const grupos = useMemo(() => agrupar(filtradas), [filtradas]);

  const selecionarEspessura = (e) => {
    onChange(e.label, e.valor);
    setAberto(false);
    setBusca("");
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setAberto(a => !a)}
        className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-left flex items-center justify-between shadow-sm hover:bg-muted/30 focus:outline-none focus:ring-1 focus:ring-ring"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || "Selecionar espessura..."}
        </span>
        <span className="text-muted-foreground ml-2">▾</span>
      </button>

      {aberto && (
        <div className="absolute z-50 top-10 left-0 w-full min-w-[280px] bg-white border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="p-2 border-b border-border">
            <Input
              autoFocus
              placeholder="Buscar espessura (ex: 1,25, GALV, FF, Slitter...)"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {Object.entries(grupos).map(([grupo, items]) => (
              <div key={grupo}>
                <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/40 sticky top-0">
                  {grupo}
                </div>
                {items.map((e, idx) => {
                  const isSelected = value === e.label;
                  return (
                    <button
                      key={`${e.label}_${idx}`}
                      type="button"
                      onClick={() => selecionarEspessura(e)}
                      className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-muted/50 transition-colors ${isSelected ? "bg-orange-50" : ""}`}
                    >
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TIPO_COR[e.tipo] || "bg-gray-100 text-gray-600"}`}>
                        {e.tipo}
                      </span>
                      <span className={`font-medium ${isSelected ? "text-orange-600" : ""}`}>{e.label}</span>
                      {e.origem !== "bobina" && (
                        <span className="text-[10px] text-muted-foreground ml-auto">{ORIGEM_LABEL[e.origem]}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
            {Object.keys(grupos).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma espessura encontrada</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}