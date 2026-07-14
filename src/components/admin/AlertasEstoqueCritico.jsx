import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, ShoppingCart, CheckCircle2, Link2, Loader2, PackageX } from "lucide-react";
import { toast } from "sonner";

const norm = (s) => (s || "").toString().toLowerCase().replace(/[.,\s]/g, "").trim();

function findCompatibleBobina(op, bobinas, setor) {
  return bobinas.find(b =>
    !b.arquivada && b.setor === setor && (b.peso_kg || 0) > 0 &&
    norm(b.chapa).includes(norm(op.material_espessura)) &&
    (!op.material_cor || norm(b.cor).includes(norm(op.material_cor)))
  );
}

export default function AlertasEstoqueCritico() {
  const [filtro, setFiltro] = useState("todos");
  const [vinculando, setVinculando] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-estoque-critico-v2"],
    queryFn: async () => {
      const [bobinas, pedidosSemMat, ordensMaqSemMat, ordensDesbSemMat] = await Promise.all([
        base44.entities.Bobina.filter({ arquivada: false }, "-peso_kg", 500),
        base44.entities.Pedido.filter({ status: "aguardando_material" }, "-created_date", 100),
        base44.entities.OrdemMaquinaCD.filter({ status: "aguardando_material" }, "-created_date", 100),
        base44.entities.OrdemDesbobinadeira.filter({ status: "aguardando_material" }, "-created_date", 100),
      ]);

      const criticas = bobinas.filter(b => (b.peso_kg || 0) < (b.estoque_minimo_kg || 500));

      const opsSemMat = [
        ...pedidosSemMat.map(o => ({ ...o, _entity: "Pedido", _setor: "telhas" })),
        ...ordensMaqSemMat.map(o => ({ ...o, _entity: "OrdemMaquinaCD", _setor: "corte_dobra" })),
        ...ordensDesbSemMat.map(o => ({ ...o, _entity: "OrdemDesbobinadeira", _setor: "corte_dobra" })),
      ].map(op => ({ ...op, _compativel: findCompatibleBobina(op, bobinas, op._setor) }));

      return { criticas, opsSemMat };
    },
    refetchInterval: 30000,
  });

  const handleVincular = async (op, bobina) => {
    setVinculando(op.id);
    try {
      const desc = `${bobina.codigo || ""} · ${bobina.cor || ""} · ${bobina.chapa || ""}`;
      const update = { status: "pendente", material_em_falta: false };
      if (op._entity === "Pedido") {
        update.bobina_superior_id = bobina.id;
        update.bobina_superior = desc;
      } else {
        update.bobina_id = bobina.id;
        update.bobina_descricao = desc;
        if (op._entity === "OrdemDesbobinadeira") update.espessura_utilizada = bobina.chapa;
      }
      await base44.entities[op._entity].update(op.id, update);
      toast.success("OP vinculada e liberada para produção!");
      queryClient.invalidateQueries({ queryKey: ["admin-estoque-critico-v2"] });
    } catch (e) {
      toast.error("Erro ao vincular: " + (e.message || e));
    }
    setVinculando(null);
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const criticas = (data?.criticas || []).filter(b => filtro === "todos" || b.setor === filtro);
  const opsSemMat = data?.opsSemMat || [];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex gap-2">
        {["todos", "telhas", "corte_dobra"].map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filtro === f ? "bg-primary text-primary-foreground" : "bg-card border border-border hover:bg-muted"}`}>
            {f === "todos" ? "Todos" : f === "telhas" ? "Telhas" : "Corte e Dobra"}
          </button>
        ))}
      </div>

      {/* Estoque Crítico */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <AlertTriangle className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-bold">Bobinas com Estoque Crítico ({criticas.length})</h3>
        </div>
        {criticas.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground"><CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />Nenhuma bobina crítica. Tudo sob controle!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-4 font-medium">Código</th>
                <th className="text-left py-2 px-4 font-medium">Especificação</th>
                <th className="text-left py-2 px-4 font-medium">Cor</th>
                <th className="text-left py-2 px-4 font-medium">Espessura</th>
                <th className="text-right py-2 px-4 font-medium">Peso Atual (KG)</th>
                <th className="text-left py-2 px-4 font-medium">Setor</th>
                <th className="text-center py-2 px-4 font-medium">Ação</th>
              </tr></thead>
              <tbody>
                {criticas.map(b => (
                  <tr key={b.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-2.5 px-4 font-mono font-bold">{b.codigo || "—"}</td>
                    <td className="py-2.5 px-4">{b.qualidade || "—"} · {b.largura_mm || "—"}mm</td>
                    <td className="py-2.5 px-4">{b.cor || "—"}</td>
                    <td className="py-2.5 px-4">{b.chapa || "—"}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="text-red-600 font-bold">{(b.peso_kg || 0).toFixed(0)}</span>
                      <span className="text-muted-foreground text-xs"> / {b.estoque_minimo_kg || 500}</span>
                    </td>
                    <td className="py-2.5 px-4">{b.setor === "corte_dobra" ? "Corte e Dobra" : "Telhas"}</td>
                    <td className="py-2.5 px-4 text-center">
                      <button onClick={() => toast.success(`Solicitação de compra gerada para ${b.codigo}`, { description: `Atual: ${(b.peso_kg||0).toFixed(0)}kg · Mín: ${b.estoque_minimo_kg||500}kg`, duration: 6000 })}
                        className="flex items-center gap-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg px-2 py-1.5 transition-colors mx-auto">
                        <ShoppingCart className="w-3 h-3" /> Comprar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pedidos Aguardando Matéria-Prima */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <PackageX className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold">Pedidos Aguardando Matéria-Prima ({opsSemMat.length})</h3>
        </div>
        {opsSemMat.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground"><CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />Nenhuma OP aguardando material.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-border text-xs text-muted-foreground bg-muted/30">
                <th className="text-left py-2 px-4 font-medium">Pedido</th>
                <th className="text-left py-2 px-4 font-medium">Cliente</th>
                <th className="text-left py-2 px-4 font-medium">Setor</th>
                <th className="text-left py-2 px-4 font-medium">Espessura</th>
                <th className="text-left py-2 px-4 font-medium">Cor</th>
                <th className="text-center py-2 px-4 font-medium">Ação</th>
              </tr></thead>
              <tbody>
                {opsSemMat.map(op => (
                  <tr key={op._entity + op.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-2.5 px-4 font-mono font-bold">{op.numero_pedido || "—"}</td>
                    <td className="py-2.5 px-4">{op.cliente || "—"}</td>
                    <td className="py-2.5 px-4">{op._setor === "corte_dobra" ? "Corte e Dobra" : "Telhas"}</td>
                    <td className="py-2.5 px-4"><span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded text-xs">{op.material_espessura || "—"}</span></td>
                    <td className="py-2.5 px-4">{op.material_cor || "—"}</td>
                    <td className="py-2.5 px-4 text-center">
                      {op._compativel ? (
                        <button onClick={() => handleVincular(op, op._compativel)} disabled={vinculando === op.id}
                          className="flex items-center gap-1 text-xs font-medium text-white bg-emerald-500 hover:bg-emerald-600 rounded-lg px-2 py-1.5 transition-colors mx-auto disabled:opacity-50">
                          {vinculando === op.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Link2 className="w-3 h-3" />}
                          Vincular e Liberar OP
                        </button>
                      ) : (
                        <span className="text-xs text-red-500 font-medium">Sem compatível</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}