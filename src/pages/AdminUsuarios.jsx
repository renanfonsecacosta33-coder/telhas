import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  UserPlus, 
  Mail, 
  Settings2, 
  Monitor, 
  ShieldAlert, 
  Search, 
  ArrowLeft, 
  Camera, 
  CheckCircle, 
  Eye, 
  AlertTriangle, 
  LayoutTemplate, 
  User, 
  Shield, 
  Settings, 
  Building,
  Loader2,
  Filter
} from "lucide-react";

const MAQUINAS_TELHAS = ["TP - 25", "TP - 40", "ONDULADA", "COLONIAL", "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM", "CORTE DE EPS"];
const MAQUINAS_CD = ["CORTE 3M", "CORTE 6M", "DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA", "DESBOBINADEIRA"];
const UNIDADES = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];

function getMaquinasPorSetor(setor) {
  if (setor === "telhas") return MAQUINAS_TELHAS;
  if (setor === "corte_dobra") return MAQUINAS_CD;
  return [...MAQUINAS_TELHAS, ...MAQUINAS_CD];
}

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

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("todos");
  const [setorFilter, setSetorFilter] = useState("todos");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("operador");
  const [inviting, setInviting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [activeTab, setActiveTab] = useState("perfil");

  const [currentUser, setCurrentUser] = useState(null);

  // Busca todos os usuários reais da aplicação via base44.entities.User.list()
  const { data: users = [], isLoading, isError } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const data = await base44.entities.User.list();
      return data.map(u => ({
        ...u,
        permissions: u.permissions || { ...DEFAULT_PERMISSIONS }
      }));
    },
  });

  useEffect(() => {
    base44.auth.me().then(setCurrentUser).catch(() => {});
  }, []);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuário atualizado com sucesso!");
    },
    onError: (err) => {
      console.error(err);
      toast.error("Erro ao salvar alterações do usuário.");
    }
  });

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
      toast.error("Erro ao enviar convite: " + (e.message || "Tente novamente"));
    } finally {
      setInviting(false);
    }
  };

  const handleSaveUser = () => {
    if (!editUser) return;
    const payload = {
      full_name: editUser.full_name,
      role: editUser.role,
      setor: editUser.setor || "telhas",
      unidade: editUser.unidade || "",
      maquina: serializeMaquinas(editUser.maquinas || []),
      gerencia: editUser.gerencia || false,
      permitido_central_alertas: editUser.permitido_central_alertas || false,
      permissions: editUser.permissions || { ...DEFAULT_PERMISSIONS }
    };

    updateMutation.mutate({ id: editUser.id, data: payload }, {
      onSuccess: () => {
        setEditOpen(false);
        setEditUser(null);
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
      const updatedPerms = { ...currentPerms, [permKey]: !currentPerms[permKey] };
      return { ...u, permissions: updatedPerms };
    });
  };

  // Filtros de busca
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      (u.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "todos" || u.role === roleFilter;
    const matchesSetor = setorFilter === "todos" || u.setor === setorFilter;
    return matchesSearch && matchesRole && matchesSetor;
  });

  // Estatísticas de papéis
  const roleCounts = {
    super_admin: users.filter(u => u.role === "super_admin").length,
    admin: users.filter(u => u.role === "admin").length,
    operador: users.filter(u => u.role === "operador").length,
    vendedor: users.filter(u => u.role === "vendedor").length,
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} title="Voltar" className="h-10 w-10 shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="w-7 h-7 text-primary" />
              Gestão de Usuários e Permissões
            </h1>
            <p className="text-sm text-muted-foreground">
              Cadastre, aloque máquinas e defina permissões granulares Odoo-Style para toda a equipe.
            </p>
          </div>
        </div>

        <Button onClick={() => setInviteOpen(true)} className="gap-2 shadow-sm shrink-0">
          <UserPlus className="w-4 h-4" />
          Convidar Usuário
        </Button>
      </div>

      {/* Cards explicativos de Papéis com contadores */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {ROLES.map(r => (
          <Card key={r.value} className="border border-border/60 shadow-sm bg-card/60 backdrop-blur">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <Badge className={`border text-xs ${ROLE_COLORS[r.value]}`}>
                  {r.label}
                </Badge>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {roleCounts[r.value]} {roleCounts[r.value] === 1 ? "usuário" : "usuários"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {r.desc}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros e Busca */}
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

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0 hidden sm:inline-block" />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-9 text-xs w-[140px]">
              <SelectValue placeholder="Papel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Papéis</SelectItem>
              {ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={setorFilter} onValueChange={setSetorFilter}>
            <SelectTrigger className="h-9 text-xs w-[150px]">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Setores</SelectItem>
              {SETORES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Lista de Usuários */}
      <Card className="border border-border/60 shadow-sm overflow-hidden bg-card/60 backdrop-blur">
        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center justify-between">
          <p className="text-sm font-medium text-foreground">
            Mostrando <strong>{filteredUsers.length}</strong> de <strong>{users.length}</strong> usuário(s) cadastrado(s)
          </p>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm">Carregando usuários do sistema...</p>
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-rose-500 text-sm">
              Erro ao carregar a lista de usuários. Por favor, tente novamente.
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">
              Nenhum usuário encontrado com os filtros aplicados.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-b border-border/60">
                  <TableHead className="w-[280px]">Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Setor / Unidade</TableHead>
                  <TableHead>Máquinas Associadas</TableHead>
                  <TableHead>Permissões Especiais</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(u => {
                  const userMaquinas = parseMaquinas(u.maquina);
                  const perms = u.permissions || {};
                  return (
                    <TableRow 
                      key={u.id} 
                      className="group cursor-pointer hover:bg-muted/40 transition-colors"
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
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                            <span className="text-primary font-bold text-sm">
                              {(u.full_name || u.email || "?").charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-sm truncate text-foreground">
                              {u.full_name || "Sem Nome"}
                            </span>
                            <span className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <Mail className="w-3 h-3 shrink-0" />
                              {u.email}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {u.role ? (
                          <Badge className={`border text-xs ${ROLE_COLORS[u.role] || "bg-gray-100 text-gray-700"}`}>
                            {ROLES.find(r => r.value === u.role)?.label || u.role}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1.5 items-center">
                          {u.setor && (
                            <Badge className={`border text-xs ${SETOR_COLORS[u.setor] || ""}`}>
                              {SETORES.find(s => s.value === u.setor)?.label || u.setor}
                            </Badge>
                          )}
                          {u.unidade && (
                            <Badge variant="secondary" className="text-[11px] gap-1 font-normal">
                              <Building className="w-3 h-3 text-muted-foreground" />
                              {u.unidade}
                            </Badge>
                          )}
                          {u.gerencia && (
                            <Badge className="border text-xs bg-amber-100 text-amber-700 border-amber-200">
                              Gerência
                            </Badge>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {userMaquinas.length > 0 ? (
                            userMaquinas.map(m => (
                              <Badge key={m} variant="outline" className="text-[11px] py-0 h-5 gap-1 font-normal bg-background">
                                <Monitor className="w-3 h-3 text-muted-foreground" />
                                {m}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground font-light">Todas / Nenhuma</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-wrap gap-1">
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
                          {perms.ver_dados_financeiros && (
                            <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 gap-1">
                              <Eye className="w-3 h-3" /> Financeiro
                            </Badge>
                          )}
                          {perms.ignorar_bloqueio_op && (
                            <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 gap-1">
                              <AlertTriangle className="w-3 h-3" /> Bypass OP
                            </Badge>
                          )}
                          {!perms.pular_foto_balanca && !perms.aprovar_reserva_automatica && !perms.ver_dados_financeiros && !perms.ignorar_bloqueio_op && (
                            <span className="text-xs text-muted-foreground font-light">Padrão</span>
                          )}
                        </div>
                      </TableCell>

                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditUser({ 
                              ...u, 
                              maquinas: userMaquinas,
                              permissions: u.permissions || { ...DEFAULT_PERMISSIONS }
                            });
                            setActiveTab("perfil");
                            setEditOpen(true);
                          }}
                          className="opacity-80 group-hover:opacity-100 transition-opacity gap-1"
                        >
                          <Settings2 className="w-4 h-4" />
                          Configurar
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal Convidar Usuário */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-primary" />
              Convidar Novo Usuário
            </DialogTitle>
            <DialogDescription>
              O novo funcionário receberá um convite por e-mail para definir a senha e acessar o AJL ERP.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Endereço de E-mail *</Label>
              <Input 
                id="invite-email"
                type="email" 
                placeholder="funcionario@ajlferroeaco.com.br" 
                value={inviteEmail} 
                onChange={e => setInviteEmail(e.target.value)} 
              />
            </div>

            <div className="space-y-1.5">
              <Label>Papel Inicial</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="py-0.5">
                        <p className="font-medium text-sm">{r.label}</p>
                        <p className="text-xs text-muted-foreground">{r.desc}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground flex gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>Após a aceitação do convite, você poderá atribuir as máquinas e permissões estendidas no painel.</span>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={handleInvite} disabled={!inviteEmail || inviting}>
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : "Enviar Convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawer Lateral Odoo-Style (Configuração do Usuário) */}
      <Sheet open={editOpen} onOpenChange={open => { setEditOpen(open); if(!open) setEditUser(null); }}>
        <SheetContent className="w-[420px] sm:w-[560px] border-border bg-background/95 backdrop-blur-xl overflow-y-auto p-6">
          {editUser && (
            <>
              <SheetHeader className="mb-6 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                    <span className="text-primary font-bold text-lg">
                      {(editUser.full_name || editUser.email || "?").charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <SheetTitle className="text-xl">{editUser.full_name || editUser.email}</SheetTitle>
                    <SheetDescription className="text-xs flex items-center gap-2 mt-1">
                      <span>{editUser.email}</span>
                      {editUser.role && (
                        <Badge className={`border text-[10px] py-0 ${ROLE_COLORS[editUser.role] || ""}`}>
                          {ROLES.find(r => r.value === editUser.role)?.label || editUser.role}
                        </Badge>
                      )}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="perfil" className="gap-2">
                    <User className="w-4 h-4" />
                    Perfil & Atribuições
                  </TabsTrigger>
                  <TabsTrigger value="permissoes" className="gap-2">
                    <Shield className="w-4 h-4" />
                    Regras Odoo-Style
                  </TabsTrigger>
                </TabsList>

                {/* Aba 1: Perfil & Atribuições */}
                <TabsContent value="perfil" className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-name">Nome Completo</Label>
                    <Input 
                      id="edit-name" 
                      value={editUser.full_name || ""} 
                      onChange={e => setEditUser(u => ({ ...u, full_name: e.target.value }))}
                      placeholder="Ex: João da Silva"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Papel *</Label>
                      <Select 
                        value={editUser.role || "operador"} 
                        onValueChange={v => setEditUser(u => ({ ...u, role: v }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label>Setor</Label>
                      <Select 
                        value={editUser.setor || "telhas"} 
                        onValueChange={v => setEditUser(u => ({ ...u, setor: v, maquinas: [] }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {SETORES.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Unidade de Trabalho</Label>
                    <Select 
                      value={editUser.unidade || "todas"} 
                      onValueChange={v => setEditUser(u => ({ ...u, unidade: v === "todas" ? "" : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione a unidade" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todas">Todas as Unidades</SelectItem>
                        {UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Seleção de Máquinas por Operador */}
                  {editUser.role === "operador" && (
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label className="flex items-center gap-2">
                        <Monitor className="w-4 h-4 text-primary" />
                        Máquinas Associadas (Visibilidade de OP)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        O operador verá apenas os pedidos das máquinas marcadas abaixo:
                      </p>
                      
                      <div className="border border-border/60 rounded-xl p-3 space-y-2 max-h-52 overflow-y-auto bg-card/40">
                        {getMaquinasPorSetor(editUser.setor || "telhas").map(m => (
                          <label key={m} className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded-md p-1.5 transition-colors">
                            <Checkbox
                              checked={(editUser.maquinas || []).includes(m)}
                              onCheckedChange={() => toggleMaquina(m)}
                            />
                            <span className="text-xs font-medium">{m}</span>
                          </label>
                        ))}
                      </div>
                      {(editUser.maquinas || []).length > 0 && (
                        <p className="text-xs text-primary font-medium">
                          {(editUser.maquinas || []).length} máquina(s) selecionada(s)
                        </p>
                      )}
                    </div>
                  )}

                  <div className="space-y-3 pt-2 border-t border-border/50">
                    <div className="bg-card/40 rounded-xl p-3 border border-border/60 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Acesso Gerencial</Label>
                        <p className="text-xs text-muted-foreground">Permite visualizar o módulo de OEE e gestão</p>
                      </div>
                      <Switch
                        checked={editUser.gerencia || false}
                        onCheckedChange={v => setEditUser(u => ({ ...u, gerencia: v }))}
                      />
                    </div>

                    <div className="bg-card/40 rounded-xl p-3 border border-border/60 flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label className="text-sm font-medium">Central de Alertas</Label>
                        <p className="text-xs text-muted-foreground">Permite gerenciar regras de notificação</p>
                      </div>
                      <Switch
                        checked={editUser.permitido_central_alertas || false}
                        onCheckedChange={v => setEditUser(u => ({ ...u, permitido_central_alertas: v }))}
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* Aba 2: Regras e Permissões Granulares (Odoo Style) */}
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
                          Permite que este usuário finalize a OP usando diretamente o <strong>peso teórico</strong> sem obrigatoriedade de anexar foto da balança.
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
                          Permite iniciar Ordens de Produção mesmo se houver pendências ou divergência de estoque.
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
                <Button onClick={handleSaveUser} disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : "Salvar Alterações"}
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
