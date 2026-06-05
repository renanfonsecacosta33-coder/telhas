import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, Trash2 } from "lucide-react";

const DENSIDADE_ACO = 7.85;

export function HistoricoPanel({ historico, onClear, titulo }) {
  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-lg bg-white">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4" />
          <span className="font-bold text-sm tracking-wide">{titulo}</span>
        </div>
        {historico.length > 0 && (
          <button onClick={onClear} className="text-xs flex items-center gap-1 hover:text-blue-100 transition-colors">
            <Trash2 className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>
      <ScrollArea className="h-[320px] w-full">
        <div className="p-3 space-y-2">
          {historico.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">Nenhum cálculo ainda</p>
          ) : (
            historico.map((h, i) => (
              <div key={i} className="text-xs border rounded-lg p-2.5 bg-gradient-to-br from-gray-50 to-white hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-gray-700">{h.label}</span>
                  <span className="text-[10px] text-muted-foreground">{h.data}</span>
                </div>
                <div className="text-gray-600 space-y-0.5">
                  <div className="font-medium">{h.entrada}</div>
                  <div className="text-blue-600 font-bold">→ {h.resultado}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function CalcCard({ label, children, historico, onClearHistorico }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2">
        <div className="rounded-xl overflow-hidden border border-border shadow-lg bg-white">
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white px-4 py-3">
            <span className="font-bold text-sm tracking-wide">{label}</span>
          </div>
          {children}
        </div>
      </div>
      <div>
        <HistoricoPanel historico={historico} onClear={onClearHistorico} titulo={label} />
      </div>
    </div>
  );
}

// Chapas
export function Chapas() {
  const [e, setE] = useState(""); const [l, setL] = useState(""); const [c, setC] = useState("");
  const [q, setQ] = useState(""); const [kg, setKg] = useState("");
  const [modo, setModo] = useState("peso"); const [res, setRes] = useState(null);
  const [historico, setHistorico] = useState([]);

  useEffect(() => { const s = localStorage.getItem("chapas_historico"); if (s) setHistorico(JSON.parse(s)); }, []);

  const add = (resultado, label) => {
    const n = { label, entrada: modo==="peso"?`E:${e}mm L:${l}mm C:${c}mm Q:${q}un`:`E:${e}mm L:${l}mm C:${c}mm ${kg}kg`,
      resultado: modo==="peso"?`${resultado.toFixed(2)} kg`:`${resultado.toFixed(2)} un`,
      data: new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}) };
    const u = [n,...historico].slice(0,20); setHistorico(u); localStorage.setItem("chapas_historico",JSON.stringify(u));
  };

  const calc = () => {
    if (modo==="peso") {
      const E=parseFloat(e),L=parseFloat(l),C=parseFloat(c),Q=parseFloat(q);
      if(!E||!L||!C||!Q)return;
      const p=(E/10)*(L/10)*(C/10)*DENSIDADE_ACO*Q/1000; setRes(p); add(p,"📊 Peso");
    } else {
      const E=parseFloat(e),L=parseFloat(l),C=parseFloat(c),K=parseFloat(kg);
      if(!E||!L||!C||!K)return;
      const pu=(E/10)*(L/10)*(C/10)*DENSIDADE_ACO/1000; const qt=K/pu; setRes(qt); add(qt,"🔢 Quantidade");
    }
  };

  return (
    <CalcCard label="Chapas / Blocos / Retalhos" historico={historico} onClearHistorico={()=>{setHistorico([]);localStorage.removeItem("chapas_historico");}}>
      <div className="p-4">
        <div className="flex gap-2 mb-4">
          <button onClick={()=>{setModo("peso");setRes(null);}} className={`flex-1 text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-md ${modo==="peso"?"bg-gradient-to-r from-blue-600 to-blue-700 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>📊 Calcular Peso</button>
          <button onClick={()=>{setModo("quantidade");setRes(null);}} className={`flex-1 text-xs font-bold px-4 py-2.5 rounded-lg transition-all shadow-md ${modo==="quantidade"?"bg-gradient-to-r from-blue-600 to-blue-700 text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>🔢 Calcular Quantidade</button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[{k:e,s:setE,l:"Espessura (mm)",p:"0.95"},{k:l,s:setL,l:"Largura (mm)",p:"1000"},{k:c,s:setC,l:"Comprimento (mm)",p:"6000"}].map((f,i)=><div key={i} className="space-y-1"><label className="text-[10px] font-semibold text-gray-600 uppercase">{f.l}</label><input type="number" step="any" placeholder={f.p} value={f.k} onChange={ev=>f.s(ev.target.value)} className="w-full h-11 px-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"/></div>)}
          <div className="space-y-1"><label className="text-[10px] font-semibold text-gray-600 uppercase">{modo==="peso"?"Quantidade (UN)":"Peso Total (Kg)"}</label><input type="number" step="any" placeholder={modo==="peso"?"10":"500"} value={modo==="peso"?q:kg} onChange={ev=>modo==="peso"?setQ(ev.target.value):setKg(ev.target.value)} className="w-full h-11 px-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"/></div>
        </div>
        <div className="mt-4 flex gap-3"><button onClick={calc} className="flex-1 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white text-sm font-bold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl">CALCULAR</button><div className="flex-1 flex items-center justify-center text-lg font-bold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg h-11">{res!==null?res.toFixed(2):"—"}</div></div>
      </div>
    </CalcCard>
  );
}

// Barras Redondas
export function BarrasRedondas() {
  const [d,setD]=useState(""); const [c,setC]=useState(""); const [q,setQ]=useState(""); const [res,setRes]=useState(null);
  const [historico,setHistorico]=useState([]);
  useEffect(()=>{const s=localStorage.getItem("redondas_historico");if(s)setHistorico(JSON.parse(s));},[]);

  const add=(r)=>{const n={label:"Barra Redonda",entrada:`D:${d}mm C:${c}mm Q:${q}un`,resultado:`${r.toFixed(2)} kg`,data:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};const u=[n,...historico].slice(0,20);setHistorico(u);localStorage.setItem("redondas_historico",JSON.stringify(u));};
  const calc=()=>{const D=parseFloat(d),C=parseFloat(c),Q=parseFloat(q);if(!D||!C||!Q)return;const p=(Math.PI/4)*(D/10)**2*(C/10)*DENSIDADE_ACO*Q/1000;setRes(p);add(p);};

  return (
    <CalcCard label="Barras Redondas" historico={historico} onClearHistorico={()=>{setHistorico([]);localStorage.removeItem("redondas_historico");}}>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          {[{k:d,s:setD,l:"Diâmetro (mm)",p:"10"},{k:c,s:setC,l:"Comprimento (mm)",p:"6000"},{k:q,s:setQ,l:"Quantidade (UN)",p:"10"}].map((f,i)=><div key={i} className="space-y-1"><label className="text-[10px] font-semibold text-gray-600 uppercase">{f.l}</label><input type="number" step="any" placeholder={f.p} value={f.k} onChange={ev=>f.s(ev.target.value)} className="w-full h-11 px-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"/></div>)}
        </div>
        <div className="mt-4 flex gap-3"><button onClick={calc} className="flex-1 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white text-sm font-bold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl">CALCULAR</button><div className="flex-1 flex items-center justify-center text-lg font-bold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg h-11">{res!==null?res.toFixed(2):"—"}</div></div>
      </div>
    </CalcCard>
  );
}

// Barras Sextavadas
export function BarrasSextavadas() {
  const [b,setB]=useState(""); const [c,setC]=useState(""); const [q,setQ]=useState(""); const [res,setRes]=useState(null);
  const [historico,setHistorico]=useState([]);
  useEffect(()=>{const s=localStorage.getItem("sextavadas_historico");if(s)setHistorico(JSON.parse(s));},[]);

  const add=(r)=>{const n={label:"Barra Sextavada",entrada:`B:${b}mm C:${c}mm Q:${q}un`,resultado:`${r.toFixed(2)} kg`,data:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};const u=[n,...historico].slice(0,20);setHistorico(u);localStorage.setItem("sextavadas_historico",JSON.stringify(u));};
  const calc=()=>{const B=parseFloat(b),C=parseFloat(c),Q=parseFloat(q);if(!B||!C||!Q)return;const a=(Math.sqrt(3)/2)*(B/10)**2;const p=a*(C/10)*DENSIDADE_ACO*Q/1000;setRes(p);add(p);};

  return (
    <CalcCard label="Barras Sextavadas" historico={historico} onClearHistorico={()=>{setHistorico([]);localStorage.removeItem("sextavadas_historico");}}>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3">
          {[{k:b,s:setB,l:"Bitola (mm)",p:"20"},{k:c,s:setC,l:"Comprimento (mm)",p:"6000"},{k:q,s:setQ,l:"Quantidade (UN)",p:"10"}].map((f,i)=><div key={i} className="space-y-1"><label className="text-[10px] font-semibold text-gray-600 uppercase">{f.l}</label><input type="number" step="any" placeholder={f.p} value={f.k} onChange={ev=>f.s(ev.target.value)} className="w-full h-11 px-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"/></div>)}
        </div>
        <div className="mt-4 flex gap-3"><button onClick={calc} className="flex-1 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white text-sm font-bold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl">CALCULAR</button><div className="flex-1 flex items-center justify-center text-lg font-bold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg h-11">{res!==null?res.toFixed(2):"—"}</div></div>
      </div>
    </CalcCard>
  );
}

// Tubo Redondo
export function TuboRedondo() {
  const [de,setDe]=useState(""); const [p,setP]=useState(""); const [c,setC]=useState(""); const [q,setQ]=useState(""); const [res,setRes]=useState(null);
  const [historico,setHistorico]=useState([]);
  useEffect(()=>{const s=localStorage.getItem("tubo_redondo_historico");if(s)setHistorico(JSON.parse(s));},[]);

  const add=(r)=>{const n={label:"Tubo Redondo",entrada:`DE:${de}mm P:${p}mm C:${c}mm Q:${q}un`,resultado:`${r.toFixed(2)} kg`,data:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};const u=[n,...historico].slice(0,20);setHistorico(u);localStorage.setItem("tubo_redondo_historico",JSON.stringify(u));};
  const calc=()=>{const DE=parseFloat(de),P=parseFloat(p),C=parseFloat(c),Q=parseFloat(q);if(!DE||!P||!C||!Q)return;const p_=Math.PI*((DE-P)/10)*(P/10)*(C/10)*DENSIDADE_ACO*Q/1000;setRes(p_);add(p_);};

  return (
    <CalcCard label="Tubo Redondo" historico={historico} onClearHistorico={()=>{setHistorico([]);localStorage.removeItem("tubo_redondo_historico");}}>
      <div className="p-4">
        <div className="grid grid-cols-4 gap-3">
          {[{k:de,s:setDe,l:"Diâmetro Ext. (mm)",p:"50"},{k:p,s:setP,l:"Parede (mm)",p:"2"},{k:c,s:setC,l:"Comprimento (mm)",p:"6000"},{k:q,s:setQ,l:"Quantidade (UN)",p:"10"}].map((f,i)=><div key={i} className="space-y-1"><label className="text-[10px] font-semibold text-gray-600 uppercase">{f.l}</label><input type="number" step="any" placeholder={f.p} value={f.k} onChange={ev=>f.s(ev.target.value)} className="w-full h-11 px-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"/></div>)}
        </div>
        <div className="mt-4 flex gap-3"><button onClick={calc} className="flex-1 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white text-sm font-bold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl">CALCULAR</button><div className="flex-1 flex items-center justify-center text-lg font-bold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg h-11">{res!==null?res.toFixed(2):"—"}</div></div>
      </div>
    </CalcCard>
  );
}

// Tubo Quadrado
export function TuboQuadrado() {
  const [b,setB]=useState(""); const [p,setP]=useState(""); const [c,setC]=useState(""); const [q,setQ]=useState(""); const [res,setRes]=useState(null);
  const [historico,setHistorico]=useState([]);
  useEffect(()=>{const s=localStorage.getItem("tubo_quadrado_historico");if(s)setHistorico(JSON.parse(s));},[]);

  const add=(r)=>{const n={label:"Tubo Quadrado",entrada:`B:${b}mm P:${p}mm C:${c}mm Q:${q}un`,resultado:`${r.toFixed(2)} kg`,data:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};const u=[n,...historico].slice(0,20);setHistorico(u);localStorage.setItem("tubo_quadrado_historico",JSON.stringify(u));};
  const calc=()=>{const B=parseFloat(b),P=parseFloat(p),C=parseFloat(c),Q=parseFloat(q);if(!B||!P||!C||!Q)return;const a=(B/10)**2-((B-2*P)/10)**2;const p_=a*(C/10)*DENSIDADE_ACO*Q/1000;setRes(p_);add(p_);};

  return (
    <CalcCard label="Tubo Quadrado" historico={historico} onClearHistorico={()=>{setHistorico([]);localStorage.removeItem("tubo_quadrado_historico");}}>
      <div className="p-4">
        <div className="grid grid-cols-4 gap-3">
          {[{k:b,s:setB,l:"Bitola (mm)",p:"50"},{k:p,s:setP,l:"Parede (mm)",p:"2"},{k:c,s:setC,l:"Comprimento (mm)",p:"6000"},{k:q,s:setQ,l:"Quantidade (UN)",p:"10"}].map((f,i)=><div key={i} className="space-y-1"><label className="text-[10px] font-semibold text-gray-600 uppercase">{f.l}</label><input type="number" step="any" placeholder={f.p} value={f.k} onChange={ev=>f.s(ev.target.value)} className="w-full h-11 px-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"/></div>)}
        </div>
        <div className="mt-4 flex gap-3"><button onClick={calc} className="flex-1 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white text-sm font-bold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl">CALCULAR</button><div className="flex-1 flex items-center justify-center text-lg font-bold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg h-11">{res!==null?res.toFixed(2):"—"}</div></div>
      </div>
    </CalcCard>
  );
}

// Tubo Retangular
export function TuboRetangular() {
  const [dm,setDm]=useState(""); const [dn,setDn]=useState(""); const [p,setP]=useState(""); const [c,setC]=useState(""); const [q,setQ]=useState(""); const [res,setRes]=useState(null);
  const [historico,setHistorico]=useState([]);
  useEffect(()=>{const s=localStorage.getItem("tubo_retangular_historico");if(s)setHistorico(JSON.parse(s));},[]);

  const add=(r)=>{const n={label:"Tubo Retangular",entrada:`DM:${dm}mm DN:${dn}mm P:${p}mm C:${c}mm Q:${q}un`,resultado:`${r.toFixed(2)} kg`,data:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};const u=[n,...historico].slice(0,20);setHistorico(u);localStorage.setItem("tubo_retangular_historico",JSON.stringify(u));};
  const calc=()=>{const DM=parseFloat(dm),DN=parseFloat(dn),P=parseFloat(p),C=parseFloat(c),Q=parseFloat(q);if(!DM||!DN||!P||!C||!Q)return;const a=(DM/10)*(DN/10)-((DM-2*P)/10)*((DN-2*P)/10);const p_=a*(C/10)*DENSIDADE_ACO*Q/1000;setRes(p_);add(p_);};

  return (
    <CalcCard label="Tubo Retangular" historico={historico} onClearHistorico={()=>{setHistorico([]);localStorage.removeItem("tubo_retangular_historico");}}>
      <div className="p-4">
        <div className="grid grid-cols-5 gap-3">
          {[{k:dm,s:setDm,l:"Maior (mm)",p:"100"},{k:dn,s:setDn,l:"Menor (mm)",p:"50"},{k:p,s:setP,l:"Parede (mm)",p:"2"},{k:c,s:setC,l:"Comprimento (mm)",p:"6000"},{k:q,s:setQ,l:"Quantidade (UN)",p:"10"}].map((f,i)=><div key={i} className="space-y-1"><label className="text-[10px] font-semibold text-gray-600 uppercase">{f.l}</label><input type="number" step="any" placeholder={f.p} value={f.k} onChange={ev=>f.s(ev.target.value)} className="w-full h-11 px-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"/></div>)}
        </div>
        <div className="mt-4 flex gap-3"><button onClick={calc} className="flex-1 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white text-sm font-bold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl">CALCULAR</button><div className="flex-1 flex items-center justify-center text-lg font-bold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg h-11">{res!==null?res.toFixed(2):"—"}</div></div>
      </div>
    </CalcCard>
  );
}

// Barras Chatas
export function BarrasChatas() {
  const [l,setL]=useState(""); const [e,setE]=useState(""); const [c,setC]=useState(""); const [q,setQ]=useState(""); const [res,setRes]=useState(null);
  const [historico,setHistorico]=useState([]);
  useEffect(()=>{const s=localStorage.getItem("chatas_historico");if(s)setHistorico(JSON.parse(s));},[]);

  const add=(r)=>{const n={label:"Barra Chata",entrada:`L:${l}mm E:${e}mm C:${c}mm Q:${q}un`,resultado:`${r.toFixed(2)} kg`,data:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};const u=[n,...historico].slice(0,20);setHistorico(u);localStorage.setItem("chatas_historico",JSON.stringify(u));};
  const calc=()=>{const L=parseFloat(l),E=parseFloat(e),C=parseFloat(c),Q=parseFloat(q);if(!L||!E||!C||!Q)return;const p=(L/10)*(E/10)*(C/10)*DENSIDADE_ACO*Q/1000;setRes(p);add(p);};

  return (
    <CalcCard label="Barras Chatas" historico={historico} onClearHistorico={()=>{setHistorico([]);localStorage.removeItem("chatas_historico");}}>
      <div className="p-4">
        <div className="grid grid-cols-4 gap-3">
          {[{k:l,s:setL,l:"Largura (mm)",p:"50"},{k:e,s:setE,l:"Espessura (mm)",p:"5"},{k:c,s:setC,l:"Comprimento (mm)",p:"6000"},{k:q,s:setQ,l:"Quantidade (UN)",p:"10"}].map((f,i)=><div key={i} className="space-y-1"><label className="text-[10px] font-semibold text-gray-600 uppercase">{f.l}</label><input type="number" step="any" placeholder={f.p} value={f.k} onChange={ev=>f.s(ev.target.value)} className="w-full h-11 px-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"/></div>)}
        </div>
        <div className="mt-4 flex gap-3"><button onClick={calc} className="flex-1 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white text-sm font-bold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl">CALCULAR</button><div className="flex-1 flex items-center justify-center text-lg font-bold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg h-11">{res!==null?res.toFixed(2):"—"}</div></div>
      </div>
    </CalcCard>
  );
}

// Cantoneiras
export function Cantoneiras() {
  const [a,setA]=useState(""); const [b,setB]=useState(""); const [e,setE]=useState(""); const [c,setC]=useState(""); const [q,setQ]=useState(""); const [res,setRes]=useState(null);
  const [historico,setHistorico]=useState([]);
  useEffect(()=>{const s=localStorage.getItem("cantoneiras_historico");if(s)setHistorico(JSON.parse(s));},[]);

  const add=(r)=>{const n={label:"Cantoneira",entrada:`A:${a}mm B:${b}mm E:${e}mm C:${c}mm Q:${q}un`,resultado:`${r.toFixed(2)} kg`,data:new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})};const u=[n,...historico].slice(0,20);setHistorico(u);localStorage.setItem("cantoneiras_historico",JSON.stringify(u));};
  const calc=()=>{const A=parseFloat(a),B=parseFloat(b),E=parseFloat(e),C=parseFloat(c),Q=parseFloat(q);if(!A||!B||!E||!C||!Q)return;const ar=((A+B-E)/10)*(E/10);const p=ar*(C/10)*DENSIDADE_ACO*Q/1000;setRes(p);add(p);};

  return (
    <CalcCard label="Cantoneiras" historico={historico} onClearHistorico={()=>{setHistorico([]);localStorage.removeItem("cantoneiras_historico");}}>
      <div className="p-4">
        <div className="grid grid-cols-5 gap-3">
          {[{k:a,s:setA,l:"Aba A (mm)",p:"50"},{k:b,s:setB,l:"Aba B (mm)",p:"50"},{k:e,s:setE,l:"Espessura (mm)",p:"4"},{k:c,s:setC,l:"Comprimento (mm)",p:"6000"},{k:q,s:setQ,l:"Quantidade (UN)",p:"10"}].map((f,i)=><div key={i} className="space-y-1"><label className="text-[10px] font-semibold text-gray-600 uppercase">{f.l}</label><input type="number" step="any" placeholder={f.p} value={f.k} onChange={ev=>f.s(ev.target.value)} className="w-full h-11 px-3 text-sm border-2 border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all font-medium"/></div>)}
        </div>
        <div className="mt-4 flex gap-3"><button onClick={calc} className="flex-1 bg-gradient-to-r from-gray-900 to-gray-800 hover:from-gray-800 hover:to-gray-700 text-white text-sm font-bold px-6 py-3 rounded-lg transition-all shadow-lg hover:shadow-xl">CALCULAR</button><div className="flex-1 flex items-center justify-center text-lg font-bold text-blue-700 bg-gradient-to-r from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg h-11">{res!==null?res.toFixed(2):"—"}</div></div>
      </div>
    </CalcCard>
  );
}