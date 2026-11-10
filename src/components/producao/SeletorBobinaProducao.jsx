import React from "react";
import { Layers, AlertTriangle, Link2, Check } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function rotuloBobina(b) {
  const kg = Number(b?.peso_kg) || 0;
  const esp = b?.chapa || b?.espessura_real || b?.espessura_utilizada || "—";
  return `${b?.codigo || "S/C"} · ${b?.cor || "—"} · ${esp}mm · ${kg.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kg`;
}

export default function SeletorBobinaProducao({
  bobinas = [],
  superiorId,
  inferiorId,
  onSuperior,
  onInferior,
  exigeInferior = false,
  mesma = false,
  onToggleMesma,
}) {
  const semBobinas = bobinas.length === 0;

  return (
    <div className="w-full bg-violet-50 dark:bg-violet-950/30 border-2 border-violet-200 dark:border-violet-800 rounded-2xl p-3 mb-3">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-9 h-9 rounded-xl bg-violet-700 text-white flex items-center justify-center shrink-0 shadow-sm">
          <Layers className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase font-black text-violet-800 dark:text-violet-200 tracking-wider leading-none">
            Bobinas desta OP
          </p>
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            Escolha entre as bobinas abertas
          </p>
        </div>
      </div>

      {semBobinas ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          Nenhuma bobina aberta encontrada. Abra uma bobina no estoque para iniciar esta OP.
        </div>
      ) : (
        <div className={`grid gap-2 ${exigeInferior ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-300 mb-1">
              Chapa Superior
            </p>
            <Select value={superiorId || undefined} onValueChange={onSuperior}>
              <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-violet-300 dark:border-violet-700 font-bold text-xs">
                <SelectValue placeholder="Escolher bobina..." />
              </SelectTrigger>
              <SelectContent>
                {bobinas.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs font-semibold">
                    {rotuloBobina(b)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {exigeInferior && (
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[10px] font-black uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  Chapa Inferior
                </p>
                <button
                  type="button"
                  onClick={onToggleMesma}
                  className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ${
                    mesma
                      ? "bg-violet-700 text-white border-violet-700"
                      : "bg-white dark:bg-slate-900 text-violet-700 dark:text-violet-300 border-violet-300 dark:border-violet-700 hover:bg-violet-100 dark:hover:bg-violet-900/40"
                  }`}
                  title="Usar a mesma bobina da chapa superior"
                >
                  {mesma ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                  Mesma bobina
                </button>
              </div>
              <Select
                value={(mesma ? superiorId : inferiorId) || undefined}
                onValueChange={onInferior}
                disabled={mesma || !superiorId}
              >
                <SelectTrigger className="h-10 bg-white dark:bg-slate-900 border-violet-300 dark:border-violet-700 font-bold text-xs disabled:opacity-60">
                  <SelectValue placeholder={mesma ? "Igual à superior" : "Escolher bobina..."} />
                </SelectTrigger>
                <SelectContent>
                  {bobinas.map((b) => (
                    <SelectItem key={b.id} value={b.id} className="text-xs font-semibold">
                      {rotuloBobina(b)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}