import React, { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calculator, Layers, AlertTriangle, CheckCircle2, RotateCcw, Package } from "lucide-react";
import { calcAproveitamentoBlank, ESPESSURAS_CHAPA } from "@/lib/catalogo-cd";
import EspessuraSelect from "./EspessuraSelect";

// Cores para aproveitamento %
function corAproveitamento(pct) {
  const v = parseFloat(pct);
  if (v >= 90) return "text-green-700 bg-green-50 border-green-200";
  if (v >= 70) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-red-700 bg-red-50 border-red-200";
}

/**
 * AproveitamentoBlank — calculadora de aproveitamento de blank/chapa
 * Props:
 *   dev: objeto DesenvolvimentoCD (pode ser null para uso standalone)
 */
export default function AproveitamentoBlank({ dev }) {
  const [espLabel, setEspLabel] = useState(dev?.espessura_mm ? String(dev.espessura_mm) : "");
  const [espValor, setEspValor] = useState(dev?.espessura_mm || "");
  const [compPeca, setCompPeca] = useState(dev?.comprimento_desenvolvido_mm || dev?.comprimento_final_mm || "");
  const [largPeca, setLargPeca] = useState(dev?.largura_mm || dev?.largura_final_mm || "");
  const [compChapa, setCompChapa] = useState("3000");
  const [largChapa, setLargChapa] = useState("1200");
  const [qtdDesejada, setQtdDesejada] = useState(dev?.quantidade_peca || "1");

  const resultados = useMemo(() => {
    return calcAproveitamentoBlank({
      comp_peca_mm: parseFloat(compPeca),
      larg_peca_mm: parseFloat(largPeca),
      comp_chapa_mm: parseFloat(compChapa),
      larg_chapa_mm: parseFloat(largChapa),
      qtd_desejada: parseInt(qtdDesejada) || 1,
    });
  }, [compPeca, largPeca, compChapa, largChapa, qtdDesejada]);

  const melhor = resultados?.[0];

  // Peso estimado (density: 7.85 kg/dm³ para aço)
  const pesoBlank = useMemo(() => {
    if (!compPeca || !largPeca || !espValor) return null;
    const vol_dm3 = (parseFloat(compPeca) / 1000) * (parseFloat(largPeca) / 1000) * (parseFloat(espValor) / 1000) * 1000; // em dm³
    return (vol_dm3 * 7.85).toFixed(3);
  }, [compPeca, largPeca, espValor]);

  const pesoLote = useMemo(() => {
    if (!pesoBlank || !qtdDesejada) return null;
    return (parseFloat(pesoBlank) * parseInt(qtdDesejada)).toFixed(2);
  }, [pesoBlank, qtdDesejada]);

  const handleReset = () => {
    setCompPeca(dev?.comprimento_desenvolvido_mm || dev?.comprimento_final_mm || "");
    setLargPeca(dev?.largura_mm || dev?.largura_final_mm || "");
    setEspLabel(dev?.espessura_mm ? String(dev.espessura_mm) : "");
    setEspValor(dev?.espessura_mm || "");
    setCompChapa("3000");
    setLargChapa("1200");
    setQtdDesejada(dev?.quantidade_peca || "1");
  };

  return (
    <div className="space-y-5">

      {/* Aviso se veio do desenvolvimento */}
      {dev && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
          <Layers className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800">
            Dados pré-preenchidos do desenvolvimento <strong>{dev.nome_peca}</strong>.
            Ajuste os campos conforme necessário.
          </p>
        </div>
      )}

      {/* Inputs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

        <div className="col-span-2 sm:col-span-3 space-y-1">
          <Label className="text-xs">Espessura do Material</Label>
          <EspessuraSelect
            value={espLabel}
            onChange={(label, valor) => { setEspLabel(label); setEspValor(valor); }}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Comprimento do Blank (mm)
            <span className="text-muted-foreground ml-1">= desenvolvido</span>
          </Label>
          <Input type="number" placeholder="Ex: 245" value={compPeca} onChange={e => setCompPeca(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Largura do Blank (mm)</Label>
          <Input type="number" placeholder="Ex: 150" value={largPeca} onChange={e => setLargPeca(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Qtd. de Peças Desejadas</Label>
          <Input type="number" placeholder="1" value={qtdDesejada} onChange={e => setQtdDesejada(e.target.value)} />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Comprimento da Chapa (mm)</Label>
          <Input type="number" placeholder="3000" value={compChapa} onChange={e => setCompChapa(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">Padrão: 3000 ou 6000</p>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Largura da Chapa/Bobina (mm)</Label>
          <Input type="number" placeholder="1200" value={largChapa} onChange={e => setLargChapa(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">Largura disponível no estoque</p>
        </div>

        {dev && (
          <div className="flex items-end">
            <Button type="button" variant="outline" size="sm" onClick={handleReset} className="gap-1 h-9 text-xs w-full">
              <RotateCcw className="w-3 h-3" /> Resetar
            </Button>
          </div>
        )}
      </div>

      {/* Peso estimado */}
      {(pesoBlank || pesoLote) && (
        <div className="flex flex-wrap gap-3">
          {pesoBlank && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-muted-foreground">Peso/blank:</span>
              <strong>{pesoBlank} kg</strong>
            </div>
          )}
          {pesoLote && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
              <Package className="w-3.5 h-3.5 text-slate-500" />
              <span className="text-muted-foreground">Peso total ({qtdDesejada} peças):</span>
              <strong>{pesoLote} kg</strong>
            </div>
          )}
        </div>
      )}

      {/* Resultados */}
      {resultados && compPeca && largPeca ? (
        <div className="space-y-3">
          <h4 className="text-sm font-bold flex items-center gap-2">
            <Calculator className="w-4 h-4 text-orange-500" />
            Aproveitamento por Layout
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {resultados.map((r, i) => (
              <div key={i} className={`border rounded-xl p-4 space-y-3 ${i === 0 ? "ring-2 ring-orange-300" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold">{r.label}</span>
                  {i === 0 && <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">✓ Melhor</Badge>}
                </div>

                {/* Visualização da grade */}
                <BlankGrid cols={Math.min(r.cols, 10)} rows={Math.min(r.rows, 8)} />

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white border border-border rounded-lg px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Peças/chapa</p>
                    <p className="font-black text-lg text-orange-600">{r.qtd_por_chapa}</p>
                  </div>
                  <div className={`border rounded-lg px-2 py-1.5 ${corAproveitamento(r.aproveitamento_pct)}`}>
                    <p className="text-[10px] opacity-70">Aproveitamento</p>
                    <p className="font-black text-lg">{r.aproveitamento_pct}%</p>
                  </div>
                  <div className="bg-white border border-border rounded-lg px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Chapas necessárias</p>
                    <p className="font-bold">{r.chapas_necessarias ?? "—"}</p>
                  </div>
                  <div className="bg-white border border-border rounded-lg px-2 py-1.5">
                    <p className="text-[10px] text-muted-foreground">Colunas × Linhas</p>
                    <p className="font-bold">{r.cols} × {r.rows}</p>
                  </div>
                </div>

                {/* Sobras */}
                <div className="flex gap-2 flex-wrap">
                  {r.sobra_comp_mm > 0 && (
                    <span className={`text-[10px] px-2 py-1 rounded-md border ${r.sobra_comp_mm > 50 ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                      Sobra comprimento: {r.sobra_comp_mm}mm
                    </span>
                  )}
                  {r.sobra_larg_mm > 0 && (
                    <span className={`text-[10px] px-2 py-1 rounded-md border ${r.sobra_larg_mm > 50 ? "bg-red-50 border-red-200 text-red-700" : "bg-slate-50 border-slate-200 text-slate-600"}`}>
                      Sobra largura: {r.sobra_larg_mm}mm
                    </span>
                  )}
                  {r.sobra_comp_mm === 0 && r.sobra_larg_mm === 0 && (
                    <span className="text-[10px] px-2 py-1 rounded-md border bg-green-50 border-green-200 text-green-700">
                      <CheckCircle2 className="w-3 h-3 inline mr-0.5" />Sem sobra!
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Alerta sobra grande */}
          {melhor && parseFloat(melhor.aproveitamento_pct) < 70 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Aproveitamento abaixo de 70%. Considere ajustar as dimensões da chapa, agrupar peças diferentes no mesmo corte, ou registrar o retalho no módulo de <strong>Retalhos</strong>.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground text-sm border border-dashed rounded-xl">
          <Calculator className="w-8 h-8 mx-auto mb-2 opacity-20" />
          Preencha as dimensões do blank e da chapa para calcular o aproveitamento
        </div>
      )}
    </div>
  );
}

// Mini visualização da grade de peças na chapa
function BlankGrid({ cols, rows }) {
  if (!cols || !rows || cols === 0 || rows === 0) {
    return (
      <div className="h-12 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center">
        <span className="text-[10px] text-red-600">Nenhuma peça cabe nesta chapa</span>
      </div>
    );
  }
  return (
    <div className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
      <div
        className="grid gap-0.5"
        style={{ gridTemplateColumns: `repeat(${Math.min(cols, 10)}, 1fr)` }}
      >
        {Array.from({ length: Math.min(cols * rows, 80) }).map((_, i) => (
          <div key={i} className="bg-orange-300 rounded-sm aspect-square" />
        ))}
      </div>
      {cols * rows > 80 && (
        <p className="text-[10px] text-muted-foreground text-center mt-1">
          (mostrando primeiras 80 de {cols * rows} peças)
        </p>
      )}
    </div>
  );
}