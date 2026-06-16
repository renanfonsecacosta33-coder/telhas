import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calculator, Trash2, Hash, FileText } from "lucide-react";

const DENSIDADE_ACO = 7.85; // kg/dm³

function calcPeso(esp, larg, comp, qtd) {
  // Volume em dm³: (mm³) / 1.000.000.000 * 1000 = mm³ / 1.000.000
  return ((esp * larg * comp * qtd) / 1_000_000) * DENSIDADE_ACO;
}

function calcQuantidade(esp, larg, comp, pesoDesejado) {
  const pesoUnitario = ((esp * larg * comp) / 1_000_000) * DENSIDADE_ACO;
  if (!pesoUnitario) return 0;
  return Math.ceil(pesoDesejado / pesoUnitario);
}

export default function CalculadoraVendedor({ vendedorNome }) {
  const storageKey = `calc_hist_${vendedorNome}`;

  const [modo, setModo] = useState("peso"); // "peso" | "quantidade"
  const [espessura, setEspessura] = useState("");
  const [largura, setLargura] = useState("");
  const [comprimento, setComprimento] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [pesoDesejado, setPesoDesejado] = useState(""); // para modo quantidade
  const [numPedido, setNumPedido] = useState("");
  const [resultado, setResultado] = useState(null);
  const [historico, setHistorico] = useState([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setHistorico(JSON.parse(saved));
    } catch {}
  }, [storageKey]);

  const salvarHistorico = (novos) => {
    setHistorico(novos);
    localStorage.setItem(storageKey, JSON.stringify(novos));
  };

  const handleCalcular = () => {
    const e = parseFloat(espessura.replace(",", "."));
    const l = parseFloat(largura.replace(",", "."));
    const c = parseFloat(comprimento.replace(",", "."));

    if (!e || !l || !c) return;

    if (modo === "peso") {
      const q = parseInt(quantidade) || 1;
      const peso = calcPeso(e, l, c, q);
      setResultado({ tipo: "peso", valor: peso });

      const novo = {
        id: Date.now(),
        data: new Date().toISOString(),
        modo: "peso",
        espessura: e, largura: l, comprimento: c,
        quantidade: q,
        resultado: peso,
        numPedido: numPedido.trim() || null,
      };
      salvarHistorico([novo, ...historico].slice(0, 50));
    } else {
      const pd = parseFloat(pesoDesejado.replace(",", "."));
      if (!pd) return;
      const qtd = calcQuantidade(e, l, c, pd);
      const pesoReal = calcPeso(e, l, c, qtd);
      setResultado({ tipo: "quantidade", valor: qtd, pesoReal });

      const novo = {
        id: Date.now(),
        data: new Date().toISOString(),
        modo: "quantidade",
        espessura: e, largura: l, comprimento: c,
        pesoDesejado: pd,
        resultado: qtd,
        pesoReal,
        numPedido: numPedido.trim() || null,
      };
      salvarHistorico([novo, ...historico].slice(0, 50));
    }
  };

  const limpar = () => {
    setEspessura(""); setLargura(""); setComprimento("");
    setQuantidade(""); setPesoDesejado(""); setNumPedido("");
    setResultado(null);
  };

  const removerDoHistorico = (id) => {
    salvarHistorico(historico.filter(h => h.id !== id));
  };

  const formatKg = (v) => v.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + " kg";
  const fmtData = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg shrink-0">
          <Calculator className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Cálculos de Peso Teórico</h1>
          <p className="text-xs text-muted-foreground">Densidade do aço: 7,85 kg/dm³</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Painel esquerdo: Calculadora */}
        <div className="lg:col-span-3 bg-[#171d29] rounded-2xl overflow-hidden shadow-lg">
          {/* Barra de título */}
          <div className="bg-[#171d29] px-5 py-3 flex items-center gap-2 border-b border-white/10">
            <Hash className="w-4 h-4 text-blue-400" />
            <span className="text-white font-semibold text-sm">Chapas / Blocos / Retalhos</span>
          </div>

          <div className="p-5 space-y-5">
            {/* Toggle */}
            <div className="flex bg-white/10 rounded-lg p-1 gap-1">
              <button
                onClick={() => { setModo("peso"); setResultado(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                  modo === "peso"
                    ? "bg-blue-600 text-white shadow"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Hash className="w-3.5 h-3.5 inline mr-1.5" />
                Calcular Peso
              </button>
              <button
                onClick={() => { setModo("quantidade"); setResultado(null); }}
                className={`flex-1 py-2 rounded-md text-sm font-semibold transition-all ${
                  modo === "quantidade"
                    ? "bg-blue-600 text-white shadow"
                    : "text-white/60 hover:text-white"
                }`}
              >
                <Hash className="w-3.5 h-3.5 inline mr-1.5" />
                Calcular Quantidade
              </button>
            </div>

            {/* Inputs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Espessura (mm)</label>
                <Input
                  type="text" inputMode="decimal"
                  value={espessura}
                  onChange={e => setEspessura(e.target.value)}
                  placeholder="0,95"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Largura (mm)</label>
                <Input
                  type="text" inputMode="decimal"
                  value={largura}
                  onChange={e => setLargura(e.target.value)}
                  placeholder="1000"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">Comprimento (mm)</label>
                <Input
                  type="text" inputMode="decimal"
                  value={comprimento}
                  onChange={e => setComprimento(e.target.value)}
                  placeholder="6000"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold">
                  {modo === "peso" ? "Quantidade (un)" : "Peso desejado (kg)"}
                </label>
                <Input
                  type="text" inputMode="decimal"
                  value={modo === "peso" ? quantidade : pesoDesejado}
                  onChange={e => modo === "peso" ? setQuantidade(e.target.value) : setPesoDesejado(e.target.value)}
                  placeholder={modo === "peso" ? "10" : "500"}
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-10"
                />
              </div>
            </div>

            {/* Num pedido (opcional) */}
            <div className="space-y-1">
              <label className="text-[10px] uppercase tracking-wider text-white/50 font-semibold flex items-center gap-1">
                <FileText className="w-3 h-3" /> Nº Pedido (opcional)
              </label>
              <Input
                value={numPedido}
                onChange={e => setNumPedido(e.target.value)}
                placeholder="Ex: PED-123"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 h-9 max-w-xs"
              />
            </div>

            {/* Resultado */}
            {resultado && (
              <div className="bg-emerald-500/20 border border-emerald-400/40 rounded-lg p-4 text-center">
                {resultado.tipo === "peso" ? (
                  <>
                    <p className="text-emerald-300 text-xs uppercase tracking-wider font-semibold">Peso Calculado</p>
                    <p className="text-white text-3xl font-black mt-1">{formatKg(resultado.valor)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-emerald-300 text-xs uppercase tracking-wider font-semibold">Quantidade Necessária</p>
                    <p className="text-white text-3xl font-black mt-1">{resultado.valor} unidades</p>
                    <p className="text-emerald-300/80 text-xs mt-1">Peso total: {formatKg(resultado.pesoReal)}</p>
                  </>
                )}
              </div>
            )}

            {/* Botões */}
            <div className="flex gap-3">
              <Button onClick={handleCalcular} className="flex-1 bg-white text-[#171d29] hover:bg-white/90 font-bold h-11">
                CALCULAR
              </Button>
              <Button variant="outline" onClick={limpar}
                className="border-white/20 text-white/60 hover:text-white hover:bg-white/10 h-11 px-5"
              >
                —
              </Button>
            </div>
          </div>
        </div>

        {/* Painel direito: Histórico */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="bg-blue-600 px-4 py-3 flex items-center gap-2">
            <Hash className="w-4 h-4 text-white" />
            <span className="text-white font-semibold text-sm">Histórico de Cálculos</span>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px]">
            {historico.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
                Nenhum cálculo ainda
              </div>
            ) : (
              <div className="divide-y divide-border">
                {historico.map(h => (
                  <div key={h.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">{fmtData(h.data)}</p>
                        <p className="text-sm font-semibold mt-0.5">
                          {h.espessura} × {h.largura} × {h.comprimento} mm
                        </p>
                        {h.numPedido && (
                          <p className="text-xs text-blue-600 font-medium mt-0.5">
                            Pedido: {h.numPedido}
                          </p>
                        )}
                        <p className="text-sm mt-1 font-bold text-foreground">
                          {h.modo === "peso"
                            ? `${formatKg(h.resultado)} (${h.quantidade} un)`
                            : `${h.resultado} un ≈ ${formatKg(h.pesoReal)}`
                          }
                        </p>
                      </div>
                      <button
                        onClick={() => removerDoHistorico(h.id)}
                        className="text-muted-foreground hover:text-red-500 shrink-0 mt-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}