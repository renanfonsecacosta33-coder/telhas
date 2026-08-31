import React from "react";
import { Factory, Scissors, Wind, Layers, Ruler, ClipboardList } from "lucide-react";
import { stripHtml } from "@/lib/stripHtml";

// Config visual por categoria — cores conforme spec:
// 🔧 C&D → LARANJA (#FF6B00) | 🏠 Telha → DOURADO (#FFD700) | 🔩 Avulso → CINZA (#888)
// Frisada mantém teal (categoria existente, não alterada pelo request).
const CATEGORIA_CFG = {
  telha: {
    label: "🏠 Telha",
    Icon: Factory,
    border: "border-l-[#FFD700]",
    qtdBg: "bg-[#FFD700]",
    qtdText: "text-black",
    chip: "bg-[#FFD700] text-black border-[#FFD700]",
  },
  cd: {
    label: "✂️ C&D",
    Icon: Scissors,
    border: "border-l-[#FF6B00]",
    qtdBg: "bg-[#FF6B00]",
    qtdText: "text-white",
    chip: "bg-[#FF6B00] text-white border-[#FF6B00]",
  },
  frisada: {
    label: "🌬️ Frisada",
    Icon: Wind,
    border: "border-l-teal-400",
    qtdBg: "bg-teal-500",
    qtdText: "text-white",
    chip: "bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30",
  },
  avulso: {
    label: "🔩 Avulso",
    Icon: Layers,
    border: "border-l-[#888888]",
    qtdBg: "bg-[#888888]",
    qtdText: "text-white",
    chip: "bg-[#888888] text-white border-[#888888]",
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
// Layout de alto contraste: quantidade GIGANTE em badge sólida colorida + instrução do vendedor em itálico azul.
export default function PedidoItensLista({ itensJson }) {
  let itens = [];
  try {
    const arr = JSON.parse(itensJson || "[]");
    itens = Array.isArray(arr) ? arr : [];
  } catch {
    itens = [];
  }
  if (itens.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Itens do Pedido ({itens.length})
      </span>
      <div className="flex flex-col gap-2">
        {itens.map((it, idx) => {
          const g = detectarCategoria(it);
          const cfg = CATEGORIA_CFG[g] || CATEGORIA_CFG.avulso;
          const { Icon: BIcon } = cfg;
          const desc = stripHtml(it.descricao || it.produto || "Item sem descrição");
          const produtoLimpo = stripHtml(it.produto);
          const obs = stripHtml(it.observacao || "");
          const qtd = it.quantidade;
          const unidade = (it.unidade || "").trim() || "peças";
          const esp = it.espessura || it.chapa;

          return (
            <div
              key={idx}
              className={`flex items-center gap-2.5 rounded-lg border-l-4 ${cfg.border} bg-white dark:bg-slate-900 px-3 py-2`}
            >
              <BIcon className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
              <div className="min-w-0 flex-1">
                {/* Linha 1: Produto (negrito) + badge de categoria */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
                    {produtoLimpo || desc}
                  </p>
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${cfg.chip}`}>
                    {cfg.label}
                  </span>
                </div>

                {/* Observação do item (itálico azul) — só se diferente do produto */}
                {obs && obs !== produtoLimpo && (
                  <div className="flex items-start gap-1 mt-1">
                    <ClipboardList className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                    <p className="text-xs italic text-sky-700 dark:text-sky-300 leading-snug break-words">
                      {obs}
                    </p>
                  </div>
                )}

                {/* Linha 2: Instrução/Descrição do vendedor (itálico azul) */}
                {desc && desc !== produtoLimpo && (
                  <div className="flex items-start gap-1 mt-1">
                    <ClipboardList className="w-3.5 h-3.5 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
                    <p className="text-xs italic text-sky-700 dark:text-sky-300 leading-snug break-words">
                      {desc}
                    </p>
                  </div>
                )}

                {/* Linha 3: Espessura + Medida (destaque secundário) */}
                {(esp || it.medida) && (
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {esp && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        <Layers className="w-3 h-3" /> {esp}mm
                      </span>
                    )}
                    {it.medida && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                        <Ruler className="w-3 h-3" /> {it.medida}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Coluna direita: QUANTIDADE em badge sólida colorida por categoria */}
              {qtd != null && (
                <div className="shrink-0 flex flex-col items-center justify-center min-w-[56px]">
                  <span className={`text-2xl sm:text-3xl font-black leading-none px-2 py-0.5 rounded-md ${cfg.qtdBg} ${cfg.qtdText}`}>
                    {qtd}
                  </span>
                  <span className="text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mt-0.5">
                    {unidade}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}