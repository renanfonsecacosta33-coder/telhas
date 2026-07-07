import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import ProducaoAdmin from "./ProducaoAdmin";
import ProducaoOperador from "./ProducaoOperador";

export default function Producao() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // Admin e user (gestor) veem visão completa
  if (!user || user.role === "admin" || user.role === "user" || user.role === "super_admin") {
    return <ProducaoAdmin />;
  }

  // Operador vê somente sua máquina
  if (user.role === "operador" && user.maquina) {
    return <ProducaoOperador maquina={user.maquina} userName={user.full_name || user.email} />;
  }

  // Sem máquina configurada
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <span className="text-3xl">🔧</span>
      </div>
      <h2 className="text-xl font-bold mb-2">Máquina não configurada</h2>
      <p className="text-muted-foreground max-w-sm">
        Peça ao administrador para configurar a máquina associada ao seu usuário para ver os pedidos.
      </p>
    </div>
  );
}