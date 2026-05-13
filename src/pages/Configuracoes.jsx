import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Settings, GripVertical, Pencil, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const ICONES_DISPONIVEIS = [
  "Package", "Droplets", "Wrench", "Layers", "Box", "ShoppingCart",
  "Truck", "BarChart", "FileText", "Tag", "Archive", "Zap"
];

const emptyForm = { nome: "", icone: "Package", path: "", cor: "#3b82f6", ativa: true };

export default function Configuracoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const queryClient = useQueryClient();

  const { data: categorias = [], isLoading } = useQuery({
    queryKey: ["categorias"],
    queryFn: () => base44.entities.Categoria.list("ordem"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Categoria.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categorias"] }); setDialogOpen(false); toast.success("Categoria criada!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Categoria.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categorias"] }); setDialogOpen(false); toast.success("Categoria atualizada!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Categoria.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["categorias"] }); toast.success("Categoria removida!"); },
  });

  const toggleAtiva = (cat) => {
    updateMutation.mutate({ id: cat.id, data: { ...cat, ativa: !cat.ativa } });
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSave = () => {
    const data = { ...form, ordem: editItem ? editItem.ordem : categorias.length + 1 };
    if (editItem) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  };

  const openNew = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (cat) => { setEditItem(cat); setForm({ nome: cat.nome, icone: cat.icone || "Package", path: cat.path, cor: cat.cor || "#3b82f6", ativa: cat.ativa !== false }); setDialogOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Configurações
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie as categorias do menu lateral</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Categoria
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold">Categorias do Menu</p>
          <p className="text-xs text-muted-foreground">Ative ou desative categorias no menu lateral</p>
        </div>

        {isLoading ? (
          <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : categorias.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Nenhuma categoria criada ainda.</p>
            <p className="text-xs text-muted-foreground mt-1">As rotas fixas (Bobinas, Isopor, Outros Produtos) sempre aparecem.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {categorias.map(cat => (
              <div key={cat.id} className="px-4 py-3 flex items-center gap-4">
                <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cat.cor + "20" }}>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.cor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm">{cat.nome}</p>
                  <p className="text-xs text-muted-foreground">/{cat.path}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={cat.ativa !== false} onCheckedChange={() => toggleAtiva(cat)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(cat)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(cat.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl p-4">
        <p className="text-sm font-semibold mb-2">Como funciona</p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
          <li>Crie categorias customizadas que aparecem no menu lateral</li>
          <li>Defina o caminho (path) para a URL da categoria (ex: <code>cola</code> → /cola)</li>
          <li>Ative/desative sem perder os dados</li>
          <li>As categorias criadas aqui aparecem como páginas de Estoque Geral filtradas</li>
        </ul>
      </div>

      <Dialog open={dialogOpen} onOpenChange={() => setDialogOpen(false)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Nome da Categoria *</Label>
              <Input placeholder="Ex: Cola, Parafusos, Acessórios..." value={form.nome} onChange={e => set("nome", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Caminho (URL) *</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/</span>
                <Input placeholder="Ex: cola, parafusos..." value={form.path} onChange={e => set("path", e.target.value.toLowerCase().replace(/\s/g, "-"))} />
              </div>
              <p className="text-xs text-muted-foreground">Só letras minúsculas e hífens</p>
            </div>
            <div className="space-y-1">
              <Label>Cor</Label>
              <div className="flex items-center gap-3">
                <input type="color" value={form.cor} onChange={e => set("cor", e.target.value)} className="w-10 h-10 rounded-lg border border-border cursor-pointer" />
                <Input value={form.cor} onChange={e => set("cor", e.target.value)} className="flex-1" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={form.ativa} onCheckedChange={v => set("ativa", v)} />
              <Label>Ativa (visível no menu)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.nome || !form.path}>{editItem ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}