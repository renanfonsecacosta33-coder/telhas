import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Package, Layers, Sparkles } from "lucide-react";
import { gerarId } from "./types";

/**
 * Painel de entrada de chapas disponíveis — lado esquerdo do otimizador
 * Permite chapas manuais + importar ChapaCD e RetalhoCD do estoque
 */
export default function PainelChapas({ chapas, onChange, chapasCDEstoque = [], retalhosEstoque = [] }) {
  const [mostrEstoque, setMostrarEstoque] = useState(false);
  const [abaEstoque, setAbaEstoque] = useState("chapas"); // "chapas" | "retalhos"

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

  const adicionarRetalho = (retalho) => {
    onChange([...chapas, {
      id: gerarId(),
      nome: `Retalho ${retalho.comprimento_mm}×${retalho.largura_mm} (${retalho.material || "Aço"})`,
      comprimento: String(retalho.comprimento_mm || 1000),
      largura: String(retalho.largura_mm || 500),
      quantidade: "1",
      origem: "retalho",
      retalho_id: retalho.id,
      status: retalho.status,
    }]);
    setMostrarEstoque(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Chapas / Matéria-Prima
        </h3>
        <div className="flex gap-1.5">
          {(chapasCDEstoque.length > 0 || retalhosEstoque.length > 0) && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1 border-emerald-300 text-emerald-700 hover:bg-emerald-50 font-semibold"
              onClick={() => setMostrarEstoque(!mostrEstoque)}
            >
              <Package className="w-3 h-3" />
              Do Estoque ({chapasCDEstoque.length + retalhosEstoque.length})
            </Button>
          )}
          <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 font-bold"
            onClick={adicionarLinha}>
            <Plus className="w-3 h-3" />
            + Manual
          </Button>
        </div>
      </div>

      {/* Estoque e Retalhos dropdown */}
      {mostrEstoque && (
        <div className="border border-emerald-300 rounded-xl bg-emerald-50/70 p-3 space-y-2.5 shadow-sm">
          {/* Alternar abas do estoque */}
          <div className="flex gap-1 bg-white p-0.5 rounded-lg border border-emerald-200">
            <button
              type="button"
              onClick={() => setAbaEstoque("chapas")}
              className={`flex-1 py-1 text-xs font-bold rounded-md transition-colors ${
                abaEstoque === "chapas" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Chapas ({chapasCDEstoque.length})
            </button>
            <button
              type="button"
              onClick={() => setAbaEstoque("retalhos")}
              className={`flex-1 py-1 text-xs font-bold rounded-md transition-colors ${
                abaEstoque === "retalhos" ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Retalhos ({retalhosEstoque.length})
            </button>
          </div>

          {abaEstoque === "chapas" ? (
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {chapasCDEstoque.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 italic">Nenhuma chapa disponível no estoque.</p>
              ) : (
                chapasCDEstoque.map(c => (
                  <button
                    key={c.id}
                    onClick={() => adicionarDoEstoque(c)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-border hover:border-emerald-400 hover:bg-emerald-50 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-foreground">{c.codigo || "Chapa"}</span>
                        <span className="text-[10px] text-muted-foreground ml-2 truncate max-w-[180px] inline-block">{c.bobina_descricao}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                        <span className="text-slate-600 font-mono font-semibold">{c.comprimento_mm}×{c.largura_mm}mm</span>
                        <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.5 font-bold">
                          Qtd: {c.quantidade_disponivel}
                        </span>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
              {retalhosEstoque.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-3 italic">Nenhum retalho disponível no estoque.</p>
              ) : (
                retalhosEstoque.map(r => (
                  <button
                    key={r.id}
                    onClick={() => adicionarRetalho(r)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white border border-teal-200 hover:border-teal-400 hover:bg-teal-50 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-teal-900">
                          {r.comprimento_mm} × {r.largura_mm} mm
                        </span>
                        <span className="text-[10px] text-slate-500 ml-2">e = {r.espessura_mm}mm · {r.material || "Aço"}</span>
                      </div>
                      <Badge className="bg-teal-100 text-teal-800 border-teal-300 text-[9px]">
                        Retalho Disponível
                      </Badge>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Tabela de chapas */}
      <div className="space-y-0">
        {/* Header */}
        <div className="grid grid-cols-[1fr_80px_80px_60px_32px] gap-1 px-2 pb-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Descrição</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center">Comp.(mm)</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center">Larg.(mm)</span>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold text-center">Qtd.</span>
          <span />
        </div>

        {/* Linhas */}
        <div className="space-y-1.5">
          {chapas.map((c) => (
            <div
              key={c.id}
              className={`grid grid-cols-[1fr_80px_80px_60px_32px] gap-1 items-center p-1.5 rounded-lg border transition-colors ${
                c.origem === "retalho"
                  ? "bg-teal-50/50 border-teal-200"
                  : c.origem === "estoque"
                  ? "bg-emerald-50/40 border-emerald-200"
                  : "bg-card border-border"
              }`}
            >
              <div className="min-w-0 flex items-center gap-1">
                {c.origem === "retalho" && (
                  <Sparkles className="w-3 h-3 text-teal-600 shrink-0" title="Retalho de estoque" />
                )}
                <Input
                  placeholder="Ex: 3000×1200"
                  value={c.nome}
                  onChange={e => atualizar(c.id, "nome", e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <Input
                type="number"
                placeholder="3000"
                value={c.comprimento}
                onChange={e => atualizar(c.id, "comprimento", e.target.value)}
                className="h-7 text-xs text-center font-mono font-bold"
              />
              <Input
                type="number"
                placeholder="1200"
                value={c.largura}
                onChange={e => atualizar(c.id, "largura", e.target.value)}
                className="h-7 text-xs text-center font-mono font-bold"
              />
              <Input
                type="number"
                min="1"
                placeholder="1"
                value={c.quantidade}
                onChange={e => atualizar(c.id, "quantidade", e.target.value)}
                className="h-7 text-xs text-center font-bold"
              />
              <div className="flex justify-center">
                {chapas.length > 1 && (
                  <button
                    onClick={() => remover(c.id)}
                    className="text-muted-foreground hover:text-red-500 p-1 rounded transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}