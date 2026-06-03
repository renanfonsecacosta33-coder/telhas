import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, LogOut, Lock } from "lucide-react";

const SENHA = "ajl1234"; // Senha única para todos os vendedores
const STORAGE_KEY = "vendedor_autenticado";

export default function VendedorEstoque() {
  const [autenticado, setAutenticado] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [senhaInput, setSenhaInput] = useState("");
  const [erro, setErro] = useState("");
  const [search, setSearch] = useState("");

  const { data: bobinas = [], isLoading } = useQuery({
    queryKey: ["bobinas-vendedor"],
    queryFn: () => base44.entities.Bobina.list("-created_date"),
    enabled: autenticado,
  });

  const handleLogin = (e) => {
    e.preventDefault();
    if (senhaInput === SENHA) {
      localStorage.setItem(STORAGE_KEY, "true");
      setAutenticado(true);
      setErro("");
    } else {
      setErro("Senha incorreta. Tente novamente.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAutenticado(false);
    setSenhaInput("");
  };

  if (!autenticado) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto">
              <span className="text-primary-foreground font-bold text-2xl">A</span>
            </div>
            <h1 className="text-2xl font-bold">AJL - Estoque</h1>
            <p className="text-sm text-muted-foreground">Consulta de bobinas disponíveis</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 bg-card border border-border rounded-xl p-6 shadow-sm">
            <div className="space-y-1">
              <label className="text-sm font-medium flex items-center gap-2">
                <Lock className="w-4 h-4 text-muted-foreground" />
                Senha de acesso
              </label>
              <Input
                type="password"
                placeholder="Digite a senha"
                value={senhaInput}
                onChange={e => { setSenhaInput(e.target.value); setErro(""); }}
                autoFocus
              />
            </div>
            {erro && <p className="text-xs text-destructive">{erro}</p>}
            <Button type="submit" className="w-full">Entrar</Button>
          </form>
        </div>
      </div>
    );
  }

  const ativas = bobinas.filter(b => !b.arquivada);
  const filtered = ativas.filter(b => {
    const q = search.toLowerCase();
    return (
      b.cor?.toLowerCase().includes(q) ||
      b.chapa?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-base">A</span>
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">AJL - Estoque de Bobinas</h1>
            <p className="text-xs text-muted-foreground">Consulta para vendedores</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2 text-muted-foreground">
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Resumo */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bobinas em estoque</span>
          <span className="text-2xl font-bold text-primary">{ativas.length}</span>
        </div>

        {/* Busca */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cor ou espessura..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma bobina encontrada.</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 px-4 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
              <span>Cor</span>
              <span>Espessura</span>
              <span>Peso (kg)</span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(b => (
                <div key={b.id} className="grid grid-cols-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
                  <span className="text-sm font-medium">{b.cor || "-"}</span>
                  <span className="text-sm">{b.chapa || "-"}</span>
                  <span className="text-sm font-semibold">{b.peso_kg ? `${b.peso_kg.toLocaleString("pt-BR")} kg` : "-"}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}