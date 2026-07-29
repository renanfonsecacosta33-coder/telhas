import React, { useState, useEffect } from "react";
import { Outlet, Navigate, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import SidebarExpedicao from "./SidebarExpedicao";
import EcosystemHeaderBar from "@/components/layout/EcosystemHeaderBar";
import PageTransition from "@/components/layout/PageTransition";

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

  return (
    <div className="min-h-screen bg-background flex">
      <SidebarExpedicao
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(o => !o)}
        user={user}
      />

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-16"}`}>
        {/* Header Global Unificado do Ecossistema */}
        <EcosystemHeaderBar
          user={user}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
        />

        <main className="flex-1 p-3 sm:p-5 md:p-6 overflow-auto">
          <PageTransition>
            <Outlet context={{ user, isAdmin }} />
          </PageTransition>
        </main>
      </div>
    </div>
  );
}
