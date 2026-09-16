import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Truck,
  User,
  Calendar,
  StickyNote,
  DollarSign,
  Trash2,
  Plus,
  GripVertical,
  X,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "distribuido", label: "Distribuído", cor: "bg-blue-100 text-blue-700" },
  { value: "carregado", label: "Carregado", cor: "bg-amber-100 text-amber-700" },
  { value: "em_transito", label: "Em Trânsito", cor: "bg-purple-100 text-purple-700" },
  { value: "expedido", label: "Expedido (Arquivado)", cor: "bg-green-100 text-green-700" },
  { value: "cancelado", label: "Cancelado", cor: "bg-red-100 text-red-700" },
];

const BARRACAO_OPTIONS = [
  { value: "telhas", label: "🏠 Telhas" },
  { value: "corte_dobra", label: "🏗️ Corte & Dobra" },
  { value: "ambos", label: "📦 Ambos" },
  { value: "aguardando", label: "⏳ Aguardando" },
];

export default function EditarRotaDialog({ open, onOpenChange, rota }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  // Campos gerais da rota
  const [titulo, setTitulo] = useState("");
  const [motoristaNome, setMotoristaNome] = useState("");
  const [placa, setPlaca] = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [entregaDate, setEntregaDate] = useState("");
  const [embarqueDate, setEmbarqueDate] = useState("");
  const [totalValor, setTotalValor] = useState("");
  const [observacao, setObservacao] = useState("");
  const [notaGeral, setNotaGeral] = useState("");
  const [status, setStatus] = useState("distribuido");

  // Itens (pedidos) da rota
  const [itens, setItens] = useState([]);

  // Inicializa os campos quando a rota muda
  useEffect(() => {
    if (rota) {
      setTitulo(rota.titulo || "");
      setMotoristaNome(rota.motorista_nome || "");
      setPlaca(rota.placa || "");
      setTransportadora(rota.transportadora || "");
      setEntregaDate(rota.entrega_date || "");
      setEmbarqueDate(rota.embarque_date || "");
      setTotalValor(rota.total_valor || "");
      setObservacao(rota.observacao || "");
      setNotaGeral(rota.nota_geral || "");
      setStatus(rota.status || "distribuido");
      try {
        setItens(JSON.parse(rota.itens_json || "[]"));
      } catch {
        setItens([]);
      }
    }
  }, [rota]);

  const handleSave = async () => {
    if (!titulo.trim()) {
      toast.error("O título da rota é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      await base44.entities.RotaEntrega.update(rota.id, {
        titulo: titulo.trim(),
        motorista_nome: motoristaNome.trim(),
        placa: placa.trim().toUpperCase(),
        transportadora: transportadora.trim(),
        entrega_date: entregaDate.trim(),
        embarque_date: embarqueDate.trim(),
        total_valor: totalValor.trim(),
        observacao: observacao.trim(),
        nota_geral: notaGeral.trim(),
        status,
        itens_json: JSON.stringify(itens),
      });
      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rotas-arquivadas"] });
      toast.success("Rota atualizada com sucesso!");
      onOpenChange(false);
    } catch (e) {
      toast.error("Erro ao salvar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  // Funções de edição dos itens
  const updateItem = (index, field, value) => {
    setItens((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: value } : it)));
  };

  const removeItem = (index) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
  };

  const addItem = () => {
    setItens((prev) => [
      ...prev,
      {
        ordem: prev.length + 1,
        numero_pedido: "",
        cliente: "",
        vendedor: "",
        bairro: "",
        pagamento: "",
        valor: "",
        observacao: "",
        barracao_sugerido: "aguardando",
        departamentos: [],
      },
    ]);
  };

  const moveItem = (fromIndex, direction) => {
    const toIndex = fromIndex + direction;
    if (toIndex < 0 || toIndex >= itens.length) return;
    setItens((prev) => {
      const copy = [...prev];
      [copy[fromIndex], copy[toIndex]] = [copy[toIndex], copy[fromIndex]];
      // Recalcula a ordem
      return copy.map((it, i) => ({ ...it, ordem: i + 1 }));
    });
  };

  if (!rota) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" />
            Editar Rota de Entrega
          </DialogTitle>
          <DialogDescription>
            Edite os dados gerais da rota e os pedidos vinculados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Status */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setStatus(s.value)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-all ${
                    status === s.value
                      ? `${s.cor} border-current ring-2 ring-primary/20`
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Título da Rota *</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: ROTA DE ENTREGA PONTA GROSSA"
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Motorista + Placa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <User className="w-3 h-3" /> Motorista
              </label>
              <input
                type="text"
                value={motoristaNome}
                onChange={(e) => setMotoristaNome(e.target.value)}
                placeholder="Nome do motorista"
                className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Truck className="w-3 h-3" /> Placa
              </label>
              <input
                type="text"
                value={placa}
                onChange={(e) => setPlaca(e.target.value)}
                placeholder="ABC-1234"
                className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring uppercase"
              />
            </div>
          </div>

          {/* Transportadora */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Transportadora</label>
            <input
              type="text"
              value={transportadora}
              onChange={(e) => setTransportadora(e.target.value)}
              placeholder="Nome da transportadora"
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Datas */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Data Entrega
              </label>
              <input
                type="text"
                value={entregaDate}
                onChange={(e) => setEntregaDate(e.target.value)}
                placeholder="17/set ou 2026-09-17"
                className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Data Embarque
              </label>
              <input
                type="text"
                value={embarqueDate}
                onChange={(e) => setEmbarqueDate(e.target.value)}
                placeholder="16/set ou 2026-09-16"
                className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </div>

          {/* Valor Total */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3" /> Valor Total
            </label>
            <input
              type="text"
              value={totalValor}
              onChange={(e) => setTotalValor(e.target.value)}
              placeholder="R$ 26.984,66"
              className="w-full h-9 px-3 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>

          {/* Observação */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1">
              <StickyNote className="w-3 h-3" /> Observação
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Observações adicionais..."
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Nota Geral */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nota Geral</label>
            <textarea
              value={notaGeral}
              onChange={(e) => setNotaGeral(e.target.value)}
              placeholder="Nota geral do manifesto..."
              rows={2}
              className="w-full px-3 py-2 rounded-md border border-input bg-transparent text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
            />
          </div>

          {/* Separador */}
          <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                📋 Pedidos da Rota
                <Badge variant="outline" className="text-xs">{itens.length}</Badge>
              </h3>
              <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 text-xs h-7">
                <Plus className="w-3 h-3" /> Adicionar Pedido
              </Button>
            </div>

            {itens.length === 0 ? (
              <div className="bg-muted/50 border border-border rounded-md p-4 text-center text-sm text-muted-foreground">
                Nenhum pedido na rota. Clique em "Adicionar Pedido" para incluir.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {itens.map((it, idx) => (
                  <div
                    key={idx}
                    className="bg-muted/30 border border-border rounded-lg p-3 space-y-2 relative group"
                  >
                    {/* Cabeçalho do item */}
                    <div className="flex items-center gap-2">
                      <div className="flex flex-col gap-0.5">
                        <button
                          type="button"
                          onClick={() => moveItem(idx, -1)}
                          disabled={idx === 0}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px] leading-none"
                          title="Mover para cima"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() => moveItem(idx, 1)}
                          disabled={idx === itens.length - 1}
                          className="text-muted-foreground hover:text-foreground disabled:opacity-30 text-[10px] leading-none"
                          title="Mover para baixo"
                        >
                          ▼
                        </button>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        #{it.ordem || idx + 1}
                      </Badge>
                      <input
                        type="text"
                        value={it.numero_pedido || ""}
                        onChange={(e) => updateItem(idx, "numero_pedido", e.target.value)}
                        placeholder="Nº Pedido"
                        className="h-7 px-2 rounded border border-input bg-transparent text-xs font-bold w-24 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <input
                        type="text"
                        value={it.cliente || ""}
                        onChange={(e) => updateItem(idx, "cliente", e.target.value)}
                        placeholder="Cliente"
                        className="h-7 px-2 rounded border border-input bg-transparent text-xs flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <select
                        value={it.barracao_sugerido || "aguardando"}
                        onChange={(e) => {
                          const v = e.target.value;
                          const deps = [];
                          if (v === "telhas" || v === "ambos") deps.push("telhas");
                          if (v === "corte_dobra" || v === "ambos") deps.push("corte_dobra");
                          if (v === "aguardando") deps.push("expedicao");
                          updateItem(idx, "barracao_sugerido", v);
                          updateItem(idx, "departamentos", deps);
                        }}
                        className="h-7 px-1.5 rounded border border-input bg-transparent text-[10px] font-semibold cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {BARRACAO_OPTIONS.map((b) => (
                          <option key={b.value} value={b.value}>{b.label}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded p-1 transition-colors shrink-0"
                        title="Remover pedido"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Campos adicionais */}
                    <div className="grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={it.vendedor || ""}
                        onChange={(e) => updateItem(idx, "vendedor", e.target.value)}
                        placeholder="Vendedor"
                        className="h-6 px-2 rounded border border-input bg-transparent text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <input
                        type="text"
                        value={it.bairro || ""}
                        onChange={(e) => updateItem(idx, "bairro", e.target.value)}
                        placeholder="Bairro"
                        className="h-6 px-2 rounded border border-input bg-transparent text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <input
                        type="text"
                        value={it.pagamento || ""}
                        onChange={(e) => updateItem(idx, "pagamento", e.target.value)}
                        placeholder="Pagamento"
                        className="h-6 px-2 rounded border border-input bg-transparent text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                      <input
                        type="text"
                        value={it.valor || ""}
                        onChange={(e) => updateItem(idx, "valor", e.target.value)}
                        placeholder="Valor"
                        className="h-6 px-2 rounded border border-input bg-transparent text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </div>

                    {/* Observação do item */}
                    <input
                      type="text"
                      value={it.observacao || ""}
                      onChange={(e) => updateItem(idx, "observacao", e.target.value)}
                      placeholder="📌 Observação do pedido..."
                      className="w-full h-6 px-2 rounded border border-input bg-transparent text-[10px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
