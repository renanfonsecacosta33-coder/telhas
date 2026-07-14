import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Camera, Truck, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MuralQualidade() {
  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["admin-mural-qualidade"],
    queryFn: async () => {
      const [ordensMaq, ordensDesb, pedidos] = await Promise.all([
        base44.entities.OrdemMaquinaCD.filter({ status: "finalizado" }, "-data_finalizacao", 50),
        base44.entities.OrdemDesbobinadeira.filter({ status: "finalizado" }, "-data_finalizacao", 50),
        base44.entities.Pedido.filter({ status: "finalizado" }, "-data_finalizacao", 50),
      ]);

      const items = [];
      const addPhoto = (url, tipo, numero_pedido, cliente, data, maquina, setor) => {
        if (!url) return;
        items.push({ url, tipo, numero_pedido, cliente, data, maquina, setor });
      };

      ordensMaq.forEach(o => {
        addPhoto(o.foto_finalizacao_url, "Finalização", o.numero_pedido, o.cliente, o.data_finalizacao, o.maquina, "Corte e Dobra");
        addPhoto(o.foto_carregamento_url, "Carregamento", o.numero_pedido, o.cliente, o.data_finalizacao, o.maquina, "Corte e Dobra");
      });
      ordensDesb.forEach(o => {
        addPhoto(o.foto_finalizacao_url, "Finalização", o.numero_pedido, o.cliente, o.data_finalizacao, "Desbobinadeira", "Corte e Dobra");
        addPhoto(o.foto_carregamento_url, "Carregamento", o.numero_pedido, o.cliente, o.data_finalizacao, "Desbobinadeira", "Corte e Dobra");
      });
      pedidos.forEach(p => {
        addPhoto(p.foto_carregamento_url, "Carregamento", p.numero_pedido, p.cliente, p.data_finalizacao, p.maquina, "Telhas");
      });

      const map = {};
      items.forEach(f => {
        const key = `${f.numero_pedido || "—"}_${f.cliente || "—"}`;
        if (!map[key]) map[key] = { numero_pedido: f.numero_pedido, cliente: f.cliente, data: f.data, setor: f.setor, fotos: [] };
        map[key].fotos.push(f);
        if (f.data && (!map[key].data || f.data > map[key].data)) map[key].data = f.data;
      });

      return Object.values(map).sort((a, b) => (b.data || "").localeCompare(a.data || ""));
    },
    refetchInterval: 30000,
  });

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      {grupos.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <ImageIcon className="w-10 h-10 mx-auto mb-2 text-muted-foreground/20" />
          Nenhuma foto de finalização ou carregamento encontrada.
        </div>
      ) : (
        <div className="relative border-l-2 border-border ml-3 space-y-6">
          {grupos.map((grupo, i) => (
            <div key={i} className="ml-6 relative">
              <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-primary border-2 border-background" />
              <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-1">
                  <div>
                    <span className="font-bold text-sm">#{grupo.numero_pedido || "—"}</span>
                    {grupo.cliente && <span className="text-sm text-muted-foreground ml-2">{grupo.cliente}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{grupo.setor}</span>
                    {grupo.data && <span className="text-xs text-muted-foreground">{format(new Date(grupo.data + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}</span>}
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {grupo.fotos.map((f, j) => (
                    <div key={j} className="flex-shrink-0 relative group">
                      <img src={f.url} alt={f.tipo} className="w-40 h-32 object-cover rounded-lg border border-border" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-0.5 rounded-b-lg flex items-center gap-1">
                        {f.tipo === "Carregamento" ? <Truck className="w-3 h-3" /> : <Camera className="w-3 h-3" />}
                        {f.tipo}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}