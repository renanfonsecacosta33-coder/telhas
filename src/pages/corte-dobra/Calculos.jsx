import { useState } from "react";
import { Calculator, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const DENSIDADE_ACO = 7.85; // g/cm³ = kg/dm³

function CalcRow({ label, fields, onCalc, resultado }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm">
      <div className="bg-gray-900 text-white text-center font-bold text-sm py-2.5 px-4 tracking-wide">
        {label}
      </div>
      <div className="bg-gray-700 text-white grid text-xs font-semibold"
        style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr) auto 120px` }}>
        {fields.map(f => (
          <div key={f.key} className="px-3 py-2 text-center border-r border-gray-600">{f.label}</div>
        ))}
        <div className="px-3 py-2 text-center border-r border-gray-600" />
        <div className="px-3 py-2 text-center">Peso Total (Kg)</div>
      </div>
      <div className="bg-white grid items-center"
        style={{ gridTemplateColumns: `repeat(${fields.length}, 1fr) auto 120px` }}>
        {fields.map(f => (
          <input
            key={f.key}
            type="number"
            step="any"
            placeholder={f.placeholder}
            value={f.value}
            onChange={e => f.onChange(e.target.value)}
            className="h-10 px-3 text-sm border-r border-gray-200 focus:outline-none focus:bg-gray-50 w-full text-gray-800"
          />
        ))}
        <button
          onClick={onCalc}
          className="bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold px-4 py-2 h-10 whitespace-nowrap transition-colors"
        >
          CALCULAR
        </button>
        <div className="h-10 flex items-center justify-center text-sm font-bold text-gray-800 bg-gray-100 border-l border-gray-200">
          {resultado !== null ? resultado.toFixed(2) : "—"}
        </div>
      </div>
    </div>
  );
}

// --- Barras Redondas ---
function BarrasRedondas() {
  const [d, setD] = useState("");
  const [c, setC] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);

  const calc = () => {
    const D = parseFloat(d), C = parseFloat(c), Q = parseFloat(q);
    if (!D || !C || !Q) return;
    // Peso = (π/4) × D² × C × ρ × Q  (em mm → kg)
    const peso = (Math.PI / 4) * (D / 10) ** 2 * (C / 10) * DENSIDADE_ACO * Q / 1000;
    setRes(peso);
  };

  return (
    <CalcRow
      label="Peso Teórico Barras Redondas"
      fields={[
        { key: "d", label: "Diâmetro (mm)", placeholder: "ex: 10", value: d, onChange: setD },
        { key: "c", label: "Comprimento (mm)", placeholder: "ex: 6000", value: c, onChange: setC },
        { key: "q", label: "Quantidade (UN)", placeholder: "ex: 10", value: q, onChange: setQ },
      ]}
      onCalc={calc}
      resultado={res}
    />
  );
}

// --- Chapas / Blocos / Retalhos ---
function Chapas() {
  const [e, setE] = useState("");
  const [l, setL] = useState("");
  const [c, setC] = useState("");
  const [q, setQ] = useState("");
  const [kg, setKg] = useState("");
  const [modo, setModo] = useState("peso"); // "peso" ou "quantidade"
  const [res, setRes] = useState(null);

  const calc = () => {
    if (modo === "peso") {
      const E = parseFloat(e), L = parseFloat(l), C = parseFloat(c), Q = parseFloat(q);
      if (!E || !L || !C || !Q) return;
      // Peso = E × L × C × ρ × Q (mm → kg)
      const peso = (E / 10) * (L / 10) * (C / 10) * DENSIDADE_ACO * Q / 1000;
      setRes(peso);
    } else {
      const E = parseFloat(e), L = parseFloat(l), C = parseFloat(c), K = parseFloat(kg);
      if (!E || !L || !C || !K) return;
      // Peso unitário = E × L × C × ρ / 1000
      const pesoUnitario = (E / 10) * (L / 10) * (C / 10) * DENSIDADE_ACO / 1000;
      const qtd = K / pesoUnitario;
      setRes(qtd);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm">
      <div className="bg-gray-900 text-white flex items-center justify-between px-4 py-2.5">
        <span className="font-bold text-sm tracking-wide">Peso Teórico de Chapas / Blocos / Retalhos</span>
        <div className="flex gap-2">
          <button
            onClick={() => { setModo("peso"); setRes(null); }}
            className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${modo === "peso" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            Calcular Peso
          </button>
          <button
            onClick={() => { setModo("quantidade"); setRes(null); }}
            className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${modo === "quantidade" ? "bg-blue-600 text-white" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
          >
            Calcular Quantidade
          </button>
        </div>
      </div>
      <div className="bg-gray-700 text-white grid text-xs font-semibold"
        style={{ gridTemplateColumns: modo === "peso" ? "repeat(4, 1fr) auto 120px" : "repeat(3, 1fr) auto 120px" }}>
        <div className="px-3 py-2 text-center border-r border-gray-600">Espessura (mm)</div>
        <div className="px-3 py-2 text-center border-r border-gray-600">Largura (mm)</div>
        <div className="px-3 py-2 text-center border-r border-gray-600">Comprimento (mm)</div>
        {modo === "peso" ? (
          <div className="px-3 py-2 text-center border-r border-gray-600">Quantidade (UN)</div>
        ) : (
          <div className="px-3 py-2 text-center border-r border-gray-600">Peso Total (Kg)</div>
        )}
        <div className="px-3 py-2 text-center border-r border-gray-600" />
        <div className="px-3 py-2 text-center">
          {modo === "peso" ? "Peso Total (Kg)" : "Quantidade (UN)"}
        </div>
      </div>
      <div className="bg-white grid items-center"
        style={{ gridTemplateColumns: modo === "peso" ? "repeat(4, 1fr) auto 120px" : "repeat(3, 1fr) auto 120px" }}>
        <input
          type="number"
          step="any"
          placeholder="ex: 0.95"
          value={e}
          onChange={ev => setE(ev.target.value)}
          className="h-10 px-3 text-sm border-r border-gray-200 focus:outline-none focus:bg-gray-50 w-full text-gray-800"
        />
        <input
          type="number"
          step="any"
          placeholder="ex: 1000"
          value={l}
          onChange={ev => setL(ev.target.value)}
          className="h-10 px-3 text-sm border-r border-gray-200 focus:outline-none focus:bg-gray-50 w-full text-gray-800"
        />
        <input
          type="number"
          step="any"
          placeholder="ex: 6000"
          value={c}
          onChange={ev => setC(ev.target.value)}
          className="h-10 px-3 text-sm border-r border-gray-200 focus:outline-none focus:bg-gray-50 w-full text-gray-800"
        />
        {modo === "peso" ? (
          <input
            type="number"
            step="any"
            placeholder="ex: 10"
            value={q}
            onChange={ev => setQ(ev.target.value)}
            className="h-10 px-3 text-sm border-r border-gray-200 focus:outline-none focus:bg-gray-50 w-full text-gray-800"
          />
        ) : (
          <input
            type="number"
            step="any"
            placeholder="ex: 500"
            value={kg}
            onChange={ev => setKg(ev.target.value)}
            className="h-10 px-3 text-sm border-r border-gray-200 focus:outline-none focus:bg-gray-50 w-full text-gray-800"
          />
        )}
        <button
          onClick={calc}
          className="bg-gray-900 hover:bg-gray-700 text-white text-xs font-bold px-4 py-2 h-10 whitespace-nowrap transition-colors"
        >
          CALCULAR
        </button>
        <div className="h-10 flex items-center justify-center text-sm font-bold text-gray-800 bg-gray-100 border-l border-gray-200">
          {res !== null ? res.toFixed(2) : "—"}
        </div>
      </div>
    </div>
  );
}

// --- Barras Sextavadas ---
function BarrasSextavadas() {
  const [b, setB] = useState("");
  const [c, setC] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);

  const calc = () => {
    const B = parseFloat(b), C = parseFloat(c), Q = parseFloat(q);
    if (!B || !C || !Q) return;
    // Área hexágono = (√3/2) × B²  (B = bitola em mm)
    const area = (Math.sqrt(3) / 2) * (B / 10) ** 2; // cm²
    const peso = area * (C / 10) * DENSIDADE_ACO * Q / 1000;
    setRes(peso);
  };

  return (
    <CalcRow
      label="Peso Teórico Barras Sextavadas"
      fields={[
        { key: "b", label: "Bitola (mm)", placeholder: "ex: 20", value: b, onChange: setB },
        { key: "c", label: "Comprimento (mm)", placeholder: "ex: 6000", value: c, onChange: setC },
        { key: "q", label: "Quantidade (UN)", placeholder: "ex: 10", value: q, onChange: setQ },
      ]}
      onCalc={calc}
      resultado={res}
    />
  );
}

// --- Tubo Redondo ---
function TuboRedondo() {
  const [de, setDe] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);

  const calc = () => {
    const DE = parseFloat(de), P = parseFloat(p), C = parseFloat(c), Q = parseFloat(q);
    if (!DE || !P || !C || !Q) return;
    // Peso = π × (DE - P) × P × C × ρ × Q (mm → kg)
    const peso = Math.PI * ((DE - P) / 10) * (P / 10) * (C / 10) * DENSIDADE_ACO * Q / 1000;
    setRes(peso);
  };

  return (
    <CalcRow
      label="Peso Teórico de Tubo Redondo"
      fields={[
        { key: "de", label: "Diâmetro Externo (mm)", placeholder: "ex: 50", value: de, onChange: setDe },
        { key: "p", label: "Parede (mm)", placeholder: "ex: 2", value: p, onChange: setP },
        { key: "c", label: "Comprimento (mm)", placeholder: "ex: 6000", value: c, onChange: setC },
        { key: "q", label: "Quantidade (UN)", placeholder: "ex: 10", value: q, onChange: setQ },
      ]}
      onCalc={calc}
      resultado={res}
    />
  );
}

// --- Tubos Quadrados ---
function TuboQuadrado() {
  const [b, setB] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);

  const calc = () => {
    const B = parseFloat(b), P = parseFloat(p), C = parseFloat(c), Q = parseFloat(q);
    if (!B || !P || !C || !Q) return;
    // Área = B² - (B - 2P)²
    const area = (B / 10) ** 2 - ((B - 2 * P) / 10) ** 2; // cm²
    const peso = area * (C / 10) * DENSIDADE_ACO * Q / 1000;
    setRes(peso);
  };

  return (
    <CalcRow
      label="Peso Teórico de Tubos Quadrados"
      fields={[
        { key: "b", label: "Bitola (mm)", placeholder: "ex: 50", value: b, onChange: setB },
        { key: "p", label: "Parede (mm)", placeholder: "ex: 2", value: p, onChange: setP },
        { key: "c", label: "Comprimento (mm)", placeholder: "ex: 6000", value: c, onChange: setC },
        { key: "q", label: "Quantidade (UN)", placeholder: "ex: 10", value: q, onChange: setQ },
      ]}
      onCalc={calc}
      resultado={res}
    />
  );
}

// --- Tubos Retangulares ---
function TuboRetangular() {
  const [dm, setDm] = useState("");
  const [dn, setDn] = useState("");
  const [p, setP] = useState("");
  const [c, setC] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);

  const calc = () => {
    const DM = parseFloat(dm), DN = parseFloat(dn), P = parseFloat(p), C = parseFloat(c), Q = parseFloat(q);
    if (!DM || !DN || !P || !C || !Q) return;
    // Área = DM×DN - (DM-2P)×(DN-2P)
    const area = (DM / 10) * (DN / 10) - ((DM - 2 * P) / 10) * ((DN - 2 * P) / 10); // cm²
    const peso = area * (C / 10) * DENSIDADE_ACO * Q / 1000;
    setRes(peso);
  };

  return (
    <CalcRow
      label="Peso Teórico de Tubos Retangular"
      fields={[
        { key: "dm", label: "Dimensão Maior (mm)", placeholder: "ex: 100", value: dm, onChange: setDm },
        { key: "dn", label: "Dimensão Menor (mm)", placeholder: "ex: 50", value: dn, onChange: setDn },
        { key: "p", label: "Parede (mm)", placeholder: "ex: 2", value: p, onChange: setP },
        { key: "c", label: "Comprimento (mm)", placeholder: "ex: 6000", value: c, onChange: setC },
        { key: "q", label: "Quantidade (UN)", placeholder: "ex: 10", value: q, onChange: setQ },
      ]}
      onCalc={calc}
      resultado={res}
    />
  );
}

// --- Barras Chatas ---
function BarrasChatas() {
  const [l, setL] = useState("");
  const [e, setE] = useState("");
  const [c, setC] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);

  const calc = () => {
    const L = parseFloat(l), E = parseFloat(e), C = parseFloat(c), Q = parseFloat(q);
    if (!L || !E || !C || !Q) return;
    const peso = (L / 10) * (E / 10) * (C / 10) * DENSIDADE_ACO * Q / 1000;
    setRes(peso);
  };

  return (
    <CalcRow
      label="Peso Teórico Barras Chatas"
      fields={[
        { key: "l", label: "Largura (mm)", placeholder: "ex: 50", value: l, onChange: setL },
        { key: "e", label: "Espessura (mm)", placeholder: "ex: 5", value: e, onChange: setE },
        { key: "c", label: "Comprimento (mm)", placeholder: "ex: 6000", value: c, onChange: setC },
        { key: "q", label: "Quantidade (UN)", placeholder: "ex: 10", value: q, onChange: setQ },
      ]}
      onCalc={calc}
      resultado={res}
    />
  );
}

// --- Cantoneiras ---
function Cantoneiras() {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [e, setE] = useState("");
  const [c, setC] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState(null);

  const calc = () => {
    const A = parseFloat(a), B = parseFloat(b), E = parseFloat(e), C = parseFloat(c), Q = parseFloat(q);
    if (!A || !B || !E || !C || !Q) return;
    // Área seção = (A + B - E) × E
    const area = ((A + B - E) / 10) * (E / 10); // cm²
    const peso = area * (C / 10) * DENSIDADE_ACO * Q / 1000;
    setRes(peso);
  };

  return (
    <CalcRow
      label="Peso Teórico Cantoneiras"
      fields={[
        { key: "a", label: "Aba A (mm)", placeholder: "ex: 50", value: a, onChange: setA },
        { key: "b", label: "Aba B (mm)", placeholder: "ex: 50", value: b, onChange: setB },
        { key: "e", label: "Espessura (mm)", placeholder: "ex: 4", value: e, onChange: setE },
        { key: "c", label: "Comprimento (mm)", placeholder: "ex: 6000", value: c, onChange: setC },
        { key: "q", label: "Quantidade (UN)", placeholder: "ex: 10", value: q, onChange: setQ },
      ]}
      onCalc={calc}
      resultado={res}
    />
  );
}

export default function Calculos() {
  return (
    <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center">
          <Calculator className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Cálculos de Peso Teórico</h1>
          <p className="text-xs text-muted-foreground">Densidade do aço: 7,85 kg/dm³ · Resultados em kg</p>
        </div>
      </div>

      <div className="space-y-4">
        <BarrasRedondas />
        <Chapas />
        <BarrasSextavadas />
        <TuboRedondo />
        <TuboQuadrado />
        <TuboRetangular />
        <BarrasChatas />
        <Cantoneiras />
      </div>
    </div>
  );
}