import React from "react";
import { Link } from "react-router-dom";
import { Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UsuariosCD() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6" /> Usuários — Corte e Dobra
        </h1>
        <p className="text-sm text-muted-foreground">Gestão de usuários do setor</p>
      </div>
      <div className="bg-card border border-border rounded-xl p-6 flex flex-col items-center gap-4 text-center">
        <Users className="w-10 h-10 opacity-30" />
        <div>
          <p className="text-sm font-medium">Gerenciamento centralizado de usuários</p>
          <p className="text-xs text-muted-foreground mt-1">
            Os usuários são gerenciados no painel central. Use o campo "Setor" para atribuir funcionários ao Corte e Dobra.
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/usuarios">
            Ir para Gerenciar Usuários
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}