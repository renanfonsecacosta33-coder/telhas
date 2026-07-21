import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Factory, 
  Scissors, 
  Truck, 
  BookmarkPlus, 
  BarChart3, 
  LayoutDashboard, 
  Settings, 
  ShieldAlert, 
  Users,
  FileText,
  Package,
  Command,
  ArrowRight
} from "lucide-react";

export default function GlobalCommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isRole = (roles) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  const isAppPermitted = (appKey) => {
    if (!user) return true;
    if (user.role === "admin" || user.role === "super_admin") return true;
    if (user.permissions && typeof user.permissions[appKey] === "boolean") {
      return user.permissions[appKey];
    }
    return true;
  };

  const allCommands = [
    { id: "mod_telhas", title: "Barracão Telhas", category: "Módulos", icon: Factory, path: "/", roles: ["super_admin", "admin", "encarregado", "operador"], appKey: "app_fabrica_telhas" },
    { id: "mod_cd", title: "Barracão C&D", category: "Módulos", icon: Scissors, path: "/corte-dobra", roles: ["super_admin", "admin", "encarregado", "operador"], appKey: "app_corte_dobra" },
    { id: "mod_logistica", title: "Logística", category: "Módulos", icon: Truck, path: "/logistica", roles: ["super_admin", "admin", "encarregado"], appKey: "app_logistica" },
    { id: "mod_estoque", title: "Estoque Rápido", category: "Módulos", icon: BookmarkPlus, path: "/vendedor", roles: ["super_admin", "admin", "encarregado", "vendedor"], appKey: "app_consulta_estoque" },
    { id: "mod_vendas", title: "Painel de Vendas", category: "Módulos", icon: BarChart3, path: "/vendedor-dashboard", roles: ["super_admin", "admin", "vendedor"], appKey: "app_painel_vendedor" },
    { id: "mod_usuarios", title: "Usuários & Permissões", category: "Administração", icon: Users, path: "/usuarios", roles: ["super_admin", "admin"], appKey: "app_gestao_usuarios" },
    { id: "mod_admin", title: "Painel Administrativo", category: "Administração", icon: ShieldAlert, path: "/painel-admin", roles: ["super_admin", "admin"], appKey: "app_control_tower" },
    { id: "op_1042", title: "OP #1042 — Telha Onde TP-40 Galvalume (Cliente: Perfilaço)", category: "Ordens de Produção", icon: FileText, path: "/", roles: ["super_admin", "admin", "encarregado", "operador"] },
    { id: "op_1045", title: "OP #1045 — Perfil U 100x40 2.00mm (Cliente: Metalúrgica Silva)", category: "Ordens de Produção", icon: FileText, path: "/corte-dobra", roles: ["super_admin", "admin", "encarregado", "operador"] },
    { id: "bob_7023", title: "Bobina BOB-7023 — Galvalume 0.43mm x 1200mm (CSN)", category: "Estoque de Bobinas", icon: Package, path: "/vendedor", roles: ["super_admin", "admin", "encarregado", "vendedor"] },
    { id: "bob_8102", title: "Bobina BOB-8102 — Zicada 0.50mm x 1200mm (Arcelor)", category: "Estoque de Bobinas", icon: Package, path: "/vendedor", roles: ["super_admin", "admin", "encarregado", "vendedor"] },
  ];

  const filteredCommands = allCommands.filter(cmd => {
    if (cmd.roles && !isRole(cmd.roles)) return false;
    if (cmd.appKey && !isAppPermitted(cmd.appKey)) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  const handleSelect = (cmd) => {
    onOpenChange(false);
    setQuery("");
    if (cmd.path) {
      navigate(cmd.path);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] sm:max-w-2xl p-0 gap-0 overflow-hidden border-border bg-slate-900 text-white shadow-2xl rounded-2xl">
        <div className="flex items-center px-3 sm:px-4 border-b border-slate-800 bg-slate-900/90 backdrop-blur">
          <Search className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400 shrink-0 mr-2 sm:mr-3" />
          <Input 
            autoFocus
            placeholder="Buscar OPs (#1042), Bobinas (BOB-7023), Menus..." 
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="h-12 sm:h-14 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent text-sm sm:text-base text-white placeholder:text-slate-500"
          />
          <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700 font-mono">
            <Command className="w-3 h-3" /> K
          </div>
        </div>

        <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto p-2 space-y-1">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs sm:text-sm text-slate-500">
              Nenhum resultado encontrado para "{query}"
            </div>
          ) : (
            filteredCommands.map(cmd => {
              const CmdIcon = cmd.icon;
              return (
                <div
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  className="flex items-center justify-between p-2.5 sm:p-3 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300 group-hover:text-primary group-hover:bg-primary/20 transition-colors border border-slate-700 shrink-0">
                      <CmdIcon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-white truncate">
                        {cmd.title}
                      </p>
                      <span className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                        {cmd.category}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                    <span className="text-xs text-primary font-medium hidden sm:inline">Acessar</span>
                    <ArrowRight className="w-4 h-4 text-primary" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 bg-slate-950 border-t border-slate-800/80 text-[11px] sm:text-xs text-slate-500 flex items-center justify-between">
          <span>Resultados filtrados por perfil</span>
          <Badge variant="outline" className="text-[10px] border-slate-800 text-slate-400">
            AJL ERP
          </Badge>
        </div>
      </DialogContent>
    </Dialog>
  );
}
