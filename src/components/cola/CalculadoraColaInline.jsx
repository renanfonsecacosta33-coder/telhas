import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calculator, Droplets } from "lucide-react";

const SACO_PESO_KG = 3.75;
const TAMBOR_PESO_KG = 200;
const SACOS_POR_TAMBOR = Math.floor(TAMBOR_PESO_KG / SACO_PESO_KG); // 53

// Consumo médio de cola por metro colado (kg/m) — ajustável
const CONSUMO_PADRAO_KG_POR_M = 0.15;

export default function CalculadoraColaInline() {
  const [metros, setMetros] = useState("");
  const [consumoKgPorM, setConsumoKgPorM] = useState(CONSUMO_PADRAO_KG_POR_M);
  const [sacosPorMetro, setSacosPorMetro] = useState("");

  // Modo 1: calcular por metros + consumo
  const metrosNum = Number(metros) || 0;
  const consumoNum = Number(consumoKgPorM) || CONSUMO_PADRAO_KG_POR_M;

  const kgNecessarios = metrosNum * consumoNum;
  const sacosNecessarios = Math.ceil(kgNecessarios / SACO_PESO_KG);
  const tamboresNecessarios = kgNecessarios / TAMBOR_PESO_KG;
  const tamboresInteiros = Math.floor(tamboresNecessarios);
  const sobra_kg = +(kgNecessarios - tamboresInteiros * TAMBOR_PESO_KG).toFixed(2);

  // Modo 2: dado sacos por metro, quanto rende um tambor inteiro
  const sacosPorMetroNum = Number(sacosPorMetro) || 0;
  const metrosPorTambor = sacosPorMetroNum > 0 ? (SACOS_POR_TAMBOR / sacosPorMetroNum).toFixed(1) : null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Calculator className="w-5 h-5" />
          <h2 className="font-bold text-lg">Calculadora de Cola</h2>
        </div>
        <p className="text-sm opacity-80">Calcule sacos e tambores para seus pedidos de colagem</p>
      </div>

      <div className="p-5 space-y-5">
        {/* Referência rápida */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-orange-700">{SACO_PESO_KG}kg</p>
            <p className="text-xs text-orange-600">por saco</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-amber-700">{TAMBOR_PESO_KG}kg</p>
            <p className="text-xs text-amber-600">por tambor</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-black text-blue-700">{SACOS_POR_TAMBOR}</p>
            <p className="text-xs text-blue-600">sacos/tambor</p>
          </div>
        </div>

        {/* Cálculo principal */}
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Calcular por Metragem</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Metros a colar</Label>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={metros}
                onChange={(e) => setMetros(e.target.value)}
                className="font-bold text-lg"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Consumo médio (kg/m)</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={consumoKgPorM}
                onChange={(e) => setConsumoKgPorM(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Padrão: {CONSUMO_PADRAO_KG_POR_M} kg/m</p>
            </div>
          </div>

          {metrosNum > 0 && (
            <div className="space-y-3">
              {/* Resultado principal */}
              <div className="bg-orange-50 border border-orange-300 rounded-xl px-5 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-orange-800 uppercase tracking-wide">Sacos Necessários</p>
                    <p className="text-xs text-orange-700">{kgNecessarios.toFixed(2)}kg ÷ {SACO_PESO_KG}kg/saco</p>
                  </div>
                  <p className="text-5xl font-black text-orange-700">{sacosNecessarios}</p>
                </div>
              </div>

              {/* Detalhamento de tambores */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-border rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Tambores completos</p>
                  <p className="text-3xl font-black text-slate-700">{tamboresInteiros}</p>
                  <p className="text-xs text-muted-foreground">+ {sobra_kg}kg restam</p>
                </div>
                <div className="bg-slate-50 border border-border rounded-xl p-3 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total de kg</p>
                  <p className="text-3xl font-black text-slate-700">{kgNecessarios.toFixed(1)}</p>
                  <p className="text-xs text-muted-foreground">kg de cola</p>
                </div>
              </div>

              {/* Sobra de um tambor aberto */}
              {sobra_kg > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-amber-800">Tambor parcial necessário</p>
                    <p className="text-xs text-amber-700">Usará {sobra_kg}kg de um tambor aberto</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-amber-700">{(((TAMBOR_PESO_KG - sobra_kg) / TAMBOR_PESO_KG) * 100).toFixed(0)}%</p>
                    <p className="text-xs text-amber-600">sobra no tambor</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modo 2: rendimento de tambor */}
        <div className="border-t border-border pt-4 space-y-3">
          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500" />
            Rendimento por Tambor
          </p>
          <div className="space-y-1">
            <Label className="text-xs">Sacos usados por metro colado</Label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="Ex: 0.04"
              value={sacosPorMetro}
              onChange={(e) => setSacosPorMetro(e.target.value)}
            />
          </div>
          {metrosPorTambor && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-800">Um tambor ({TAMBOR_PESO_KG}kg = {SACOS_POR_TAMBOR} sacos) rende:</p>
                <p className="text-xs text-blue-700">com {sacosPorMetro} sacos/metro</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-black text-blue-700">{metrosPorTambor}m</p>
                <p className="text-xs text-blue-600">de colagem</p>
              </div>
            </div>
          )}
        </div>

        {/* Conversão rápida */}
        <div className="border-t border-border pt-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tabela de Conversão Rápida</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-1.5 text-muted-foreground font-medium">Tambores</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Sacos</th>
                  <th className="text-right py-1.5 text-muted-foreground font-medium">Kg Total</th>
                </tr>
              </thead>
              <tbody>
                {[1, 2, 3, 5, 10].map((n) => (
                  <tr key={n} className="border-b border-border/50">
                    <td className="py-1.5 font-semibold">{n} tambor{n > 1 ? "es" : ""}</td>
                    <td className="py-1.5 text-right text-orange-700 font-bold">{n * SACOS_POR_TAMBOR}</td>
                    <td className="py-1.5 text-right text-slate-600">{n * TAMBOR_PESO_KG}kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}