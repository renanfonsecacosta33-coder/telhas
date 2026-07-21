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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
  Camera, 
  CheckCircle, 
  Eye, 
  AlertTriangle, 
  LayoutTemplate,
  User,
  Shield,
  Settings
} from "lucide-react";
import { base44 } from "@/api/base44Client";

// Default permissions state to use as fallback
const DEFAULT_PERMISSIONS = {
  pular_foto_balanca: false,
  aprovar_reserva_automatica: false,
  ver_dados_financeiros: false,
  ignorar_bloqueio_op: false,
  layout_compacto: false,
};
const INITIAL_USERS = [
  {
    id: "usr_1",
    name: "João Silva",
    email: "joao@exemplo.com",
    role: "Operador de Máquina",
    status: "Ativo",
    permissions: {
      pular_foto_balanca: false,
      aprovar_reserva_automatica: false,
      ver_dados_financeiros: false,
      ignorar_bloqueio_op: false,
      layout_compacto: false,
    }
  },
  {
    id: "usr_2",
    name: "Maria Oliveira",
    email: "maria.gerente@exemplo.com",
    role: "Gerente de Produção",
    status: "Ativo",
    permissions: {
      pular_foto_balanca: true,
      aprovar_reserva_automatica: true,
      ver_dados_financeiros: true,
      ignorar_bloqueio_op: true,
      layout_compacto: false,
    }
  },
  {
    id: "usr_3",
    name: "Carlos Souza",
    email: "carlos@exemplo.com",
    role: "Almoxarife",
    status: "Inativo",
    permissions: {
      pular_foto_balanca: false,
      aprovar_reserva_automatica: false,
      ver_dados_financeiros: false,
      ignorar_bloqueio_op: false,
      layout_compacto: true,
    }
  },
];
export default function AdminUsuarios() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        // Busca os usuários reais no banco
        const data = await base44.db.User.findMany({});
        // Garante que a propriedade permissions exista
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
    fetchUsers();
  }, []);

  const handleRowClick = (user) => {
    setSelectedUser(user);
    setIsSheetOpen(true);
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

    // Optimistic UI update
    setSelectedUser(updatedUser);
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
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestão de Usuários</h1>
          <p className="text-muted-foreground mt-2">
            Gerencie acessos, papéis e permissões granulares dos usuários do sistema.
          </p>
        </div>
      </div>

      <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-12 text-muted-foreground">
              Carregando usuários do sistema...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[300px]">Usuário</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="group">
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
                        {user.role || "Operador"}
                      </div>
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
                        onClick={() => handleRowClick(user)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
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
                <SheetTitle>Gestão de Acessos</SheetTitle>
                <SheetDescription>
                  Gerenciando permissões para <strong className="text-foreground">{selectedUser?.full_name || selectedUser?.name || "Usuário"}</strong>
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-8">
                {/* Acessos e Permissões */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Acessos e Permissões
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                      <div className="space-y-1 flex-1 pr-4">
                        <Label className="text-base font-medium flex items-center gap-2">
                          <Camera className="h-4 w-4 text-blue-500" />
                          Pular Foto da Balança
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Permitir inserção de peso teórico sem necessidade de enviar foto da balança.
                        </p>
                      </div>
                      <Switch 
                        checked={selectedUser.permissions.pular_foto_balanca}
                        onCheckedChange={() => handlePermissionToggle('pular_foto_balanca')}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                      <div className="space-y-1 flex-1 pr-4">
                        <Label className="text-base font-medium flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          Aprovar Reserva Automática
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Aprovar reservas de estoque sem depender da autorização da gerência.
                        </p>
                      </div>
                      <Switch 
                        checked={selectedUser.permissions.aprovar_reserva_automatica}
                        onCheckedChange={() => handlePermissionToggle('aprovar_reserva_automatica')}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                      <div className="space-y-1 flex-1 pr-4">
                        <Label className="text-base font-medium flex items-center gap-2">
                          <Eye className="h-4 w-4 text-purple-500" />
                          Ver Dados Financeiros
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Visualizar valores, custos de produção e indicadores financeiros ocultos.
                        </p>
                      </div>
                      <Switch 
                        checked={selectedUser.permissions.ver_dados_financeiros}
                        onCheckedChange={() => handlePermissionToggle('ver_dados_financeiros')}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                      <div className="space-y-1 flex-1 pr-4">
                        <Label className="text-base font-medium flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                          Ignorar Bloqueio de OP
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Iniciar Ordens de Produção (OPs) mesmo havendo divergência de estoque.
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
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                      <div className="space-y-1 flex-1 pr-4">
                        <Label className="text-base font-medium flex items-center gap-2">
                          <LayoutTemplate className="h-4 w-4 text-slate-500" />
                          Layout Compacto
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          Forçar tabelas e listas em modo denso, exibindo mais informações na tela.
                        </p>
                      </div>
                      <Switch 
                        checked={selectedUser.permissions.layout_compacto}
                        onCheckedChange={() => handlePermissionToggle('layout_compacto')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
