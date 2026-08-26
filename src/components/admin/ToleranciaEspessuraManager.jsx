import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Ruler, Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Manage configurable espessura tolerances (min/max acceptable per nominal espessura)
 * used by the strict bobina validation across all selection points.
 */
export default function ToleranciaEspessuraManager() {
  const queryClient = useQueryClient();
  const [novo, setNovo] = useState({ espessura_nominal: "", min_aceitavel: "", max_aceitavel: "", origem_exigida: "ambas" });
  const [salvando, setSalvando] = useState(false);

  const { data: lista = [], isLoading } = useQuery({
    queryKey: ["tolerancias-espessura"],
    queryFn: () => base44.entities.ToleranciaEspessura.list("espessura_nominal"),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ["tolerancias-espessura"] });

  const adicionar = async () => {
    if (!novo.espessura_nominal || !novo.min_aceitavel || !novo.max_aceitavel) {
      toast.error("Preencha espessura nominal, mínimo e máximo.");
      return;
    }
    setSalvando(true);
    try {
      await base44.entities.ToleranciaEspessura.create({
        espessura_nominal: novo.espessura_nominal.replace(".", ","),
        min_aceitavel: Number(novo.min_aceitavel),
        max_aceitavel: Number(novo.max_aceitavel),
        origem_exigida: novo.origem_exigida,
        ativo: true,
      });
      toast.success("Tolerância cadastrada!");
      setNovo({ espessura_nominal: "", min_aceitavel: "", max_aceitavel: "", origem_exigida: "ambas" });
      invalidar();
    } catch (e) {
      toast.error("Erro ao cadastrar: " + (e.message || e));
    } finally {
      setSalvando(false);
    }
  };

  const remover = async (id) => {
    if (!confirm("Excluir esta tolerância?")) return;
    try {
      await base44.entities.ToleranciaEspessura.delete(id);
      toast.success("Tolerância removida.");
      invalidar();
    } catch (e) {
      toast.error("Erro ao excluir.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Ruler className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold">Faixas de Tolerância de Espessura (Trava Odoo)</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Define a faixa mín/máx aceitável para cada espessura exigida pelo pedido Odoo. Bobinas fora da faixa são bloqueadas na seleção.
        </p>

        {/* Formulário de cadastro */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end">
          <div className="space-y-1">
            <Label className="text-xs">Espessura Nominal</Label>
            <Input placeholder="ex: 1,30" value={novo.espessura_nominal} onChange={(e) => setNovo((n) => ({ ...n, espessura_nominal: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mín. aceitável (mm)</Label>
            <Input type="number" step="0.01" placeholder="ex: 1,25" value={novo.min_aceitavel} onChange={(e) => setNovo((n) => ({ ...n, min_aceitavel: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Máx. aceitável (mm)</Label>
            <Input type="number" step="0.01" placeholder="ex: 1,35" value={novo.max_aceitavel} onChange={(e) => setNovo((n) => ({ ...n, max_aceitavel: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Origem exigida</Label>
            <Select value={novo.origem_exigida} onValueChange={(v) => setNovo((n) => ({ ...n, origem_exigida: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ambas">Ambas (sem restrição)</SelectItem>
                <SelectItem value="Nacional">Nacional</SelectItem>
                <SelectItem value="Importado">Importado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={adicionar} disabled={salvando} size="sm" className="gap-1">
          {salvando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          Cadastrar Faixa
        </Button>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : lista.length === 0 ? (
        <div className="text-center py-6 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
          Nenhuma tolerância cadastrada. Sem cadastro, a validação exige espessura exata.
        </div>
      ) : (
        <div className="space-y-2">
          {lista.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex items-center gap-3 flex-wrap text-sm">
                <span className="font-mono font-bold text-primary">{t.espessura_nominal}mm</span>
                <span className="text-muted-foreground">faixa:</span>
                <span className="font-semibold">{t.min_aceitavel} – {t.max_aceitavel}mm</span>
                {t.origem_exigida && t.origem_exigida !== "ambas" && (
                  <span className="text-xs bg-amber-100 text-amber-700 border border-amber-300 rounded-full px-2 py-0.5 font-semibold">
                    {t.origem_exigida}
                  </span>
                )}
                {t.ativo === false && <span className="text-xs text-red-500">(inativa)</span>}
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:bg-red-50" onClick={() => remover(t.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}