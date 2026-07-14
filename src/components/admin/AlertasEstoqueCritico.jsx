import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, ShoppingCart, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function AlertasEstoqueCritico() {
  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["admin-estoque-critico"],
    queryFn: async () => {
      const all = await base44.entities.Bobina.filter({ arquivada: false }, "-peso_kg", 500);
      return all.filter(b => (b.peso_kg || 0) < (b.estoque_minimo_kg || 500));
    },
    refetchInterval: 30000,
  });

  const gerarSolicitacao = (bobina) => {
    toast.success(`Solicitação de compra gerada para ${bobina.codigo || "bobina"}`, {
      description: `${bobina.cor || ""} ${bobina.chapa || ""} · Atual: ${(bobina.peso_kg || 0).toFixed(0)}kg · Mínimo: ${bobina.estoque_minimo_kg || 500}kg`,
      duration: 6000,
    });
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-3">
      {bobinas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-500" />
          Nenhuma bobina com estoque crítico. Tudo sob controle!
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span>{bobinas.length} bobina(s) com estoque abaixo do mínimo</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {bobinas.map(b => (
              <div key={b.id} className="bg-card border border-red-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{b.codigo || "—"}</span>
                  <span className="text-xs text-muted-foreground">{b.unidade}</span>
                </div>
                <div className="text-xs space-y-0.5">
                  <p>Cor: <strong>{b.cor || "—"}</strong></p>
                  <p>Espessura: <strong>{b.chapa || "—"}</strong></p>
                  <p>Setor: <strong>{b.setor === "corte_dobra" ? "Corte e Dobra" : "Telhas"}</strong></p>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-red-600 font-bold">{(b.peso_kg || 0).toFixed(0)} kg</span>
                  <span className="text-muted-foreground">mín: {b.estoque_minimo_kg || 500} kg</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, ((b.peso_kg || 0) / (b.estoque_minimo_kg || 500)) * 100)}%` }} />
                </div>
                <button
                  onClick={() => gerarSolicitacao(b)}
                  className="w-full flex items-center justify-center gap-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg py-2 transition-colors"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  Gerar Solicitação de Compra
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}