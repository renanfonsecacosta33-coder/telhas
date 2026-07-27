import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Package, Plus, Search, ChevronLeft, Archive,
  Weight, MapPin, AlertTriangle, CheckCircle2, Layers
} from "lucide-react";
import BobinaFormDialog from "@/components/bobinas/BobinaFormDialog";

export default function EstoqueExpedicao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showArquivadas, setShowArquivadas] = useState(false);

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["bobinas-expedicao"],
    queryFn: () => base44.entities.Bobina?.filter?.({ setor: "expedicao" }, "-created_date", 500) ?? [],
    retry: false,
  });

  const arquivarMutation = useMutation({
    mutationFn: ({ id, arquivada }) => base44.entities.Bobina.update(id, { arquivada }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bobinas-expedicao"] });
      toast.success("Status atualizado!");
    },
  });

  const ativas    = bobinas.filter(b => !b.arquivada);
  const arquivadas = bobinas.filter(b => b.arquivada);
  const base      = showArquivadas ? arquivadas : ativas;

  const filtered = base.filter(b => {
    if (!search) return true;
    const q = search.toLowerCase();
    return b.codigo?.toLowerCase().includes(q) ||
           b.cor?.toLowerCase().includes(q) ||
           b.chapa?.toLowerCase().includes(q) ||
           b.fornecedor?.toLowerCase().includes(q);
  });

  const totalPeso = ativas.reduce((s, b) => s + (b.peso_kg || 0), 0);

  // Gerar próximo código EX (Expedição)
  const [proximoNum] = useState(() => {
    const nums = bobinas.map(b => b.codigo).filter(c => /^EX\d+$/i.test(c || "")).map(c => parseInt(c.slice(2)));
    return (nums.length > 0 ? Math.max(...nums) : 0) + 1;
  });
  const proximoCodigo = `EX${String(proximoNum).padStart(4, "0")}`;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate("/expedicao")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Package className="w-6 h-6 text-blue-600" /> Estoque de Bobinas — Expedição
          </h1>
          <p className="text-sm text-muted-foreground">Bobinas disponíveis para a máquina de Frisada</p>
        </div>
        <Button onClick={() => { setEditItem(null); setDialogOpen(true); }} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nova Bobina
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <Package className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-blue-700">{ativas.length}</p>
          <p className="text-xs text-muted-foreground">Em Estoque</p>
        </div>
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-center">
          <Weight className="w-5 h-5 text-teal-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-teal-700">{(totalPeso / 1000).toFixed(1)}t</p>
          <p className="text-xs text-muted-foreground">Total em Estoque</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
          <Archive className="w-5 h-5 text-gray-400 mx-auto mb-1" />
          <p className="text-2xl font-bold">{arquivadas.length}</p>
          <p className="text-xs text-muted-foreground">Arquivadas</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por código, cor, espessura..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button
          variant={showArquivadas ? "default" : "outline"}
          size="sm"
          onClick={() => setShowArquivadas(s => !s)}
        >
          <Archive className="w-4 h-4 mr-1" />
          {showArquivadas ? "Ver Ativas" : `Arquivadas (${arquivadas.length})`}
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-muted border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nenhuma bobina encontrada</p>
          <Button className="mt-4 bg-blue-600 hover:bg-blue-700" onClick={() => { setEditItem(null); setDialogOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Adicionar Bobina
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => {
            const alerta = b.peso_kg < (b.estoque_minimo_kg || 0);
            return (
              <div key={b.id} className={`border rounded-xl p-4 bg-card hover:bg-muted/20 transition-colors ${alerta ? "border-red-300" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {b.codigo && <span className="font-mono font-bold text-sm text-primary">{b.codigo}</span>}
                      {b.qualidade && <Badge variant="secondary" className="text-[10px]">{b.qualidade}</Badge>}
                      {b.chapa && <span className="text-xs text-muted-foreground">{b.chapa}mm</span>}
                      {b.cor && <span className="text-xs font-medium text-blue-600">{b.cor}</span>}
                    </div>
                    <div className="flex gap-4 text-xs flex-wrap">
                      <span className="text-emerald-600 font-bold">
                        {(b.peso_kg || 0).toLocaleString("pt-BR")} kg
                      </span>
                      {b.largura_mm && <span className="text-muted-foreground">{b.largura_mm}mm larg.</span>}
                      {b.fornecedor && <span className="text-muted-foreground">{b.fornecedor}</span>}
                    </div>
                    {alerta && (
                      <div className="flex items-center gap-1 text-red-600 text-xs font-semibold">
                        <AlertTriangle className="w-3 h-3" /> Abaixo do estoque mínimo ({b.estoque_minimo_kg} kg)
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => { setEditItem(b); setDialogOpen(true); }}>
                      Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-7 text-muted-foreground"
                      onClick={() => arquivarMutation.mutate({ id: b.id, arquivada: !b.arquivada })}>
                      {b.arquivada ? "Restaurar" : "Arquivar"}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reutiliza BobinaFormDialog com setor=expedicao */}
      {dialogOpen && (
        <BobinaFormDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditItem(null); }}
          editItem={editItem ? { ...editItem, setor: "expedicao" } : null}
          setorOverride="expedicao"
          codigoPrefixo="EX"
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["bobinas-expedicao"] });
            setDialogOpen(false);
            setEditItem(null);
          }}
        />
      )}
    </div>
  );
}
