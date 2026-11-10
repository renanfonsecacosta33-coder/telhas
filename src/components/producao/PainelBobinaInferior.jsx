import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Layers, Pencil, Check, X } from "lucide-react";

/**
 * Painel da bobina da chapa inferior da telha sanduíche (TELHA + EPS + TELHA).
 * Permite ajustar manualmente o texto da bobina, a cor/RVM e a espessura.
 */
export default function PainelBobinaInferior({
  pedido,
  podeGerenciar,
  bobinaInferiorVisual,
  editandoBobinaInf,
  textoBobinaInf,
  setTextoBobinaInf,
  setEditandoBobinaInf,
  handleSalvarBobinaInf,
  salvandoBobinaInf,
  editandoCorInf,
  setEditandoCorInf,
  textoCorInf,
  setTextoCorInf,
  handleSalvarCorInf,
  salvandoCorInf,
  editandoEspInf,
  setEditandoEspInf,
  textoEspInf,
  setTextoEspInf,
  handleSalvarEspInf,
  salvandoEspInf,
  overrideCorInf,
  overrideEspInf,
  CORES_RAPIDAS,
  ESPESSURAS_RAPIDAS,
}) {
  const p = pedido;

  return (
    <div className="w-full bg-indigo-50/70 dark:bg-indigo-950/40 border-2 border-indigo-200 dark:border-indigo-800 rounded-2xl p-3 sm:p-4 mb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
      <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-indigo-800 text-white flex items-center justify-center shrink-0 shadow-md">
          <Layers className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-300 tracking-wider">
              Bobina da Chapa Inferior (2ª Telha / Sanduíche)
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
              (Automática Odoo · Campo Escrito)
            </span>
          </div>

          {editandoBobinaInf ? (
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap mt-1">
              <Input
                value={textoBobinaInf}
                onChange={(e) => setTextoBobinaInf(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSalvarBobinaInf();
                  if (e.key === "Escape") {
                    setTextoBobinaInf(p.bobina_inferior || "");
                    setEditandoBobinaInf(false);
                  }
                }}
                placeholder="Digite a bobina da chapa inferior..."
                className="h-9 font-mono text-xs sm:text-sm font-bold bg-white dark:bg-slate-800 border-indigo-400 focus-visible:ring-indigo-400 max-w-md"
                autoFocus
              />
              <Button
                size="sm"
                onClick={handleSalvarBobinaInf}
                disabled={salvandoBobinaInf}
                className="h-9 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1 shrink-0"
              >
                <Check className="w-3.5 h-3.5" />
                Salvar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTextoBobinaInf(p.bobina_inferior || "");
                  setEditandoBobinaInf(false);
                }}
                disabled={salvandoBobinaInf}
                className="h-9 px-2 text-xs text-muted-foreground hover:text-foreground shrink-0"
              >
                <X className="w-3.5 h-3.5" />
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span
                onClick={() => podeGerenciar && setEditandoBobinaInf(true)}
                title="Clique para editar ou ajustar o texto da bobina inferior"
                className={`font-mono font-black text-sm text-foreground bg-white dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-700 ${podeGerenciar ? "hover:border-indigo-500 cursor-pointer" : ""} transition-colors shadow-2xs flex items-center gap-2 group`}
              >
                <span>{bobinaInferiorVisual}</span>
                {podeGerenciar && <Pencil className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 transition-colors" />}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => podeGerenciar && setEditandoBobinaInf(true)}
                className={`h-7 px-2 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 gap-1 shrink-0 ${podeGerenciar ? "" : "hidden"}`}
              >
                <Pencil className="w-3 h-3" />
                Ajustar
              </Button>
            </div>
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
            {/* Cor / RVM Inferior */}
            {!editandoCorInf ? (
              <span className="inline-flex items-center gap-1.5 bg-background/90 px-2 py-1 rounded-md border border-border hover:border-indigo-400 transition-colors shadow-2xs">
                <span className="text-[11px] text-muted-foreground font-medium">Cor / RVM:</span>
                <button
                  type="button"
                  onClick={() => { if (podeGerenciar) { setEditandoCorInf(true); setEditandoEspInf(false); } }}
                  className={`inline-flex items-center gap-1 font-bold text-foreground ${podeGerenciar ? "hover:text-indigo-600 cursor-pointer" : "cursor-default"} transition-colors group`}
                  title="Clique para alterar a Cor / RVM da chapa inferior"
                >
                  <span>{overrideCorInf !== null ? overrideCorInf : (p.rvm_inferior || "—")}</span>
                  {podeGerenciar && <Pencil className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-600" />}
                </button>
              </span>
            ) : (
              <div className="w-full bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-xl p-2.5 shadow-md flex flex-col gap-2 my-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Cor / RVM Inferior:</span>
                  <Input
                    value={textoCorInf}
                    onChange={(e) => setTextoCorInf(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSalvarCorInf();
                      if (e.key === "Escape") setEditandoCorInf(false);
                    }}
                    placeholder="Digite ou escolha abaixo..."
                    className="h-7 text-xs font-bold w-40 bg-background"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSalvarCorInf()}
                    disabled={salvandoCorInf}
                    className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold gap-1"
                  >
                    <Check className="w-3 h-3" /> Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditandoCorInf(false)}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground mr-1">Rápido:</span>
                  {CORES_RAPIDAS.map(cor => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => handleSalvarCorInf(cor)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                        (textoCorInf || "").toLowerCase() === cor.toLowerCase()
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-muted/60 hover:bg-indigo-50 hover:text-indigo-600 border-border text-foreground"
                      }`}
                    >
                      {cor}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Espessura Inferior */}
            {!editandoEspInf ? (
              <span className="inline-flex items-center gap-1.5 bg-background/90 px-2 py-1 rounded-md border border-border hover:border-indigo-400 transition-colors shadow-2xs">
                <span className="text-[11px] text-muted-foreground font-medium">Espessura:</span>
                <button
                  type="button"
                  onClick={() => { if (podeGerenciar) { setEditandoEspInf(true); setEditandoCorInf(false); } }}
                  className={`inline-flex items-center gap-1 font-bold text-foreground ${podeGerenciar ? "hover:text-indigo-600 cursor-pointer" : "cursor-default"} transition-colors group`}
                  title="Clique para alterar a Espessura da chapa inferior"
                >
                  <span>{overrideEspInf !== null ? overrideEspInf : (p.espessura_inferior || p.espessura_exigida || p.espessura || "0,43")} mm</span>
                  {podeGerenciar && <Pencil className="w-2.5 h-2.5 text-slate-400 group-hover:text-indigo-600" />}
                </button>
              </span>
            ) : (
              <div className="w-full bg-white dark:bg-slate-900 border-2 border-indigo-500 rounded-xl p-2.5 shadow-md flex flex-col gap-2 my-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase">Espessura Inferior:</span>
                  <Input
                    value={textoEspInf}
                    onChange={(e) => setTextoEspInf(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSalvarEspInf();
                      if (e.key === "Escape") setEditandoEspInf(false);
                    }}
                    placeholder="Ex: 0,43"
                    className="h-7 text-xs font-bold w-24 bg-background"
                    autoFocus
                  />
                  <span className="text-xs text-muted-foreground font-bold">mm</span>
                  <Button
                    size="sm"
                    onClick={() => handleSalvarEspInf()}
                    disabled={salvandoEspInf}
                    className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold gap-1"
                  >
                    <Check className="w-3 h-3" /> Salvar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditandoEspInf(false)}
                    className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-muted-foreground mr-1">Rápido:</span>
                  {ESPESSURAS_RAPIDAS.map(esp => (
                    <button
                      key={esp}
                      type="button"
                      onClick={() => handleSalvarEspInf(esp)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all border ${
                        (textoEspInf || "").replace(".", ",") === esp
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-muted/60 hover:bg-indigo-50 hover:text-indigo-600 border-border text-foreground"
                      }`}
                    >
                      {esp} mm
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Badge className="bg-indigo-700 text-white font-bold text-xs gap-1 self-start sm:self-center">
        <Layers className="w-3 h-3" /> Chapa Inferior
      </Badge>
    </div>
  );
}