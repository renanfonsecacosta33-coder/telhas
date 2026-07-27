import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Map, Plus, Settings, ChevronLeft, Package, Ruler,
  ArrowRight, Trash2, Edit3, Save, X, Move, CheckCircle2
} from "lucide-react";

// ─── Constantes ────────────────────────────────────────────
const COMPRIMENTO_BARRA = 6; // metros
const LARGURA_BARRA_VISUAL = 60; // px por barra no mapa

const COR_OCUPACAO = {
  vazio:   "bg-slate-100 border-slate-300 text-slate-400",
  parcial: "bg-amber-50 border-amber-300 text-amber-700",
  cheio:   "bg-emerald-50 border-emerald-400 text-emerald-700",
  reservado:"bg-blue-50 border-blue-400 text-blue-700",
};

// ─── Posições padrão iniciais ──────────────────────────────
const POSICOES_PADRAO = [
  { id: "A1", rua: "A", posicao: "1", capacidade_barras: 20, descricao: "Rua A — Posição 1" },
  { id: "A2", rua: "A", posicao: "2", capacidade_barras: 20, descricao: "Rua A — Posição 2" },
  { id: "A3", rua: "A", posicao: "3", capacidade_barras: 20, descricao: "Rua A — Posição 3" },
  { id: "B1", rua: "B", posicao: "1", capacidade_barras: 15, descricao: "Rua B — Posição 1" },
  { id: "B2", rua: "B", posicao: "2", capacidade_barras: 15, descricao: "Rua B — Posição 2" },
  { id: "B3", rua: "B", posicao: "3", capacidade_barras: 15, descricao: "Rua B — Posição 3" },
  { id: "B4", rua: "B", posicao: "4", capacidade_barras: 15, descricao: "Rua B — Posição 4" },
  { id: "C1", rua: "C", posicao: "1", capacidade_barras: 30, descricao: "Rua C — Frisada/Bobinas" },
  { id: "C2", rua: "C", posicao: "2", capacidade_barras: 30, descricao: "Rua C — Posição 2" },
  { id: "PATIO", rua: "PÁTIO", posicao: "EXT", capacidade_barras: 100, descricao: "Pátio Externo" },
];

export default function MapaArmazenagem() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [modoAdmin, setModoAdmin] = useState(false);
  const [posicoes, setPosicoes] = useState(POSICOES_PADRAO);
  const [posicaoSel, setPosicaoSel] = useState(null);
  const [dialogMover, setDialogMover] = useState(false);
  const [dialogNova, setDialogNova] = useState(false);
  const [novaPosicao, setNovaPosicao] = useState({ rua: "", posicao: "", capacidade_barras: 20, descricao: "" });
  const [movDestino, setMovDestino] = useState("");

  // Buscar entradas para mostrar ocupação
  const { data: entradas = [] } = useQuery({
    queryKey: ["entradas-expedicao"],
    queryFn: () => base44.entities.EntradaMaterialExpedicao?.filter?.({}, "-created_date", 200) ?? [],
    retry: false,
  });

  // Calcular ocupação por posição
  function getOcupacao(posId) {
    const itens = entradas.filter(e => e.local_armazenagem === posId && e.status !== "movido");
    const totalBarras = itens.reduce((s, e) => s + (e.quantidade_barras || 0), 0);
    const totalKg     = itens.reduce((s, e) => s + (e.peso_kg_balanca || e.peso_kg_nf || 0), 0);
    return { itens, totalBarras, totalKg };
  }

  // Ruas únicas
  const ruas = [...new Set(posicoes.map(p => p.rua))];

  function getEstadoOcupacao(pos) {
    const { totalBarras } = getOcupacao(pos.id);
    if (totalBarras === 0) return "vazio";
    if (totalBarras >= pos.capacidade_barras) return "cheio";
    if (totalBarras > pos.capacidade_barras * 0.5) return "parcial";
    return "parcial";
  }

  function handleNovaPosicao() {
    if (!novaPosicao.rua || !novaPosicao.posicao) {
      toast.error("Informe Rua e Posição");
      return;
    }
    const id = `${novaPosicao.rua}${novaPosicao.posicao}`.toUpperCase();
    if (posicoes.find(p => p.id === id)) {
      toast.error("Posição já existe");
      return;
    }
    setPosicoes(p => [...p, { ...novaPosicao, id }]);
    setDialogNova(false);
    setNovaPosicao({ rua: "", posicao: "", capacidade_barras: 20, descricao: "" });
    toast.success(`Posição ${id} criada!`);
  }

  function handleRemoverPosicao(id) {
    const { totalBarras } = getOcupacao(id);
    if (totalBarras > 0) {
      toast.error("Esta posição tem material. Mova primeiro antes de remover.");
      return;
    }
    setPosicoes(p => p.filter(pos => pos.id !== id));
    toast.success("Posição removida!");
  }

  async function handleMoverMaterial() {
    if (!movDestino || !posicaoSel) return;
    try {
      const { itens } = getOcupacao(posicaoSel.id);
      for (const item of itens) {
        await base44.entities.EntradaMaterialExpedicao?.update?.(item.id, { local_armazenagem: movDestino });
      }
      queryClient.invalidateQueries({ queryKey: ["entradas-expedicao"] });
      toast.success(`✅ Material movido de ${posicaoSel.id} → ${movDestino}`);
      setDialogMover(false);
      setPosicaoSel(null);
      setMovDestino("");
    } catch {
      toast.error("Erro ao mover material.");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <button onClick={() => navigate("/expedicao")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Map className="w-6 h-6 text-teal-600" /> Mapa de Armazenagem
          </h1>
          <p className="text-sm text-muted-foreground">Visualize e gerencie posições do barracão. Barras padrão: {COMPRIMENTO_BARRA}m</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={modoAdmin ? "default" : "outline"}
            size="sm"
            onClick={() => setModoAdmin(m => !m)}
            className="gap-1.5"
          >
            <Settings className="w-4 h-4" />
            {modoAdmin ? "Sair do Modo Admin" : "Configurar Mapa"}
          </Button>
          {modoAdmin && (
            <Button size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={() => setDialogNova(true)}>
              <Plus className="w-4 h-4" /> Nova Posição
            </Button>
          )}
        </div>
      </div>

      {/* Legenda */}
      <div className="flex gap-3 flex-wrap text-xs">
        {[
          { label: "Vazio",    color: "bg-slate-100 border-slate-300" },
          { label: "Ocupado",  color: "bg-amber-50 border-amber-300" },
          { label: "Cheio",    color: "bg-emerald-50 border-emerald-400" },
        ].map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-4 h-4 rounded border-2 ${color}`} />
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
        <div className="ml-auto text-muted-foreground">
          Clique em uma posição para ver detalhes ou mover material
        </div>
      </div>

      {/* Mapa por Ruas */}
      <div className="space-y-4">
        {ruas.map(rua => {
          const posicoesRua = posicoes.filter(p => p.rua === rua);
          return (
            <div key={rua} className="border rounded-xl overflow-hidden">
              <div className="bg-slate-800 text-white px-4 py-2 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-teal-400" />
                <span className="font-bold text-sm">Rua {rua}</span>
                <span className="text-slate-400 text-xs ml-1">
                  — {posicoesRua.length} posição(ões)
                </span>
              </div>

              <div className="p-3 flex gap-3 flex-wrap">
                {posicoesRua.map(pos => {
                  const { totalBarras, totalKg } = getOcupacao(pos.id);
                  const estado  = getEstadoOcupacao(pos);
                  const pct     = Math.min(100, (totalBarras / pos.capacidade_barras) * 100);
                  const colors  = COR_OCUPACAO[estado];

                  return (
                    <button
                      key={pos.id}
                      onClick={() => setPosicaoSel(pos)}
                      className={`border-2 rounded-xl p-3 text-left transition-all hover:shadow-md min-w-36 ${colors} ${posicaoSel?.id === pos.id ? "ring-2 ring-teal-500" : ""}`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm">{pos.id}</span>
                        {modoAdmin && (
                          <button
                            onClick={e => { e.stopPropagation(); handleRemoverPosicao(pos.id); }}
                            className="text-red-400 hover:text-red-600 p-0.5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground mb-2 truncate">{pos.descricao}</p>

                      {/* Barra de ocupação */}
                      <div className="w-full bg-white/50 rounded-full h-1.5 mb-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct > 80 ? "bg-red-500" : pct > 40 ? "bg-amber-500" : "bg-emerald-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>

                      <div className="text-[10px] font-semibold">
                        {totalBarras}/{pos.capacidade_barras} barras
                      </div>
                      {totalKg > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          {totalKg.toLocaleString("pt-BR")} kg
                        </div>
                      )}
                      {totalBarras > 0 && (
                        <div className="text-[10px] text-muted-foreground">
                          ~{(totalBarras * COMPRIMENTO_BARRA).toLocaleString("pt-BR")}m lineares
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Painel lateral da posição selecionada */}
      {posicaoSel && (() => {
        const { itens, totalBarras, totalKg } = getOcupacao(posicaoSel.id);
        return (
          <div className="border-2 border-teal-400 rounded-xl p-4 bg-teal-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Package className="w-5 h-5 text-teal-600" />
                Posição {posicaoSel.id} — {posicaoSel.descricao}
              </h3>
              <button onClick={() => setPosicaoSel(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground text-xs">Barras</p>
                <p className="font-bold text-lg">{totalBarras}</p>
                <p className="text-xs text-muted-foreground">de {posicaoSel.capacidade_barras}</p>
              </div>
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground text-xs">Peso</p>
                <p className="font-bold text-lg">{(totalKg / 1000).toFixed(2)}t</p>
                <p className="text-xs text-muted-foreground">{totalKg.toLocaleString("pt-BR")} kg</p>
              </div>
              <div className="bg-white rounded-lg p-2 border">
                <p className="text-muted-foreground text-xs">Metros</p>
                <p className="font-bold text-lg">{(totalBarras * COMPRIMENTO_BARRA).toLocaleString("pt-BR")}</p>
                <p className="text-xs text-muted-foreground">lineares</p>
              </div>
            </div>

            {itens.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Materiais nesta posição</p>
                {itens.map(item => (
                  <div key={item.id} className="bg-white border rounded-lg px-3 py-2 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-bold font-mono">NF {item.numero_nf}</span>
                      <span className="text-muted-foreground ml-2">— {item.produto}</span>
                    </div>
                    <span className="text-emerald-600 font-bold">{item.quantidade_barras} barras</span>
                  </div>
                ))}
              </div>
            )}

            {totalBarras > 0 && (
              <Button
                className="w-full gap-2"
                variant="outline"
                onClick={() => setDialogMover(true)}
              >
                <Move className="w-4 h-4" />
                Mover Material para outra posição
              </Button>
            )}
          </div>
        );
      })()}

      {/* Dialog: Mover material */}
      <Dialog open={dialogMover} onOpenChange={setDialogMover}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Move className="w-5 h-5 text-teal-600" />
              Mover Material — {posicaoSel?.id}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Selecione a posição de destino:</p>
            <select
              className="w-full border rounded-md px-3 py-2 text-sm bg-background"
              value={movDestino}
              onChange={e => setMovDestino(e.target.value)}
            >
              <option value="">Selecione destino...</option>
              {posicoes.filter(p => p.id !== posicaoSel?.id).map(p => (
                <option key={p.id} value={p.id}>{p.id} — {p.descricao}</option>
              ))}
            </select>
            {movDestino && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-700 flex items-center gap-2">
                <ArrowRight className="w-4 h-4" />
                <span>{posicaoSel?.id} → {movDestino}</span>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogMover(false)}>Cancelar</Button>
            <Button onClick={handleMoverMaterial} disabled={!movDestino} className="bg-teal-600 hover:bg-teal-700 gap-2">
              <CheckCircle2 className="w-4 h-4" /> Confirmar Movimentação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova posição */}
      <Dialog open={dialogNova} onOpenChange={setDialogNova}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-teal-600" /> Nova Posição
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Rua *</Label>
                <Input
                  value={novaPosicao.rua}
                  onChange={e => setNovaPosicao(n => ({ ...n, rua: e.target.value.toUpperCase() }))}
                  placeholder="Ex: A, B, C"
                  maxLength={5}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Posição *</Label>
                <Input
                  value={novaPosicao.posicao}
                  onChange={e => setNovaPosicao(n => ({ ...n, posicao: e.target.value.toUpperCase() }))}
                  placeholder="Ex: 1, 2, EXT"
                  maxLength={5}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Capacidade (barras) *</Label>
              <Input
                type="number"
                value={novaPosicao.capacidade_barras}
                onChange={e => setNovaPosicao(n => ({ ...n, capacidade_barras: Number(e.target.value) }))}
                min={1}
              />
              <p className="text-[10px] text-muted-foreground">
                = {(novaPosicao.capacidade_barras * COMPRIMENTO_BARRA).toLocaleString("pt-BR")}m lineares de barra 6m
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={novaPosicao.descricao}
                onChange={e => setNovaPosicao(n => ({ ...n, descricao: e.target.value }))}
                placeholder="Ex: Rua A — Posição 1"
              />
            </div>
            <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs text-muted-foreground">
              ID da posição: <strong>{(novaPosicao.rua + novaPosicao.posicao).toUpperCase() || "—"}</strong>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNova(false)}>Cancelar</Button>
            <Button onClick={handleNovaPosicao} className="bg-teal-600 hover:bg-teal-700 gap-2">
              <Save className="w-4 h-4" /> Criar Posição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
