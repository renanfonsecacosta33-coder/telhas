import React from "react";
import { Badge } from "@/components/ui/badge";
import { FileText, Layers, Scale, Scissors, Wrench, Package, Sparkles } from "lucide-react";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";

/**
 * Classifica se a ordem de Corte & Dobra é uma CHAPA LISA ou BARRA (Perfil Dobrado)
 * e calcula as duas métricas principais: Chapas/Barras e KG de forma 100% segura.
 */
export function classificarItemCorteDobra(ordem, specTecOverride = null) {
  const o = ordem || {};
  const textoCompleto = [
    o.observacoes,
    o.tipo_peca,
    o.dimensoes_livres,
    o.especificacoes_tecnicas
  ].filter(Boolean).join(" ");

  let spec = specTecOverride;
  if (!spec) {
    try {
      spec = extrairEspecificacao(textoCompleto, o.quantidade, o.unidade);
    } catch {
      spec = null;
    }
  }

  // 1. Verifica roteiro de máquinas
  let maquinas = [];
  try {
    if (Array.isArray(o.roteiro_maquinas)) {
      maquinas = o.roteiro_maquinas;
    } else if (typeof o.roteiro_maquinas === "string" && o.roteiro_maquinas.trim().startsWith("[")) {
      maquinas = JSON.parse(o.roteiro_maquinas);
    }
  } catch {}

  if (!Array.isArray(maquinas)) maquinas = [];

  // Normaliza cada elemento para string garantida
  maquinas = maquinas.map(m => {
    if (!m) return "";
    if (typeof m === "string") return m.trim();
    if (typeof m === "object") return m.nome || m.maquina || m.label || "";
    return String(m || "").trim();
  }).filter(Boolean);

  const maquinaAtualUpper = String(o.maquina || o.maquina_inicial || "").toUpperCase();
  const isMaquinaDobra = maquinaAtualUpper.includes("DOBRA");
  const isMaquinaCorteOuDesb = maquinaAtualUpper.includes("DESBOBINADEIRA") || maquinaAtualUpper.includes("CORTE") || maquinaAtualUpper.includes("GUILHOTINA");

  const textoChapa = /(?:chapa|blank)/i.test(textoCompleto);
  const textoTemDobra = /(?:dobr|perfil|cantoneira|calha|cartola|degrau|pingadeira|rufo|\bl\b|\bu\b)/i.test(textoCompleto);

  // 🛡️ Regra aprovada: No Desbobinador e Guilhotina é sempre CHAPA (ex: 10 Chapas).
  // Só vira BARRA/PERFIL quando a ordem estiver fisicamente na Dobradeira!
  const isPerfilDobrado = isMaquinaDobra ? true : (isMaquinaCorteOuDesb ? false : (textoTemDobra && !textoChapa));
  const isChapaLisa = !isPerfilDobrado;

  const tipoMetrica = isChapaLisa ? "chapa" : "barra";
  const labelMetrica = isChapaLisa ? "Chapas" : "Barras";

  // Quantidade de peças / chapas
  let qtdPecas = Number(
    o.quantidade_pecas ||
    spec?.pecas ||
    (o.unidade !== "KG" && o.quantidade ? Number(o.quantidade) : null) ||
    spec?.quantidade ||
    (o.quantidade && Number(o.quantidade) <= 500 ? Number(o.quantidade) : 1)
  );
  if (isNaN(qtdPecas) || qtdPecas <= 0) qtdPecas = 1;

  // Peso em KG
  const isKg = String(o.unidade || "").toUpperCase() === "KG";
  let pesoKg = Number(o.peso_kg || o.kg_estimado || (isKg ? o.quantidade : null)) || 0;

  // Se não tem peso gravado, estima com base nas dimensões
  if (!pesoKg || pesoKg <= 0) {
    const compM = (Number(spec?.comprimento_mm) || Number(o.comprimento_mm) || 3000) / 1000;
    const largM = (Number(spec?.largura_mm) || Number(spec?.desenvolvimento_mm) || Number(o.largura_mm) || 1200) / 1000;
    const espNum = Number(spec?.espessura_mm) || parseFloat(String(o.espessura_utilizada || o.material_espessura || "1.95").replace(",", ".")) || 1.95;
    pesoKg = Math.round(compM * largM * espNum * 7.85 * (qtdPecas || 1));
  }
  if (isNaN(pesoKg) || pesoKg < 0) pesoKg = 0;

  // Medidas formatadas
  let medidaFmt = spec?.dimensoes_fmt || o.dimensoes_livres || "";
  if (isChapaLisa && spec?.largura_mm && spec?.comprimento_mm) {
    medidaFmt = `${spec.largura_mm} × ${spec.comprimento_mm} mm`;
  }

  return {
    isChapaLisa,
    isPerfilDobrado,
    tipoMetrica,
    labelMetrica,
    qtdPecas,
    pesoKg,
    medidaFmt,
    spec,
    maquinas
  };
}

/**
 * Banner de Instrução e Especificação de Alta Visibilidade para TODAS as máquinas de Corte & Dobra
 * Destaca a instrução/descrição do vendedor e as duas métricas principais: CHAPA / BARRA e KG.
 */
export default function BannerInstrucaoCorteDobra({ ordem, specTec = null, className = "" }) {
  if (!ordem) return null;

  try {
    const {
      isChapaLisa,
      labelMetrica,
      qtdPecas,
      pesoKg,
      medidaFmt,
      spec,
      maquinas
    } = classificarItemCorteDobra(ordem, specTec);

    const descricaoTexto = ordem.observacoes || spec?.resumo_formatado || ordem.tipo_peca || "";

    return (
      <div
        className={`rounded-2xl border-2 p-3.5 mb-3 transition-all shadow-xs ${
          isChapaLisa
            ? "bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-400/80 dark:border-amber-500/60 text-amber-950 dark:text-amber-100"
            : "bg-gradient-to-r from-indigo-500/10 via-blue-400/5 to-purple-500/10 border-indigo-400/80 dark:border-indigo-500/60 text-indigo-950 dark:text-indigo-100"
        } ${className}`}
      >
        {/* Linha Superior: Cabeçalho com Tipo de Operação e Medidas */}
        <div className="flex items-center justify-between gap-2 flex-wrap pb-2 border-b border-amber-300/40 dark:border-amber-600/30">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider shadow-2xs ${
                isChapaLisa
                  ? "bg-amber-500 text-white dark:bg-amber-600"
                  : "bg-indigo-600 text-white dark:bg-indigo-700"
              }`}
            >
              {isChapaLisa ? <Scissors className="w-3.5 h-3.5" /> : <Wrench className="w-3.5 h-3.5" />}
              {isChapaLisa ? "Chapa Lisa / Blank" : "Perfil Dobrado (Barra)"}
            </span>

            {medidaFmt && (
              <span className="font-mono font-black text-sm px-2.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-current shadow-2xs">
                📐 {medidaFmt}
              </span>
            )}

            {/* Espessura da Chapa Exigida pelo Pedido em Destaque Absoluto */}
            {(() => {
              const espExigida = ordem.espessura_exigida || ordem.material_espessura || (spec?.espessura_mm ? String(spec.espessura_mm) : null);
              if (espExigida) {
                const espFmt = String(espExigida).replace(".", ",");
                const espBobina = ordem.espessura_utilizada ? String(ordem.espessura_utilizada).replace(".", ",") : null;
                const isDivergente = espBobina && espBobina !== espFmt;
                return (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono font-black text-xs sm:text-sm px-2.5 py-1 rounded-lg bg-orange-600 text-white shadow-xs border border-orange-700 flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5" /> CHAPA: {espFmt} mm
                    </span>
                    {isDivergente && (
                      <span className="font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/40" title="A bobina física montada possui espessura diferente da chapa exigida pelo pedido">
                        ⚠️ Bobina: {espBobina} mm
                      </span>
                    )}
                  </div>
                );
              }
              if (ordem.espessura_utilizada) {
                return (
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/70 text-blue-900 dark:text-blue-200 border border-blue-300 dark:border-blue-700">
                    ⚡ {String(ordem.espessura_utilizada).replace(".", ",")} mm
                  </span>
                );
              }
              return null;
            })()}
          </div>

          {/* As Duas Métricas Principais em Super Evidência */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Métrica 1: Quantidade em Chapas ou Barras */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-black font-mono shadow-xs border ${
                isChapaLisa
                  ? "bg-orange-600 text-white border-orange-700"
                  : "bg-indigo-700 text-white border-indigo-800"
              }`}
            >
              {isChapaLisa ? <Layers className="w-4 h-4" /> : <Package className="w-4 h-4" />}
              <span>
                {qtdPecas} {(labelMetrica || "PEÇAS").toUpperCase()}
              </span>
            </div>

            {/* Métrica 2: Peso Comercial Total em KG */}
            {pesoKg > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs sm:text-sm font-black font-mono bg-emerald-600 text-white border border-emerald-700 shadow-xs">
                <Scale className="w-4 h-4" />
                <span>
                  {(Number(pesoKg) || 0).toLocaleString("pt-BR")} KG
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Linha Central: Descrição / Instrução do Vendedor com Destaque Máximo */}
        {descricaoTexto && (
          <div className="pt-2.5">
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                <FileText className="w-3.5 h-3.5" />
                INSTRUÇÃO:
              </span>
              <p className="text-sm sm:text-base font-extrabold text-foreground leading-snug whitespace-pre-line break-words bg-white/70 dark:bg-slate-900/60 p-2 rounded-xl border border-amber-300/60 dark:border-amber-700/50 flex-1 shadow-2xs">
                {descricaoTexto}
              </p>
            </div>
          </div>
        )}

        {/* Roteiro PCP (se houver etapas definidas) */}
        {Array.isArray(maquinas) && maquinas.length > 0 && (
          <div className="flex items-center gap-1.5 pt-2 text-[11px] text-muted-foreground flex-wrap">
            <span className="font-bold uppercase tracking-wide">Roteiro PCP:</span>
            {maquinas.map((m, idx) => {
              const nomeM = typeof m === "string" ? m : (m?.nome || m?.maquina || String(m || ""));
              const isEtapaAtual = String(nomeM).toUpperCase() === String(ordem.maquina || "").toUpperCase();
              return (
                <React.Fragment key={`${nomeM}-${idx}`}>
                  <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] ${
                    isEtapaAtual
                      ? "bg-orange-500 text-white shadow-2xs"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {idx + 1}º {nomeM}
                  </span>
                  {idx < maquinas.length - 1 && <span>➔</span>}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    );
  } catch (errBanner) {
    console.warn("[BannerInstrucaoCorteDobra] Erro ao renderizar banner:", errBanner);
    return null;
  }
}

