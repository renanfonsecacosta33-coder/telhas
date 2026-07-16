import React, { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Layers, Package, ClipboardCheck, ThumbsUp, ThumbsDown, Plus } from "lucide-react";
import CorChapaDot, { extractEspessuraFromDesc } from "@/components/corte-dobra/CorChapaDot";

export default function InsumosCQPanel({
  ordem: o,
  medicao1, setMedicao1,
  medicao2, setMedicao2,
  cqAprovado, setCqAprovado,
  onRegistrarCQ,
}) {
  const [materialOk, setMaterialOk] = useState(false);

  if (!o) {
    return (
      <div className="w-full flex flex-col items-center justify-center bg-white border-l border-slate-200 p-6 text-center">
        <ClipboardCheck className="w-8 h-8 text-slate-200 mb-2" />
        <p className="text-xs text-slate-400">Selecione uma OP para ver insumos e CQ</p>
      </div>
    );
  }

  const espessura = extractEspessuraFromDesc(o.chapa_descricao) || extractEspessuraFromDesc(o.bobina_descricao);
  const isChaparia = o.chapa_origem === "chaparia";

  return (
    <div className="w-full flex flex-col bg-white border-l border-slate-200 overflow-y-auto">
      {/* Materiais Necessários */}
      <div className="p-3 border-b border-slate-200">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Materiais Necessários</p>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50">
              <tr className="text-left text-slate-400">
                <th className="px-2 py-1.5 font-semibold">Código</th>
                <th className="px-2 py-1.5 font-semibold">Descrição</th>
                <th className="px-2 py-1.5 font-semibold text-center">Qtd</th>
                <th className="px-2 py-1.5 font-semibold text-center">OK</th>
              </tr>
            </thead>
            <tbody>
              {/* Material principal (bobina-mãe ou chapa) */}
              <tr className="border-t border-slate-100">
                <td className="px-2 py-2 font-mono font-bold text-slate-700 text-[10px]">
                  {o.bobina_id?.slice(-6).toUpperCase() || o.chapa_cd_id?.slice(-6).toUpperCase() || "—"}
                </td>
                <td className="px-2 py-2 text-slate-600">
                  <div className="flex items-center gap-1">
                    {isChaparia ? <Layers className="w-3 h-3 text-orange-500" /> : <Package className="w-3 h-3 text-blue-500" />}
                    <span className="truncate" title={isChaparia ? o.chapa_descricao : o.bobina_descricao}>
                      {isChaparia ? (o.chapa_descricao || "Chapa") : (o.bobina_descricao || "Bobina")}
                    </span>
                    <CorChapaDot espessura={espessura} size="xs" />
                  </div>
                </td>
                <td className="px-2 py-2 text-center font-bold text-slate-700">{o.quantidade || 0}</td>
                <td className="px-2 py-2 text-center">
                  <button
                    onClick={() => setMaterialOk(!materialOk)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      materialOk ? "bg-green-500 border-green-500 text-white" : "border-slate-300 hover:border-green-400"
                    }`}
                  >
                    {materialOk && <CheckCircle2 className="w-3 h-3" />}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
          {materialOk && (
            <div className="px-2 py-1 bg-green-50 border-t border-green-100">
              <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Material conferido
              </span>
            </div>
          )}
        </div>
        <button className="mt-2 text-xs text-blue-600 font-medium flex items-center gap-1 hover:underline">
          <Plus className="w-3 h-3" /> Adicionar material
        </button>
      </div>

      {/* Inspeção / CQ */}
      <div className="p-3 flex-1">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Inspeção / CQ</p>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Medição 1 (mm)</Label>
            <div className="relative">
              <Input
                type="number"
                value={medicao1}
                onChange={(e) => setMedicao1(e.target.value)}
                placeholder="0.00"
                className="pr-8 font-bold text-sm"
                step="0.01"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">mm</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Medição 2 (mm)</Label>
            <div className="relative">
              <Input
                type="number"
                value={medicao2}
                onChange={(e) => setMedicao2(e.target.value)}
                placeholder="0.00"
                className="pr-8 font-bold text-sm"
                step="0.01"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">mm</span>
            </div>
          </div>

          {/* Aprovado? */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-500">Aprovado?</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCqAprovado(true)}
                className={`h-10 rounded-lg border-2 font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${
                  cqAprovado === true ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 text-slate-400 hover:border-green-300"
                }`}
              >
                <ThumbsUp className="w-4 h-4" /> Sim
              </button>
              <button
                onClick={() => setCqAprovado(false)}
                className={`h-10 rounded-lg border-2 font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${
                  cqAprovado === false ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 text-slate-400 hover:border-red-300"
                }`}
              >
                <ThumbsDown className="w-4 h-4" /> Não
              </button>
            </div>
          </div>

          <Button
            onClick={onRegistrarCQ}
            disabled={!medicao1 || !medicao2 || cqAprovado === null}
            className="w-full h-10 bg-blue-600 hover:bg-blue-700 gap-2 text-sm"
          >
            <ClipboardCheck className="w-4 h-4" /> Registrar Inspeção
          </Button>

          {/* Observações / OBD */}
          {o.observacoes && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2 text-xs text-yellow-800">
              📋 {o.observacoes}
            </div>
          )}
          {o.modificacao_blank && (
            <Badge className="bg-amber-100 text-amber-700 border-amber-300 text-[10px] w-fit">
              ⚠️ Blank modificado (OBD)
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}