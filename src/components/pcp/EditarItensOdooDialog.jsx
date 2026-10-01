import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit3, Save, Package, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getItens } from "@/lib/pedidoOdooHelper";

export default function EditarItensOdooDialog({ open, onOpenChange, pedido, onSalvo }) {
  const [itens, setItens] = useState([]);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (pedido) {
      const lista = getItens(pedido);
      setItens(lista.map(i => ({
        produto: i.produto || "",
        quantidade: i.quantidade != null ? i.quantidade : 1,
        unidade: i.unidade || "MT",
        descricao: i.descricao || i.observacao || "",
        observacao: i.observacao || i.descricao || "",
        medida: i.medida || "",
        espessura: i.espessura || "",
        categoria: i.categoria || "Telhas"
      })));
    }
  }, [pedido, open]);

  const handleUpdateItem = (idx, field, value) => {
    setItens(prev => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      if (field === "descricao") {
        copy[idx].observacao = value;
      }
      return copy;
    });
  };

  const handleRemoverItem = (idx) => {
    if (itens.length <= 1) {
      toast.warning("O pedido precisa conter ao menos 1 item.");
      return;
    }
    setItens(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAdicionarItem = () => {
    setItens(prev => [
      ...prev,
      {
        produto: "Telha TP 40 (0,43) nacional",
        quantidade: 1,
        unidade: "MT",
        descricao: "",
        observacao: "",
        medida: "",
        espessura: "0.43",
        categoria: "Telhas"
      }
    ]);
  };

  const handleSalvar = async () => {
    if (!pedido?.id) return;
    setSalvando(true);
    try {
      const itensFinal = itens.map((it, idx) => ({
        ...it,
        quantidade: Number(it.quantidade) || 1,
        _idx: idx
      }));

      const itensJsonStr = JSON.stringify(itensFinal);
      const telhas = itensFinal.filter(i => /(telha|bandeja|cumeeira|calha|rufo|bobin)/i.test(`${i.categoria} ${i.produto}`));
      const cd = itensFinal.filter(i => /(perfil|cantoneir|chapa|dobra|corte)/i.test(`${i.categoria} ${i.produto}`));
      const frisada = itensFinal.filter(i => /frisad/i.test(`${i.categoria} ${i.produto}`));

      const logExistente = (() => {
        try { return JSON.parse(pedido.historico_log || "[]"); } catch { return []; }
      })();
      const novoLog = [...logExistente, {
        data: new Date().toISOString(),
        usuario: "PCP (Edição Manual)",
        acao: "edicao_itens",
        detalhes: `Itens corrigidos manualmente pelo PCP: ${itensFinal.length} item(ns).`
      }];

      await base44.entities.PedidoOdoo.update(pedido.id, {
        itens_json: itensJsonStr,
        total_itens: itensFinal.length,
        itens_telha_count: telhas.length,
        itens_cd_count: cd.length,
        itens_frisada_count: frisada.length,
        historico_log: JSON.stringify(novoLog)
      });

      toast.success("Itens e medidas da OF atualizados com sucesso!");
      onSalvo?.();
      onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao salvar itens: " + (err.message || "Erro desconhecido"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold">
            <Edit3 className="w-5 h-5 text-orange-500" />
            Ajustar Itens e Medidas — OF #{pedido?.of_nome || pedido?.numero_pedido}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Corrija quantidades, produtos e instruções de corte (ex: "1 PÇ C/ 2000 mm" ou "2 MT") diretamente nesta OF sem travar a produção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {itens.map((it, idx) => (
            <div key={idx} className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/60 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline" className="font-mono text-[11px] font-bold">
                  Item #{idx + 1}
                </Badge>
                {itens.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoverItem(idx)}
                    className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                    title="Remover este item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Produto / Modelo:
                </label>
                <Input
                  value={it.produto}
                  onChange={(e) => handleUpdateItem(idx, "produto", e.target.value)}
                  placeholder="Ex: 407 - Telha TP 40 (0,43) nacional"
                  className="text-xs h-8"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Quantidade:
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    value={it.quantidade}
                    onChange={(e) => handleUpdateItem(idx, "quantidade", e.target.value)}
                    className="text-xs h-8 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Unidade:
                  </label>
                  <Input
                    value={it.unidade}
                    onChange={(e) => handleUpdateItem(idx, "unidade", e.target.value)}
                    placeholder="MT / PC"
                    className="text-xs h-8 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Espessura (mm):
                  </label>
                  <Input
                    value={it.espessura}
                    onChange={(e) => handleUpdateItem(idx, "espessura", e.target.value)}
                    placeholder="Ex: 0.43"
                    className="text-xs h-8 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                    Categoria:
                  </label>
                  <Input
                    value={it.categoria}
                    onChange={(e) => handleUpdateItem(idx, "categoria", e.target.value)}
                    placeholder="Telhas / CD / Frisadas"
                    className="text-xs h-8"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 dark:text-slate-300 block mb-1">
                  Especificação de Corte / Instrução do Vendedor:
                </label>
                <Input
                  value={it.descricao}
                  onChange={(e) => handleUpdateItem(idx, "descricao", e.target.value)}
                  placeholder="Ex: 6 PÇS C/ 6000 mm ou 1 PÇ C/ 2000 mm"
                  className="text-xs h-8 font-semibold text-orange-700 dark:text-orange-300"
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={handleAdicionarItem}
            className="w-full gap-1.5 text-xs font-bold border-dashed border-slate-300 hover:border-orange-500 hover:text-orange-600 h-8"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Outro Item a Esta OF
          </Button>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold gap-1.5 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            {salvando ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
