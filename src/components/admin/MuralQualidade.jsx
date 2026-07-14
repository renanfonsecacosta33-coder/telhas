import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Camera, Truck, ImageIcon, ZoomIn, Scissors, Factory, PackageCheck, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function getTimeline(ops) {
  const corteOps = ops.filter(o => o._tipo === "ordem_desb" || (o.maquina && o.maquina.includes("CORTE")));
  const dobraOps = ops.filter(o => o.maquina && (o.maquina.includes("DOBRA") || o.maquina === "PERFILADEIRA"));
  const allFinalizado = ops.length > 0 && ops.every(o => o.status === "finalizado");
  const anyExpedicao = ops.find(o => o.status_expedicao && o.status_expedicao !== "aguardando");
  const stageStatus = (list) => { if (list.length === 0) return "none"; if (list.every(o => o.status === "finalizado")) return "done"; if (list.some(o => o.status === "em_producao" || o.status === "aguardando_corte")) return "producing"; return "pending"; };
  return { corte: stageStatus(corteOps), dobra: stageStatus(dobraOps), logistica: anyExpedicao ? (anyExpedicao.status_expedicao === "expedido" ? "done" : "producing") : (allFinalizado ? "pending" : "none") };
}

const STAGE_CFG = { done: { color: "bg-emerald-500 text-white", label: "Finalizado" }, producing: { color: "bg-blue-500 text-white", label: "Produzindo" }, pending: { color: "bg-amber-400 text-white", label: "Pendente" }, none: { color: "bg-muted text-muted-foreground", label: "—" } };

export default function MuralQualidade({ filters }) {
  const [zoomPhoto, setZoomPhoto] = useState(null);

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["admin-mural-v3", filters.dataInicial, filters.dataFinal, filters.filial],
    queryFn: async () => {
      const f = {};
      if (filters.filial) f.unidade = filters.filial;
      const [ordensMaq, ordensDesb, pedidos] = await Promise.all([
        base44.entities.OrdemMaquinaCD.filter(f, "-created_date", 100),
        base44.entities.OrdemDesbobinadeira.filter(f, "-created_date", 100),
        base44.entities.Pedido.filter(f, "-created_date", 100),
      ]);

      const opsByPedido = {};
      const addOp = (op, tipo, setor) => {
        const key = op.numero_pedido || `_${op.id}`;
        if (!opsByPedido[key]) opsByPedido[key] = { ops: [], setor, numero_pedido: op.numero_pedido, cliente: op.cliente, vendedor: op.vendedor, data_prevista: op.data_prevista };
        opsByPedido[key].ops.push({ ...op, _tipo: tipo });
        if (!opsByPedido[key].cliente && op.cliente) opsByPedido[key].cliente = op.cliente;
        if (!opsByPedido[key].vendedor && op.vendedor) opsByPedido[key].vendedor = op.vendedor;
        if (!opsByPedido[key].data_prevista && op.data_prevista) opsByPedido[key].data_prevista = op.data_prevista;
      };
      ordensMaq.forEach(o => addOp(o, "ordem_maquina", "Corte e Dobra"));
      ordensDesb.forEach(o => addOp(o, "ordem_desb", "Corte e Dobra"));
      pedidos.forEach(p => addOp(p, "pedido", "Telhas"));

      const grupos = [];
      Object.values(opsByPedido).forEach(grupo => {
        const fotos = [];
        grupo.ops.forEach(op => {
          if (op.foto_finalizacao_url) fotos.push({ url: op.foto_finalizacao_url, tipo: "Finalização", data: op.data_finalizacao, maquina: op.maquina, status: op.status });
          if (op.foto_carregamento_url) fotos.push({ url: op.foto_carregamento_url, tipo: "Carregamento", data: op.data_finalizacao, maquina: op.maquina, status: op.status });
        });
        if (fotos.length > 0) {
          grupo.fotos = fotos.sort((a, b) => (b.data || "").localeCompare(a.data || ""));
          grupo.timeline = getTimeline(grupo.ops);
          grupos.push(grupo);
        }
      });

      return grupos.filter(g => {
        const data = g.fotos[0]?.data;
        if (!data) return true;
        return data >= filters.dataInicial && data <= filters.dataFinal;
      }).sort((a, b) => (b.fotos[0]?.data || "").localeCompare(a.fotos[0]?.data || ""));
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {grupos.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground"><ImageIcon className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />Nenhuma foto no período selecionado.</div>
      ) : grupos.map((grupo, i) => {
        const tl = grupo.timeline;
        return (
          <div key={i} className="bg-card border border-border rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2"><span className="font-bold text-sm">#{grupo.numero_pedido || "—"}</span><span className="text-xs text-muted-foreground">{grupo.setor}</span></div>
                <p className="text-sm font-medium">{grupo.cliente || "—"}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {grupo.vendedor && <span className="flex items-center gap-1"><User className="w-3 h-3" />{grupo.vendedor}</span>}
                  {grupo.data_prevista && <span>Entrega: {format(new Date(grupo.data_prevista + "T12:00:00"), "dd/MM", { locale: ptBR })}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 py-2">
              {[
                { label: "Corte", icon: Scissors, status: tl.corte },
                { label: "Dobra", icon: Factory, status: tl.dobra },
                { label: "Logística", icon: PackageCheck, status: tl.logistica },
              ].map((stage, j) => {
                const Icon = stage.icon; const cfg = STAGE_CFG[stage.status];
                return (
                  <div key={stage.label} className="flex items-center flex-1">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.color}`}><Icon className="w-4 h-4" /></div>
                      <span className="text-[10px] mt-1 font-medium">{stage.label}</span>
                      <span className="text-[9px] text-muted-foreground">{cfg.label}</span>
                    </div>
                    {j < 2 && <div className={`flex-1 h-0.5 mx-1 ${stage.status === "done" ? "bg-emerald-500" : "bg-muted"}`} />}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {grupo.fotos.map((f, j) => (
                <div key={j} className="flex-shrink-0 relative group">
                  <img src={f.url} alt={f.tipo} className="w-48 h-36 object-cover rounded-lg border border-border cursor-zoom-in" onClick={() => setZoomPhoto(f.url)} />
                  <button onClick={() => setZoomPhoto(f.url)} className="absolute top-1 right-1 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity"><ZoomIn className="w-3 h-3" /></button>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-0.5 rounded-b-lg flex items-center gap-1">
                    {f.tipo === "Carregamento" ? <Truck className="w-3 h-3" /> : <Camera className="w-3 h-3" />}{f.tipo}
                    {f.data && <span className="ml-auto opacity-70">{format(new Date(f.data + "T12:00:00"), "dd/MM", { locale: ptBR })}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {zoomPhoto && (
        <Dialog open={!!zoomPhoto} onOpenChange={() => setZoomPhoto(null)}>
          <DialogContent className="sm:max-w-4xl p-2"><img src={zoomPhoto} alt="Foto ampliada" className="w-full h-auto rounded-lg" /></DialogContent>
        </Dialog>
      )}
    </div>
  );
}