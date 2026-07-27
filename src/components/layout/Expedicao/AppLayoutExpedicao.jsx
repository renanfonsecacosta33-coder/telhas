import React, { useState, useEffect } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import SidebarExpedicao from "./SidebarExpedicao";
import { Menu } from "lucide-react";

export default function AppLayoutExpedicao() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me()
      .then(u => { setUser(u); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-teal-500 rounded-full animate-spin" />
    </div>
  );

  const isAdmin = user?.role === "admin" || user?.role === "super_admin" || user?.email === "renanfonsecacosta33@gmail.com";

  // Sem permissão para expedição → seletor de setor
  if (user && !isAdmin && user?.setor !== "expedicao" && user?.setor !== "ambos") {
    return <Navigate to="/setor" replace />;
  }

  // Operador da frisada → direto para frisada
  const isFrisadaOp = user && !isAdmin && user.setor === "expedicao" && user.maquina?.includes?.("FRISADA");

  return (
    <div className="min-h-screen bg-background flex">
      <SidebarExpedicao
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        user={user}
      />

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-16"}`}>
        {/* Top bar mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b bg-background sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(o => !o)}
            className="p-1.5 rounded-lg hover:bg-muted"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-teal-600">EXPEDIÇÃO</span>
            <span className="text-xs text-muted-foreground">AJL Ferro & Aço</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          <Outlet context={{ user, isAdmin }} />
        </main>
      </div>
    </div>
  );
}
