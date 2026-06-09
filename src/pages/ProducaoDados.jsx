import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Pencil, Check, X, ChevronDown, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const PRODUTOS = ["TELHA", "TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA", "BOBININHA", "CUMEEIRA", "PAINEL"];

// Máquinas disponíveis (sem COLAGEM — ela é controlada pelo toggle separado)
const MAQUINAS_DISPONIVEIS = [
  "TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA"
];

// string "TP - 40, COLAGEM" <-> { maquinas: ["TP - 40"], colagem: true }
const parseFluxo = (str) => {
  const arr = str ? str.split(",").map(s => s.trim()).filter(Boolean) : [];
  const colagem = arr.includes("COLAGEM");
  return { maquinas: arr.filter(m => m !== "COLAGEM"), colagem };
};
const buildFluxo = (maquinas, colagem) => {
  const arr = [...maquinas];
  if (colagem) arr.push("COLAGEM");
  return arr.join(", ");
};

// Componente de seleção com ordem + toggle colagem
function MaquinasSelect({ value, onChange }) {
  const { maquinas: selected, colagem } = parseFluxo(value);

  const toggle = (m) => {
    const next = selected.includes(m) ? selected.filter(x => x !== m) : [...selected, m];
    onChange(buildFluxo(next, colagem));
  };
  const moveUp = (i) => {
    if (i === 0) return;
    const next = [...selected];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    onChange(buildFluxo(next, colagem));
  };
  const moveDown = (i) => {
    if (i === selected.length - 1) return;
    const next = [...selected];
    [next[i], next[i + 1]] = [next[i + 1], next[i]];
    onChange(buildFluxo(next, colagem));
  };
  const toggleColagem = () => onChange(buildFluxo(selected, !colagem));

  const label = selected.length === 0 && !colagem
    ? null
    : [...selected, ...(colagem ? ["COLAGEM"] : [])].join(" → ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1 min-w-[150px] max-w-[260px] h-8 rounded-md border border-input bg-transparent px-2 text-xs text-left hover:bg-muted/40 transition-colors">
          <span className="flex-1 truncate">
            {label ? <span className="font-medium">{label}</span> : <span className="text-muted-foreground">Selecionar...</span>}
          </span>
          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        {/* Selecionar máquinas */}
        <p className="text-xs font-semibold text-muted-foreground mb-2">1. Selecionar máquinas</p>
        <div className="space-y-1 mb-3">
          {MAQUINAS_DISPONIVEIS.map(m => (
            <button
              key={m}
              onClick={() => toggle(m)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${selected.includes(m) ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted"}`}
            >
              <div className={`w-3.5 h-3.5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${selected.includes(m) ? "border-primary bg-primary" : "border-muted-foreground"}`}>
                {selected.includes(m) && <Check className="w-2 h-2 text-primary-foreground" />}
              </div>
              {m}
              {selected.includes(m) && (
                <span className="ml-auto text-[10px] text-muted-foreground font-normal">#{selected.indexOf(m) + 1}</span>
              )}
            </button>
          ))}
        </div>

        {/* Ordenar selecionadas */}
        {selected.length > 1 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground mb-2">2. Ordenar (sequência de produção)</p>
            <div className="space-y-1 mb-3 bg-muted/30 rounded-lg p-2">
              {selected.map((m, i) => (
                <div key={m} className="flex items-center gap-1.5 text-xs">
                  <span className="w-4 h-4 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold flex-shrink-0">{i + 1}</span>
                  <span className="flex-1 font-medium">{m}</span>
                  <button onClick={() => moveUp(i)} disabled={i === 0} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button onClick={() => moveDown(i)} disabled={i === selected.length - 1} className="p-0.5 rounded hover:bg-muted disabled:opacity-30">
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Toggle Colagem */}
        <div className={`flex items-center justify-between px-2 py-2 rounded-lg border-2 transition-colors ${colagem ? "border-orange-400 bg-orange-50" : "border-border bg-muted/20"}`}>
          <div>
            <p className="text-xs font-bold">Vai para Colagem?</p>
            <p className="text-[10px] text-muted-foreground">Adiciona COLAGEM ao final do fluxo</p>
          </div>
          <Switch checked={colagem} onCheckedChange={toggleColagem} />
        </div>

        {value && (
          <button onClick={() => onChange("")} className="w-full mt-2 text-xs text-muted-foreground hover:text-destructive pt-2 border-t">
            Limpar tudo
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// helper para exibir badges na tabela
const maqsToArray = (str) => str ? str.split(",").map(s => s.trim()).filter(Boolean) : [];

// ─── Modelos de Produto ─────────────────────────────────────────
function TabelaModelos() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ produto: "", modelo: "", maquinas: "", espessuras: "" });
  const [editForm, setEditForm] = useState({});

  const { data: modelos = [] } = useQuery({
    queryKey: ["modelos-produto"],
    queryFn: () => base44.entities.ModeloProduto.list("produto"),
  });

  const createM = useMutation({
    mutationFn: (d) => base44.entities.ModeloProduto.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["modelos-produto"] }); setAdding(false); setForm({ produto: "", modelo: "", maquinas: "", espessuras: "" }); toast.success("Modelo adicionado!"); },
  });

  const updateM = useMutation({
    mutationFn: ({ id, d }) => base44.entities.ModeloProduto.update(id, d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["modelos-produto"] }); setEditId(null); toast.success("Salvo!"); },
  });

  const deleteM = useMutation({
    mutationFn: (id) => base44.entities.ModeloProduto.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["modelos-produto"] }); toast.success("Removido!"); },
  });

  const startEdit = (m) => { setEditId(m.id); setEditForm({ produto: m.produto, modelo: m.modelo, maquinas: m.maquinas || "", espessuras: m.espessuras || "" }); };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-bold">Produtos × Modelos × Espessuras</h3>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1"><Plus className="w-3 h-3" />Adicionar</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-2 text-left font-semibold">Produto</th>
              <th className="px-4 py-2 text-left font-semibold">Modelo</th>
              <th className="px-4 py-2 text-left font-semibold">Máquinas</th>
              <th className="px-4 py-2 text-left font-semibold">Espessuras</th>
              <th className="px-4 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {adding && (
              <tr className="bg-primary/5">
                <td className="px-3 py-2">
                  <Select value={form.produto} onValueChange={v => setForm(f => ({ ...f, produto: v }))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Produto" /></SelectTrigger>
                    <SelectContent>{PRODUTOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2"><Input className="h-8 text-xs" placeholder="ex: TP-40 RVM" value={form.modelo} onChange={e => setForm(f => ({ ...f, modelo: e.target.value }))} /></td>
                <td className="px-3 py-2"><MaquinasSelect value={form.maquinas} onChange={v => setForm(f => ({ ...f, maquinas: v }))} /></td>
                <td className="px-3 py-2"><Input className="h-8 text-xs" placeholder="ex: 0,43 / 0,50 / 0,65" value={form.espessuras} onChange={e => setForm(f => ({ ...f, espessuras: e.target.value }))} /></td>
                <td className="px-3 py-2 flex gap-1">
                  <Button size="icon" className="h-7 w-7" onClick={() => createM.mutate(form)}><Check className="w-3 h-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setAdding(false)}><X className="w-3 h-3" /></Button>
                </td>
              </tr>
            )}
            {modelos.map(m => (
              <tr key={m.id} className="hover:bg-muted/30">
                {editId === m.id ? (
                  <>
                    <td className="px-3 py-2">
                      <Select value={editForm.produto} onValueChange={v => setEditForm(f => ({ ...f, produto: v }))}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{PRODUTOS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-2"><Input className="h-8 text-xs" value={editForm.modelo} onChange={e => setEditForm(f => ({ ...f, modelo: e.target.value }))} /></td>
                    <td className="px-3 py-2"><MaquinasSelect value={editForm.maquinas} onChange={v => setEditForm(f => ({ ...f, maquinas: v }))} /></td>
                    <td className="px-3 py-2"><Input className="h-8 text-xs" value={editForm.espessuras} onChange={e => setEditForm(f => ({ ...f, espessuras: e.target.value }))} /></td>
                    <td className="px-3 py-2 flex gap-1">
                      <Button size="icon" className="h-7 w-7" onClick={() => updateM.mutate({ id: m.id, d: editForm })}><Check className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditId(null)}><X className="w-3 h-3" /></Button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{m.produto}</Badge></td>
                    <td className="px-4 py-2.5 font-medium">{m.modelo}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1">
                        {maqsToArray(m.maquinas).length > 0
                          ? maqsToArray(m.maquinas).map((mq, idx, arr) => (
                            <React.Fragment key={mq}>
                              <Badge
                                variant="secondary"
                                className={`text-xs font-semibold ${mq === "COLAGEM" ? "bg-orange-100 text-orange-700 border-orange-300" : ""}`}
                              >
                                <span className="text-[10px] opacity-60 mr-1">#{idx + 1}</span>{mq}
                              </Badge>
                              {idx < arr.length - 1 && <span className="text-muted-foreground text-xs">→</span>}
                            </React.Fragment>
                          ))
                          : <span className="text-muted-foreground text-xs">—</span>
                        }
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.espessuras || "—"}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(m)}><Pencil className="w-3 h-3" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteM.mutate(m.id)}><Trash2 className="w-3 h-3" /></Button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
            {modelos.length === 0 && !adding && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground italic">Nenhum modelo cadastrado</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Lista genérica (Vendedores / RVMs / Maquinários / EPS) ─────
function ListaDados({ tipo, titulo, placeholder }) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");

  const { data: itens = [] } = useQuery({
    queryKey: ["dados-producao", tipo],
    queryFn: () => base44.entities.DadosProducao.filter({ tipo, ativo: true }),
  });

  const createM = useMutation({
    mutationFn: (d) => base44.entities.DadosProducao.create(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["dados-producao", tipo] }); setNovo(""); },
  });

  const deleteM = useMutation({
    mutationFn: (id) => base44.entities.DadosProducao.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dados-producao", tipo] }),
  });

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-bold">{titulo}</h3>
      </div>
      <div className="p-3 space-y-2">
        <div className="flex gap-2">
          <Input
            className="h-8 text-sm"
            placeholder={placeholder}
            value={novo}
            onChange={e => setNovo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && novo.trim() && createM.mutate({ tipo, valor: novo.trim(), ativo: true })}
          />
          <Button size="sm" className="h-8 gap-1" onClick={() => novo.trim() && createM.mutate({ tipo, valor: novo.trim(), ativo: true })}>
            <Plus className="w-3 h-3" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          {itens.map(i => (
            <div key={i.id} className="flex items-center gap-1 bg-muted/60 rounded-lg px-2.5 py-1 text-sm">
              <span>{i.valor}</span>
              <button onClick={() => deleteM.mutate(i.id)} className="text-muted-foreground hover:text-destructive ml-1">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {itens.length === 0 && <p className="text-xs text-muted-foreground italic">Nenhum cadastrado</p>}
        </div>
      </div>
    </div>
  );
}

export default function ProducaoDados() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Dados de Produção</h2>
        <p className="text-sm text-muted-foreground">Gerencie modelos, vendedores, cores e maquinários disponíveis no sistema</p>
      </div>

      <TabelaModelos />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ListaDados tipo="vendedor" titulo="Vendedores" placeholder="Ex: VERA (PG)" />
        <ListaDados tipo="rvm" titulo="RVM / Cores" placeholder="Ex: Natural, Preta - 9005, Azul - 5010" />
        <ListaDados tipo="maquinario" titulo="Maquinários" placeholder="Ex: TP - 25, TP - 40" />
        <ListaDados tipo="eps" titulo="Tipos de EPS" placeholder="Ex: EPS - TP 40, EPS - COLONIAL" />
      </div>
    </div>
  );
}