import React, { useState, useMemo } from "react";
import { format } from "date-fns";
import { Eye, Truck, MapPin, User, DollarSign, StickyNote, Camera } from "lucide-react";
import ImageViewer from "@/components/ui/ImageViewer";

export default function RotaArquivadaCard({ rota }) {
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");

  const itens = useMemo(() => {
    try { return JSON.parse(rota.itens_json || "[]"); } catch { return []; }
  }, [rota.itens_json]);

  const fotos = useMemo(() => {
    const arr = [];
    if (rota.rota_imagem_url) arr.push({ label: "Manifesto", url: rota.rota_imagem_url, nome: rota.rota_imagem_nome });
    if (rota.imagem_carregamento_telhas_url) arr.push({ label: "Telhas", url: rota.imagem_carregamento_telhas_url, nome: rota.imagem_carregamento_telhas_nome });
    if (rota.imagem_carregamento_corte_dobra_url) arr.push({ label: "Corte e Dobra", url: rota.imagem_carregamento_corte_dobra_url, nome: rota.imagem_carregamento_corte_dobra_nome });
    if (rota.imagem_carregamento_expedicao_url) arr.push({ label: "Expedição", url: rota.imagem_carregamento_expedicao_url, nome: rota.imagem_carregamento_expedicao_nome });
    return arr;
  }, [rota]);

  const fmtData = (d) => d ? format(new Date(d), "dd/MM/yyyy 'às' HH:mm") : "—";
  const abrir = (url, nome) => { setViewerUrl(url); setViewerName(nome); };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{rota.titulo}</p>
          <p className="text-[11px] text-emerald-600 font-medium">Arquivada em {fmtData(rota.data_finalizacao || rota.data_criacao)}</p>
        </div>
      </div>

      {/* Tempos e dados */}
      <div className="grid grid-cols-2 gap-1.5 text-xs">
        {rota.embarque_date && <div className="flex items-center gap-1 text-muted-foreground"><Truck className="w-3 h-3" /> Embarque: <b className="text-foreground">{rota.embarque_date}</b></div>}
        {rota.entrega_date && <div className="flex items-center gap-1 text-muted-foreground"><MapPin className="w-3 h-3" /> Entrega: <b className="text-foreground">{rota.entrega_date}</b></div>}
        {rota.motorista_nome && <div className="flex items-center gap-1 text-muted-foreground"><User className="w-3 h-3" /> {rota.motorista_nome}</div>}
        {rota.placa && <div className="flex items-center gap-1 text-muted-foreground"><span className="font-mono font-bold text-foreground">{rota.placa}</span></div>}
      </div>

      {/* Todas as fotos */}
      {fotos.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {fotos.map((f, i) => (
            <button key={i} onClick={() => abrir(f.url, f.nome)} className="relative aspect-video rounded-lg border border-border overflow-hidden bg-muted group">
              <img src={f.url} alt={f.label} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
              </div>
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[8px] text-center py-0.5 truncate">{f.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-4 border border-dashed border-border rounded-lg">
          <Camera className="w-4 h-4" /> Sem fotos registradas
        </div>
      )}

      {/* Itens */}
      {itens.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-md border border-border">
          <table className="w-full text-xs">
            <thead className="bg-muted sticky top-0">
              <tr>
                <th className="text-left p-1.5 font-semibold w-6">#</th>
                <th className="text-left p-1.5 font-semibold">Pedido</th>
                <th className="text-left p-1.5 font-semibold">Cliente</th>
                <th className="text-left p-1.5 font-semibold">Valor</th>
              </tr>
            </thead>
            <tbody>
              {itens.map((it, idx) => (
                <tr key={idx} className="border-t border-border">
                  <td className="p-1.5 text-muted-foreground">{it.ordem}</td>
                  <td className="p-1.5 font-semibold">{it.numero_pedido}</td>
                  <td className="p-1.5 truncate max-w-[120px]">{it.cliente}</td>
                  <td className="p-1.5 font-medium">{it.valor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {rota.observacao && (
        <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">
          <StickyNote className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="whitespace-pre-wrap">{rota.observacao}</span>
        </div>
      )}

      {rota.total_valor && (
        <div className="flex items-center justify-between text-xs pt-1 border-t border-border">
          <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Total</span>
          <span className="font-bold">{rota.total_valor}</span>
        </div>
      )}

      <ImageViewer url={viewerUrl} name={viewerName} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
    </div>
  );
}