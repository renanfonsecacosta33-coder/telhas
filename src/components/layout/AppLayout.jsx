import React, { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { base44 } from "@/api/base44Client";

export default function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  // Operador do CD acessando layout de Telhas → redireciona
  if (user && user.setor === "corte_dobra") {
    return <Navigate to="/corte-dobra" replace />;
  }

  // Usuário sem setor/papel definido → redireciona ao seletor de setor
  if (user && user.role !== "admin" && !user.setor && !user.maquina) {
    return <Navigate to="/setor" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="lg:ml-64 min-h-screen">
        <div className="p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}