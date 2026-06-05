import React, { useState, useRef, useCallback, useEffect } from "react";
import { Map, Trash2, Plus, Save, RotateCcw, ZoomIn, ZoomOut, Move, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const TIPOS = {
  maquina_corte:    { label: "Guilhotina",      cor: "#ef4444", icone: "✂", w: 120, h: 60 },
  maquina_dobra:    { label: "Dobradeira",       cor: "#3b82f6", icone: "⚙", w: 140, h: 60 },
  perfiladeira:     { label: "Perfiladeira",     cor: "#8b5cf6", icone: "⚙", w: 200, h: 55 },
  desbobinadeira:   { label: "Desbobinadeira",   cor: "#f59e0b", icone: "🔄", w: 100, h: 80 },
  bobinas:          { label: "Estoque Bobinas",  cor: "#10b981", icone: "🪙", w: 100, h: 100 },
  chaparia:         { label: "Chaparia",         cor: "#06b6d4", icone: "📦", w: 120, h: 80 },
  retalhos:         { label: "Retalhos",         cor: "#f97316", icone: "♻", w: 80,  h: 80 },
  parede:           { label: "Parede / Coluna",  cor: "#6b7280", icone: "▌", w: 20,  h: 100 },
  porta:            { label: "Porta / Entrada",  cor: "#84cc16", icone: "🚪", w: 60,  h: 20 },
  mesa:             { label: "Mesa / Bancada",   cor: "#a78bfa", icone: "📋", w: 120, h: 60 },
  outro:            { label: "Outro",            cor: "#94a3b8", icone: "⬜", w: 80,  h: 60 },
};

const STORAGE_KEY = "ajl_mapa_barracao_cd";

function loadLayout() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveLayout(items, barracaoW, barracaoH) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, barracaoW, barracaoH }));
}

let nextId = Date.now();

export default function MapaBarracao() {
  const saved = loadLayout();
  const [items, setItems] = useState(saved?.items || []);
  const [barracaoW, setBarracaoW] = useState(saved?.barracaoW || 1200);
  const [barracaoH, setBarracaoH] = useState(saved?.barracaoH || 700);
  const [zoom, setZoom] = useState(0.9);
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null); // { id, offX, offY }
  const [resizing, setResizing] = useState(null);  // { id, startX, startY, startW, startH }
  const [addDialog, setAddDialog] = useState(false);
  const [configDialog, setConfigDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [newTipo, setNewTipo] = useState("maquina_corte");
  const [newLabel, setNewLabel] = useState("");
  const canvasRef = useRef(null);

  // ── Drag item ──────────────────────────────────────────────────────────────
  const onMouseDownItem = useCallback((e, id) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    const item = items.find(i => i.id === id);
    const rect = canvasRef.current.getBoundingClientRect();
    setSelected(id);
    setDragging({
      id,
      offX: (e.clientX - rect.left) / zoom - item.x,
      offY: (e.clientY - rect.top)  / zoom - item.y,
    });
  }, [items, zoom]);

  const onMouseDownResize = useCallback((e, id) => {
    e.stopPropagation();
    e.preventDefault();
    const item = items.find(i => i.id === id);
    setResizing({ id, startX: e.clientX, startY: e.clientY, startW: item.w, startH: item.h });
  }, [items]);

  const onMouseMove = useCallback((e) => {
    if (dragging) {
      const rect = canvasRef.current.getBoundingClientRect();
      const nx = Math.max(0, Math.min(barracaoW - 20, (e.clientX - rect.left) / zoom - dragging.offX));
      const ny = Math.max(0, Math.min(barracaoH - 20, (e.clientY - rect.top)  / zoom - dragging.offY));
      setItems(prev => prev.map(i => i.id === dragging.id ? { ...i, x: Math.round(nx), y: Math.round(ny) } : i));
    }
    if (resizing) {
      const dx = (e.clientX - resizing.startX) / zoom;
      const dy = (e.clientY - resizing.startY) / zoom;
      const nw = Math.max(30, Math.round(resizing.startW + dx));
      const nh = Math.max(20, Math.round(resizing.startH + dy));
      setItems(prev => prev.map(i => i.id === resizing.id ? { ...i, w: nw, h: nh } : i));
    }
  }, [dragging, resizing, zoom, barracaoW, barracaoH]);

  const onMouseUp = useCallback(() => {
    setDragging(null);
    setResizing(null);
  }, []);

  // ── Add item ───────────────────────────────────────────────────────────────
  const handleAdd = () => {
    const tipo = TIPOS[newTipo];
    const label = newLabel.trim() || tipo.label;
    setItems(prev => [...prev, {
      id: ++nextId,
      tipo: newTipo,
      label,
      x: 80, y: 80,
      w: tipo.w, h: tipo.h,
      cor: tipo.cor,
    }]);
    setAddDialog(false);
    setNewLabel("");
    toast.success(`"${label}" adicionado ao mapa!`);
  };

  const handleDelete = (id) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setSelected(null);
  };

  const handleSave = () => {
    saveLayout(items, barracaoW, barracaoH);
    toast.success("Layout salvo!");
  };

  const handleReset = () => {
    if (!confirm("Limpar todo o mapa?")) return;
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
    setSelected(null);
  };

  // double click = editar label/cor
  const onDblClick = (e, id) => {
    e.stopPropagation();
    setEditItem({ ...items.find(i => i.id === id) });
  };

  const handleEditSave = () => {
    setItems(prev => prev.map(i => i.id === editItem.id ? { ...editItem } : i));
    setEditItem(null);
  };

  const selectedItem = selected ? items.find(i => i.id === selected) : null;

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Map className="w-5 h-5 text-orange-500" />
            Mapa do Barracão — Corte & Dobra
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Arraste os elementos para posicionar · Duplo clique para editar nome · Alça no canto para redimensionar
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))} className="gap-1">
            <ZoomOut className="w-4 h-4" /> {Math.round(zoom * 100)}%
          </Button>
          <Button size="sm" variant="outline" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))} className="gap-1">
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setConfigDialog(true)} className="gap-1">
            <Settings className="w-4 h-4" /> Tamanho
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setAddDialog(true); setNewTipo("maquina_corte"); setNewLabel(""); }} className="gap-1">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset} className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10">
            <RotateCcw className="w-4 h-4" /> Limpar
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1 bg-orange-500 hover:bg-orange-600">
            <Save className="w-4 h-4" /> Salvar
          </Button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(TIPOS).filter(([k]) => k !== "parede" && k !== "porta" && k !== "outro").map(([k, t]) => (
          <span key={k} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium"
            style={{ borderColor: t.cor, color: t.cor, background: t.cor + "18" }}>
            {t.icone} {t.label}
          </span>
        ))}
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto border border-border rounded-xl bg-muted/30">
        <div
          ref={canvasRef}
          className="relative"
          style={{
            width: barracaoW * zoom,
            height: barracaoH * zoom,
            minWidth: barracaoW * zoom,
            minHeight: barracaoH * zoom,
            cursor: dragging ? "grabbing" : "default",
          }}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onClick={() => setSelected(null)}
        >
          {/* Grelha */}
          <svg
            className="absolute inset-0 pointer-events-none"
            width={barracaoW * zoom}
            height={barracaoH * zoom}
          >
            <defs>
              <pattern id="grid-small" width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
                <path d={`M ${20 * zoom} 0 L 0 0 0 ${20 * zoom}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
              </pattern>
              <pattern id="grid-large" width={100 * zoom} height={100 * zoom} patternUnits="userSpaceOnUse">
                <rect width={100 * zoom} height={100 * zoom} fill="url(#grid-small)" />
                <path d={`M ${100 * zoom} 0 L 0 0 0 ${100 * zoom}`} fill="none" stroke="#d1d5db" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-large)" />
            {/* Borda do barracão */}
            <rect x="1" y="1" width={barracaoW * zoom - 2} height={barracaoH * zoom - 2}
              fill="none" stroke="#374151" strokeWidth="3" strokeDasharray="8,4" rx="2" />
          </svg>

          {/* Rótulo barracão */}
          <div className="absolute top-2 left-3 text-xs font-bold text-muted-foreground/60 pointer-events-none select-none">
            BARRACÃO — {barracaoW}×{barracaoH} m²
          </div>

          {/* Items */}
          {items.map(item => {
            const isSelected = selected === item.id;
            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  left: item.x * zoom,
                  top: item.y * zoom,
                  width: item.w * zoom,
                  height: item.h * zoom,
                  border: `2px solid ${item.cor}`,
                  borderRadius: 6,
                  backgroundColor: item.cor + "25",
                  boxShadow: isSelected ? `0 0 0 3px ${item.cor}80, 0 4px 12px ${item.cor}40` : "0 2px 6px rgba(0,0,0,0.1)",
                  cursor: dragging?.id === item.id ? "grabbing" : "grab",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  zIndex: isSelected ? 10 : 1,
                  transition: dragging?.id === item.id ? "none" : "box-shadow 0.15s",
                }}
                onMouseDown={e => onMouseDownItem(e, item.id)}
                onDoubleClick={e => onDblClick(e, item.id)}
              >
                <span style={{ fontSize: Math.max(10, 18 * zoom), lineHeight: 1 }}>
                  {TIPOS[item.tipo]?.icone || "⬜"}
                </span>
                <span style={{
                  fontSize: Math.max(8, 11 * zoom),
                  fontWeight: 700,
                  color: item.cor,
                  textAlign: "center",
                  padding: "0 4px",
                  lineHeight: 1.2,
                  wordBreak: "break-word",
                  maxWidth: "100%",
                }}>
                  {item.label}
                </span>
                <span style={{ fontSize: Math.max(6, 9 * zoom), color: "#9ca3af", marginTop: 2 }}>
                  {item.w}×{item.h}
                </span>

                {/* Resize handle */}
                {isSelected && (
                  <div
                    style={{
                      position: "absolute", right: 0, bottom: 0,
                      width: 14, height: 14,
                      background: item.cor,
                      cursor: "se-resize",
                      borderRadius: "4px 0 4px 0",
                    }}
                    onMouseDown={e => onMouseDownResize(e, item.id)}
                  />
                )}

                {/* Delete button */}
                {isSelected && (
                  <button
                    style={{
                      position: "absolute", top: -10, right: -10,
                      background: "#ef4444", color: "#fff",
                      border: "none", borderRadius: "50%",
                      width: 20, height: 20, fontSize: 11,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      cursor: "pointer", zIndex: 20,
                    }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                  >✕</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Selecionado info */}
      {selectedItem && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
          <span className="font-bold" style={{ color: selectedItem.cor }}>{selectedItem.label}</span>
          <span>Pos: {selectedItem.x},{selectedItem.y}</span>
          <span>Tam: {selectedItem.w}×{selectedItem.h}</span>
          <span className="ml-1 text-[10px] opacity-60">· Duplo clique para editar · Alça para redimensionar</span>
        </div>
      )}

      {/* ── Dialog: Adicionar ── */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Adicionar ao Mapa</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={newTipo} onValueChange={v => { setNewTipo(v); setNewLabel(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPOS).map(([k, t]) => (
                    <SelectItem key={k} value={k}>{t.icone} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nome (opcional)</Label>
              <Input
                placeholder={TIPOS[newTipo]?.label}
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>Cancelar</Button>
            <Button onClick={handleAdd} className="bg-orange-500 hover:bg-orange-600">
              <Plus className="w-4 h-4 mr-1" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Editar item ── */}
      {editItem && (
        <Dialog open onOpenChange={() => setEditItem(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Editar Elemento</DialogTitle></DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1">
                <Label>Nome</Label>
                <Input value={editItem.label} onChange={e => setEditItem({ ...editItem, label: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Cor</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editItem.cor}
                    onChange={e => setEditItem({ ...editItem, cor: e.target.value })}
                    className="w-10 h-10 rounded cursor-pointer border border-border" />
                  <span className="text-xs text-muted-foreground">{editItem.cor}</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditItem(null)}>Cancelar</Button>
              <Button onClick={handleEditSave} className="bg-orange-500 hover:bg-orange-600">Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Dialog: Configurar tamanho do barracão ── */}
      <Dialog open={configDialog} onOpenChange={setConfigDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Tamanho do Barracão</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-1">
            <div className="space-y-1">
              <Label>Largura (px)</Label>
              <Input type="number" value={barracaoW} onChange={e => setBarracaoW(+e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Altura (px)</Label>
              <Input type="number" value={barracaoH} onChange={e => setBarracaoH(+e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground px-0.5">Cada 100px ≈ 1m no mapa. Padrão: 1200×700 = ~12×7m</p>
          <DialogFooter>
            <Button onClick={() => setConfigDialog(false)} className="bg-orange-500 hover:bg-orange-600">OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}