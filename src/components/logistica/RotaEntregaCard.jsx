import React, { useState, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Truck, Eye, Factory, Layers, PackageCheck, DollarSign, StickyNote, RefreshCw, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ImageViewer from "@/components/ui/ImageViewer";
import RotaCarregamentoSlot from "@/components/logistica/RotaCarregamentoSlot";
import { parseRotaImage } from "@/lib/rotaParser";

const DEP_LABEL = { telhas: "Telhas", corte_dobra: "Corte e Dobra", expedicao: "Expedição" };
const DEP_COLOR = {
  telhas: "bg-blue-100 text-blue-700 border-blue-200",
  corte_dobra: "bg-orange-100 text-orange-700 border-orange-200",
  expedicao: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function RotaEntregaCard({ rota, departamento, allowDelete = false }) {
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");
  const [replacingRota, setReplacingRota] = useState(false);
  const editRotaRef = useRef(null);
  const queryClient = useQueryClient();

  const handleReplaceRota = async (file) => {
    if (!file) return;
    setReplacingRota(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const parsed = await parseRotaImage(file_url);
      await base44.entities.RotaEntrega.update(rota.id, {
        rota_imagem_url: file_url,
        rota_imagem_nome: file.name,
        titulo: parsed.titulo || rota.titulo,
        entrega_date: parsed.entrega_date || "",
        embarque_date: parsed.embarque_date || "",
        total_valor: parsed.total_valor || "",
        nota_geral: parsed.nota_geral || "",
        itens_json: JSON.stringify(parsed.itens || []),
        motorista_nome: parsed.motorista_nome || rota.motorista_nome,
        placa: (parsed.placa || rota.placa || "").toUpperCase(),
      });
      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      toast.success("Rota atualizada! IA releu todos os dados.");
    } catch (e) {
      toast.error("Erro ao atualizar rota: " + (e?.message || ""));
    } finally {
      setReplacingRota(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Excluir esta rota de entrega? Esta ação não pode ser desfeita.")) return;
    try {
      await base44.entities.RotaEntrega.delete(rota.id);
      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rotas-arquivadas"] });
      toast.success("Rota excluída.");
    } catch (e) {
      toast.error("Erro: " + (e?.message || ""));
    }
  };

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
    fotosJson: rota[`fotos_${dep}_json`] || "",
    videoUrl: rota[`video_${dep}_url`] || "",
    videoNome: rota[`video_${dep}_nome`] || "",
    // compat legado: se não houver fotos novas mas houver foto única legada, reutiliza
    legadoUrl: rota[`imagem_carregamento_${dep}_url`],
    legadoNome: rota[`imagem_carregamento_${dep}_nome`],
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
          <div className="relative h-20 w-28 shrink-0">
            <button
              onClick={() => { setViewerUrl(rota.rota_imagem_url); setViewerName(rota.rota_imagem_nome); }}
              className="relative h-full w-full rounded-lg border border-border overflow-hidden bg-muted group"
              title="Ver rota"
            >
              <img src={rota.rota_imagem_url} alt="rota" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] text-center py-0.5">Rota</span>
            </button>
            <button
              type="button"
              onClick={() => editRotaRef.current?.click()}
              disabled={replacingRota}
              className="absolute top-1 right-1 h-6 w-6 rounded-md bg-background/90 border border-border shadow-sm flex items-center justify-center hover:bg-background disabled:opacity-60"
              title="Editar foto da rota (reler tudo com IA)"
            >
              {replacingRota ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <RefreshCw className="w-3.5 h-3.5 text-primary" />}
            </button>
          </div>
        )}
        <div className={`grid gap-2 flex-1 ${departamentosAtivos.length === 1 ? "grid-cols-1" : "grid-cols-3"}`}>
          {departamentosAtivos.map((dep) => {
            const f = carregamentoField(dep);
            // Se houver foto legada única e nenhuma foto nova, converte para o novo formato
            const fotosArr = (() => { try { return JSON.parse(f.fotosJson || "[]"); } catch { return []; } })();
            const fotosJsonFinal = fotosArr.length > 0
              ? f.fotosJson
              : (f.legadoUrl ? JSON.stringify([{ url: f.legadoUrl, nome: f.legadoNome || "foto" }]) : "[]");
            return (
              <RotaCarregamentoSlot
                key={dep}
                rotaId={rota.id}
                dep={dep}
                fotosJson={fotosJsonFinal}
                videoUrl={f.videoUrl}
                videoNome={f.videoNome}
              />
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

      {allowDelete && (
        <button onClick={handleDelete} className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md py-2 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Excluir Rota
        </button>
      )}

      <input ref={editRotaRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleReplaceRota(e.target.files?.[0])} />
      <ImageViewer url={viewerUrl} name={viewerName} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
    </div>
  );
}