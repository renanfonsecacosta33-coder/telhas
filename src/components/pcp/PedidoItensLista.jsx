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
// Layout de alto contraste: quantidade GIGANTE em badge sólida colorida + barra de progresso individual + processo sanduíche.
export default function PedidoItensLista({ itensJson, pedido, pedidosProducao = [], ordensCD = [] }) {
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

          let pctItem = 0;
          let statusTexto = "Pendente";
          let etapaAtiva = 1; // 1: Tirar Telha, 2: Corte EPS, 3: Colagem, 4: Concluído

          if (opReal) {
            if (opReal.status === "finalizado") {
              pctItem = 100;
              statusTexto = "Concluído";
              etapaAtiva = 4;
            } else if (opReal.status === "aguardando_colagem") {
              pctItem = 85;
              statusTexto = isSanduiche ? "Aguardando Colagem" : "Acabamento";
              etapaAtiva = 3;
            } else if (opReal.status === "em_producao") {
              pctItem = 70;
              statusTexto = isSanduiche ? "1ª Etapa: Tirando Telha" : "Em Produção";
              etapaAtiva = 1;
            } else if (opReal.status === "pausado") {
              pctItem = 60;
              statusTexto = "Pausado";
              etapaAtiva = 1;
            } else if (opReal.status === "pendente") {
              pctItem = 50;
              statusTexto = opReal.maquina ? `Na máquina ${opReal.maquina}` : "Na máquina";
              etapaAtiva = 1;
            }
          } else if (it.status === "concluido") {
            pctItem = 100;
            statusTexto = "Concluído";
            etapaAtiva = 4;
          } else if (it.status === "em_producao" || it.maquina) {
            pctItem = 50;
            statusTexto = it.maquina ? `Na máquina ${it.maquina}` : "Em preparação";
            etapaAtiva = 1;
          } else if (pedido?.status_pcp === "distribuido") {
            pctItem = 15;
            statusTexto = "Distribuído";
            etapaAtiva = 1;
          }

          return (
            <div
              key={idx}
              className={`rounded-lg border-l-4 ${cfg.border} bg-white dark:bg-slate-900 px-3 py-2 flex flex-col gap-2 border border-slate-200/60 dark:border-slate-800`}
            >
              <div className="flex items-start gap-2.5">
                <BIcon className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400 mt-0.5" />
                <div className="min-w-0 flex-1">
                  {/* Linha 1: Produto (negrito) + badge de categoria */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
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

                  {/* Linha 3: Espessura + Medida */}
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