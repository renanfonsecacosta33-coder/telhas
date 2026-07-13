import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const MAQUINAS_TELHAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];
const MAQUINAS_CD = ["CORTE 3M", "CORTE 6M", "DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA", "DESBOBINADEIRA"];
const UNIDADES = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];

const ROLES = [
  { value: "super_admin", label: "Super Admin" },
  { value: "admin", label: "Administrador" },
  { value: "operador", label: "Operador" },
  { value: "vendedor", label: "Vendedor" },
];

const SETORES = [
  { value: "telhas", label: "🏗️ Telhas" },
  { value: "corte_dobra", label: "✂️ Corte e Dobra" },
  { value: "ambos", label: "🏭 Ambos os setores" },
];

function getMaquinasPorSetor(setor) {
  if (setor === "telhas") return MAQUINAS_TELHAS;
  if (setor === "corte_dobra") return MAQUINAS_CD;
  return [...MAQUINAS_TELHAS, ...MAQUINAS_CD];
}

function parseMaquinas(maquina) {
  if (!maquina) return [];
  try {
    const parsed = JSON.parse(maquina);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [maquina];
  }
}

function serializeMaquinas(arr) {
  if (!arr || arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  return JSON.stringify(arr);
}

export default function EditarMembroDialog({ user, onClose, onSave, saving }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (user) {
      setForm({
        ...user,
        maquinas: parseMaquinas(user.maquina),
      });
    } else {
      setForm(null);
    }
  }, [user]);

  if (!user || !form) return null;

  const toggleMaquina = (m) => {
    setForm(f => {
      const maquinas = f.maquinas || [];
      const exists = maquinas.includes(m);
      return { ...f, maquinas: exists ? maquinas.filter(x => x !== m) : [...maquinas, m] };
    });
  };

  const handleSave = () => {
    onSave({
      role: form.role,
      maquina: serializeMaquinas(form.maquinas || []),
      unidade: form.unidade || "",
      setor: form.setor || "telhas",
      gerencia: form.gerencia || false,
    });
  };

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configurar Membro</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-semibold text-sm">{form.full_name || form.email}</p>
            <p className="text-xs text-muted-foreground">{form.email}</p>
          </div>
          <div className="space-y-1">
            <Label>Função *</Label>
            <Select value={form.role || "operador"} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Setor</Label>
            <Select value={form.setor || "telhas"} onValueChange={v => setForm(f => ({ ...f, setor: v, maquinas: [] }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SETORES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {form.role === "operador" && (
            <div className="space-y-2">
              <Label>Máquinas Associadas</Label>
              <div className="border border-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                {getMaquinasPorSetor(form.setor || "telhas").map(m => (
                  <label key={m} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                    <Checkbox
                      checked={(form.maquinas || []).includes(m)}
                      onCheckedChange={() => toggleMaquina(m)}
                    />
                    <span className="text-sm">{m}</span>
                  </label>
                ))}
              </div>
              {(form.maquinas || []).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {(form.maquinas || []).length} máquina(s): {(form.maquinas || []).join(", ")}
                </p>
              )}
            </div>
          )}
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Gerência</p>
              <p className="text-xs text-muted-foreground">Acesso ao setor gerencial</p>
            </div>
            <Switch
              checked={form.gerencia || false}
              onCheckedChange={v => setForm(f => ({ ...f, gerencia: v }))}
            />
          </div>
          <div className="space-y-1">
            <Label>Unidade</Label>
            <Select value={form.unidade || "todas"} onValueChange={v => setForm(f => ({ ...f, unidade: v === "todas" ? "" : v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}