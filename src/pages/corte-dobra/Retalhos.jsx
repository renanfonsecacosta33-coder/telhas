import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Scissors, Plus, Layers, ChevronDown, ChevronUp, Lightbulb, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { sugerirProdutosParaRetalho, CATEGORIAS_CATALOGO } from "@/lib/catalogo-cd";

const STATUS_CFG = {
  disponivel: { label: "Disponível", cls: "bg-green-100 text-green-700 border-green-200" },
  reservado:  { label: "Reservado",  cls: "bg-amber-100 text-amber-700 border-amber-200" },
  consumido:  { label: "Consumido",  cls: "bg-slate-100 text-slate-500 border-slate-200" },
  descartado: { label: "Descartado", cls: "bg-red-100 text-red-500 border-red-200" },
};

export default function Retalhos() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("disponivel");
  const queryClient = useQueryClient();

  const { data: retalhos = [], isLoading } = useQuery({
    queryKey: ["retalhos-cd"],
    queryFn: () => base44.entities.RetalhoCD.list("-created_date", 200),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RetalhoCD.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["retalhos-cd"] }); setDialogOpen(false); toast.success("Retalho cadastrado!"); },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RetalhoCD.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["retalhos-cd"] }); setDialogOpen(false); toast.success("Atualizado!"); },
  });

  const handleSave = (data) => {
    if (editItem?.id) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  };

  const filtrados = retalhos.filter(r => filtroStatus === "todos" || r.status === filtroStatus);

  const stats = {
    total: retalhos.filter(r => r.status === "disponivel").length,
    area_total: retalhos.filter(r => r.status === "disponivel")
      .reduce((s, r) => s + ((r.comprimento_mm || 0) * (r.largura_mm || 0) / 1e6), 0),
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scissors className="w-6 h-6 text-orange-500" />
            Retalhos e Sobras
          </h1>
          <p className="text-sm text-muted-foreground">Gestão de sobras de chapa com sugestão de aproveitamento pelo catálogo</p>
        </div>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2 bg-orange-500 hover:bg-orange-600">
          <Plus className="w-4 h-4" /> Registrar Retalho
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-green-600">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Retalhos disponíveis</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-orange-600">{stats.area_total.toFixed(2)} m²</p>
          <p className="text-xs text-muted-foreground">Área total em estoque</p>
        </div>
      </div>

      {/* Filtro status */}
      <div className="flex gap-2 flex-wrap">
        {["todos", "disponivel", "reservado", "consumido", "descartado"].map(s => (
          <button key={s} onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${filtroStatus === s ? "bg-orange-500 text-white border-orange-500" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}>
            {s === "todos" ? "Todos" : STATUS_CFG[s]?.label}
            <span className="ml-1.5 opacity-70">{s === "todos" ? retalhos.length : retalhos.filter(r => r.status === s).length}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" /></div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Scissors className="w-12 h-12 text-muted-foreground/20 mx-auto" />
          <p className="text-muted-foreground">Nenhum retalho encontrado.</p>
          <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2 bg-orange-500 hover:bg-orange-600">
            <Plus className="w-4 h-4" /> Registrar Primeiro Retalho
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtrados.map(r => {
            const stCfg = STATUS_CFG[r.status] || STATUS_CFG.disponivel;
            const isExpanded = expandedId === r.id;
            const sugestoes = r.status === "disponivel" && r.comprimento_mm && r.largura_mm && r.espessura_mm
              ? sugerirProdutosParaRetalho(r.comprimento_mm, r.largura_mm, r.espessura_mm).slice(0, 5)
              : [];

            return (
              <div key={r.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 flex items-start gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{r.comprimento_mm}×{r.largura_mm}mm · {r.espessura_mm}mm</span>
                      <Badge className={`border text-xs ${stCfg.cls}`}>{stCfg.label}</Badge>
                      {sugestoes.length > 0 && (
                        <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 border text-xs">
                          <Lightbulb className="w-3 h-3 mr-1" />{sugestoes.length} produto(s) possível(eis)
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                      {r.material && <span><Layers className="w-3 h-3 inline mr-0.5" />{r.material}</span>}
                      {r.localizacao && <span>📍 {r.localizacao}</span>}
                      <span>Área: {((r.comprimento_mm || 0) * (r.largura_mm || 0) / 1e6).toFixed(4)} m²</span>
                      {r.peso_estimado_kg && <span>≈ {r.peso_estimado_kg}kg</span>}
                      <span>{format(new Date(r.created_date), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {r.status === "disponivel" && (
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => updateMutation.mutate({ id: r.id, data: { status: "consumido" } })}>
                        Consumido
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-7 text-xs"
                      onClick={() => { setEditItem(r); setDialogOpen(true); }}>Editar</Button>
                    <button onClick={() => setExpandedId(isExpanded ? null : r.id)}
                      className="p-1.5 text-muted-foreground hover:text-foreground">
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {isExpanded && sugestoes.length > 0 && (
                  <div className="border-t border-border bg-yellow-50/50 px-4 py-3">
                    <p className="text-xs font-bold text-yellow-800 mb-2 flex items-center gap-1">
                      <Lightbulb className="w-3.5 h-3.5" /> Produtos do catálogo que cabem neste retalho:
                    </p>
                    <div className="space-y-1.5">
                      {sugestoes.map(s => {
                        const cat = CATEGORIAS_CATALOGO.find(c => c.id === s.categoria);
                        return (
                          <div key={s.id} className="flex items-center justify-between bg-white border border-yellow-200 rounded-lg px-3 py-1.5 text-xs">
                            <div className="flex items-center gap-2">
                              {cat && <Badge className={`border text-[10px] ${cat.cor}`}>{cat.label}</Badge>}
                              <span className="font-medium">{s.nome}</span>
                              <span className="text-muted-foreground">{s.dimensoes}</span>
                            </div>
                            <div className="text-right text-muted-foreground">
                              <span className="font-bold text-orange-600">{s.qtd_possivel}×</span>
                              <span className="ml-1">({s.comprimento_desenvolvido}mm/pç)</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isExpanded && sugestoes.length === 0 && r.status === "disponivel" && (
                  <div className="border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground italic">
                    Nenhum produto do catálogo se encaixa neste retalho. Considere descartar ou usar como blank.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <RetalhoFormDialog open={dialogOpen} onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave} editItem={editItem} />
    </div>
  );
}

function RetalhoFormDialog({ open, onClose, onSave, editItem }) {
  const [form, setForm] = useState({
    origem: "sobra_producao", material: "", espessura_mm: "", comprimento_mm: "", largura_mm: "",
    peso_estimado_kg: "", localizacao: "", status: "disponivel", observacoes: "",
    data_entrada: format(new Date(), "yyyy-MM-dd"),
  });

  React.useEffect(() => {
    if (!open) return;
    if (editItem) {
      setForm({
        origem: editItem.origem || "sobra_producao",
        material: editItem.material || "",
        espessura_mm: editItem.espessura_mm || "",
        comprimento_mm: editItem.comprimento_mm || "",
        largura_mm: editItem.largura_mm || "",
        peso_estimado_kg: editItem.peso_estimado_kg || "",
        localizacao: editItem.localizacao || "",
        status: editItem.status || "disponivel",
        observacoes: editItem.observacoes || "",
        data_entrada: editItem.data_entrada || format(new Date(), "yyyy-MM-dd"),
      });
    } else {
      setForm({ origem: "sobra_producao", material: "", espessura_mm: "", comprimento_mm: "", largura_mm: "",
        peso_estimado_kg: "", localizacao: "", status: "disponivel", observacoes: "",
        data_entrada: format(new Date(), "yyyy-MM-dd") });
    }
  }, [open, editItem]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.espessura_mm || !form.comprimento_mm || !form.largura_mm) {
      toast.error("Informe espessura, comprimento e largura.");
      return;
    }
    // Calcular área automaticamente
    const area = (parseFloat(form.comprimento_mm) * parseFloat(form.largura_mm)) / 10000; // cm²
    onSave({ ...form, espessura_mm: parseFloat(form.espessura_mm), comprimento_mm: parseFloat(form.comprimento_mm),
      largura_mm: parseFloat(form.largura_mm), peso_estimado_kg: form.peso_estimado_kg ? parseFloat(form.peso_estimado_kg) : undefined,
      area_cm2: Math.round(area) });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editItem ? "Editar Retalho" : "Registrar Retalho"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Espessura (mm) *</Label>
              <Input type="number" step="0.01" placeholder="1.50" value={form.espessura_mm} onChange={e => set("espessura_mm", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Comprimento (mm) *</Label>
              <Input type="number" placeholder="800" value={form.comprimento_mm} onChange={e => set("comprimento_mm", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Largura (mm) *</Label>
              <Input type="number" placeholder="500" value={form.largura_mm} onChange={e => set("largura_mm", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Material</Label>
              <Input placeholder="Aço galvanizado..." value={form.material} onChange={e => set("material", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Peso estimado (kg)</Label>
              <Input type="number" step="0.01" placeholder="0.0" value={form.peso_estimado_kg} onChange={e => set("peso_estimado_kg", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Localização</Label>
              <Input placeholder="Prateleira A3..." value={form.localizacao} onChange={e => set("localizacao", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data de entrada</Label>
              <Input type="date" value={form.data_entrada} onChange={e => set("data_entrada", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Origem</Label>
              <Select value={form.origem} onValueChange={v => set("origem", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sobra_producao">Sobra de produção</SelectItem>
                  <SelectItem value="corte_chapa">Corte de chapa</SelectItem>
                  <SelectItem value="chapa_parcial">Chapa parcial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="reservado">Reservado</SelectItem>
                  <SelectItem value="consumido">Consumido</SelectItem>
                  <SelectItem value="descartado">Descartado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Observações</Label>
            <Textarea placeholder="Observações..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}