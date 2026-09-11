import React from "react";
import { Factory, Scissors, Wind, Layers, Ruler, ClipboardList, ImageIcon, Sparkles, Home } from "lucide-react";
import { stripHtml } from "@/lib/stripHtml";
import { obterStatusDescritivoItem, extrairAnotacaoItem } from "@/lib/pedidoOdooHelper";
import { extrairCroquiItem, extrairCroquiPedido } from "@/lib/croquiExtractor";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import ImageLink from "@/components/ui/ImageLink";

// Config visual por categoria — cores sincronizadas com o ecossistema AJL:
// 🏠 Fábrica de Telhas → AZUL (#2563EB)
// 🏭 Corte & Dobra    → LARANJA (#EA580C)
// 🌬️ Frisada          → TEAL (#0D9488)
// 🔩 Avulso           → CINZA SLATE (#475569)
const CATEGORIA_CFG = {
  telha: {
    label: "🏠 Fábrica de Telhas",
    curto: "🏠 Telha",
    Icon: Home,
    border: "border-l-blue-600",
    qtdBg: "bg-blue-600",
    qtdText: "text-white",
    chip: "bg-blue-600 text-white border-blue-700 shadow-xs",
    highlightBg: "bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 border-blue-300 dark:border-blue-800",
  },
  cd: {
    label: "🏭 Corte & Dobra",
    curto: "✂️ C&D",
    Icon: Scissors,
    border: "border-l-orange-600",
    qtdBg: "bg-orange-600",
    qtdText: "text-white",
    chip: "bg-orange-600 text-white border-orange-700 shadow-xs",
    highlightBg: "bg-orange-50 dark:bg-orange-950/40 text-orange-800 dark:text-orange-300 border-orange-300 dark:border-orange-800",
  },
  frisada: {
    label: "🌬️ Frisada",
    curto: "🌬️ Frisada",
    Icon: Wind,
    border: "border-l-teal-600",
    qtdBg: "bg-teal-600",
    qtdText: "text-white",
    chip: "bg-teal-600 text-white border-teal-700 shadow-xs",
    highlightBg: "bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800",
  },
  avulso: {
    label: "🔩 Avulso",
    curto: "🔩 Avulso",
    Icon: Layers,
    border: "border-l-slate-400",
    qtdBg: "bg-slate-600",
    qtdText: "text-white",
    chip: "bg-slate-600 text-white border-slate-700 shadow-xs",
    highlightBg: "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300 border-slate-300",
  },
};

// Detecção de categoria: campo explícito → nome do produto → fallback Avulso.
function detectarCategoria(item) {
  const cat = String(item?.categoria || "").trim().toLowerCase();
  if (["telhas", "telha", "bandeja", "bobininha"].includes(cat)) return "telha";
  if (["frisadas", "frisada"].includes(cat)) return "frisada";
  if (["chapa", "perfil", "barra", "tubo", "zincado", "corte e dobra", "corte_dobra"].some((k) => cat.includes(k))) return "cd";

  const nome = String(item?.produto || item?.descricao || "").toLowerCase();
  if (["telha", "tp-", "tp ", "eps", "manta"].some((k) => nome.includes(k))) return "telha";
  if (["chapa", "perfil", "barra", "tubo", "zincado"].some((k) => nome.includes(k))) return "cd";
  return "avulso";
}

// Lista cada item do pedido com cor distinta por categoria.
// Layout de alto contraste: quantidade GIGANTE em badge sólida colorida + barra de progresso individual + processo sanduíche.
export default function PedidoItensLista({ itensJson, pedido, pedidosProducao = [], ordensCD = [], compacto = false }) {
  let itens = [];
  try {
    const arr = JSON.parse(itensJson || "[]");
    itens = Array.isArray(arr) ? arr : [];
  } catch {
    itens = [];
  }
  if (itens.length === 0) return null;

  const numPed = String(pedido?.numero_pedido || "").trim().toUpperCase();
  const opsTelha = (pedidosProducao || []).filter(op =>
    op.numero_pedido && String(op.numero_pedido).trim().toUpperCase() === numPed
  );
  const opsCD = (ordensCD || []).filter(op =>
    op.numero_pedido && String(op.numero_pedido).trim().toUpperCase() === numPed
  );

  return (
    <div className={`flex flex-col ${compacto ? "gap-1" : "gap-1.5"}`}>
      {!compacto && (
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          Itens do Pedido ({itens.length})
        </span>
      )}
      <div className={`flex flex-col ${compacto ? "gap-1.5" : "gap-2"}`}>
        {itens.map((it, idx) => {
          const g = detectarCategoria(it);
          const cfg = CATEGORIA_CFG[g] || CATEGORIA_CFG.avulso;
          const { Icon: BIcon } = cfg;
          const desc = stripHtml(it.descricao || it.produto || "Item sem descrição");
          const produtoLimpo = stripHtml(it.produto);
          const anotacao = extrairAnotacaoItem(it);
          const qtd = it.quantidade;
          const unidade = (it.unidade || "").trim() || "peças";
          const esp = it.espessura || it.chapa;

          // Detecção de produto composto: Telha + EPS + Manta (Sanduíche / Termoacústica)
          const isSanduiche = /(eps|manta|sanduiche|isopor|termoacustica)/i.test(
            String(it.produto || it.descricao || "")
          );

          // Localiza OP real nas máquinas
          let opReal = null;
          if (g === "telha") {
            opReal = opsTelha.find(o =>
              String(o.produto || "").toUpperCase().includes(String(it.produto || "").toUpperCase())
            ) || opsTelha[0];
          } else if (g === "cd") {
            opReal = opsCD.find(o =>
              String(o.produto || "").toUpperCase().includes(String(it.produto || "").toUpperCase())
            ) || opsCD[0];
          }

          // Obtém status descritivo exato para o vendedor e PCP
          const itemInfo = obterStatusDescritivoItem(it, pedido, pedidosProducao, ordensCD);
          const pctItem = itemInfo.pct;
          const statusTexto = itemInfo.status;
          const etapaAtiva = itemInfo.etapaAtiva;

          return (
            <div
              key={idx}
              className={`rounded-lg border-l-4 ${cfg.border} bg-white dark:bg-slate-900 ${compacto ? "px-2.5 py-1.5 gap-1.5" : "px-3 py-2 gap-2"} flex flex-col border border-slate-200/60 dark:border-slate-800`}
            >
              <div className="flex items-start gap-2">
                <BIcon className={`${compacto ? "w-3.5 h-3.5" : "w-4 h-4"} shrink-0 text-slate-500 dark:text-slate-400 mt-0.5`} />
                <div className="min-w-0 flex-1">
                  {/* Linha 1: Produto (negrito) + badge de categoria */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`${compacto ? "text-xs font-bold" : "text-sm font-extrabold"} text-slate-900 dark:text-white leading-tight`}>
                      {produtoLimpo || desc}
                    </p>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.chip}`}>
                      {cfg.label}
                    </span>
                    {isSanduiche && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30">
                        Termoacústica
                      </span>
                    )}
                  </div>

                  {/* Especificação técnica inteligente extraída da descrição (ex: 50 pçs c/ 2000mm ou 60 peças) */}
                  {(() => {
                    const espTec = extrairEspecificacao(it.descricao || it.observacao, it.quantidade, it.unidade);
                    if (!espTec.tem_especificacao || !espTec.resumo_formatado) return null;
                    return (
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md border ${cfg.highlightBg} shadow-xs`}>
                          <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                          <span>{espTec.resumo_formatado}</span>
                        </span>
                      </div>
                    );
                  })()}

                  {/* Anotação/Observação real do vendedor (itálico azul) — limpa de repetições do produto */}
                  {anotacao && (
                    <div className="flex items-start gap-1 mt-1">
                      <ClipboardList className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                      <p className="text-xs italic text-sky-700 dark:text-sky-300 leading-snug break-words">
                        {anotacao}
                      </p>
                    </div>
                  )}

                  {/* Linha 3: Espessura + Medida */}
                  {(esp || it.medida) && (
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {esp && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                          <Layers className="w-2.5 h-2.5" /> {esp}mm
                        </span>
                      )}
                      {it.medida && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                          <Ruler className="w-2.5 h-2.5" /> {it.medida}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Imagem/Croqui do Item (específico da linha do Odoo com fallback p/ foto do pedido) */}
                {(() => {
                  const itemCroqui = extrairCroquiItem(it) || extrairCroquiPedido(pedido);
                  if (!itemCroqui) return null;
                  return (
                    <div className="shrink-0 flex items-center justify-center">
                      <ImageLink url={itemCroqui} name={produtoLimpo || desc}>
                        <img
                          src={itemCroqui}
                          alt="Croqui do item"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            if (e.currentTarget.src && e.currentTarget.src.includes("/web/content/")) {
                              e.currentTarget.src = e.currentTarget.src.replace("/web/content/", "/web/image/");
                            }
                          }}
                          className={`${compacto ? "w-9 h-9 rounded-md" : "w-12 h-12 sm:w-14 sm:h-14 rounded-lg"} object-cover border-2 border-slate-300 dark:border-slate-700 shadow-sm hover:scale-105 transition-transform`}
                        />
                      </ImageLink>
                    </div>
                  );
                })()}

                {/* Coluna direita: QUANTIDADE em badge sólida colorida por categoria */}
                {qtd != null && (
                  <div className={`shrink-0 flex flex-col items-center justify-center ${compacto ? "min-w-[40px]" : "min-w-[56px]"}`}>
                    <span className={`${compacto ? "text-lg font-black px-1.5 py-0.5" : "text-2xl sm:text-3xl font-black px-2 py-0.5"} leading-none rounded-md ${cfg.qtdBg} ${cfg.qtdText}`}>
                      {qtd}
                    </span>
                    <span className="text-[8px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-0.5">
                      {unidade}
                    </span>
                  </div>
                )}
              </div>

              {/* Roteamento de Etapas para Telha Sanduíche (Telha + EPS + Manta) */}
              {isSanduiche && (
                <div className="mt-1 pt-1.5 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1 flex-wrap text-[10px]">
                  <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                    etapaAtiva > 1 ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30" :
                    pctItem >= 50 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 animate-pulse" :
                    "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}>
                    {etapaAtiva > 1 ? "✓" : "1."} Tirar Telha
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">➔</span>
                  <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                    etapaAtiva > 2 ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30" :
                    etapaAtiva === 2 ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/40 animate-pulse" :
                    "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}>
                    {etapaAtiva > 2 ? "✓" : "2."} Cortar EPS/Manta
                  </span>
                  <span className="text-slate-300 dark:text-slate-600">➔</span>
                  <span className={`px-2 py-0.5 rounded font-bold flex items-center gap-1 ${
                    etapaAtiva === 4 ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30" :
                    etapaAtiva === 3 ? "bg-purple-500/20 text-purple-700 dark:text-purple-300 border border-purple-500/40 animate-pulse" :
                    "bg-slate-100 dark:bg-slate-800 text-slate-400"
                  }`}>
                    {etapaAtiva === 4 ? "✓" : "3."} Colagem
                  </span>
                </div>
              )}

              {/* BARRA DE PROGRESSO INDIVIDUAL POR ITEM */}
              <div className="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex flex-col gap-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                    <span>Progresso do Item:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{statusTexto}</span>
                  </span>
                  <span className={`font-black ${
                    pctItem >= 100
                      ? "text-emerald-600"
                      : g === "telha"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-orange-600"
                  }`}>
                    {pctItem}%
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      pctItem >= 100
                        ? "bg-emerald-500"
                        : g === "telha"
                        ? "bg-gradient-to-r from-amber-400 to-amber-500"
                        : "bg-gradient-to-r from-orange-500 to-amber-500"
                    }`}
                    style={{ width: `${pctItem}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}