import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Factory, CalendarDays, Pencil, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const UNIDADES = ["Matriz AJL", "Pinhais", "Ivaiporã"];

const emptyForm = {
  data: format(new Date(), "yyyy-MM-dd"),
  unidade: "Matriz AJL",
  bobina_id: "",
  bobina_codigo: "",
  bobina_cor: "",
  metros_perfiladeira: "",
  metros_colagem: "",
  metros_total: "",
  telha_simples: "",
  telha_eps: "",
  telha_eps_manta: "",
  telha_eps_telha: "",
  telha_bandeja: "",
  bobininha: "",
  cumeeira: "",
  painel: "",
  observacoes: "",
};

export default function Producao() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedId, setExpandedId] = useState(null);
  const queryClient = useQueryClient();

  // Só bobinas em estoque (não arquivadas, status ativo)
  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-estoque"],
    queryFn: () => base44.entities.Bobina.filter({ arquivada: false }),
  });

  const { data: producoes = [], isLoading } = useQuery({
    queryKey: ["producoes"],
    queryFn: () => base44.entities.ProducaoDiaria.list("-data"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProducaoDiaria.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["producoes"] }); setDialogOpen(false); toast.success("Produção registrada!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProducaoDiaria.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["producoes"] }); setDialogOpen(false); setEditItem(null); toast.success("Produção atualizada!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProducaoDiaria.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["producoes"] }); toast.success("Registro excluído!"); },
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleBobinaChange = (id) => {
    const b = bobinas.find(b => b.id === id);
    if (b) {
      set("bobina_id", id);
      set("bobina_codigo", b.codigo || "");
      set("bobina_cor", b.cor || "");
    }
  };

  const calcTotal = (f) => {
    const perf = Number(f.metros_perfiladeira) || 0;
    const col = Number(f.metros_colagem) || 0;
    return perf + col;
  };

  const handleSave = () => {
    const data = {
      ...form,
      metros_perfiladeira: Number(form.metros_perfiladeira) || 0,
      metros_colagem: Number(form.metros_colagem) || 0,
      metros_total: calcTotal(form),
      telha_simples: Number(form.telha_simples) || 0,
      telha_eps: Number(form.telha_eps) || 0,
      telha_eps_manta: Number(form.telha_eps_manta) || 0,
      telha_eps_telha: Number(form.telha_eps_telha) || 0,
      telha_bandeja: Number(form.telha_bandeja) || 0,
      bobininha: Number(form.bobininha) || 0,
      cumeeira: Number(form.cumeeira) || 0,
      painel: Number(form.painel) || 0,
    };
    if (editItem) updateMutation.mutate({ id: editItem.id, data });
    else createMutation.mutate(data);
  };

  const openNew = () => { setEditItem(null); setForm(emptyForm); setDialogOpen(true); };
  const openEdit = (p) => {
    setEditItem(p);
    setForm({ ...p, metros_perfiladeira: p.metros_perfiladeira || "", metros_colagem: p.metros_colagem || "", telha_simples: p.telha_simples || "", telha_eps: p.telha_eps || "", telha_eps_manta: p.telha_eps_manta || "", telha_eps_telha: p.telha_eps_telha || "", telha_bandeja: p.telha_bandeja || "", bobininha: p.bobininha || "", cumeeira: p.cumeeira || "", painel: p.painel || "" });
    setDialogOpen(true);
  };

  // Group by date
  const grouped = producoes.reduce((acc, p) => {
    const key = p.data;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  const totalMes = producoes.reduce((s, p) => s + (p.metros_total || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Produção Diária</h1>
          <p className="text-sm text-muted-foreground">Registro de metros produzidos por dia</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge className="bg-primary/10 text-primary border border-primary/20 px-3 py-1">
            Total: {totalMes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
          </Badge>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Registrar Dia
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Factory className="w-12 h-12 text-muted-foreground mb-4" />
          <p className="font-semibold">Nenhum registro de produção</p>
          <p className="text-sm text-muted-foreground mb-4">Comece registrando a produção de hoje</p>
          <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" />Registrar</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([date, items]) => {
            const dayTotal = items.reduce((s, p) => s + (p.metros_total || 0), 0);
            const isExpanded = expandedId === date;
            return (
              <div key={date} className="bg-card border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : date)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/20 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{format(new Date(date + "T12:00:00"), "dd 'de' MMMM yyyy", { locale: ptBR })}</span>
                    <Badge variant="outline">{items.length} {items.length === 1 ? "registro" : "registros"}</Badge>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-primary">{dayTotal.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>
                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {items.map(p => (
                      <div key={p.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary">{p.unidade}</Badge>
                              {p.bobina_cor && <span className="text-sm font-medium">{p.bobina_cor}</span>}
                              {p.bobina_codigo && <span className="text-xs text-muted-foreground">Cód: {p.bobina_codigo}</span>}
                            </div>
                            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <span>Perfiladeira: <b>{(p.metros_perfiladeira || 0).toLocaleString("pt-BR")}m</b></span>
                              <span>Colagem: <b>{(p.metros_colagem || 0).toLocaleString("pt-BR")}m</b></span>
                              <span>Total: <b className="text-primary">{(p.metros_total || 0).toLocaleString("pt-BR")}m</b></span>
                              {p.bobininha > 0 && <span>Bobininha: <b>{p.bobininha}m</b></span>}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                              {p.telha_simples > 0 && <span>Telha: {p.telha_simples}m</span>}
                              {p.telha_eps > 0 && <span>+EPS: {p.telha_eps}m</span>}
                              {p.telha_eps_manta > 0 && <span>+EPS+Manta: {p.telha_eps_manta}m</span>}
                              {p.telha_eps_telha > 0 && <span>+EPS+Telha: {p.telha_eps_telha}m</span>}
                              {p.telha_bandeja > 0 && <span>Bandeja: {p.telha_bandeja}m</span>}
                              {p.cumeeira > 0 && <span>Cumeeira: {p.cumeeira}m</span>}
                              {p.painel > 0 && <span>Painel: {p.painel}m</span>}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="w-3 h-3" /></Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="w-3 h-3" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={() => { setDialogOpen(false); setEditItem(null); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editItem ? "Editar Produção" : "Registrar Produção"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data *</Label>
                <Input type="date" value={form.data} onChange={e => set("data", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Unidade *</Label>
                <Select value={form.unidade} onValueChange={v => set("unidade", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Bobina em uso</Label>
              <Select value={form.bobina_id} onValueChange={handleBobinaChange}>
                <SelectTrigger><SelectValue placeholder="Selecionar bobina em estoque" /></SelectTrigger>
                <SelectContent>
                  {bobinas.filter(b => !b.arquivada).map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.cor} — {b.chapa} — {b.peso_kg ? `${b.peso_kg}kg` : ""} {b.codigo ? `(${b.codigo})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border border-border rounded-lg p-3 space-y-3">
              <p className="text-sm font-semibold">Metros Produzidos</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Perfiladeira (m)</Label>
                  <Input type="number" placeholder="0" value={form.metros_perfiladeira} onChange={e => set("metros_perfiladeira", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Colagem (m)</Label>
                  <Input type="number" placeholder="0" value={form.metros_colagem} onChange={e => set("metros_colagem", e.target.value)} />
                </div>
              </div>
              <div className="bg-primary/5 rounded-lg px-3 py-2 text-sm font-semibold text-primary">
                Total: {calcTotal(form).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
              </div>
            </div>

            <div className="border border-border rounded-lg p-3 space-y-3">
              <p className="text-sm font-semibold">Tipos de Produto</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  ["telha_simples", "Telha"],
                  ["telha_eps", "Telha + EPS"],
                  ["telha_eps_manta", "Telha + EPS + Manta"],
                  ["telha_eps_telha", "Telha + EPS + Telha"],
                  ["telha_bandeja", "Telha Bandeja"],
                  ["bobininha", "Bobininha"],
                  ["cumeeira", "Cumeeira"],
                  ["painel", "Painel"],
                ].map(([key, label]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs">{label} (m)</Label>
                    <Input type="number" placeholder="0" value={form[key]} onChange={e => set(key, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea placeholder="Anotações do dia..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.data || !form.unidade}>{editItem ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}