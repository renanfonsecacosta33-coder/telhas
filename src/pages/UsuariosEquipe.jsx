import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Mail, Search, Circle, MessageCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import EditarMembroDialog from "@/components/equipe/EditarMembroDialog";

const ROLES = [
  { value: "super_admin", label: "Super Admin", desc: "Controle total" },
  { value: "admin", label: "Administrador", desc: "Acesso total ao sistema" },
  { value: "operador", label: "Operador", desc: "Vê pedidos da sua máquina" },
  { value: "vendedor", label: "Vendedor", desc: "Cadastra e acompanha pedidos" },
];

const ROLE_COLORS = {
  super_admin: "bg-purple-100 text-purple-700 border-purple-200",
  admin: "bg-red-100 text-red-700 border-red-200",
  operador: "bg-blue-100 text-blue-700 border-blue-200",
  vendedor: "bg-green-100 text-green-700 border-green-200",
};

const SETOR_LABELS = {
  telhas: "🏗️ Telhas",
  corte_dobra: "✂️ Corte e Dobra",
  ambos: "🏭 Ambos",
};

const SETOR_COLORS = {
  telhas: "bg-blue-100 text-blue-700 border-blue-200",
  corte_dobra: "bg-orange-100 text-orange-700 border-orange-200",
  ambos: "bg-purple-100 text-purple-700 border-purple-200",
};

const ACTIVE_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

function parseMaquinas(maquina) {
  if (!maquina) return [];
  try {
    const parsed = JSON.parse(maquina);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [maquina];
  }
}

export default function UsuariosEquipe() {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operador");
  const [inviting, setInviting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  // Buscar mensagens recentes para determinar atividade no chat
  const { data: recentMessages = [] } = useQuery({
    queryKey: ["chat-activity"],
    queryFn: () => base44.entities.MensagemChat.list("-data_hora", 200),
    refetchInterval: 30000,
  });

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditUser(null);
      toast.success("Membro atualizado!");
    },
  });

  // Mapa de última atividade por usuário (baseado em mensagens de chat)
  const activityMap = useMemo(() => {
    const map = {};
    const now = Date.now();
    recentMessages.forEach(msg => {
      if (!msg.remetente_id) return;
      const ts = new Date(msg.data_hora).getTime();
      if (isNaN(ts)) return;
      if (!map[msg.remetente_id] || ts > map[msg.remetente_id].ts) {
        map[msg.remetente_id] = { ts, now };
      }
    });
    return map;
  }, [recentMessages]);

  const isUserActive = (userId) => {
    const activity = activityMap[userId];
    if (!activity) return false;
    return (Date.now() - activity.ts) < ACTIVE_WINDOW_MS;
  };

  const getLastActiveLabel = (userId) => {
    const activity = activityMap[userId];
    if (!activity) return "Sem atividade";
    const diffMs = Date.now() - activity.ts;
    if (diffMs < 60000) return "há instantes";
    if (diffMs < ACTIVE_WINDOW_MS) return "ativo agora";
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `há ${mins}min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `há ${days}d`;
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setInviting(true);
    try {
      const platformRole = (inviteRole === "admin" || inviteRole === "super_admin") ? "admin" : "user";
      await base44.users.inviteUser(inviteEmail, platformRole);
      toast.success(`Convite enviado para ${inviteEmail}!`);
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("operador");
    } catch (e) {
      toast.error("Erro ao enviar convite: " + e.message);
    }
    setInviting(false);
  };

  const handleUpdateUser = (data) => {
    if (!editUser) return;
    updateMutation.mutate({ id: editUser.id, data });
  };

  // Bloqueia acesso se não for admin
  if (currentUser && currentUser.role !== "admin" && currentUser.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold">Acesso Restrito</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Apenas administradores podem acessar o gerenciamento da equipe.
        </p>
      </div>
    );
  }

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.full_name || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  });

  const activeCount = users.filter(u => isUserActive(u.id)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6" />
            Equipe
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie funções e veja quem está ativo no chat interno</p>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Convidar Membro
        </Button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold">{users.length}</p>
          <p className="text-xs text-muted-foreground">Total de membros</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold flex items-center gap-1">
            <Circle className="w-3 h-3 fill-green-500 text-green-500" />
            {activeCount}
          </p>
          <p className="text-xs text-muted-foreground">Ativos no chat</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold">{users.filter(u => u.role === "operador").length}</p>
          <p className="text-xs text-muted-foreground">Operadores</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-2xl font-bold">{users.filter(u => u.role === "vendedor").length}</p>
          <p className="text-xs text-muted-foreground">Vendedores</p>
        </div>
      </div>

      {/* Busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Lista de membros */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {isLoading ? (
          <div className="p-8 flex justify-center"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Nenhum membro encontrado</div>
        ) : (
          <div className="divide-y divide-border">
            {filteredUsers.map(u => {
              const active = isUserActive(u.id);
              const maquinas = parseMaquinas(u.maquina);
              return (
                <div key={u.id} className="px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-bold text-sm">{(u.full_name || u.email || "?").charAt(0).toUpperCase()}</span>
                    </div>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${active ? "bg-green-500" : "bg-muted-foreground/30"}`}
                      title={active ? "Ativo agora" : "Inativo"}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{u.full_name || "—"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      {u.email}
                    </p>
                  </div>
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MessageCircle className="w-3 h-3" />
                    {getLastActiveLabel(u.id)}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {u.role && <Badge className={`border text-xs ${ROLE_COLORS[u.role] || ""}`}>{ROLES.find(r => r.value === u.role)?.label || u.role}</Badge>}
                    {u.setor && <Badge className={`border text-xs ${SETOR_COLORS[u.setor] || ""}`}>{SETOR_LABELS[u.setor] || u.setor}</Badge>}
                    {maquinas.length > 0 && maquinas.slice(0, 2).map(m => (
                      <Badge key={m} variant="outline" className="text-xs">{m}</Badge>
                    ))}
                    {maquinas.length > 2 && <Badge variant="outline" className="text-xs">+{maquinas.length - 2}</Badge>}
                    {u.unidade && <Badge variant="secondary" className="text-xs">{u.unidade}</Badge>}
                  </div>
                  <Button variant="ghost" size="sm" className="h-8 text-xs flex-shrink-0" onClick={() => setEditUser(u)}>
                    Editar
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog Convidar */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setInviteOpen(false)}>
          <div className="bg-background border rounded-lg p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Convidar Membro</h2>
            <div className="space-y-1">
              <label className="text-sm font-medium">Email *</label>
              <Input type="email" placeholder="email@exemplo.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Função</label>
              <div className="space-y-2">
                {ROLES.map(r => (
                  <label key={r.value} className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer hover:bg-muted/50 ${inviteRole === r.value ? "border-primary bg-primary/5" : "border-border"}`}>
                    <input type="radio" name="inviteRole" checked={inviteRole === r.value} onChange={() => setInviteRole(r.value)} className="mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{r.label}</p>
                      <p className="text-xs text-muted-foreground">{r.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
              <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
                {inviting ? "Enviando..." : "Enviar Convite"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Dialog Editar */}
      <EditarMembroDialog
        user={editUser}
        onClose={() => setEditUser(null)}
        onSave={handleUpdateUser}
        saving={updateMutation.isPending}
      />
    </div>
  );
}