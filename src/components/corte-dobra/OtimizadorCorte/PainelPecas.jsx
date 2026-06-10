import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, BookOpen, ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { CATALOGO, CATEGORIAS_CATALOGO, calcDesenvolvido } from "@/lib/catalogo-cd";
import { corPeca, gerarId } from "./types";

/**
 * Painel de entrada de peças — lado esquerdo do otimizador
 */
export default function PainelPecas({ pecas, onChange }) {
  const [mostrarCatalogo, setMostrarCatalogo] = useState(false);
  const [categoriaSel, setCategoriaSel] = useState(null);
  const [espessura, setEspessura] = useState("");

  const adicionarLinha = () => {
    onChange([...pecas, { id: gerarId(), nome: "", comprimento: "", largura: "", quantidade: "1" }]);
  };

  const atualizar = (id, campo, valor) => {
    onChange(pecas.map(p => p.id === id ? { ...p, [campo]: valor } : p));
  };

  const remover = (id) => {
    onChange(pecas.filter(p => p.id !== id));
  };

  const adicionarDoCatalogo = (produto) => {
    const esp = parseFloat(espessura);
    const comp = esp > 0 && produto.abas.length > 0
      ? calcDesenvolvido(produto.abas, produto.dobras, esp)
      : (produto.comprimento_padrao_mm || 3000);
    const larg = produto.largura_necessaria_mm || "";

    onChange([...pecas, {
      id: gerarId(),
      nome: `${produto.codigo} — ${produto.nome}`,
      comprimento: String(comp),
      largura: larg ? String(larg) : "",
      quantidade: "1",
    }]);
    setMostrarCatalogo(false);
  };

  const catalogoFiltrado = CATALOGO.filter(p =>
    (!categoriaSel || p.categoria === categoriaSel) &&
    (!espessura || p.espessuras_disponiveis.some(e => Math.abs(e - parseFloat(espessura)) < 0.05))
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          Peças a Cortar
        </h3>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
            onClick={() => setMostrarCatalogo(!mostrarCatalogo)}>
            <BookOpen className="w-3 h-3" />
            Catálogo
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
            onClick={adicionarLinha}>
            <Plus className="w-3 h-3" />
            Adicionar
          </Button>
        </div>
      </div>

      {/* Catálogo dropdown */}
      {mostrarCatalogo && (
        <div className="border border-blue-200 rounded-xl bg-blue-50/50 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Espessura (mm)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="Ex: 1.50"
                value={espessura}
                onChange={e => setEspessura(e.target.value)}
                className="h-7 text-xs mt-0.5"
              />
            </div>
          </div>

          {/* Filtro categoria */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setCategoriaSel(null)}
              className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${!categoriaSel ? "bg-blue-600 text-white border-blue-600" : "bg-white border-border text-muted-foreground hover:border-blue-300"}`}
            >
              Todos
            </button>
            {CATEGORIAS_CATALOGO.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategoriaSel(cat.id === categoriaSel ? null : cat.id)}
                className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${categoriaSel === cat.id ? "bg-blue-600 text-white border-blue-600" : "bg-white border-border text-muted-foreground hover:border-blue-300"}`}
              >
                {cat.label.replace("Perfil Serralheiro — ", "PS ").replace("Perfil Estrutural ", "PE ")}
              </button>
            ))}
          </div>

          {/* Lista do catálogo */}
          <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
            {catalogoFiltrado.map(produto => {
              const esp = parseFloat(espessura);
              const comp = esp > 0 && produto.abas.length > 0
                ? calcDesenvolvido(produto.abas, produto.dobras, esp)
                : produto.comprimento_padrao_mm;
              return (
                <button
                  key={produto.id}
                  onClick={() => adicionarDoCatalogo(produto)}
                  className="w-full text-left px-3 py-2 rounded-lg bg-white border border-border hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-foreground">{produto.codigo}</span>
                      <span className="text-[10px] text-muted-foreground ml-2">{produto.dimensoes}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
                      {produto.largura_necessaria_mm && <span>L: {produto.largura_necessaria_mm}mm</span>}
                      {comp && esp > 0 && <span className="text-orange-600 font-bold">Desenv: {comp}mm</span>}
                    </div>
                  </div>
                </button>
              );
            })}
            {catalogoFiltrado.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum produto encontrado com esta espessura</p>
            )}
          </div>
        </div>
      )}

      {/* Tabela de peças */}
      <div className="space-y-0">
        {/* Header da tabela */}
        <div className="grid grid-cols-[1fr_80px_80px_60px_32px] gap-1 px-2 pb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Nome / Descrição</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center">Comp. (mm)</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center">Larg. (mm)</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center">Qtd.</span>
          <span />
        </div>

        {pecas.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-xs border border-dashed rounded-xl">
            Clique em "Adicionar" ou use o catálogo para adicionar peças
          </div>
        )}

        {pecas.map((p, idx) => (
          <div key={p.id} className="grid grid-cols-[1fr_80px_80px_60px_32px] gap-1 py-1 items-center group">
            {/* Cor indicadora + nome */}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: corPeca(idx) }} />
              <Input
                value={p.nome}
                onChange={e => atualizar(p.id, "nome", e.target.value)}
                placeholder={`Peça ${idx + 1}`}
                className="h-7 text-xs"
              />
            </div>
            <Input
              type="number"
              value={p.comprimento}
              onChange={e => atualizar(p.id, "comprimento", e.target.value)}
              placeholder="mm"
              className="h-7 text-xs text-center"
            />
            <Input
              type="number"
              value={p.largura}
              onChange={e => atualizar(p.id, "largura", e.target.value)}
              placeholder="mm"
              className="h-7 text-xs text-center"
            />
            <Input
              type="number"
              min="1"
              value={p.quantidade}
              onChange={e => atualizar(p.id, "quantidade", e.target.value)}
              className="h-7 text-xs text-center"
            />
            <button onClick={() => remover(p.id)} className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {pecas.length > 0 && (
        <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
          {pecas.reduce((s, p) => s + (parseInt(p.quantidade) || 0), 0)} peças no total
          {" · "}
          {pecas.length} {pecas.length === 1 ? "tipo" : "tipos"}
        </div>
      )}
    </div>
  );
}