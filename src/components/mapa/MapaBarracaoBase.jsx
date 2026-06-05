/**
 * MapaBarracaoBase — componente reutilizável para mapa 2D de barracão.
 */
import React, { useState, useRef, useEffect } from "react";
import { Map, Trash2, Plus, Save, RotateCcw, ZoomIn, ZoomOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export const TIPOS_BASE = {
  parede:   { label: "Parede / Coluna", cor: "#6b7280", icone: "▌", w: 20,  h: 100 },
  porta:    { label: "Porta / Entrada", cor: "#84cc16", icone: "🚪", w: 60,  h: 20  },
  mesa:     { label: "Mesa / Bancada",  cor: "#a78bfa", icone: "📋", w: 120, h: 60  },
  outro:    { label: "Outro",           cor: "#94a3b8", icone: "⬜", w: 80,  h: 60  },
};

function loadLayout(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

let nextId = Date.now();

export default function MapaBarracaoBase({ storageKey, titulo, subtitulo, tipos }) {
  const saved = loadLayout(storageKey);
  const [items, setItems] = useState(saved?.items || []);
  const [barracaoW, setBarracaoW] = useState(saved?.barracaoW || 1200);
  const [barracaoH, setBarracaoH] = useState(saved?.barracaoH || 700);
  const [zoom, setZoom] = useState(0.9);
  const [viewAngle, setViewAngle] = useState("topo"); // "topo" | "frente" | "lado"
  const [selected, setSelected] = useState(null);
  const [addDialog, setAddDialog] = useState(false);
  const [configDialog, setConfigDialog] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [newTipo, setNewTipo] = useState(Object.keys(tipos)[0]);
  const [newLabel, setNewLabel] = useState("");

  const canvasRef = useRef(null);

  // Refs para drag/resize sem stale closures
  const interactionRef = useRef(null); // { type: 'drag'|'resize', id, ... }
  const itemsRef = useRef(items);
  const zoomRef = useRef(zoom);
  const barracaoWRef = useRef(barracaoW);
  const barracaoHRef = useRef(barracaoH);

  useEffect(() => { itemsRef.current = items; }, [items]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { barracaoWRef.current = barracaoW; }, [barracaoW]);
  useEffect(() => { barracaoHRef.current = barracaoH; }, [barracaoH]);

  // ── Mouse global ──
  useEffect(() => {
    const onMove = (e) => {
      const ia = interactionRef.current;
      if (!ia) return;
      const z = zoomRef.current;

      if (ia.type === "drag") {
        const rect = canvasRef.current.getBoundingClientRect();
        const nx = Math.max(0, Math.min(barracaoWRef.current - 20, (e.clientX - rect.left) / z - ia.offX));
        const ny = Math.max(0, Math.min(barracaoHRef.current - 20, (e.clientY - rect.top) / z - ia.offY));
        setItems(prev => prev.map(i => i.id === ia.id ? { ...i, x: Math.round(nx), y: Math.round(ny) } : i));
      }

      if (ia.type === "resize") {
        const dx = (e.clientX - ia.startX) / z;
        const dy = (e.clientY - ia.startY) / z;
        setItems(prev => prev.map(i => {
          if (i.id !== ia.id) return i;
          let { x, y, w, h } = i;

          if (ia.dir === "se") {
            w = Math.max(30, Math.round(ia.startW + dx));
            h = Math.max(20, Math.round(ia.startH + dy));
          } else if (ia.dir === "sw") {
            const nw = Math.max(30, Math.round(ia.startW - dx));
            x = Math.round(ia.startItemX + ia.startW - nw);
            w = nw;
            h = Math.max(20, Math.round(ia.startH + dy));
          } else if (ia.dir === "ne") {
            w = Math.max(30, Math.round(ia.startW + dx));
            const nh = Math.max(20, Math.round(ia.startH - dy));
            y = Math.round(ia.startItemY + ia.startH - nh);
            h = nh;
          } else if (ia.dir === "nw") {
            const nw = Math.max(30, Math.round(ia.startW - dx));
            x = Math.round(ia.startItemX + ia.startW - nw);
            w = nw;
            const nh = Math.max(20, Math.round(ia.startH - dy));
            y = Math.round(ia.startItemY + ia.startH - nh);
            h = nh;
          } else if (ia.dir === "e") {
            w = Math.max(30, Math.round(ia.startW + dx));
          } else if (ia.dir === "w") {
            const nw = Math.max(30, Math.round(ia.startW - dx));
            x = Math.round(ia.startItemX + ia.startW - nw);
            w = nw;
          } else if (ia.dir === "s") {
            h = Math.max(20, Math.round(ia.startH + dy));
          } else if (ia.dir === "n") {
            const nh = Math.max(20, Math.round(ia.startH - dy));
            y = Math.round(ia.startItemY + ia.startH - nh);
            h = nh;
          }
          return { ...i, x, y, w, h };
        }));
      }
    };

    const onUp = () => { interactionRef.current = null; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  const startDrag = (e, id) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const item = itemsRef.current.find(i => i.id === id);
    const rect = canvasRef.current.getBoundingClientRect();
    const z = zoomRef.current;
    setSelected(id);
    interactionRef.current = {
      type: "drag", id,
      offX: (e.clientX - rect.left) / z - item.x,
      offY: (e.clientY - rect.top) / z - item.y,
    };
  };

  const startResize = (e, id, dir) => {
    e.stopPropagation();
    e.preventDefault();
    const item = itemsRef.current.find(i => i.id === id);
    interactionRef.current = {
      type: "resize", id, dir,
      startX: e.clientX, startY: e.clientY,
      startW: item.w, startH: item.h,
      startItemX: item.x, startItemY: item.y,
    };
  };

  // ── CRUD ──
  const handleAdd = () => {
    const t = tipos[newTipo];
    const label = newLabel.trim() || t.label;
    setItems(prev => [...prev, { id: ++nextId, tipo: newTipo, label, x: 80, y: 80, w: t.w, h: t.h, cor: t.cor }]);
    setAddDialog(false); setNewLabel("");
    toast.success(`"${label}" adicionado!`);
  };

  const handleDelete = (id) => { setItems(prev => prev.filter(i => i.id !== id)); setSelected(null); };

  const handleSave = () => {
    localStorage.setItem(storageKey, JSON.stringify({ items, barracaoW, barracaoH }));
    toast.success("Layout salvo!");
  };

  const handleReset = () => {
    if (!confirm("Limpar todo o mapa?")) return;
    setItems([]); localStorage.removeItem(storageKey); setSelected(null);
  };

  const handleEditSave = () => {
    setItems(prev => prev.map(i => i.id === editItem.id ? { ...editItem } : i));
    setEditItem(null);
  };

  const selectedItem = selected ? items.find(i => i.id === selected) : null;
  const tiposLegenda = Object.entries(tipos).filter(([k]) => !["parede","porta","outro"].includes(k));
  const viewAngleLabel = { topo: "Vista Superior (2D)", frente: "Vista Frontal (3D)", lado: "Vista Lateral (3D)" }[viewAngle];

  // Alças de resize: 8 direções
  const HANDLES = [
    { dir: "nw", style: { top: -5, left: -5,   cursor: "nw-resize" } },
    { dir: "n",  style: { top: -5, left: "50%", transform: "translateX(-50%)", cursor: "n-resize" } },
    { dir: "ne", style: { top: -5, right: -5,   cursor: "ne-resize" } },
    { dir: "e",  style: { top: "50%", right: -5, transform: "translateY(-50%)", cursor: "e-resize" } },
    { dir: "se", style: { bottom: -5, right: -5, cursor: "se-resize" } },
    { dir: "s",  style: { bottom: -5, left: "50%", transform: "translateX(-50%)", cursor: "s-resize" } },
    { dir: "sw", style: { bottom: -5, left: -5,  cursor: "sw-resize" } },
    { dir: "w",  style: { top: "50%", left: -5,  transform: "translateY(-50%)", cursor: "w-resize" } },
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] select-none">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Map className="w-5 h-5 text-orange-500" />
            {titulo}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{subtitulo}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
            <ZoomOut className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))} />
            <Slider min={30} max={200} step={5}
              value={[Math.round(zoom * 100)]}
              onValueChange={([v]) => setZoom(v / 100)}
              className="w-28" />
            <ZoomIn className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground"
              onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))} />
            <span className="text-xs font-mono w-9 text-center">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1.5">
            <span className="text-xs font-medium text-muted-foreground">Ângulo:</span>
            <Button size="sm" variant={viewAngle === "topo" ? "default" : "outline"}
              onClick={() => setViewAngle("topo")} className="h-7 text-xs">Topo</Button>
            <Button size="sm" variant={viewAngle === "frente" ? "default" : "outline"}
              onClick={() => setViewAngle("frente")} className="h-7 text-xs">Frente</Button>
            <Button size="sm" variant={viewAngle === "lado" ? "default" : "outline"}
              onClick={() => setViewAngle("lado")} className="h-7 text-xs">Lado</Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setConfigDialog(true)} className="gap-1">
            <Settings className="w-4 h-4" /> Tamanho
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setAddDialog(true); setNewTipo(Object.keys(tipos)[0]); setNewLabel(""); }} className="gap-1">
            <Plus className="w-4 h-4" /> Adicionar
          </Button>
          {selected && (
            <Button size="sm" variant="outline" onClick={() => handleDelete(selected)}
              className="gap-1 text-destructive border-destructive/40 hover:bg-destructive hover:text-white">
              <Trash2 className="w-4 h-4" /> Apagar selecionado
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleReset} className="gap-1 text-muted-foreground">
            <RotateCcw className="w-4 h-4" /> Limpar tudo
          </Button>
          <Button size="sm" onClick={handleSave} className="gap-1 bg-orange-500 hover:bg-orange-600">
            <Save className="w-4 h-4" /> Salvar
          </Button>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {tiposLegenda.map(([k, t]) => (
          <span key={k} className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium"
            style={{ borderColor: t.cor, color: t.cor, background: t.cor + "18" }}>
            {t.icone} {t.label}
          </span>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto border border-border rounded-xl bg-muted/30">
        <div
          ref={canvasRef}
          className="relative"
          style={{
            width: barracaoW * zoom, height: barracaoH * zoom,
            minWidth: barracaoW * zoom, minHeight: barracaoH * zoom,
          }}
          onClick={() => setSelected(null)}
        >
          {/* Grade SVG */}
          <svg className="absolute inset-0 pointer-events-none" width={barracaoW * zoom} height={barracaoH * zoom}>
            <defs>
              <pattern id={`gs-${storageKey}`} width={20 * zoom} height={20 * zoom} patternUnits="userSpaceOnUse">
                <path d={`M ${20*zoom} 0 L 0 0 0 ${20*zoom}`} fill="none" stroke="#e5e7eb" strokeWidth="0.5" />
              </pattern>
              <pattern id={`gl-${storageKey}`} width={100 * zoom} height={100 * zoom} patternUnits="userSpaceOnUse">
                <rect width={100*zoom} height={100*zoom} fill={`url(#gs-${storageKey})`} />
                <path d={`M ${100*zoom} 0 L 0 0 0 ${100*zoom}`} fill="none" stroke="#d1d5db" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#gl-${storageKey})`} />
            <rect x="1" y="1" width={barracaoW*zoom-2} height={barracaoH*zoom-2}
              fill="none" stroke="#374151" strokeWidth="3" strokeDasharray="8,4" rx="2" />
          </svg>

          <div className="absolute top-2 left-3 text-xs font-bold text-muted-foreground/60 pointer-events-none">
            {titulo} — {barracaoW}×{barracaoH} · {viewAngleLabel}
          </div>

          {/* Itens com transformação baseada no ângulo */}
          {items.map(item => {
            const isSelected = selected === item.id;
            
            // Transformações CSS para simular diferentes ângulos
            const angleTransform = {
              topo: "perspective(800px) rotateX(0deg) rotateY(0deg)",
              frente: "perspective(800px) rotateX(25deg) rotateY(0deg)",
              lado: "perspective(800px) rotateX(20deg) rotateY(-25deg)",
            };

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
                  boxShadow: isSelected
                    ? `0 0 0 3px ${item.cor}80, 0 4px 12px ${item.cor}40`
                    : viewAngle === "topo"
                      ? "0 2px 6px rgba(0,0,0,0.1)"
                      : "8px 8px 16px rgba(0,0,0,0.2)",
                  cursor: "grab",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "visible",
                  zIndex: isSelected ? 10 : 1,
                  transform: angleTransform[viewAngle],
                  transformStyle: "preserve-3d",
                  transition: "transform 0.4s ease, box-shadow 0.2s",
                }}
                onMouseDown={e => startDrag(e, item.id)}
                onDoubleClick={e => { e.stopPropagation(); setEditItem({ ...item }); }}
              >
                <span style={{ fontSize: Math.max(10, 18 * zoom), lineHeight: 1, pointerEvents: "none" }}>
                  {tipos[item.tipo]?.icone || "⬜"}
                </span>
                <span style={{ fontSize: Math.max(8, 11 * zoom), fontWeight: 700, color: item.cor, textAlign: "center", padding: "0 4px", lineHeight: 1.2, wordBreak: "break-word", maxWidth: "100%", pointerEvents: "none" }}>
                  {item.label}
                </span>
                <span style={{ fontSize: Math.max(6, 9 * zoom), color: "#9ca3af", marginTop: 2, pointerEvents: "none" }}>
                  {item.w}×{item.h}
                </span>

                {/* Botão delete no canto — sempre visível ao selecionar */}
                {isSelected && (
                  <>
                    <button
                      style={{
                        position: "absolute", top: -12, right: -12,
                        background: "#ef4444", color: "#fff", border: "2px solid #fff",
                        borderRadius: "50%", width: 22, height: 22, fontSize: 12,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", zIndex: 30, boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      }}
                      onMouseDown={e => e.stopPropagation()}
                      onClick={e => { e.stopPropagation(); handleDelete(item.id); }}
                    >✕</button>

                    {/* 8 alças de resize */}
                    {HANDLES.map(({ dir, style }) => (
                      <div
                        key={dir}
                        style={{
                          position: "absolute",
                          width: 12, height: 12,
                          background: "#fff",
                          border: `2px solid ${item.cor}`,
                          borderRadius: 3,
                          zIndex: 25,
                          ...style,
                        }}
                        onMouseDown={e => startResize(e, item.id, dir)}
                      />
                    ))}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Barra de info */}
      {selectedItem && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground bg-card border border-border rounded-lg px-3 py-2">
          <span className="font-bold" style={{ color: selectedItem.cor }}>{selectedItem.label}</span>
          <span>Pos: {selectedItem.x},{selectedItem.y}</span>
          <span>Tam: {selectedItem.w}×{selectedItem.h}</span>
          <span className="text-[10px] opacity-60 ml-1">· Clique para selecionar · Duplo clique para editar · 8 alças para redimensionar · ✕ para apagar</span>
        </div>
      )}

      {/* Dialog: Adicionar */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Adicionar ao Mapa</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label>Tipo</Label>
              <Select value={newTipo} onValueChange={v => { setNewTipo(v); setNewLabel(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(tipos).map(([k, t]) => (
                    <SelectItem key={k} value={k}>{t.icone} {t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Nome (opcional)</Label>
              <Input placeholder={tipos[newTipo]?.label} value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAdd()} />
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

      {/* Dialog: Editar */}
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

      {/* Dialog: Tamanho */}
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