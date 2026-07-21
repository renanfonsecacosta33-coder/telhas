import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { useTheme } from '@/lib/ThemeContext';
import { base44 } from '@/api/base44Client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetClose
} from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Sun, Moon, Monitor, LogOut, Briefcase, MapPin, MonitorPlay, ChevronRight } from 'lucide-react';

export default function UserSettingsDrawer({ open, onOpenChange }) {
  const { user, logout } = useAuth();
  const { tema, setTema } = useTheme();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const getInitials = (name) => {
    if (!name) return 'U';
    const parts = name.split(' ');
    if (parts.length > 1) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name[0].toUpperCase();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res?.file_url) {
        await base44.auth.updateMe({ avatar_url: res.file_url });
        // The user object in AuthContext should ideally update or we can reload, 
        // but for now the upload succeeds.
        if (typeof window !== 'undefined') {
          window.location.reload(); // Simple reload to reflect changes
        }
      }
    } catch (err) {
      console.error('Error uploading avatar:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const roleName = user?.role || 'Usuário';

  const themeOptions = [
    { id: 'claro', icon: Sun, label: 'Claro' },
    { id: 'escuro', icon: Moon, label: 'Escuro' },
    { id: 'sistema', icon: Monitor, label: 'Sistema' }
  ];

  const handleLogout = async () => {
    onOpenChange(false);
    await logout();
  };

  const handleTrocarSetor = () => {
    onOpenChange(false);
    navigate('/setor');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[400px] border-l border-border/50 bg-background/80 backdrop-blur-xl flex flex-col p-0">
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide">
          <SheetHeader className="mb-6 text-left">
            <SheetTitle className="text-xl font-bold">Minha Conta</SheetTitle>
            <SheetDescription className="hidden">Configurações e preferências do usuário</SheetDescription>
          </SheetHeader>

          {/* Profile Section */}
          <div className="flex flex-col items-center mb-10">
            <div className="relative mb-4 group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Avatar className={`w-20 h-20 border-4 border-background shadow-lg transition-transform duration-300 group-hover:scale-105 ${isUploading ? 'opacity-50' : ''}`}>
                <AvatarImage src={user?.avatar_url} alt={user?.full_name || 'Usuário'} />
                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground text-2xl font-semibold">
                  {getInitials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 shadow-md border-2 border-background transition-transform duration-300 group-hover:scale-110">
                <Camera size={14} />
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <h3 className="text-xl font-semibold text-foreground">{user?.full_name || 'Usuário'}</h3>
            <p className="text-sm text-muted-foreground mb-2">{user?.email || 'email@exemplo.com'}</p>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full uppercase tracking-wider">
              {roleName}
            </span>
          </div>

          {/* Appearance Section */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider mb-3">Aparência</h4>
            <div className="flex gap-2 p-1 bg-secondary/50 rounded-xl">
              {themeOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = tema === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setTema(opt.id)}
                    className={`flex-1 flex flex-col items-center py-2.5 rounded-lg transition-all duration-200 ${
                      isActive 
                        ? 'bg-background shadow-sm text-foreground scale-95' 
                        : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon size={18} className="mb-1" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Info Section */}
          <div className="mb-8">
            <h4 className="text-sm font-semibold text-foreground/80 uppercase tracking-wider mb-3">Informações</h4>
            <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
              <div className="flex items-center gap-3 p-4 border-b border-border/50">
                <div className="bg-primary/10 p-2 rounded-md text-primary">
                  <Briefcase size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Setor</p>
                  <p className="text-sm font-medium text-foreground">{user?.setor || 'Não definido'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4 border-b border-border/50">
                <div className="bg-primary/10 p-2 rounded-md text-primary">
                  <MapPin size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Unidade</p>
                  <p className="text-sm font-medium text-foreground">{user?.unidade || 'Não definida'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <div className="bg-primary/10 p-2 rounded-md text-primary">
                  <MonitorPlay size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Máquina</p>
                  <p className="text-sm font-medium text-foreground">{user?.maquina || 'Nenhuma'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="p-6 border-t border-border/50 bg-background">
          <button 
            onClick={handleTrocarSetor}
            className="w-full flex items-center justify-between p-3 mb-3 bg-secondary/30 hover:bg-secondary/60 text-foreground rounded-xl transition-colors duration-200"
          >
            <span className="font-medium text-sm">Trocar Setor</span>
            <ChevronRight size={18} className="text-muted-foreground" />
          </button>
          
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-3 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-xl transition-colors duration-200"
          >
            <LogOut size={18} />
            <span className="font-medium text-sm">Sair da conta</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
