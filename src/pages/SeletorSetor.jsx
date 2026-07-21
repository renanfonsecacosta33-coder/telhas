import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ChevronRight, BookmarkPlus, Truck, BarChart3 } from "lucide-react";
import UserAvatarButton from "@/components/UserAvatarButton";

export default function SeletorSetor() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [navegando, setNavegando] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const isGerencia = user?.gerencia === true;

  const selecionarSetor = async (setor) => {
    if (navegando) return;
    setNavegando(true);
    try {
      await base44.auth.updateMe({ setor });
    } catch (e) {
      // Segue mesmo se falhar — o importante é permitir o acesso
    }
    navigate(setor === "telhas" ? "/" : "/corte-dobra");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative">
      {/* Avatar do usuário — acesso rápido a configurações */}
      <div className="absolute top-4 right-4 z-10">
        <UserAvatarButton size="default" />
      </div>
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold">AJL ERP</h1>
          <p className="text-sm text-muted-foreground">Selecione o setor para acessar</p>
        </div>

        <div className="space-y-3">
          {user?.role === "admin" && (
            <button
              onClick={() => navigate("/painel-admin")}
              className="w-full bg-gradient-to-r from-slate-800 to-slate-700 text-white rounded-xl p-5 flex items-center justify-between hover:from-slate-700 hover:to-slate-600 transition-all group text-left shadow-lg"
            >
              <div>
                <p className="font-bold text-base">🏛️ Painel do Administrador</p>
                <p className="text-sm text-slate-300 mt-1">Control Tower — Visão geral da operação</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-white transition-colors" />
            </button>
          )}
          <button
            onClick={() => selecionarSetor("telhas")}
            disabled={navegando}
            className="w-full bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary hover:bg-primary/5 transition-all group text-left disabled:opacity-60"
          >
            <div>
              <p className="font-bold text-base">🏗️ Telhas</p>
              <p className="text-sm text-muted-foreground mt-1">Barracão de produção de telhas</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          <button
            onClick={() => selecionarSetor("corte_dobra")}
            disabled={navegando}
            className="w-full bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary hover:bg-primary/5 transition-all group text-left disabled:opacity-60"
          >
            <div>
              <p className="font-bold text-base">✂️ Corte e Dobra</p>
              <p className="text-sm text-muted-foreground mt-1">Setor de corte e dobra de chapas</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          <button
            onClick={() => { setNavegando(true); navigate("/logistica"); }}
            disabled={navegando}
            className="w-full bg-card border border-emerald-300 rounded-xl p-5 flex items-center justify-between hover:border-emerald-500 hover:bg-emerald-50 transition-all group text-left disabled:opacity-60"
          >
            <div>
              <p className="font-bold text-base flex items-center gap-2">
                <Truck className="w-5 h-5 text-emerald-600" />
                Logística
              </p>
              <p className="text-sm text-muted-foreground mt-1">Expedição, cargas e carregamento</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-emerald-600 transition-colors" />
          </button>

          {isGerencia && (
            <a
              href="https://gerencial-fabricas.base44.app"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-card border border-amber-300 rounded-xl p-5 flex items-center justify-between hover:border-amber-500 hover:bg-amber-50 transition-all group text-left"
            >
              <div>
                <p className="font-bold text-base">🏭 Gerência Fábricas</p>
                <p className="text-sm text-muted-foreground mt-1">Painel gerencial das fábricas</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-amber-600 transition-colors" />
            </a>
          )}

          <a
            href="https://dashboard-ajl.base44.app"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary hover:bg-primary/5 transition-all group text-left"
          >
            <div>
              <p className="font-bold text-base">📊 Dashboard AJL</p>
              <p className="text-sm text-muted-foreground mt-1">Acesso ao painel de indicadores</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </a>

          <button
            onClick={() => navigate("/vendedor")}
            className="w-full bg-card border border-blue-300 rounded-xl p-5 flex items-center justify-between hover:border-blue-500 hover:bg-blue-50 transition-all group text-left"
          >
            <div>
              <p className="font-bold text-base flex items-center gap-2">
                <BookmarkPlus className="w-5 h-5 text-blue-600" />
                Reserva & Consulta de Estoque
              </p>
              <p className="text-sm text-muted-foreground mt-1">Consultar estoque e reservar bobinas</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
          </button>

          <button
            onClick={() => navigate("/vendedor-dashboard")}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-5 flex items-center justify-between hover:opacity-95 transition-all group text-left shadow-md"
          >
            <div>
              <p className="font-bold text-base flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-200" />
                📊 Dashboard do Vendedor
              </p>
              <p className="text-sm text-blue-100 mt-1">Status de OPs, vendas e reservas individuais</p>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
      </div>
    </div>
  );
}