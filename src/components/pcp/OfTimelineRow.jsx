import React, { useMemo } from "react";
import { classGrupo, getItens, obterStatusExecucaoPedido } from "@/lib/pedidoOdooHelper";
import { calcularEtapasProcesso } from "@/components/producao/ProcessoStepperPedido";
import { urgenciaPrazo } from "@/lib/prazoUrgencia";
import BadgeEnvio from "@/components/pcp/BadgeEnvioDistribuicao";

/**
 * Linha de Timeline Vertical de uma OF dentro do card expandido do pedido (Central PCP).
 * Trilho com nó circular na cor do setor + informações essenciais + coluna de ações.
 * Leve por design: sem simulação de estoque, stepper visual ou listas de itens —
 * o detalhe completo continua no diálogo ao clicar na linha.
 */

// Cores do nó e do botão principal por setor (Telhas azul, C&D laranja, Frisada teal, Avulso slate)
const COR_SETOR = {
  telha: "#2563eb",
  cd: "#ea580c",
  frisada: "#0d9488",
  avulso: "#64748b",
};

// Pílulas de estado (contrato visual da timeline)
const PILL = {
  amber: "bg-[#f6edda] text-[#72511d] border-[#ead8ad] dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40",
  blue: "bg-[#e1ecf9] text-[#274f77] border-[#c3d8ee] dark:bg-blue-500/15 dark:text-blue-300 dark:border-blue-500/40",
  emerald: "bg-[#e2f2ec] text-[#1f5e46] border-[#c5e2d5] dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40",
};

const BTN_BASE =
  "rounded-[7px] px-2 py-[7px] text-[10px] font-bold cursor-pointer " +
  "transition-[background-color,color,box-shadow,transform] [transition-duration:160ms] " +
  "hover:shadow-[0_4px_10px_#193a3025] active:translate-y-[1px] " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#327361]";
const BTN_SEC =
  "bg-white text-[#41514c] border border-[#d7dfdb] dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700";

export default function OfTimelineRow({
  pedido,
  progressoReal,
  pedidosProducao = [],
  ordensCD = [],
  selecionado = false,
  onToggleSelect,
  onDistribuir,
  onFinalizar100,
  onRetirarFila,
  onClick
}) {
  const diag = useMemo(
    () => obterStatusExecucaoPedido(pedido, pedidosProducao, ordensCD),
    [pedido, pedidosProducao, ordensCD]
  );

  const pct = progressoReal != null ? progressoReal : pedido.percentual_concluido || 0;
  const isConcluido = diag.isConcluido || pct >= 100;
  const urg = urgenciaPrazo(pedido.data_entrega, { concluido: isConcluido });

  const itens = getItens(pedido);
  const grupoSetor = classGrupo(itens[0] || pedido);
  const corSetor = COR_SETOR[grupoSetor] || COR_SETOR.cd;

  // Resumo do item principal (o resto dos itens fica como contagem)
  const primeiro = itens[0];
  const resumoItem = primeiro
    ? `${primeiro.produto || "Item"} — ${primeiro.quantidade ?? "?"} ${primeiro.unidade || ""}`.trim()
    : pedido.descricao || "Sem itens cadastrados";
  const itensExtras = itens.length > 1 ? `  +${itens.length - 1} item(ns)` : "";

  // Descrição/observação dos itens (ex.: "6 PÇ C/ 4400 AMADEIRADA" / "11 pç c/ 1200")
  // para leitura rápida direto na linha da OF, sem precisar abrir os detalhes
  const linhasDescricao = useMemo(() => {
    const linhas = [];
    itens.slice(0, 3).forEach(it => {
      const d = String(it.descricao || it.observacao || "")
        .replace(/<[^>]*>/g, " ")
        .trim();
      if (!d || d === String(it.produto || "").trim()) return;
      d.split(/\n+/).map(l => l.trim()).filter(Boolean).forEach(l => linhas.push(l));
    });
    return Array.from(new Set(linhas)).slice(0, 4);
  }, [itens]);

  // Onde está (mesma lógica de localização do Hero, em formato de texto)
  const posto = (() => {
    if (isConcluido) return "Expedição Final";
    const maqs = (diag.maquinas || []).join(" + ") || "Chão de Fábrica";
    switch (diag.statusChave) {
      case "produzindo_agora": return `Produzindo: ${maqs}`;
      case "pausado": return `Pausado: ${maqs}`;
      case "aguardando_inicio": return `Fila da Máquina: ${maqs}`;
      case "distribuido": return "Fila de Produção (Galpão)";
      default: return "Mesa PCP (Pendente)";
    }
  })();

  // Roteiro de processos como texto corrido
  const roteiro = useMemo(() => {
    const etapas = calcularEtapasProcesso(pedido, grupoSetor === "cd" ? "corte_dobra" : "telhas");
    return etapas.map(e => e.label).join(" → ");
  }, [pedido, grupoSetor]);

  const pillCls = isConcluido
    ? PILL.emerald
    : ["distribuido", "produzindo_agora", "aguardando_inicio"].includes(diag.statusChave)
    ? PILL.blue
    : PILL.amber;

  const podeDistribuir = pedido.status_pcp === "pendente_distribuicao" && onDistribuir;
  const podeRetirar =
    (pedido.status_pcp === "distribuido" || pedido.status_pcp === "em_producao") && onRetirarFila;

  return (
    <div
      onClick={onClick}
      className={`of-card-arrive relative border rounded-[13px] px-4 py-[15px] grid items-center gap-3 shadow-[0_4px_12px_#223a3210] cursor-pointer ${
        isConcluido
          ? "bg-emerald-50/80 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-700"
          : urg?.atrasado
          ? "bg-red-50/70 dark:bg-red-950/25 border-red-300 dark:border-red-900 hover:border-red-400 dark:hover:border-red-800"
          : "bg-white dark:bg-slate-900 border-[#d8e0dc] dark:border-slate-700 hover:border-[#c3cfc9] dark:hover:border-slate-600"
      }`}
      style={{ gridTemplateColumns: "42px minmax(0,1fr) 134px" }}
    >
      {/* Trilho vertical com nó do setor */}
      <div className="relative h-full flex flex-col items-center justify-center">
        <span className="absolute left-1/2 top-1/2 bottom-0 w-0.5 -translate-x-1/2 bg-[#cbd7d1] dark:bg-slate-700" />
        <span
          className="relative z-[1] block w-[17px] h-[17px] rounded-full border-4 border-[#dcebe5] dark:border-slate-600"
          style={{ backgroundColor: corSetor, boxShadow: `0 0 0 1px ${corSetor}` }}
        />
      </div>

      {/* Informações essenciais da OF */}
      <div className="min-w-0 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!selecionado}
              onChange={() => {}}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(pedido);
              }}
              className="w-3.5 h-3.5 rounded text-orange-600 border-slate-300 focus:ring-orange-500 cursor-pointer shrink-0"
              title="Selecionar OF"
            />
          )}
          <span
            className="font-mono text-sm font-extrabold tracking-[.01em] text-[#265f50] dark:text-emerald-300 truncate"
            title={pedido.of_nome || `OF ${pedido.of_odoo_id || ""}`}
          >
            OF: {pedido.of_nome || pedido.of_odoo_id || `#${pedido.numero_pedido}`}
          </span>
          <span className={`text-[10px] font-bold rounded-full px-2 py-1 border ${pillCls}`}>
            {diag.label}
          </span>
          <BadgeEnvio pedidoId={pedido.id} statusPcp={pedido.status_pcp} />
        </div>

        <div className="text-xs leading-[1.35] text-[#34423e] dark:text-slate-300 truncate">
          {resumoItem}
          {itensExtras && <span className="font-semibold text-[#687773] dark:text-slate-500">{itensExtras}</span>}
        </div>

        {linhasDescricao.length > 0 && (
          <div className="text-[10.5px] italic leading-[1.5] text-[#687773] dark:text-slate-500">
            {linhasDescricao.map((l, i) => (
              <span key={i} className="block truncate" title={l}>{l}</span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 items-start">
          <div className="text-[11px] leading-[1.4] text-[#53615d] dark:text-slate-400 truncate">
            Onde está: <strong className="font-semibold">{posto}</strong>
          </div>
          <div className="text-[10px] font-bold text-[#327361] dark:text-emerald-400 whitespace-nowrap">
            Progresso {pct}%
          </div>
        </div>

        <div className="text-[10.5px] leading-[1.45] text-[#687773] dark:text-slate-500 border-t border-[#edf0ee] dark:border-slate-800 pt-[7px] truncate">
          Roteiro {roteiro}
        </div>
      </div>

      {/* Coluna de ações */}
      <div
        className="h-full border-l border-[#e7ece9] dark:border-slate-800 pl-3.5 flex flex-col justify-center gap-[7px]"
        onClick={(e) => e.stopPropagation()}
      >
        {podeDistribuir && (
          <button
            type="button"
            onClick={() => onDistribuir(pedido)}
            className={`${BTN_BASE} text-white border`}
            style={{ backgroundColor: corSetor, borderColor: corSetor, boxShadow: `0 3px 8px ${corSetor}30` }}
            title="Distribuir esta OF para os galpões"
          >
            Distribuir
          </button>
        )}
        <button
          type="button"
          onClick={() => onClick && onClick(pedido)}
          className={`${BTN_BASE} ${BTN_SEC}`}
          title="Ver detalhes técnicos, croquis e checklists desta OF"
        >
          Detalhes
        </button>
        {onFinalizar100 && !isConcluido && (
          <button
            type="button"
            onClick={() => onFinalizar100(pedido)}
            className={`${BTN_BASE} ${BTN_SEC}`}
            title="Marcar esta OF como 100% concluída (exige senha de gestor)"
          >
            Concluir / Já Enviado
          </button>
        )}
        {podeRetirar && (
          <button
            type="button"
            onClick={() => onRetirarFila(pedido)}
            className={`${BTN_BASE} ${BTN_SEC}`}
            title="Devolver esta OF para a fila do PCP"
          >
            Retirar da Fila
          </button>
        )}
      </div>
    </div>
  );
}