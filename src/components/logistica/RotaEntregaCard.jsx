import React, { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Truck, Eye, Factory, Layers, PackageCheck, DollarSign, StickyNote } from "lucide-react";
import ImageViewer from "@/components/ui/ImageViewer";
import RotaCarregamentoSlot from "@/components/logistica/RotaCarregamentoSlot";

const DEP_LABEL = { telhas: "Telhas", corte_dobra: "Corte e Dobra", expedicao: "Expedição" };
const DEP_COLOR = {
  telhas: "bg-blue-100 text-blue-700 border-blue-200",
  corte_dobra: "bg-orange-100 text-orange-700 border-orange-200",
  expedicao: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function RotaEntregaCard({ rota, departamento }) {
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");

  const itens = useMemo(() => {
    try { return JSON.parse(rota.itens_json || "[]"); } catch { return []; }
  }, [rota.itens_json]);

  const itensFiltrados = useMemo(() => {
    if (!departamento) return itens;
    return itens.filter((i) => (i.departamentos || []).includes(departamento));
  }, [itens, departamento]);

  const departamentosAtivos = useMemo(() => {
    if (departamento) return [departamento];
    const set = new Set();
    itens.forEach((i) => (i.departamentos || []).forEach((d) => set.add(d)));
    return ["telhas", "corte_dobra", "expedicao"].filter((d) => set.has(d));
  }, [itens, departamento]);

  const carregamentoField = (dep) => ({
    url: rota[`imagem_carregamento_${dep}_url`],
    nome: rota[`imagem_carregamento_${dep}_nome`],
  });

  const totalFmt = rota.total_valor || "";
  const dataCriacao = rota.data_criacao ? format(new Date(rota.data_criacao + "T12:00:00"), "dd/MM") : "";

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{rota.titulo}</p>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
            {rota.entrega_date && <span className="flex items-center gap-0.5"><Truck className="w-3 h-3" /> Entrega: <b>{rota.entrega_date}</b></span>}
            {rota.embarque_date && <span>Embarque: <b>{rota.embarque_date}</b></span>}
            {dataCriacao && <span>· {dataCriacao}</span>}
          </div>
        </div>
        <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 shrink-0">
          {itensFiltrados.length} {departamento ? DEP_LABEL[departamento] : "ped"}
        </Badge>
      </div>

      {/* Imagem da rota + carregamento por barracão */}
      <div className="flex gap-2">
        {rota.rota_imagem_url && (
          <button
            onClick={() => { setViewerUrl(rota.rota_imagem_url); setViewerName(rota.rota_imagem_nome); }}
            className="relative h-20 w-28 rounded-lg border border-border overflow-hidden bg-muted group shrink-0"
            title="Ver rota"
          >
            <img src={rota.rota_imagem_url} alt="rota" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5">Rota</span>
          </button>
        )}
        <div className={`grid gap-2 flex-1 ${departamentosAtivos.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
          {departamentosAtivos.map((dep) => {
            const f = carregamentoField(dep);
            return (
              <RotaCarregamentoSlot key={dep} rotaId={rota.id} dep={dep} url={f.url} nome={f.nome} />
            );
          })}
        </div>
      </div>

      {/* Itens filtrados por departamento */}
      {itensFiltrados.length > 0 && (
        <div className="max-h-44 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left p-1.5 font-semibold w-6">#</th>
                <th className="text-left p-1.5 font-semibold">Pedido</th>
                <th className="text-left p-1.5 font-semibold">Cliente</th>
                <th className="text-left p-1.5 font-semibold hidden sm:table-cell">Bairro</th>
                <th className="text-left p-1.5 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itensFiltrados.map((it, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="p-1.5 text-muted-foreground">{it.ordem}</td>
                  <td className="p-1.5 font-semibold">{it.numero_pedido}</td>
                  <td className="p-1.5 truncate max-w-[110px]">{it.cliente}</td>
                  <td className="p-1.5 truncate max-w-[80px] hidden sm:table-cell">{it.bairro}</td>
                  <td className="p-1.5 font-medium">{it.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Departamentos envolvidos */}
      {!departamento && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {["telhas", "corte_dobra", "expedicao"].map((d) => {
            const count = itens.filter((i) => (i.departamentos || []).includes(d)).length;
            if (count === 0) return null;
            return (
              <Badge key={d} className={`text-[10px] ${DEP_COLOR[d]}`}>
                {d === "telhas" && <Factory className="w-3 h-3 mr-0.5" />}
                {d === "corte_dobra" && <Layers className="w-3 h-3 mr-0.5" />}
                {d === "expedicao" && <PackageCheck className="w-3 h-3 mr-0.5" />}
                {DEP_LABEL[d]}: {count}
              </Badge>
            );
          })}
        </div>
      )}

      {/* OBS */}
      {rota.observacao && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{rota.observacao}</span>
        </div>
      )}

      {totalFmt && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
          <span className="text-muted-foreground flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Total da rota
          </span>
          <span className="font-bold">{totalFmt}</span>
        </div>
      )}

      <ImageViewer url={viewerUrl} name={viewerName} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
    </div>
  );
}