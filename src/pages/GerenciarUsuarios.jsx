import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Plus, Mail, Settings2, Monitor } from "lucide-react";
import { toast } from "sonner";

const MAQUINAS_TELHAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"];
const MAQUINAS_CD = ["CORTE 3M", "CORTE 6M", "DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA", "DESBOBINADEIRA"];
const UNIDADES = ["Matriz AJL", "Pinhais", "Ivaiporã", ""];

function getMaquinasPorSetor(setor) {
  if (setor === "telhas") return MAQUINAS_TELHAS;
  if (setor === "corte_dobra") return MAQUINAS_CD;
  return [...MAQUINAS_TELHAS, ...MAQUINAS_CD];
}

// Parse maquina field: pode ser string simples ou JSON array
function parseMaquinas(maquina) {
  if (!maquina) return [];
  try {
    const parsed = JSON.parse(maquina);
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  } catch {
    return [maquina];
  }
}

function serializeMaquinas(arr) {
  if (!arr || arr.length === 0) return "";
  if (arr.length === 1) return arr[0];
  return JSON.stringify(arr);
}
const ROLES = [
  { value: "admin", label: "Administrador", desc: "Acesso total ao sistema" },
  { value: "operador", label: "Operador", desc: "Vê pedidos da sua máquina" },
  { value: "vendedor", label: "Vendedor", desc: "Cadastra e acompanha pedidos" },
];
const SETORES = [
  { value: "telhas", label: "🏗️ Telhas" },
  { value: "corte_dobra", label: "✂️ Corte e Dobra" },
  { value: "ambos", label: "🏭 Ambos os setores" },
];
const SETOR_COLORS = {
  telhas: "bg-blue-100 text-blue-700 border-blue-200",
  corte_dobra: "bg-orange-100 text-orange-700 border-orange-200",
  ambos: "bg-purple-100 text-purple-700 border-purple-200",
};

const ROLE_COLORS = {
  admin: "bg-red-100 text-red-700 border-red-200",
  operador: "bg-blue-100 text-blue-700 border-blue-200",
  vendedor: "bg-green-100 text-green-700 border-green-200",
};

export default function GerenciarUsuarios() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operador");
  const [inviting, setInviting] = useState(false);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["users"] }); setEditOpen(false); setEditUser(null); toast.success("Usuário atualizado!"); },
  });

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole === "admin" ? "admin" : "user");
      toast.success(`Convite enviado para ${inviteEmail}!`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("operador");
    } catch (e) {
      toast.error("Erro ao enviar convite: " + e.message);
    }
    setInviting(false);
  };

  const handleUpdateUser = () => {
    if (!editUser) return;
    updateMutation.mutate({ id: editUser.id, data: {
      role: editUser.role,
      maquina: serializeMaquinas(editUser.maquinas || []),
      unidade: editUser.unidade || "",
      setor: editUser.setor || "telhas",
    }});
  };

  const toggleMaquina = (m) => {
    setEditUser(u => {
      const maquinas = u.maquinas || [];
      const exists = maquinas.includes(m);
      return { ...u, maquinas: exists ? maquinas.filter(x => x !== m) : [...maquinas, m] };
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6" />
            Gerenciar Usuários
          </h1>
          <p className="text-sm text-muted-foreground">Configure quem acessa o sistema e com qual papel</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Roles explicação */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {ROLES.map(r => (
          <div key={r.value} className={`border rounded-xl p-3 ${ROLE_COLORS[r.value].replace("text-", "border-").replace("-100", "-200").replace("-700", "-300")}`}>
            <Badge className={`border text-xs mb-2 ${ROLE_COLORS[r.value]}`}>{r.label}</Badge>
            <p className="text-xs text-muted-foreground">{r.desc}</p>
          </div>
        ))}
      </div>

      {/* Lista de usuários */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold">{users.length} usuário(s) cadastrado(s)</p>
        </div>
        {isLoading ? (
          <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : users.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum usuário encontrado</div>
        ) : (
          <div className="divide-y divide-border">
            {users.map(u => (
              <div key={u.id} className="px-4 py-3 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-primary font-bold text-sm">{(u.full_name || u.email || "?").charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{u.full_name || "—"}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    {u.email}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  {u.role && <Badge className={`border text-xs ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700 border-gray-200"}`}>{u.role}</Badge>}
                  {u.setor && <Badge className={`border text-xs ${SETOR_COLORS[u.setor] || ""}`}>{SETORES.find(s => s.value === u.setor)?.label || u.setor}</Badge>}
                  {parseMaquinas(u.maquina).map(m => (
                    <Badge key={m} variant="outline" className="text-xs gap-1">
                      <Monitor className="w-3 h-3" />
                      {m}
                    </Badge>
                  ))}
                  {u.unidade && <Badge variant="secondary" className="text-xs">{u.unidade}</Badge>}
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditUser({ ...u, maquinas: parseMaquinas(u.maquina) }); setEditOpen(true); }}>
                    <Settings2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog Convidar */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input type="email" placeholder="email@exemplo.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <p>{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              O usuário receberá um email com link de acesso. Depois que entrar, configure a máquina dele aqui.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
              {inviting ? "Enviando..." : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar usuário */}
      <Dialog open={editOpen} onOpenChange={() => { setEditOpen(false); setEditUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Usuário</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4 py-2">
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-semibold text-sm">{editUser.full_name || editUser.email}</p>
                <p className="text-xs text-muted-foreground">{editUser.email}</p>
              </div>
              <div className="space-y-1">
                <Label>Papel *</Label>
                <Select value={editUser.role || "operador"} onValueChange={v => setEditUser(u => ({ ...u, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label} — {r.desc}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Setor</Label>
                <Select value={editUser.setor || "telhas"} onValueChange={v => setEditUser(u => ({ ...u, setor: v, maquinas: [] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SETORES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Define em qual setor este usuário trabalha</p>
              </div>
              {editUser.role === "operador" && (
                <div className="space-y-2">
                  <Label>Máquinas Associadas</Label>
                  <div className="border border-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto">
                    {getMaquinasPorSetor(editUser.setor || "telhas").map(m => (
                      <label key={m} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5">
                        <Checkbox
                          checked={(editUser.maquinas || []).includes(m)}
                          onCheckedChange={() => toggleMaquina(m)}
                        />
                        <span className="text-sm">{m}</span>
                      </label>
                    ))}
                  </div>
                  {(editUser.maquinas || []).length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {(editUser.maquinas || []).length} máquina(s) selecionada(s): {(editUser.maquinas || []).join(", ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">O operador verá apenas os pedidos das máquinas selecionadas</p>
                </div>
              )}
              <div className="space-y-1">
                <Label>Unidade</Label>
                <Select value={editUser.unidade || ""} onValueChange={v => setEditUser(u => ({ ...u, unidade: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>Todas</SelectItem>
                    {UNIDADES.filter(u => u).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditOpen(false); setEditUser(null); }}>Cancelar</Button>
            <Button onClick={handleUpdateUser}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}