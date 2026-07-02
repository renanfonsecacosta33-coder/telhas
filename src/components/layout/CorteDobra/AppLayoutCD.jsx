import React, { useState, useEffect } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import SidebarCD from "./SidebarCD";
import FilialSwitcher from "@/components/FilialSwitcher";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function AppLayoutCD() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => { setUser(u); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin" />
    </div>
  );

  // Operador de Telhas acessando layout do CD → redireciona
  if (user && user.setor === "telhas") {
    return <Navigate to="/" replace />;
  }

  // Usuário sem setor/papel definido → redireciona ao seletor de setor
  if (user && user.role !== "admin" && !user.setor && !user.maquina) {
    return <Navigate to="/setor" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <SidebarCD isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="lg:ml-64 min-h-screen">
        <div className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-end gap-2 lg:hidden">
          <FilialSwitcher />
        </div>
        <div className="hidden lg:flex sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border px-8 py-2 items-center justify-end gap-2">
          <FilialSwitcher />
        </div>
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}