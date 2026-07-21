import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Plus, 
  Mail, 
  Settings2, 
  Monitor, 
  ShieldAlert, 
  ArrowLeft, 
  Search, 
  Camera, 
  CheckCircle, 
  Eye, 
  AlertTriangle, 
  LayoutTemplate, 
  Shield, 
  User, 
  Settings 
} from "lucide-react";
import { toast } from "sonner";

const MAQUINAS_TELHAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM", "CORTE DE EPS"];
const MAQUINAS_CD = ["CORTE 3M", "CORTE 6M", "DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA", "DESBOBINADEIRA"];
const UNIDADES = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa", ""];

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
  { value: "super_admin", label: "Super Administrador", desc: "Controle total — gerencia usuários e permissões" },
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
  telhas: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  corte_dobra: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  ambos: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
};

const ROLE_COLORS = {
  super_admin: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  admin: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  operador: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  vendedor: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
};

const DEFAULT_PERMISSIONS = {
  pular_foto_balanca: false,
  aprovar_reserva_automatica: false,
  ver_dados_financeiros: false,
  ignorar_bloqueio_op: false,
  layout_compacto: false,
};

export default function GerenciarUsuarios() {
  const navigate = useNavigate();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [activeTab, setActiveTab] = useState("perfil");
  const [searchTerm, setSearchTerm] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operador");
  const [inviting, setInviting] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  const { data: rawUsers = [], isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => base44.entities.User.list(),
  });

  const users = rawUsers.map(u => ({
    ...u,
    permissions: u.permissions || { ...DEFAULT_PERMISSIONS }
  }));

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ["users"] }); 
      setEditOpen(false); 
      setEditUser(null); 
      toast.success("Usuário atualizado com sucesso!"); 
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao atualizar usuário.");
    }
  });

  const isSuperAdmin = currentUser?.role === "super_admin";

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
      queryClient.invalidateQueries({ queryKey: ["users"] });
    } catch (e) {
      toast.error("Erro ao enviar convite: " + e.message);
    }
    setInviting(false);
  };

  const handleUpdateUser = () => {
    if (!editUser) return;
    updateMutation.mutate({ 
      id: editUser.id, 
      data: {
        full_name: editUser.full_name,
        role: editUser.role,
        maquina: serializeMaquinas(editUser.maquinas || []),
        unidade: editUser.unidade || "",
        setor: editUser.setor || "telhas",
        gerencia: editUser.gerencia || false,
        permissions: editUser.permissions || { ...DEFAULT_PERMISSIONS }
      }
    });
  };

  const toggleMaquina = (m) => {
    setEditUser(u => {
      const maquinas = u.maquinas || [];
      const exists = maquinas.includes(m);
      return { ...u, maquinas: exists ? maquinas.filter(x => x !== m) : [...maquinas, m] };
    });
  };

  const handlePermissionToggle = (permKey) => {
    setEditUser(u => {
      const currentPerms = u.permissions || { ...DEFAULT_PERMISSIONS };
      return {
        ...u,
        permissions: {
          ...currentPerms,
          [permKey]: !currentPerms[permKey]
        }
      };
    });
  };

  const filteredUsers = users.filter(u => {
    const term = searchTerm.toLowerCase();
    return (
      (u.full_name || "").toLowerCase().includes(term) ||
      (u.email || "").toLowerCase().includes(term)
    );
  });

  // Bloqueia acesso se não for admin/super_admin
  if (currentUser && currentUser.role !== "admin" && currentUser.role !== "super_admin") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <ShieldAlert className="w-16 h-16 text-muted-foreground mb-4" />
        <h1 className="text-xl font-bold">Acesso Restrito</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Apenas administradores podem acessar o gerenciamento de usuários.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 sm:p-6 animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} title="Voltar" className="h-9 w-9 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Gerenciar Usuários
            </h1>
            <p className="text-sm text-muted-foreground">
              Configure quem acessa o sistema, com qual papel, máquinas atribuídas e permissões Odoo-style.
            </p>
          </div>
        </div>

        <Button onClick={() => setInviteOpen(true)} className="gap-2 shadow-sm shrink-0">
          <Plus className="w-4 h-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Roles explicação */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLES.map(r => {
          const count = users.filter(u => u.role === r.value).length;
          return (
            <div key={r.value} className={`border rounded-xl p-3 bg-card ${ROLE_COLORS[r.value].replace("text-", "border-").replace("-100", "-200").replace("-700", "-300")}`}>
              <div className="flex items-center justify-between mb-1.5">
                <Badge className={`border text-xs ${ROLE_COLORS[r.value]}`}>{r.label}</Badge>
                <span className="text-xs font-semibold text-muted-foreground px-2 py-0.5 rounded bg-muted">
                  {count} {count === 1 ? "usuário" : "usuários"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{r.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Barra de Busca e Contador */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Buscar por nome ou e-mail..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>

        <p className="text-xs text-muted-foreground font-medium">
          Mostrando <strong>{filteredUsers.length}</strong> de <strong>{users.length}</strong> usuário(s) cadastrado(s)
        </p>
      </div>

      {/* Lista de usuários */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nenhum usuário encontrado
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredUsers.map(u => {
              const perms = u.permissions || {};
              const userMaquinas = parseMaquinas(u.maquina);
              return (
                <div key={u.id} className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                      <span className="text-primary font-bold text-sm">
                        {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{u.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap justify-start sm:justify-end">
                    {u.role && (
                      <Badge className={`border text-xs ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700"}`}>
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </Badge>
                    )}
                    {u.gerencia && (
                      <Badge className="border text-xs bg-amber-100 text-amber-700 border-amber-200">
                        Gerência
                      </Badge>
                    )}
                    {u.setor && (
                      <Badge className={`border text-xs ${SETOR_COLORS[u.setor] || ""}`}>
                        {SETORES.find(s => s.value === u.setor)?.label || u.setor}
                      </Badge>
                    )}
                    {userMaquinas.map(m => (
                      <Badge key={m} variant="outline" className="text-xs gap-1 font-normal bg-background">
                        <Monitor className="w-3 h-3 text-muted-foreground" />
                        {m}
                      </Badge>
                    ))}
                    {u.unidade && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {u.unidade}
                      </Badge>
                    )}

                    {/* Badges de Permissão Granular */}
                    {perms.pular_foto_balanca && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 gap-1">
                        <Camera className="w-3 h-3" /> Peso Teórico
                      </Badge>
                    )}
                    {perms.aprovar_reserva_automatica && (
                      <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 gap-1">
                        <CheckCircle className="w-3 h-3" /> Auto Reserva
                      </Badge>
                    )}

                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 gap-1 ml-1" 
                      onClick={() => { 
                        setEditUser({ 
                          ...u, 
                          maquinas: userMaquinas,
                          permissions: u.permissions || { ...DEFAULT_PERMISSIONS }
                        }); 
                        setActiveTab("perfil");
                        setEditOpen(true); 
                      }}
                    >
                      <Settings2 className="w-4 h-4" />
                      Configurar
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dialog Convidar Usuário */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Convidar Usuário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Email *</Label>
              <Input 
                type="email" 
                placeholder="email@exemplo.com" 
                value={inviteEmail} 
                onChange={e => setInviteEmail(e.target.value)} 
              />
            </div>
            <div className="space-y-1">
              <Label>Papel</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <p className="font-medium">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
              O usuário receberá um email com link de acesso. Depois que entrar, você pode configurar as máquinas e permissões Odoo-style dele aqui.
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

      {/* Sheet Lateral Configurar Usuário (Perfil + Permissões Granulares) */}
      <Sheet open={editOpen} onOpenChange={open => { setEditOpen(open); if(!open) setEditUser(null); }}>
        <SheetContent className="w-[420px] sm:w-[540px] border-border bg-background/95 backdrop-blur-xl overflow-y-auto p-6">
          {editUser && (
            <>
              <SheetHeader className="mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <span className="text-primary font-bold text-base">
                      {(editUser.full_name || editUser.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <SheetTitle className="text-lg">{editUser.full_name || editUser.email}</SheetTitle>
                    <SheetDescription className="text-xs">{editUser.email}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="perfil" className="gap-2">
                    <User className="w-4 h-4" />
                    Perfil & Máquinas
                  </TabsTrigger>
                  <TabsTrigger value="permissoes" className="gap-2">
                    <Shield className="w-4 h-4" />
                    Regras Odoo-Style
                  </TabsTrigger>
                </TabsList>

                {/* Aba 1: Perfil & Máquinas */}
                <TabsContent value="perfil" className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="user-name">Nome Completo</Label>
                    <Input 
                      id="user-name"
                      value={editUser.full_name || ""} 
                      onChange={e => setEditUser(u => ({ ...u, full_name: e.target.value }))}
                      placeholder="Nome do colaborador"
                    />
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
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-primary" />
                        Máquinas Associadas
                      </Label>
                      <div className="border border-border rounded-lg p-3 space-y-2 max-h-48 overflow-y-auto bg-card/50">
                        {getMaquinasPorSetor(editUser.setor || "telhas").map(m => (
                          <label key={m} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors">
                            <Checkbox
                              checked={(editUser.maquinas || []).includes(m)}
                              onCheckedChange={() => toggleMaquina(m)}
                            />
                            <span className="text-xs">{m}</span>
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

                  <div className="bg-card/40 rounded-lg p-3 border border-border flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">Acesso Gerencial</p>
                      <p className="text-xs text-muted-foreground">Acesso ao setor gerencial (link externo OEE)</p>
                    </div>
                    <Switch
                      checked={editUser.gerencia || false}
                      onCheckedChange={v => setEditUser(u => ({ ...u, gerencia: v }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Unidade</Label>
                    <Select value={editUser.unidade || "todas"} onValueChange={v => setEditUser(u => ({ ...u, unidade: v === "todas" ? "" : v }))}>
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas</SelectItem>
                        {UNIDADES.filter(u => u).map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>

                {/* Aba 2: Regras e Permissões Granulares (Odoo-Style) */}
                <TabsContent value="permissoes" className="space-y-4">
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-primary" />
                      Regras Operacionais e Bypasses
                    </h3>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 transition-colors">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Camera className="h-4 w-4 text-blue-500" />
                          Pular Foto da Balança
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Permite que este usuário finalize a OP usando diretamente o <strong>peso teórico</strong> sem obrigatoriedade de foto da balança.
                        </p>
                      </div>
                      <Switch 
                        checked={editUser.permissions?.pular_foto_balanca || false}
                        onCheckedChange={() => handlePermissionToggle('pular_foto_balanca')}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 transition-colors">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Aprovar Reserva Automática
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Aprova automaticamente reservas de estoque sem depender da autorização da gerência.
                        </p>
                      </div>
                      <Switch 
                        checked={editUser.permissions?.aprovar_reserva_automatica || false}
                        onCheckedChange={() => handlePermissionToggle('aprovar_reserva_automatica')}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 transition-colors">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Eye className="h-4 w-4 text-purple-500" />
                          Ver Dados Financeiros
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Exibe custos de matéria-prima, margens de lucro e valores financeiros nas OPs.
                        </p>
                      </div>
                      <Switch 
                        checked={editUser.permissions?.ver_dados_financeiros || false}
                        onCheckedChange={() => handlePermissionToggle('ver_dados_financeiros')}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 transition-colors">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Ignorar Bloqueio de OP
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Permite iniciar Ordens de Produção mesmo se houver divergência de estoque.
                        </p>
                      </div>
                      <Switch 
                        checked={editUser.permissions?.ignorar_bloqueio_op || false}
                        onCheckedChange={() => handlePermissionToggle('ignorar_bloqueio_op')}
                      />
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-border/50">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Settings className="w-4 h-4 text-primary" />
                      Preferências de Layout
                    </h3>

                    <div className="flex items-center justify-between p-3.5 rounded-xl border border-border/60 bg-card/40 hover:bg-card/60 transition-colors">
                      <div className="space-y-0.5 pr-4">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <LayoutTemplate className="h-4 w-4 text-slate-500" />
                          Layout Compacto
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Força exibição densa de tabelas e cartões para otimizar espaço de tela.
                        </p>
                      </div>
                      <Switch 
                        checked={editUser.permissions?.layout_compacto || false}
                        onCheckedChange={() => handlePermissionToggle('layout_compacto')}
                      />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="pt-6 mt-6 border-t border-border flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => { setEditOpen(false); setEditUser(null); }}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateUser} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}