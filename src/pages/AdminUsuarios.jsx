import React, { useState, useEffect } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { 
  Camera, 
  CheckCircle, 
  Eye, 
  AlertTriangle, 
  LayoutTemplate,
  User,
  Shield,
  Settings,
  UserPlus,
  Loader2,
  ArrowLeft
} from "lucide-react";
import { base44 } from "@/api/base44Client";

const DEFAULT_PERMISSIONS = {
  pular_foto_balanca: false,
  aprovar_reserva_automatica: false,
  ver_dados_financeiros: false,
  ignorar_bloqueio_op: false,
  layout_compacto: false,
};

const DEFAULT_USER_FORM = {
  full_name: "",
  email: "",
  password: "",
  role: "operador",
  setor: "ambos",
  gerencia: false,
  status: "Ativo"
};

export default function AdminUsuarios() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState('edit'); // 'create' | 'edit'
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(DEFAULT_USER_FORM);
  const [activeTab, setActiveTab] = useState("dados");

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const data = await base44.db.User.findMany({});
      const usersComPermissions = data.map(u => ({
        ...u,
        permissions: u.permissions || { ...DEFAULT_PERMISSIONS }
      }));
      setUsers(usersComPermissions);
    } catch (error) {
      console.error("Failed to fetch users", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUserClick = () => {
    setSheetMode('create');
    setFormData(DEFAULT_USER_FORM);
    setSelectedUser({ permissions: { ...DEFAULT_PERMISSIONS } });
    setActiveTab("dados");
    setIsSheetOpen(true);
  };

  const handleRowClick = (user) => {
    setSheetMode('edit');
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name || user.name || "",
      email: user.email || user.username || "",
      password: "",
      role: user.role || "operador",
      setor: user.setor || "ambos",
      gerencia: user.gerencia || false,
      status: user.status || "Ativo",
    });
    setActiveTab("dados");
    setIsSheetOpen(true);
  };

  const handleFormChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveDadosBasicos = async () => {
    try {
      setIsSaving(true);
      if (sheetMode === 'create') {
        if (!formData.full_name || !formData.email || !formData.password) {
          toast.error("Preencha todos os campos obrigatórios (Nome, E-mail, Senha).");
          setIsSaving(false);
          return;
        }
        const newUser = {
          ...formData,
          permissions: selectedUser?.permissions || DEFAULT_PERMISSIONS
        };
        await base44.db.User.create(newUser);
        toast.success("Usuário criado com sucesso!");
      } else {
        if (!formData.full_name || !formData.email) {
          toast.error("Nome e E-mail são obrigatórios.");
          setIsSaving(false);
          return;
        }
        const updatedData = { ...formData };
        if (!updatedData.password) {
          delete updatedData.password;
        }
        await base44.db.User.update(selectedUser.id, updatedData);
        toast.success("Usuário atualizado com sucesso!");
      }
      setIsSheetOpen(false);
      fetchUsers();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar usuário.");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePermissionToggle = async (permissionKey) => {
    if (!selectedUser) return;
    
    const updatedPermissions = {
      ...selectedUser.permissions,
      [permissionKey]: !selectedUser.permissions[permissionKey]
    };

    const updatedUser = {
      ...selectedUser,
      permissions: updatedPermissions
    };

    setSelectedUser(updatedUser);

    if (sheetMode === 'edit') {
      // Auto-save on edit mode
      setUsers(users.map(u => u.id === updatedUser.id ? updatedUser : u));
      try {
        await base44.db.User.update(updatedUser.id, { permissions: updatedPermissions });
        toast.success('Permissão atualizada com sucesso');
      } catch (error) {
        console.error(error);
        // Revert on error
        setSelectedUser(selectedUser);
        setUsers(users.map(u => u.id === selectedUser.id ? selectedUser : u));
        toast.error('Erro ao atualizar permissão no banco');
      }
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} title="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
            <p className="text-muted-foreground mt-2">
              Gerencie acessos, papéis, permissões granulares e perfis dos usuários do sistema.
            </p>
          </div>
        </div>
        <Button onClick={handleCreateUserClick} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              Carregando usuários do sistema...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px]">Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Setor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="group hover:bg-slate-50/50 cursor-pointer transition-colors" onClick={() => handleRowClick(user)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-sm font-medium text-slate-600">
                          {user.full_name ? user.full_name.charAt(0).toUpperCase() : (user.name ? user.name.charAt(0).toUpperCase() : 'U')}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-medium">{user.full_name || user.name || "Sem Nome"}</span>
                          <span className="text-xs text-muted-foreground">{user.email || user.username}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <User className="w-4 h-4" />
                        <span className="capitalize">{user.role || "Operador"}</span>
                        {user.gerencia && (
                          <Badge variant="outline" className="ml-1 text-[10px] py-0 h-4 px-1 border-amber-200 text-amber-700 bg-amber-50">
                            Gerência
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="capitalize text-sm text-muted-foreground">{user.setor || "Ambos"}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={user.status === 'Inativo' ? 'bg-slate-100 text-slate-500' : 'bg-slate-900 text-slate-50'}>
                        {user.status || 'Ativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRowClick(user);
                        }}
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum usuário encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[400px] sm:w-[540px] border-border/50 bg-background/95 backdrop-blur-xl overflow-y-auto">
          {selectedUser && (
            <>
              <SheetHeader className="mb-6">
                <SheetTitle>{sheetMode === 'create' ? 'Novo Usuário' : 'Editar Usuário'}</SheetTitle>
                <SheetDescription>
                  {sheetMode === 'create' 
                    ? 'Preencha os dados abaixo para cadastrar um novo usuário no sistema.'
                    : <span>Gerenciando perfil e permissões de <strong className="text-foreground">{selectedUser?.full_name || selectedUser?.name || "Usuário"}</strong></span>
                  }
                </SheetDescription>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="dados">Dados Básicos</TabsTrigger>
                  <TabsTrigger value="permissoes">Permissões</TabsTrigger>
                </TabsList>

                <TabsContent value="dados" className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="full_name">Nome Completo</Label>
                      <Input 
                        id="full_name" 
                        placeholder="Ex: João da Silva" 
                        value={formData.full_name}
                        onChange={(e) => handleFormChange('full_name', e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input 
                        id="email" 
                        type="email"
                        placeholder="Ex: joao@empresa.com" 
                        value={formData.email}
                        onChange={(e) => handleFormChange('email', e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="password">
                        Senha {sheetMode === 'edit' && <span className="text-muted-foreground text-xs font-normal">(Deixe em branco para manter)</span>}
                      </Label>
                      <Input 
                        id="password" 
                        type="password"
                        placeholder="******" 
                        value={formData.password}
                        onChange={(e) => handleFormChange('password', e.target.value)}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Papel</Label>
                        <Select value={formData.role} onValueChange={(v) => handleFormChange('role', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o papel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="super_admin">Super Admin</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="operador">Operador</SelectItem>
                            <SelectItem value="vendedor">Vendedor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Setor</Label>
                        <Select value={formData.setor} onValueChange={(v) => handleFormChange('setor', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione o setor" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ambos">Ambos</SelectItem>
                            <SelectItem value="telhas">Telhas</SelectItem>
                            <SelectItem value="corte_dobra">Corte e Dobra</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-card/30">
                        <div className="space-y-0.5">
                          <Label>Gerência</Label>
                          <p className="text-[10px] text-muted-foreground">Privilégios de gestor</p>
                        </div>
                        <Switch 
                          checked={formData.gerencia}
                          onCheckedChange={(v) => handleFormChange('gerencia', v)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Status</Label>
                        <Select value={formData.status} onValueChange={(v) => handleFormChange('status', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ativo">Ativo</SelectItem>
                            <SelectItem value="Inativo">Inativo</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button onClick={handleSaveDadosBasicos} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Salvar Dados Básicos
                    </Button>
                  </div>
                </TabsContent>

                <TabsContent value="permissoes" className="space-y-6">
                  {sheetMode === 'create' && (
                    <div className="bg-amber-50 text-amber-800 text-sm p-3 rounded-md border border-amber-200 mb-4">
                      Nota: Em modo de criação, as permissões serão salvas com os valores escolhidos aqui ao clicar em "Salvar Dados Básicos".
                    </div>
                  )}

                  <div className="space-y-4">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Acessos Operacionais
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                        <div className="space-y-1 flex-1 pr-4">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Camera className="h-4 w-4 text-blue-500" />
                            Pular Foto da Balança
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Permitir inserção de peso teórico sem necessidade de enviar foto.
                          </p>
                        </div>
                        <Switch 
                          checked={selectedUser.permissions.pular_foto_balanca}
                          onCheckedChange={() => handlePermissionToggle('pular_foto_balanca')}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                        <div className="space-y-1 flex-1 pr-4">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            Aprovar Reserva Automática
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Aprovar reservas sem depender da autorização da gerência.
                          </p>
                        </div>
                        <Switch 
                          checked={selectedUser.permissions.aprovar_reserva_automatica}
                          onCheckedChange={() => handlePermissionToggle('aprovar_reserva_automatica')}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                        <div className="space-y-1 flex-1 pr-4">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <Eye className="h-4 w-4 text-purple-500" />
                            Ver Dados Financeiros
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Visualizar custos de produção e indicadores financeiros.
                          </p>
                        </div>
                        <Switch 
                          checked={selectedUser.permissions.ver_dados_financeiros}
                          onCheckedChange={() => handlePermissionToggle('ver_dados_financeiros')}
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                        <div className="space-y-1 flex-1 pr-4">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                            Ignorar Bloqueio de OP
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Iniciar OPs mesmo havendo divergência de estoque.
                          </p>
                        </div>
                        <Switch 
                          checked={selectedUser.permissions.ignorar_bloqueio_op}
                          onCheckedChange={() => handlePermissionToggle('ignorar_bloqueio_op')}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Preferências de Layout */}
                  <div className="space-y-4 pt-4 border-t border-border/50">
                    <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Preferências de Layout
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                        <div className="space-y-1 flex-1 pr-4">
                          <Label className="text-sm font-medium flex items-center gap-2">
                            <LayoutTemplate className="h-4 w-4 text-slate-500" />
                            Layout Compacto
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Forçar tabelas e listas em modo denso.
                          </p>
                        </div>
                        <Switch 
                          checked={selectedUser.permissions.layout_compacto}
                          onCheckedChange={() => handlePermissionToggle('layout_compacto')}
                        />
                      </div>
                    </div>
                  </div>
                  
                  {sheetMode === 'create' && (
                     <div className="pt-4 flex justify-end">
                      <Button onClick={handleSaveDadosBasicos} disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Salvar Usuário
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
