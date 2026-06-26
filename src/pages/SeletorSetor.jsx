import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ChevronRight, BookmarkPlus } from "lucide-react";

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
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold">AJL ERP</h1>
          <p className="text-sm text-muted-foreground">Selecione o setor para acessar</p>
        </div>

        <div className="space-y-3">
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
                Reserva de Bobinas
              </p>
              <p className="text-sm text-muted-foreground mt-1">Consultar estoque e reservar bobinas</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-blue-600 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}