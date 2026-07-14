import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, DollarSign, AlertTriangle, Camera, BarChart3, MessageCircle, Building2 } from "lucide-react";
import KpiFinanceiro from "@/components/admin/KpiFinanceiro";
import AlertasEstoqueCritico from "@/components/admin/AlertasEstoqueCritico";
import MuralQualidade from "@/components/admin/MuralQualidade";
import EficienciaMaquinas from "@/components/admin/EficienciaMaquinas";
import AuditoriaChats from "@/components/admin/AuditoriaChats";

export default function PainelAdministrativo() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("kpi");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (!u || (u.role !== "admin" && u.role !== "super_admin")) {
        navigate("/setor");
        return;
      }
      setUser(u);
      setLoading(false);
    }).catch(() => navigate("/setor"));
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  const TABS = [
    { key: "kpi", label: "KPIs Financeiros", icon: DollarSign },
    { key: "estoque", label: "Estoque Crítico", icon: AlertTriangle },
    { key: "qualidade", label: "Mural de Qualidade", icon: Camera },
    { key: "eficiencia", label: "Eficiência", icon: BarChart3 },
    { key: "chats", label: "Auditoria de Chats", icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3">
          <button onClick={() => navigate("/setor")} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Building2 className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Painel do Administrador</h1>
              <p className="text-xs text-muted-foreground leading-tight">Control Tower — Visão geral</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex gap-1 overflow-x-auto pb-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors border-b-2 ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {tab === "kpi" && <KpiFinanceiro />}
        {tab === "estoque" && <AlertasEstoqueCritico />}
        {tab === "qualidade" && <MuralQualidade />}
        {tab === "eficiencia" && <EficienciaMaquinas />}
        {tab === "chats" && <AuditoriaChats />}
      </div>
    </div>
  );
}