import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Calculator, Snowflake } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Cada placa de EPS tem 2m de comprimento
const COMPRIMENTO_PLACA = 2; // metros

// Larguras padrão por tipo de EPS (em mm)
const LARGURAS_EPS = {
  "EPS - TP 25":           1000,
  "EPS - TP 40":           1000,
  "EPS - TP 40 BANDEJA":   1150,
  "EPS - COLONIAL":         820,
  "EPS - COLONIAL BANDEJA": 820,
  "EPS - ONDULADO":         820,
};

export default function CalculadoraIsopor() {
  const navigate = useNavigate();
  const [tipoEPS, setTipoEPS] = useState("");
  const [qtdTelhas, setQtdTelhas] = useState("");
  const [comprimento_mm, setComprimento_mm] = useState("");

  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores"],
    queryFn: () => base44.entities.Isopor.list(),
  });

  const metragemTotalM = (Number(qtdTelhas) || 0) * ((Number(comprimento_mm) || 0) / 1000);
  const larguraMm = LARGURAS_EPS[tipoEPS] || 0;

  // Cada TELHA consome placas individualmente (não compartilha entre telhas)
  // Ex: telha de 5,25m → ceil(5,25/2) = 3 placas por telha
  const comprimentoTelhaM = (Number(comprimento_mm) || 0) / 1000;
  const placasPorTelha = comprimentoTelhaM > 0 ? Math.ceil(comprimentoTelhaM / COMPRIMENTO_PLACA) : 0;
  const qtdTelhasNum = Number(qtdTelhas) || 0;
  const placasNecessarias = placasPorTelha * qtdTelhasNum;

  // Detalhamento: placas inteiras (cabem exatas) e pedaços (sobra)
  const placasInteirasPorTelha = comprimentoTelhaM > 0 ? Math.floor(comprimentoTelhaM / COMPRIMENTO_PLACA) : 0;
  const sobraPorTelha = +(comprimentoTelhaM - placasInteirasPorTelha * COMPRIMENTO_PLACA).toFixed(4);
  const placasInteiras = placasInteirasPorTelha * qtdTelhasNum;
  const pedacos = sobraPorTelha > 0 ? qtdTelhasNum : 0;
  const sobra = sobraPorTelha; // sobra de cada pedaço

  // Area total coberta
  const areaTotalM2 = metragemTotalM * (larguraMm / 1000);

  // Estoque atual do tipo selecionado
  const estoqueAtual = isopores.find(i => i.tipo === tipoEPS);
  const qtdEstoque = estoqueAtual?.quantidade || 0;
  const saldo = qtdEstoque - placasNecessarias;

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2 text-muted-foreground">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Button>
      </div>

      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-3 mb-2">
          <Calculator className="w-6 h-6" />
          <p className="text-sm opacity-75 font-medium uppercase tracking-wide">Ferramenta</p>
        </div>
        <h1 className="text-3xl font-black">Calculadora de Isopor</h1>
        <p className="text-sm opacity-80 mt-1">Calcule quantas placas de EPS você precisa para um pedido</p>
      </div>

      {/* Inputs */}
      <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
        <h2 className="font-semibold text-base">Dados do Pedido</h2>

        <div className="space-y-1">
          <Label>Tipo de EPS</Label>
          <Select value={tipoEPS} onValueChange={setTipoEPS}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de EPS..." />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(LARGURAS_EPS).map(t => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {tipoEPS && (
            <p className="text-xs text-muted-foreground">
              Largura da placa: <strong>{LARGURAS_EPS[tipoEPS]}mm</strong> · Comprimento padrão: <strong>2m</strong>
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Quantidade de Telhas</Label>
            <Input
              type="number"
              placeholder="0"
              value={qtdTelhas}
              onChange={e => setQtdTelhas(e.target.value)}
              className="font-bold text-lg"
            />
          </div>
          <div className="space-y-1">
            <Label>Comprimento Individual (mm)</Label>
            <Input
              type="number"
              placeholder="ex: 5000"
              value={comprimento_mm}
              onChange={e => setComprimento_mm(e.target.value)}
            />
            {comprimento_mm && Number(comprimento_mm) > 0 && (
              <p className="text-xs text-muted-foreground">{(Number(comprimento_mm) / 1000).toFixed(3)}m por telha</p>
            )}
          </div>
        </div>

        {/* Metragem total */}
        {metragemTotalM > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Metragem Total do Pedido</p>
              <p className="text-xs text-muted-foreground">{qtdTelhas} telhas × {Number(comprimento_mm)}mm</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-primary">{metragemTotalM.toFixed(2)}m</p>
              {larguraMm > 0 && (
                <p className="text-xs text-muted-foreground">{areaTotalM2.toFixed(2)}m²</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Resultado */}
      {placasNecessarias > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <h2 className="font-semibold text-base flex items-center gap-2">
            <Snowflake className="w-4 h-4 text-blue-500" />
            Resultado do Cálculo
          </h2>

          {/* Card principal */}
          <div className="bg-emerald-50 border border-emerald-300 rounded-xl px-5 py-4 text-center">
            <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide mb-1">Total de Placas a Comprar</p>
            <p className="text-5xl font-black text-emerald-700">{placasNecessarias}</p>
          </div>

          {/* Detalhamento inteiras + pedaços */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
              <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Placas Inteiras</p>
              <p className="text-4xl font-black text-blue-700">{placasInteiras}</p>
              <p className="text-xs text-blue-500 mt-1">de {COMPRIMENTO_PLACA},000m ({COMPRIMENTO_PLACA},000m) cada</p>
            </div>
            {pedacos > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Pedaços</p>
                <p className="text-4xl font-black text-amber-700">{pedacos}</p>
                <p className="text-xs text-amber-500 mt-1">de {(sobra * 1000).toFixed(0)}mm ({sobra.toFixed(3)}m) cada</p>
              </div>
            )}
          </div>

          {/* Detalhamento */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 border border-border rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Metragem coberta</p>
              <p className="text-xl font-bold text-slate-700">{metragemTotalM.toFixed(2)}m</p>
            </div>
            <div className="bg-slate-50 border border-border rounded-xl p-3 text-center">
              <p className="text-xs text-muted-foreground">Comprimento placa</p>
              <p className="text-xl font-bold text-slate-700">{COMPRIMENTO_PLACA}m</p>
            </div>
            {larguraMm > 0 && (
              <div className="bg-slate-50 border border-border rounded-xl p-3 text-center">
                <p className="text-xs text-muted-foreground">Largura da placa</p>
                <p className="text-xl font-bold text-slate-700">{larguraMm}mm</p>
              </div>
            )}
            {sobra > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-700">Sobra da última placa</p>
                <p className="text-xl font-bold text-amber-700">{+(COMPRIMENTO_PLACA - sobra).toFixed(2)}m</p>
              </div>
            )}
          </div>

          {/* Estoque */}
          {tipoEPS && estoqueAtual && (
            <div className={`border rounded-xl px-4 py-3 flex items-center justify-between ${saldo >= 0 ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${saldo >= 0 ? "text-green-800" : "text-red-800"}`}>
                  Estoque Atual — {tipoEPS}
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
            <div className="bg-slate-50 border border-border rounded-xl px-4 py-3 text-sm text-muted-foreground">
              Sem estoque cadastrado para {tipoEPS}
            </div>
          )}
        </div>
      )}
    </div>
  );
}