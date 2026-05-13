import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Search, Pencil, Trash2, Package, Droplets, Wrench } from "lucide-react";
import { toast } from "sonner";
import ProdutoFormDialog from "@/components/produtos/ProdutoFormDialog";
import DeleteConfirmDialog from "@/components/stock/DeleteConfirmDialog";
import EmptyState from "@/components/stock/EmptyState";

const categoryIcons = {
  Bobininha: Package,
  Cumeeira: Package,
  Cola: Droplets,
  Consumivel: Wrench,
};

const categoryColors = {
  Bobininha: "bg-blue-500/10 text-blue-700 border-blue-200",
  Cumeeira: "bg-green-500/10 text-green-700 border-green-200",
  Cola: "bg-amber-500/10 text-amber-700 border-amber-200",
  Consumivel: "bg-purple-500/10 text-purple-700 border-purple-200",
};

export default function Estoque() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [deleteItem, setDeleteItem] = useState(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const queryClient = useQueryClient();

  const { data: produtos = [], isLoading } = useQuery({
    queryKey: ["produtos"],
    queryFn: () => base44.entities.Produto.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Produto.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setDialogOpen(false);
      toast.success("Produto adicionado!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Produto.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setDialogOpen(false);
      setEditItem(null);
      toast.success("Produto atualizado!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Produto.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["produtos"] });
      setDeleteItem(null);
      toast.success("Produto excluído!");
    },
  });

  const handleSave = (data) => {
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filtered = produtos.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch =
      p.nome?.toLowerCase().includes(q) ||
      p.cor?.toLowerCase().includes(q) ||
      p.observacoes?.toLowerCase().includes(q);
    const matchTab = activeTab === "all" || p.categoria === activeTab;
    return matchSearch && matchTab;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Outros Produtos</h1>
          <p className="text-sm text-muted-foreground">Bobininha, Cumeeira, Cola e Consumíveis</p>
        </div>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          Novo Produto
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-muted">
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="Bobininha">Bobininha</TabsTrigger>
          <TabsTrigger value="Cumeeira">Cumeeira</TabsTrigger>
          <TabsTrigger value="Cola">Cola</TabsTrigger>
          <TabsTrigger value="Consumivel">Consumível</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Nenhum produto encontrado"
          description="Adicione produtos ao estoque."
          onAdd={() => { setEditItem(null); setDialogOpen(true); }}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((produto) => {
            const Icon = categoryIcons[produto.categoria] || Package;
            return (
              <div
                key={produto.id}
                className="bg-card border border-border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{produto.nome}</p>
                      <Badge variant="outline" className={categoryColors[produto.categoria] || ""}>
                        {produto.categoria}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {produto.cor && <span>{produto.cor}</span>}
                      {produto.observacoes && <span>· {produto.observacoes}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  {produto.quantidade != null && (
                    <Badge variant="outline" className="font-semibold">
                      {produto.quantidade} {produto.unidade || "un"}
                    </Badge>
                  )}
                  {produto.peso_kg && (
                    <Badge variant="secondary">{produto.peso_kg} kg</Badge>
                  )}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditItem(produto); setDialogOpen(true); }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteItem(produto)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ProdutoFormDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditItem(null); }}
        onSave={handleSave}
        editItem={editItem}
        defaultCategoria={activeTab !== "all" ? activeTab : ""}
      />

      <DeleteConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={() => deleteMutation.mutate(deleteItem.id)}
        itemName={deleteItem ? deleteItem.nome : ""}
      />
    </div>
  );
}