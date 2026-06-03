import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Snowflake } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

const COMPRIMENTO_PLACA = 2;
const LARGURAS_EPS = {
  "EPS - TP 25": 1000,
  "EPS - TP 40": 1000,
  "EPS - TP 40 BANDEJA": 1150,
  "EPS - COLONIAL": 820,
  "EPS - COLONIAL BANDEJA": 820,
  "EPS - ONDULADO": 820,
};

export default function CalculadoraIsoporInline() {
  const [tipoEPS, setTipoEPS] = useState("");
  const [qtdTelhas, setQtdTelhas] = useState("");
  const [comprimento_mm, setComprimento_mm] = useState("");

  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores"],
    queryFn: () => base44.entities.Isopor.list(),
  });

  const comprimentoTelhaM = (Number(comprimento_mm) || 0) / 1000;
  const qtdTelhasNum = Number(qtdTelhas) || 0;
  const metragemTotalM = qtdTelhasNum * comprimentoTelhaM;
  const larguraMm = LARGURAS_EPS[tipoEPS] || 0;
  const areaTotalM2 = metragemTotalM * (larguraMm / 1000);

  const placasPorTelha = comprimentoTelhaM > 0 ? Math.ceil(comprimentoTelhaM / COMPRIMENTO_PLACA) : 0;
  const placasNecessarias = placasPorTelha * qtdTelhasNum;
  const placasInteirasPorTelha = comprimentoTelhaM > 0 ? Math.floor(comprimentoTelhaM / COMPRIMENTO_PLACA) : 0;
  const sobraPorTelha = +(comprimentoTelhaM - placasInteirasPorTelha * COMPRIMENTO_PLACA).toFixed(4);
  const placasInteiras = placasInteirasPorTelha * qtdTelhasNum;
  const pedacos = sobraPorTelha > 0 ? qtdTelhasNum : 0;

  const estoqueAtual = isopores.find((i) => i.tipo === tipoEPS);
  const qtdEstoque = estoqueAtual?.quantidade || 0;
  const saldo = qtdEstoque - placasNecessarias;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" />
          <h2 className="font-bold text-lg">Calculadora de Isopor</h2>
        </div>
        <p className="text-sm opacity-80">Calcule quantas placas de EPS você precisa</p>
      </div>

      <div className="p-5 space-y-4">
        <div className="space-y-1">
          <Label>Tipo de EPS</Label>
          <Select value={tipoEPS} onValueChange={setTipoEPS}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de EPS..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(LARGURAS_EPS).map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tipoEPS && (
            <p className="text-xs text-muted-foreground">
              Largura: <strong>{LARGURAS_EPS[tipoEPS]}mm</strong> · Comprimento padrão: <strong>2m</strong>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Quantidade de Telhas</Label>
            <Input
              type="number" min="0" placeholder="0"
              value={qtdTelhas}
              onChange={(e) => setQtdTelhas(e.target.value)}
              className="font-bold text-lg"
            />
          </div>
          <div className="space-y-1">
            <Label>Comprimento Individual (mm)</Label>
            <Input
              type="number" min="0" placeholder="ex: 5000"
              value={comprimento_mm}
              onChange={(e) => setComprimento_mm(e.target.value)}
            />
            {comprimento_mm && Number(comprimento_mm) > 0 && (
              <p className="text-xs text-muted-foreground">{comprimentoTelhaM.toFixed(3)}m por telha</p>
            )}
          </div>
        </div>

        {metragemTotalM > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Metragem Total</p>
              <p className="text-xs text-muted-foreground">{qtdTelhas} telhas × {Number(comprimento_mm)}mm</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-primary">{metragemTotalM.toFixed(2)}m</p>
              {areaTotalM2 > 0 && <p className="text-xs text-muted-foreground">{areaTotalM2.toFixed(2)}m²</p>}
            </div>
          </div>
        )}

        {placasNecessarias > 0 && (
          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-5 py-4 text-center">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1">Total de Placas</p>
              <p className="text-5xl font-black text-emerald-700">{placasNecessarias}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Placas Inteiras</p>
                <p className="text-4xl font-black text-blue-700">{placasInteiras}</p>
                <p className="text-xs text-blue-500 mt-1">2m cada</p>
              </div>
              {pedacos > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                  <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Pedaços</p>
                  <p className="text-4xl font-black text-amber-700">{pedacos}</p>
                  <p className="text-xs text-amber-500 mt-1">{(sobraPorTelha * 1000).toFixed(0)}mm cada</p>
                </div>
              )}
            </div>

            {tipoEPS && estoqueAtual && (
              <div className={`border rounded-xl px-4 py-3 flex items-center justify-between ${saldo >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
                <div>
                  <p className={`text-xs font-semibold uppercase tracking-wide ${saldo >= 0 ? "text-green-800" : "text-red-800"}`}>
                    Estoque — {tipoEPS}
                  </p>
                  <p className={`text-sm ${saldo >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {qtdEstoque} placas disponíveis
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-black ${saldo >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {saldo >= 0 ? `+${saldo}` : saldo}
                  </p>
                  <p className={`text-xs ${saldo >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {saldo >= 0 ? "sobram após uso" : "faltam no estoque!"}
                  </p>
                </div>
              </div>
            )}
            {tipoEPS && !estoqueAtual && (
              <div className="bg-muted/40 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
                Sem estoque cadastrado para {tipoEPS}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}