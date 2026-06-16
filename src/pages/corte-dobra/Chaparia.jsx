import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Layers, ShoppingCart, Warehouse, Search,
  CheckCircle2, RefreshCw, X, Plus, Paperclip, Loader2
} from "lucide-react";
import ChapaFormDialog from "@/components/corte-dobra/ChapaFormDialog";
import ChapaCard from "@/components/corte-dobra/ChapaCard";

function EditarQuantDialog({ chapa, open, onClose, onSave }) {
  const [qtd, setQtd] = useState(chapa?.quantidade_disponivel || 0);
  const [status, setStatus] = useState(chapa?.status || "disponivel");
  const [motivo, setMotivo] = useState("");
  const [anexoUrl, setAnexoUrl] = useState("");
  const [anexoNome, setAnexoNome] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  React.useEffect(() => {
    if (open && chapa) {
      setQtd(chapa.quantidade_disponivel ?? 0);
      setStatus(chapa.status || "disponivel");
      setMotivo("");
      setAnexoUrl("");
      setAnexoNome("");
    }
  }, [open, chapa]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAnexoUrl(file_url);
    setAnexoNome(file.name);
    setUploading(false);
  };

  const qtdMudou = qtd !== (chapa?.quantidade_disponivel ?? 0);
  const canSave = (motivo.trim() && qtdMudou) || (motivo.trim() && anexoUrl);

  const handleSave = () => {
    const historicoAntigo = chapa?.historico_movimentacoes;
    let historico = [];
    try { if (historicoAntigo) historico = JSON.parse(historicoAntigo); } catch {}
    historico.push({
      data: new Date().toISOString(),
      motivo: motivo.trim(),
      qtd_antes: chapa?.quantidade_disponivel ?? 0,
      qtd_depois: qtd,
      anexo_url: anexoUrl || null,
      anexo_nome: anexoNome || null,
    });
    onSave({
      quantidade_disponivel: qtd,
      status,
      historico_movimentacoes: JSON.stringify(historico),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Atualizar Chapa</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label>Quantidade Disponível</Label>
            <Input type="number" value={qtd} onChange={e => setQtd(Number(e.target.value))} min={0} max={chapa?.quantidade_total} />
            <p className="text-xs text-muted-foreground">Total original: {chapa?.quantidade_total} pcs</p>
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="parcial">Parcial</SelectItem>
                <SelectItem value="consumido">Consumido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Motivo da alteração *</Label>
            <Input placeholder="Ex: consumo em produção, perda..." value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Anexar imagem (opcional)</Label>
            <input ref={fileRef} type="file" className="hidden" accept="image/*" capture="environment"
              onChange={e => handleUpload(e.target.files[0])} />
            {anexoUrl ? (
              <div className="flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs">
                <img src={anexoUrl} alt="Anexo" className="w-10 h-10 object-cover rounded" />
                <span className="truncate flex-1 text-emerald-800 font-medium">{anexoNome}</span>
                <button onClick={() => { setAnexoUrl(""); setAnexoNome(""); }} className="text-emerald-600 hover:text-red-500"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <Button type="button" variant="outline" className="w-full border-dashed border-2 h-10 text-sm gap-2"
                onClick={() => fileRef.current.click()} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                {uploading ? "Enviando..." : "Anexar imagem"}
              </Button>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Chaparia() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDestino, setFiltroDestino] = useState("todos");
  const [editChapa, setEditChapa] = useState(null);
  const [fotoViewer, setFotoViewer] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  const isAdmin = user?.role === "admin";

  const { data: chapas = [], isLoading } = useQuery({
    queryKey: ["chapas-cd"],
    queryFn: () => base44.entities.ChapaCD.list("-created_date", 200),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChapaCD.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["chapas-cd"]); setEditChapa(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ChapaCD.delete(id),
    onSuccess: () => qc.invalidateQueries(["chapas-cd"]),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.ChapaCD.create(data),
    onSuccess: () => { qc.invalidateQueries(["chapas-cd"]); setShowForm(false); },
  });

  // Próximo código CHxxxx
  const proximoCodigo = (() => {
    let maxN = 0;
    chapas.forEach(c => {
      const m = c.codigo?.match(/^CH(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
    });
    return `CH${String(maxN + 1).padStart(4, "0")}`;
  })();

  const filtradas = chapas.filter(c => {
    const matchBusca = !busca || [c.codigo, c.bobina_descricao, c.numero_pedido, c.cliente].some(v => v?.toLowerCase().includes(busca.toLowerCase()));
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus || (filtroStatus === "disponivel" && !c.status);
    const matchDestino = filtroDestino === "todos" || c.destino === filtroDestino;
    return matchBusca && matchStatus && matchDestino;
  });

  const totalDisponiveis = chapas.filter(c => (c.status === "disponivel" || !c.status) && c.destino === "estoque").reduce((s, c) => s + (c.quantidade_disponivel || 0), 0);
  const totalPedido = chapas.filter(c => (c.status === "disponivel" || !c.status) && c.destino === "pedido_direto").reduce((s, c) => s + (c.quantidade_disponivel || 0), 0);
  const totalConsumido = chapas.filter(c => c.status === "consumido").reduce((s, c) => s + (c.quantidade_total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chaparia</h1>
          <p className="text-sm text-muted-foreground">Estoque de chapas — Desbobinadeira e entrada manual</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries(["chapas-cd"])} className="gap-1">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Nova Chapa
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <Warehouse className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
          <p className="text-2xl font-black text-emerald-700">{totalDisponiveis}</p>
          <p className="text-xs text-emerald-600 font-semibold">Chapas em Estoque</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <ShoppingCart className="w-6 h-6 mx-auto mb-1 text-blue-600" />
          <p className="text-2xl font-black text-blue-700">{totalPedido}</p>
          <p className="text-xs text-blue-600 font-semibold">Reservadas para Pedido</p>
        </div>
        <div className="bg-slate-50 border border-border rounded-xl p-4 text-center">
          <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-slate-500" />
          <p className="text-2xl font-black text-slate-600">{totalConsumido}</p>
          <p className="text-xs text-slate-500 font-semibold">Consumidas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por bobina, pedido ou cliente..."
            className="pl-9"
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
        </div>
        <Select value={filtroDestino} onValueChange={setFiltroDestino}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Destino" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos destinos</SelectItem>
            <SelectItem value="estoque">Estoque</SelectItem>
            <SelectItem value="pedido_direto">Pedido Direto</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos status</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="parcial">Parcial</SelectItem>
            <SelectItem value="consumido">Consumido</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Nenhuma chapa encontrada</p>
          <p className="text-xs mt-1">As chapas aparecem aqui ao finalizar ordens da Desbobinadeira</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(c => {
            const isConsumed = c.status === "consumido" || c.status === "cancelado";
            return (
              <ChapaCard
                key={c.id}
                chapa={c}
                isAdmin={isAdmin}
                isConsumed={isConsumed}
                onEdit={(chapa) => setEditChapa(chapa)}
                onDelete={(id) => deleteMut.mutate(id)}
                onViewFoto={(url) => setFotoViewer(url)}
              />
            );
          })}
        </div>
      )}

      {/* Dialog editar */}
      <EditarQuantDialog
        chapa={editChapa}
        open={!!editChapa}
        onClose={() => setEditChapa(null)}
        onSave={(data) => updateMut.mutate({ id: editChapa.id, data })}
      />

      {/* Form nova chapa manual */}
      <ChapaFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={(data) => createMut.mutate(data)}
        proximoCodigo={proximoCodigo}
      />

      {/* Viewer foto */}
      {fotoViewer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setFotoViewer(null)}>
          <div className="relative max-w-2xl w-full">
            <button className="absolute -top-10 right-0 text-white hover:text-slate-300" onClick={() => setFotoViewer(null)}>
              <X className="w-7 h-7" />
            </button>
            <img src={fotoViewer} alt="Foto de finalização" className="w-full rounded-xl shadow-2xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  );
}