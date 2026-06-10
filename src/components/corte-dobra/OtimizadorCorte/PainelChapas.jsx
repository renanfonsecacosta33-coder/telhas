import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package, Layers } from "lucide-react";
import { gerarId } from "./types";

/**
 * Painel de entrada de chapas disponíveis — lado esquerdo do otimizador
 * Permite chapas manuais + importar ChapaCD do estoque
 */
export default function PainelChapas({ chapas, onChange, chapasCDEstoque = [] }) {
  const [mostrEstoque, setMostrarEstoque] = useState(false);

  const adicionarLinha = () => {
    onChange([...chapas, { id: gerarId(), nome: "", comprimento: "3000", largura: "1200", quantidade: "1", origem: "manual" }]);
  };

  const atualizar = (id, campo, valor) => {
    onChange(chapas.map(c => c.id === id ? { ...c, [campo]: valor } : c));
  };

  const remover = (id) => {
    onChange(chapas.filter(c => c.id !== id));
  };

  const adicionarDoEstoque = (chapaCD) => {
    const qtd = chapaCD.quantidade_disponivel || 1;
    const descricao = chapaCD.bobina_descricao || chapaCD.codigo || "Chapa";
    onChange([...chapas, {
      id: gerarId(),
      nome: `${chapaCD.codigo || ""} ${descricao}`.trim(),
      comprimento: String(chapaCD.comprimento_mm || 3000),
      largura: String(chapaCD.largura_mm || 1200),
      quantidade: String(Math.min(qtd, 20)),
      origem: "estoque",
      chapa_cd_id: chapaCD.id,
      status: chapaCD.status,
    }]);
    setMostrarEstoque(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Chapas Disponíveis
        </h3>
        <div className="flex gap-1.5">
          {chapasCDEstoque.length > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              onClick={() => setMostrarEstoque(!mostrEstoque)}>
              <Package className="w-3 h-3" />
              Estoque ({chapasCDEstoque.length})
            </Button>
          )}
          <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
            onClick={adicionarLinha}>
            <Plus className="w-3 h-3" />
            Manual
          </Button>
        </div>
      </div>

      {/* Estoque CD dropdown */}
      {mostrEstoque && chapasCDEstoque.length > 0 && (
        <div className="border border-emerald-200 rounded-xl bg-emerald-50/50 p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Chapas no Estoque (ChapaCD)</p>
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {chapasCDEstoque.map(c => (
              <button
                key={c.id}
                onClick={() => adicionarDoEstoque(c)}
                className="w-full text-left px-3 py-2 rounded-lg bg-white border border-border hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold text-foreground">{c.codigo || "—"}</span>
                    <span className="text-[10px] text-muted-foreground ml-2 truncate max-w-[180px] inline-block">{c.bobina_descricao}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                    <span className="text-slate-600">{c.comprimento_mm}×{c.largura_mm}mm</span>
                    <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 rounded px-1.5 py-0.5 font-semibold">
                      Qtd: {c.quantidade_disponivel}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de chapas */}
      <div className="space-y-0">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px_60px_32px] gap-1 px-2 pb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Descrição</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center">Comp. (mm)</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center">Larg. (mm)</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center">Qtd.</span>
          <span />
        </div>

        {chapas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl">
            Adicione chapas manualmente ou importe do estoque
          </div>
        )}

        {chapas.map((c) => (
          <div key={c.id} className="grid grid-cols-[1fr_80px_80px_60px_32px] gap-1 py-1 items-center group">
            <div className="flex items-center gap-1.5">
              {c.origem === "estoque" ? (
                <Package className="w-3 h-3 shrink-0 text-emerald-500" />
              ) : (
                <Layers className="w-3 h-3 shrink-0 text-slate-400" />
              )}
              <Input
                value={c.nome}
                onChange={e => atualizar(c.id, "nome", e.target.value)}
                placeholder="Chapa padrão"
                className="h-7 text-xs"
              />
            </div>
            <Input
              type="number"
              value={c.comprimento}
              onChange={e => atualizar(c.id, "comprimento", e.target.value)}
              placeholder="mm"
              className="h-7 text-xs text-center"
            />
            <Input
              type="number"
              value={c.largura}
              onChange={e => atualizar(c.id, "largura", e.target.value)}
              placeholder="mm"
              className="h-7 text-xs text-center"
            />
            <Input
              type="number"
              min="1"
              value={c.quantidade}
              onChange={e => atualizar(c.id, "quantidade", e.target.value)}
              className="h-7 text-xs text-center"
            />
            <button onClick={() => remover(c.id)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {chapas.length > 0 && (
        <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
          {chapas.reduce((s, c) => s + (parseInt(c.quantidade) || 0), 0)} chapas disponíveis
          {chapas.some(c => c.origem === "estoque") && (
            <span className="ml-2 text-emerald-600 font-semibold">· Do estoque</span>
          )}
        </div>
      )}
    </div>
  );
}