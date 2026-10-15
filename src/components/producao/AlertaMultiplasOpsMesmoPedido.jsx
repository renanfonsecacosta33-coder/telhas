import React from "react";
import { AlertTriangle } from "lucide-react";

const STATUS_LABEL = {
  pendente: "Pendente",
  em_producao: "Em produção",
  pausado: "Pausado",
  aguardando_colagem: "Aguardando colagem",
  aguardando_material: "Sem material",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

function normalizarNum(num) {
  return String(num || "").trim().replace(/^#/, "").toUpperCase();
}

function resumoMedidas(op) {
  const qtd = Number(op.metros || op.quantidade_telhas || 0);
  let vars = [];
  try { vars = JSON.parse(op.variacoes_telhas || "[]"); } catch { vars = []; }
  if (Array.isArray(vars) && vars.length > 0) {
    const totalPecas = vars.reduce((s, v) => s + (Number(v.qty) || 0), 0);
    return `${totalPecas.toLocaleString("pt-BR")} pçs · ${vars.length} medida(s)`;
  }
  const mm = Number(op.metragem_mm || 0);
  const qtdFmt = qtd > 0 ? `${qtd.toLocaleString("pt-BR")} pçs x` : "";
  const mmFmt = mm > 0 ? ` ${mm.toLocaleString("pt-BR")}mm` : "";
  return `${qtdFmt}${mmFmt}`.trim() || "Ver detalhes na OP";
}

/**
 * Alerta ao operador quando o mesmo número de pedido (ex: #S01286) possui
 * mais de uma OP / modelo de telha distinto na fila (mesma máquina ou não).
 */
export default function AlertaMultiplasOpsMesmoPedido({ pedido, todosPedidos = [] }) {
  const numAtual = normalizarNum(pedido?.numero_pedido);
  if (!numAtual) return null;

  const irmas = todosPedidos.filter(op => {
    if (!op || op.id === pedido.id) return false;
    if (normalizarNum(op.numero_pedido) !== numAtual) return false;
    return op.status !== "cancelado";
  });

  if (irmas.length === 0) return null;

  const pendentes = irmas.filter(op => op.status !== "finalizado");

  return (
    <div className="mb-3 rounded-xl border-2 border-amber-500/50 bg-amber-500/10 px-3 py-2.5 flex flex-col gap-2">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-black text-amber-900 dark:text-amber-200 leading-tight">
            Atenção: esta OP possui {irmas.length} outro(s) modelo(s) de telha no mesmo pedido #{numAtual}
          </p>
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mt-0.5">
            {pendentes.length > 0
              ? `Ainda falta(m) ${pendentes.length} OP(s) deste pedido para ser(em) tirada(s). Confira abaixo antes de dar o pedido como concluído.`
              : "Os demais modelos deste pedido já foram finalizados."}
          </p>
        </div>
        <span className="ml-auto shrink-0 px-2.5 py-1 rounded-full text-xs font-black bg-amber-500 text-white shadow-sm">
          OP {1 + irmas.length}x
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {irmas.map(op => (
          <span
            key={op.id}
            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-bold border ${
              op.status === "finalizado"
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : "bg-white text-slate-700 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700"
            }`}
            title={`Máquina: ${op.maquina || "?"}`}
          >
            {op.maquina && op.maquina !== pedido.maquina && (
              <span className="font-black text-amber-700 dark:text-amber-400">[{op.maquina}]</span>
            )}
            {resumoMedidas(op)}
            <span className="opacity-70">· {STATUS_LABEL[op.status] || op.status}</span>
          </span>
        ))}
      </div>
    </div>
  );
}