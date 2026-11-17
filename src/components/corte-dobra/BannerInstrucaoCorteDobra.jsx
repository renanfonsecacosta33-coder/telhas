import React from "react";
import { Badge } from "@/components/ui/badge";
import { FileText, Layers, Scale, Scissors, Wrench, Package, Sparkles } from "lucide-react";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";

/**
 * Extrai a instrução real e limpa do vendedor vinda do Odoo/PCP,
 * preservando todas as linhas de observação e especificações (sem truncar).
 */
export function extrairInstrucaoLimpaVendedor(ordem, pedidoOdoo = null) {
  if (!ordem && !pedidoOdoo) return "";
  const o = ordem || {};

  const itemOdoo = pedidoOdoo?.itens?.[o.item_idx ?? 0] || pedidoOdoo?.itens?.[0] || null;

  const nomeProd = String(
    itemOdoo?.produto || o.tipo_peca || o.produto || ""
  ).trim().toUpperCase();

  const linhasSet = new Set();
  const linhasColetadas = [];

  const adicionarLinha = (linha) => {
    if (!linha || typeof linha !== "string") return;
    let l = linha.replace(/<[^>]*>/g, " ").trim();
    if (!l) return;

    // Desempacota prefixos como "Instrução: ..." ou "Anotação: ..." se existirem
    const matchInst = l.match(/^(?:instru[çc][aã]o|anota[çc][aã]o)\s*:\s*(.+)$/i);
    if (matchInst && matchInst[1]?.trim()) {
      l = matchInst[1].trim();
    }

    // Filtra metadados internos de roteamento do sistema
    const upper = l.toUpperCase();
    if (
      upper.startsWith("UNIDADE:") ||
      upper.startsWith("ROTEIRO PCP:") ||
      upper.startsWith("AUTO-ROTEADO") ||
      upper.startsWith("FINALIZADO JUNTO") ||
      upper.startsWith("RETOMADA:") ||
      upper.startsWith("PAUSA:") ||
      upper.startsWith("MODO DIRETO") ||
      upper.startsWith("STATUS:") ||
      upper.startsWith("ENTREGA:")
    ) {
      return;
    }

    // Não repete o próprio nome do produto como instrução
    if (upper === nomeProd) return;

    const chaveNorm = upper.replace(/\s+/g, " ");
    if (!linhasSet.has(chaveNorm)) {
      linhasSet.add(chaveNorm);
      linhasColetadas.push(l);
    }
  };

  const processarTextoEmLinhas = (txt) => {
    if (!txt || typeof txt !== "string") return;
    // Divide primeiro por pipe "|" (separador de metadados do roteador)
    const blocos = txt.split(/\s*\|\s*/);
    for (const bloco of blocos) {
      const bTrim = bloco.trim();
      if (!bTrim) continue;
      // Se o bloco inteiro for metadado do sistema, descarta
      const bUpper = bTrim.toUpperCase();
      if (
        bUpper.startsWith("UNIDADE:") ||
        bUpper.startsWith("ROTEIRO PCP:") ||
        bUpper.startsWith("AUTO-ROTEADO") ||
        bUpper.startsWith("FINALIZADO JUNTO") ||
        bUpper.startsWith("RETOMADA:") ||
        bUpper.startsWith("PAUSA:") ||
        bUpper.startsWith("MODO DIRETO")
      ) {
        continue;
      }
      // Divide por quebras de linha dentro do bloco mantendo todas as linhas
      const subLinhas = bTrim.split(/\r?\n/);
      for (const sl of subLinhas) {
        adicionarLinha(sl);
      }
    }
  };

  // 1. Textos vindos do Item do Odoo ERP (Fonte mais fiel da especificação técnica do vendedor)
  if (itemOdoo) {
    processarTextoEmLinhas(itemOdoo.descricao);
    processarTextoEmLinhas(itemOdoo.observacao);
  }

  // 2. Anotação expressa do vendedor na venda ou na OP
  if (o.observacao_vendedor) {
    processarTextoEmLinhas(o.observacao_vendedor);
  }
  if (pedidoOdoo?.observacao_vendedor) {
    processarTextoEmLinhas(pedidoOdoo.observacao_vendedor);
  }
  if (o.instrucao) {
    processarTextoEmLinhas(o.instrucao);
  }

  // 3. Textos gravados nas observações ou descrição da OP
  processarTextoEmLinhas(o.observacoes);
  processarTextoEmLinhas(o.descricao);
  if (pedidoOdoo?.observacoes) {
    processarTextoEmLinhas(pedidoOdoo.observacoes);
  }

  return linhasColetadas.join("\n").trim();
}

/**
 * Extrai o Nome Oficial do Produto do Odoo ERP (sem substituir por genéricos como "Chapa Lisa / Blank" ou "Chapa Cortada")
 */
export function extrairNomeProdutoOficial(ordem, spec = null, pedidoOdoo = null) {
  if (!ordem && !pedidoOdoo) return "Corte & Dobra";
  const o = ordem || {};

  const NOMES_GENERICOS = new Set([
    "CHAPA LISA / BLANK",
    "BLANK / CHAPA CORTADA",
    "CORTE & DOBRA",
    "CORTE E DOBRA",
    "CHAPA",
    "BLANK",
    "CHAPA CORTADA",
    "CHAPA LISA",
    "—",
    "-"
  ]);

  // Se houver pedidoOdoo vinculado, busca o item correspondente à OF
  const itemOdoo = pedidoOdoo?.itens?.[o.item_idx ?? 0] || pedidoOdoo?.itens?.[0] || null;

  const candidatos = [
    itemOdoo?.produto,
    itemOdoo?.name,
    pedidoOdoo?.produto,
    o.item_produto,
    o.produto_nome,
    o.produto,
    o.descricao_odoo,
    o.tipo_peca,
    o.descricao
  ];

  for (const c of candidatos) {
    if (!c) continue;
    const str = String(c).trim();
    const upper = str.toUpperCase();
    if (NOMES_GENERICOS.has(upper)) {
      continue;
    }
    return str;
  }

  if (spec?.tipo_label && !NOMES_GENERICOS.has(String(spec.tipo_label).trim().toUpperCase())) {
    return spec.tipo_label;
  }
  return o.tipo_peca || o.produto || "Chapa Cortada";
}

/**
 * Classifica se a ordem de Corte & Dobra é uma CHAPA LISA ou BARRA (Perfil Dobrado)
 * e calcula as duas métricas principais: Chapas/Barras e KG de forma 100% segura.
 *
 * 🛡️ REGRA AJL ANTI-CONFUSÃO MEDIDA (MM) X QUANTIDADE:
 * - Em 1277 x 3000 mm, 1277 é estritamente LARGURA e 3000 COMPRIMENTO, NUNCA quantidade de peças!
 * - A quantidade vem da contagem explícita na anotação ou de qtdOdoo (se UN/PC).
 * - Se vendido em KG no Odoo, calcula: KG / peso_unitario_teorico (Largura x Comp x Esp x 7.85).
 */
export function classificarItemCorteDobra(ordem, specTecOverride = null, pedidoOdoo = null) {
  const o = ordem || {};
  const textoCompleto = [
    o.tipo_peca,
    o.produto,
    o.descricao,
    o.observacoes,
    o.dimensoes_livres,
    o.especificacoes_tecnicas
  ].filter(Boolean).join(" ");

  const unidadeNorm = String(o.unidade || "").toUpperCase();
  const isKg = unidadeNorm === "KG" || unidadeNorm === "KGS";

  let spec = specTecOverride;
  if (!spec) {
    try {
      spec = extrairEspecificacao(textoCompleto, o.quantidade, o.unidade);
    } catch {
      spec = null;
    }
  }

  // 1. Roteiro de máquinas
  let maquinas = [];
  try {
    if (Array.isArray(o.roteiro_maquinas)) {
      maquinas = o.roteiro_maquinas;
    } else if (typeof o.roteiro_maquinas === "string" && o.roteiro_maquinas.trim().startsWith("[")) {
      maquinas = JSON.parse(o.roteiro_maquinas);
    }
  } catch {}

  if (!Array.isArray(maquinas)) maquinas = [];
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

  // No Desbobinador e Guilhotina é sempre CHAPA (ex: 10 Chapas).
  // Só vira BARRA/PERFIL quando a ordem estiver fisicamente na Dobradeira!
  const isPerfilDobrado = isMaquinaDobra ? true : (isMaquinaCorteOuDesb ? false : (textoTemDobra && !textoChapa));
  const isChapaLisa = !isPerfilDobrado;

  const tipoMetrica = isChapaLisa ? "chapa" : "barra";
  const labelMetrica = isChapaLisa ? "Chapas" : "Barras";

  // Dimensões físicas para cálculo de peso teórico
  const largMm = Number(spec?.largura_mm || o.largura_mm || 0);
  const compMm = Number(spec?.comprimento_mm || o.comprimento_mm || 3000);
  const espNum = Number(spec?.espessura_mm) ||
    parseFloat(String(o.espessura_utilizada || o.espessura_exigida || o.material_espessura || "0.65").replace(",", ".")) ||
    0.65;

  const largM = (largMm > 0 ? largMm : 1200) / 1000;
  const compM = (compMm > 0 ? compMm : 3000) / 1000;
  const pesoUnitarioTeorico = +(largM * compM * espNum * 7.85).toFixed(2);

  // 2. Determinação Rigorosa da Quantidade de Peças e Peso em KG
  let qtdPecas = null;
  let pesoKg = null;

  // Primeiro: contagem explícita na anotação/observações (ex: "10 peças", "5 chapas", "4 barras")
  const matchPecasTexto = textoCompleto.match(/\b(\d+)\s*(?:p[çc]s?\.?|pe[çc]as?|pcas?|pecas?|chapas?|barras?|unidades?|un\.?|pc\.?)\b/i);
  if (matchPecasTexto) {
    const n = parseInt(matchPecasTexto[1], 10);
    // Validação anti-bug: não pode ser igual à largura (ex: 1277) ou absurdo (> 500)
    if (n > 0 && n !== largMm && n <= 500) {
      qtdPecas = n;
    }
  }

  // Segundo: peso gravado na OP (com filtro de sanidade para descartar corrupção > 50.000 kg)
  const pesoGravado = Number(o.peso_kg || o.kg_estimado || (isKg ? o.quantidade : null)) || 0;
  if (pesoGravado > 0 && pesoGravado <= 50000) {
    pesoKg = pesoGravado;
  }

  // Terceiro: Se vendido em KG no Odoo
  if (isKg && pesoKg && pesoKg > 0) {
    if (!qtdPecas && pesoUnitarioTeorico > 0) {
      const calculadas = Math.max(1, Math.round(pesoKg / pesoUnitarioTeorico));
      qtdPecas = calculadas <= 500 ? calculadas : 1;
    }
  }

  // Quarto: Se não for em KG, a quantidade vem do campo quantidade do Odoo
  if (!qtdPecas) {
    const rawQtd = Number(o.quantidade_pecas || (unidadeNorm !== "KG" && o.quantidade ? Number(o.quantidade) : null) || spec?.pecas);
    if (rawQtd && rawQtd > 0 && rawQtd !== largMm && rawQtd <= 500) {
      qtdPecas = rawQtd;
    }
  }

  // Fallback seguro se ainda for nulo, igual à largura ou absurdo
  if (!qtdPecas || isNaN(qtdPecas) || qtdPecas <= 0 || (isChapaLisa && qtdPecas === largMm) || qtdPecas > 500) {
    if (pesoKg && pesoKg > 0 && pesoUnitarioTeorico > 0) {
      qtdPecas = Math.max(1, Math.round(pesoKg / pesoUnitarioTeorico));
      if (qtdPecas > 500) qtdPecas = 1;
    } else {
      qtdPecas = 1;
    }
  }

  // Cálculo final do peso em KG se não estiver gravado ou corrompido
  if (!pesoKg || pesoKg <= 0 || pesoKg > 50000) {
    pesoKg = Math.round(pesoUnitarioTeorico * qtdPecas);
  }

  // Medidas formatadas
  let medidaFmt = spec?.dimensoes_fmt || o.dimensoes_livres || "";
  if (isChapaLisa && largMm && compMm) {
    medidaFmt = `${largMm} × ${compMm} mm`;
  }

  const nomeProduto = extrairNomeProdutoOficial(o, spec, pedidoOdoo);
  const instrucaoVendedor = extrairInstrucaoLimpaVendedor(o, pedidoOdoo);

  return {
    isChapaLisa,
    isPerfilDobrado,
    tipoMetrica,
    labelMetrica,
    qtdPecas,
    pesoKg,
    medidaFmt,
    nomeProduto,
    instrucaoVendedor,
    spec,
    maquinas
  };
}

/**
 * Banner de Instrução e Especificação de Alta Visibilidade para TODAS as máquinas de Corte & Dobra
 * Padrão Telhas: Título Oficial do ERP no topo, Badges de Qtd/Peso no canto direito, e Instrução do Vendedor em destaque.
 */
export default function BannerInstrucaoCorteDobra({ ordem, specTec = null, pedidoOdoo = null, className = "" }) {
  if (!ordem) return null;

  try {
    const {
      isChapaLisa,
      labelMetrica,
      qtdPecas,
      pesoKg,
      medidaFmt,
      nomeProduto,
      instrucaoVendedor,
      spec,
      maquinas
    } = classificarItemCorteDobra(ordem, specTec, pedidoOdoo);

    return (
      <div
        className={`rounded-2xl border-2 p-3 sm:p-4 mb-3 transition-all shadow-xs ${
          isChapaLisa
            ? "bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-orange-500/10 border-amber-400/80 dark:border-amber-500/60 text-amber-950 dark:text-amber-100"
            : "bg-gradient-to-r from-indigo-500/10 via-blue-400/5 to-purple-500/10 border-indigo-400/80 dark:border-indigo-500/60 text-indigo-950 dark:text-indigo-100"
        } ${className}`}
      >
        {/* Linha Superior: Nome Oficial do Produto (Título Principal) + Badges de Quantidade e Peso */}
        <div className="flex items-start justify-between gap-3 flex-wrap pb-2.5 border-b border-amber-300/40 dark:border-amber-600/30">
          <div className="flex-1 min-w-[260px]">
            {/* 1. Nome Oficial do Produto do ERP (Nunca frases genéricas) */}
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2 flex-wrap leading-snug">
              <span>{nomeProduto}</span>
            </h3>

            {/* Badges de Categoria e Medidas logo abaixo do Título */}
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-black uppercase tracking-wider shadow-2xs ${
                  isChapaLisa
                    ? "bg-amber-500 text-white dark:bg-amber-600"
                    : "bg-indigo-600 text-white dark:bg-indigo-700"
                }`}
              >
                {isChapaLisa ? <Scissors className="w-3 h-3" /> : <Wrench className="w-3 h-3" />}
                {isChapaLisa ? "Chapa Lisa / Blank" : "Perfil Dobrado (Barra)"}
              </span>

              {medidaFmt && (
                <span className="font-mono font-black text-xs px-2.5 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 border border-current shadow-2xs">
                  📐 {medidaFmt}
                </span>
              )}

              {/* Espessura Exigida da Chapa */}
              {(() => {
                const espExigida = ordem.espessura_exigida || ordem.material_espessura || (spec?.espessura_mm ? String(spec.espessura_mm) : null);
                if (!espExigida) return null;
                const espFmt = String(espExigida).replace(".", ",");
                return (
                  <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-orange-500/15 text-orange-900 dark:text-orange-200 border border-orange-400">
                    ⚡ Chapa: {espFmt} mm
                  </span>
                );
              })()}
            </div>
          </div>

          {/* 3. Badges de Quantidade e Peso (Canto Superior Direito) */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Badge de Peças / Chapas / Barras */}
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black font-mono shadow-xs border ${
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

            {/* Badge de Peso em KG */}
            {pesoKg > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-black font-mono bg-emerald-600 text-white border border-emerald-700 shadow-xs">
                <Scale className="w-4 h-4" />
                <span>
                  {Number(pesoKg).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KG
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 2. Descrição / Instrução Real do Vendedor (Verdade Técnica em Destaque) */}
        {instrucaoVendedor && (
          <div className="pt-2.5">
            <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-amber-300 dark:border-amber-700 shadow-2xs">
              <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 shrink-0 mt-0.5">
                <FileText className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                INSTRUÇÃO:
              </span>
              <p className="text-sm sm:text-base font-extrabold italic text-foreground leading-snug whitespace-pre-line break-words flex-1">
                "{instrucaoVendedor}"
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
