import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Layers, Lock, CheckCircle2, Camera, Play } from "lucide-react";
import { format } from "date-fns";

/**
 * Lista as medidas (variações) da OP com as ações por item:
 * iniciar (com conferência de bobina), finalizar (foto + metragem) e reabrir.
 */
export default function ItensVariacoesTelhas({ pedido, iniciarBloqueado = false, onIniciar, onIniciarItem, onFinalizar, onReabrir }) {
  const vars = useMemo(() => {
    let lista = [];
    try { lista = JSON.parse(pedido?.variacoes_telhas || "[]"); } catch { lista = []; }
    return Array.isArray(lista) ? lista : [];
  }, [pedido?.variacoes_telhas]);

  if (vars.length === 0) return null;

  const todosFinalizados = vars.every(v => v.finalizado);
  const finalizadosCount = vars.filter(v => v.finalizado).length;
  const emProducaoCount = vars.filter(v => v.iniciado && !v.finalizado).length;

  return (
    <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl p-3 mb-3 space-y-2.5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <p className="text-xs font-bold text-indigo-700 uppercase tracking-wide flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-600" />
            Medidas do Pedido ({vars.length})
          </p>
          <Badge variant="outline" className="text-[11px] font-bold border-indigo-300 text-indigo-800 bg-white">
            {finalizadosCount}/{vars.length} concluídos
          </Badge>
        </div>

        {todosFinalizados ? (
          <span className="text-xs font-bold text-green-700 bg-green-100 border border-green-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" /> Todos os itens finalizados!
          </span>
        ) : pedido?.status === "pendente" ? (
          <span className="text-xs font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <Lock className="w-3 h-3 text-amber-700" /> Inicie a OP ou um item — o início é encadeado automaticamente
          </span>
        ) : emProducaoCount > 0 ? (
          <span className="text-xs font-bold text-blue-800 bg-blue-100 border border-blue-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" /> {emProducaoCount} item(ns) em produção
          </span>
        ) : null}
      </div>

      {vars.map((v, i) => {
        const q = Number(v.qty) || 0;
        const mm = Number(v.mm) || 0;
        const metrosPlan = q > 0 && mm > 0 ? +((q * mm) / 1000).toFixed(2) : 0;
        const fin = !!v.finalizado;
        const inic = !!v.iniciado;

        return (
          <div
            key={i}
            className={`rounded-xl border p-3 transition-all ${
              fin
                ? "bg-green-50/80 border-green-300 shadow-xs"
                : inic
                ? "bg-blue-50/70 border-blue-400 ring-2 ring-blue-300/50 shadow-sm"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-start gap-2.5 text-xs">
              <span className={`w-5 h-5 rounded-full font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                fin
                  ? "bg-green-600 text-white"
                  : inic
                  ? "bg-blue-600 text-white"
                  : "bg-indigo-100 text-indigo-700"
              }`}>
                {i + 1}
              </span>

              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div>
                    <span className={`font-bold text-sm ${fin ? "text-green-800" : inic ? "text-blue-900" : "text-slate-800"}`}>
                      {q} pçs × {mm.toLocaleString("pt-BR")}mm
                    </span>
                    <span className="text-muted-foreground ml-1 font-medium">
                      (~{metrosPlan.toFixed(2)}m planejado)
                    </span>
                  </div>

                  {fin && (
                    <Badge className="bg-green-600 text-white text-[11px] font-bold">
                      ✓ Finalizado · {(v.metragem_real || metrosPlan).toFixed(1)}m real
                    </Badge>
                  )}
                  {!fin && inic && (
                    <Badge className="bg-blue-600 text-white text-[11px] font-bold animate-pulse">
                      ⚡ Produzindo agora
                    </Badge>
                  )}
                  {!fin && !inic && (
                    <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200">
                      Aguardando Início
                    </Badge>
                  )}
                </div>

                {v.obs && (
                  <div className="pt-0.5">
                    <span className="text-muted-foreground text-[11px] italic">
                      OBS: {v.obs}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-2.5 pt-2 border-t border-slate-200/80">
              {fin ? (
                <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    {[["Foto do Lote", v.foto_item_url], ["Telha Superior", v.foto_etapa1_url], ["Bandeja", v.foto_etapa2_url]].filter(([, url]) => url).map(([label, url]) => (
                      <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white border border-green-300 text-green-800 font-bold hover:bg-green-100 transition-all shadow-xs" title={`Ver foto: ${label}`}>
                        <Camera className="w-3.5 h-3.5 text-green-600" />
                        <img src={url} alt={label} className="w-4 h-4 rounded object-cover border border-green-400" />
                        <span>{label}</span>
                      </a>
                    ))}
                    {v.observacao && (
                      <span className="text-slate-600 bg-white/90 px-2 py-0.5 rounded border border-green-200 text-[11px]">
                        <strong>Obs:</strong> {v.observacao}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onReabrir(i)}
                    className="text-[10px] text-muted-foreground hover:text-red-600 underline font-medium ml-auto"
                  >
                    Reabrir item
                  </button>
                </div>
              ) : inic ? (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-blue-800 font-semibold flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                    Produzindo {v.iniciado_em ? `(desde ${format(new Date(v.iniciado_em), "HH:mm")})` : ""}
                  </span>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white font-bold h-8 text-xs gap-1.5 shadow-sm"
                    onClick={() => onFinalizar(i)}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Finalizar Item {i + 1}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                    <Lock className="w-3 h-3 text-amber-600" />
                    {pedido?.status === "pendente"
                      ? "Use o botão Iniciar da OP — este item inicia junto automaticamente"
                      : "Aguardando o início deste item na sequência da OP"}
                  </span>
                  {pedido?.status !== "pendente" && onIniciarItem && (
                    <Button
                      size="sm"
                      className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-8 text-xs shadow-sm"
                      onClick={() => onIniciarItem(i)}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Conferir Bobina e Iniciar Item {i + 1}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}