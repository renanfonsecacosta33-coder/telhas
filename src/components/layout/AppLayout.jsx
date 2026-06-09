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

  // Usuário sem setor/papel definido → sala de espera
  if (user && user.role !== "admin" && !user.setor && !user.maquina) {
    return <SalaDeEspera userName={user.full_name || user.email} />;
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

function SalaDeEspera({ userName }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background p-6">
      <div className="max-w-sm w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mx-auto">
          <span className="text-4xl">⏳</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">Aguardando configuração</h1>
          <p className="text-muted-foreground mt-2">
            Olá, <strong>{userName}</strong>! Sua conta foi criada com sucesso.
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Aguarde o administrador configurar seu setor e máquina para liberar o acesso.
          </p>
        </div>
        <div className="bg-muted/50 border border-border rounded-xl p-4 text-sm text-muted-foreground">
          Entre em contato com o administrador do sistema para liberar seu acesso.
        </div>
        <button
          onClick={() => base44.auth.logout()}
          className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Sair da conta
        </button>
      </div>
    </div>
  );
}