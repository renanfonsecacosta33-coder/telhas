import React from "react";
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Layers, Scissors, Info, Ruler } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * BoxAproveitamentoTiras.jsx
 * 
 * Componente oficial AJL para conferência de aproveitamento de tiras na largura da bobina (1.200 mm).
 * 
 * Regras:
 * 1. Trava imediata se o desenvolvimento > largura da bobina (com botão para inverter).
 * 2. Cálculo exato de tiras por passada, sobra lateral, aproveitamento % e chapas necessárias.
 * 3. Mini visualizador gráfico de tiras na chapa/bobina.
 */
export default function BoxAproveitamentoTiras({
  larguraBobina = 1200,
  desenvolvimento = 0,
  comprimentoBarra = 0,
  quantidadePecas = 1,
  onInverterMedidas = null,
  compact = false,
}) {
  const largBob = Number(larguraBobina) > 0 ? Number(larguraBobina) : 1200;
  const desenv = Number(desenvolvimento) || 0;
  const comp = Number(comprimentoBarra) || 0;
  const qtd = Math.max(1, Number(quantidadePecas) || 1);

  // ── TRAVA DE SEGURANÇA ──
  // Se o desenvolvimento for maior que a largura da bobina-mãe (ex: 6000 mm no campo de desenvolvimento)
  const isExcedido = desenv > largBob;

  if (isExcedido) {
    return (
      <div className="rounded-xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-3.5 space-y-2.5 animate-in fade-in">
        <div className="flex items-start gap-2.5">
          <div className="p-1.5 bg-red-600 text-white rounded-lg shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-sm text-red-800 dark:text-red-200 uppercase tracking-wide">
                🚫 Trava Operacional: Desenvolvimento Inválido!
              </span>
              <Badge className="bg-red-600 text-white text-[10px] font-bold">
                {desenv} mm &gt; {largBob} mm
              </Badge>
            </div>
            <p className="text-xs text-red-700 dark:text-red-300 mt-1 leading-relaxed">
              O valor de <strong>{desenv} mm</strong> ultrapassa a largura máxima da bobina-mãe (<strong>{largBob} mm</strong>).
              Nenhuma tira cortada pode ser mais larga que a bobina. <strong>Você provavelmente digitou o comprimento final da barra neste campo!</strong>
            </p>
          </div>
        </div>

        {onInverterMedidas && (
          <div className="pt-2 border-t border-red-200 dark:border-red-900/50 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs text-red-700 dark:text-red-300">
              Deseja corrigir invertendo os campos automaticamente?
            </span>
            <Button
              type="button"
              size="sm"
              onClick={onInverterMedidas}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-7 gap-1.5 shadow-sm cursor-pointer"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Inverter com Comprimento da Barra
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Se não digitou desenvolvimento ainda, não renderiza cálculo
  if (desenv <= 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-2.5 text-xs text-slate-500 flex items-center gap-2">
        <Info className="w-4 h-4 text-slate-400 shrink-0" />
        <span>
          Digite o <strong>Desenvolvimento da Tira (soma das abas, ex: 172 mm)</strong> para calcular o rendimento automático na bobina de {largBob} mm.
        </span>
      </div>
    );
  }

  // ── CÁLCULO DE APROVEITAMENTO & RENDIMENTO ──
  const tirasPorPassada = Math.floor(largBob / desenv);
  const larguraUtil = tirasPorPassada * desenv;
  const sobraLateral = largBob - larguraUtil;
  const aproveitamentoPerc = +((larguraUtil / largBob) * 100).toFixed(1);

  // Chapas / passadas necessárias para o total de peças do pedido
  const chapasNecessarias = tirasPorPassada > 0 ? Math.ceil(qtd / tirasPorPassada) : 1;
  const totalTirasGeradas = chapasNecessarias * tirasPorPassada;
  const saldoExcedente = Math.max(0, totalTirasGeradas - qtd);

  // Classificação de eficiência
  const corAproveitamento =
    aproveitamentoPerc >= 85
      ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
      : aproveitamentoPerc >= 70
      ? "text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-red-600 dark:text-red-400 border-red-500/30 bg-red-500/10";

  return (
    <div className="rounded-2xl border-2 border-emerald-500/30 bg-slate-900 text-slate-100 p-3.5 space-y-3 shadow-lg">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400">
            <Scissors className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
              Conferência de Rendimento & Aproveitamento
            </span>
            <span className="text-[11px] text-slate-400">
              Largura da Bobina-Mãe: <strong className="text-white">{largBob} mm</strong> · Tira desenvolvida: <strong className="text-emerald-400">{desenv} mm</strong>
            </span>
          </div>
        </div>

        <Badge className={`text-xs font-mono font-bold px-2.5 py-0.5 border ${corAproveitamento}`}>
          {aproveitamentoPerc}% Aproveitado
        </Badge>
      </div>

      {/* Grid de 4 Métricas Essenciais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">Tiras / Passada</span>
          <span className="text-xl font-black text-emerald-400 font-mono">
            {tirasPorPassada} <span className="text-xs font-normal text-slate-300">tiras</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {larguraUtil} mm úteis
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">Sobra Lateral</span>
          <span className={`text-xl font-black font-mono ${sobraLateral > 200 ? "text-amber-400" : "text-slate-200"}`}>
            {sobraLateral} <span className="text-xs font-normal text-slate-400">mm</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            {sobraLateral === 0 ? "Zero refugo lateral" : "Refugo / Retalho"}
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">Chapas Necessárias</span>
          <span className="text-xl font-black text-blue-400 font-mono">
            {chapasNecessarias} <span className="text-xs font-normal text-slate-300">{chapasNecessarias === 1 ? "chapa" : "chapas"}</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            p/ {qtd} {qtd === 1 ? "peça" : "peças"}
          </span>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-2">
          <span className="text-[10px] text-slate-400 block uppercase font-bold">Saldo / Excedente</span>
          <span className="text-xl font-black text-purple-400 font-mono">
            +{saldoExcedente} <span className="text-xs font-normal text-slate-300">{saldoExcedente === 1 ? "tira" : "tiras"}</span>
          </span>
          <span className="text-[10px] text-slate-400 block mt-0.5">
            Total corte: {totalTirasGeradas} tiras
          </span>
        </div>
      </div>

      {/* Mini Visualizador Gráfico das Tiras na Largura da Bobina */}
      <div className="space-y-1 pt-1">
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span>Esquema de Tiras na Bobina de {largBob} mm:</span>
          <span>{tirasPorPassada} × {desenv} mm + {sobraLateral} mm sobra</span>
        </div>
        <div className="w-full h-5 bg-slate-950 rounded-lg p-0.5 flex gap-0.5 border border-slate-700/80 overflow-hidden">
          {Array.from({ length: tirasPorPassada }).map((_, i) => (
            <div
              key={i}
              style={{ width: `${(desenv / largBob) * 100}%` }}
              className="h-full bg-emerald-500/80 hover:bg-emerald-400 transition-colors rounded-xs flex items-center justify-center text-[9px] font-mono font-bold text-slate-900"
              title={`Tira ${i + 1}: ${desenv} mm`}
            >
              {i + 1}
            </div>
          ))}
          {sobraLateral > 0 && (
            <div
              style={{ width: `${(sobraLateral / largBob) * 100}%` }}
              className="h-full bg-amber-500/30 border border-dashed border-amber-500/50 rounded-xs flex items-center justify-center text-[8px] font-mono text-amber-300"
              title={`Sobra/Refugo Lateral: ${sobraLateral} mm`}
            >
              sobra
            </div>
          )}
        </div>
      </div>

      {comp > 0 && (
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800">
          <span className="flex items-center gap-1">
            <Ruler className="w-3.5 h-3.5 text-blue-400" />
            Comprimento da Barra: <strong className="text-slate-200">{comp} mm ({(comp / 1000).toFixed(2)} m)</strong>
          </span>
          <span>
            Metragem Total: <strong className="text-emerald-400">{((qtd * comp) / 1000).toFixed(1)} m</strong>
          </span>
        </div>
      )}
    </div>
  );
}
