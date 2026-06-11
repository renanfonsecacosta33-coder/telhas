import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, LogOut, Lock, ChevronRight, ArrowLeft, BookmarkPlus } from "lucide-react";
import SolicitarReservaDialog from "@/components/vendedor/SolicitarReservaDialog";

const SENHA = "ajl1234";
const STORAGE_KEY = "vendedor_autenticado";
const NOME_KEY = "vendedor_nome";

// Tela de seleção de setor
function SetorSelector({ onSelect }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto">
            <span className="text-primary-foreground font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold">AJL - Estoque</h1>
          <p className="text-sm text-muted-foreground">Selecione o setor para consultar</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => onSelect("telhas")}
            className="w-full bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="text-left">
              <p className="font-bold text-base">🏗️ Telhas</p>
              <p className="text-sm text-muted-foreground mt-1">Bobinas do barracão de telhas</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
          <button
            onClick={() => onSelect("corte_dobra")}
            className="w-full bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="text-left">
              <p className="font-bold text-base">✂️ Corte e Dobra</p>
              <p className="text-sm text-muted-foreground mt-1">Bobinas do setor de corte e dobra</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Tela de login + nome do vendedor
function LoginScreen({ onLogin }) {
  const [senhaInput, setSenhaInput] = useState("");
  const [nomeInput, setNomeInput] = useState(() => localStorage.getItem(NOME_KEY) || "");
  const [erro, setErro] = useState("");

  const handleLogin = (e) => {
    e.preventDefault();
    if (!nomeInput.trim()) {
      setErro("Informe seu nome.");
      return;
    }
    if (senhaInput === SENHA) {
      localStorage.setItem(NOME_KEY, nomeInput.trim());
      onLogin(nomeInput.trim());
    } else {
      setErro("Senha incorreta. Tente novamente.");
    }
  };

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
            <Label>Seu nome *</Label>
            <Input
              placeholder="Nome do vendedor"
              value={nomeInput}
              onChange={e => { setNomeInput(e.target.value); setErro(""); }}
              autoFocus
            />
          </div>
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
            />
          </div>
          {erro && <p className="text-xs text-destructive">{erro}</p>}
          <Button type="submit" className="w-full">Entrar</Button>
        </form>
      </div>
    </div>
  );
}

// Tela do estoque
function EstoqueView({ setor, vendedorNome, onLogout, onVoltar }) {
  const [search, setSearch] = useState("");
  const [solicitarBobina, setSolicitarBobina] = useState(null);

  const setorLabel = setor === "telhas" ? "Telhas" : "Corte e Dobra";
  const setorEmoji = setor === "telhas" ? "🏗️" : "✂️";

  const { data: bobinas = [], isLoading, refetch } = useQuery({
    queryKey: ["bobinas-vendedor", setor],
    queryFn: () => base44.entities.Bobina.filter({ setor, arquivada: false }),
  });

  // Busca ordens ativas para mostrar status da bobina
  const { data: ordensAtivas = [] } = useQuery({
    queryKey: ["ordens-ativas-vendedor", setor],
    queryFn: async () => {
      if (setor === "telhas") {
        const pedidos = await base44.entities.Pedido.list();
        return pedidos.filter(p => !["finalizado", "cancelado"].includes(p.status));
      } else {
        const ordens = await base44.entities.OrdemDesbobinadeira.list();
        return ordens.filter(o => !["finalizado", "cancelado"].includes(o.status));
      }
    },
  });

  // Mapa: bobina_id -> { maquina, status }
  const statusMap = {};
  ordensAtivas.forEach(o => {
    if (setor === "telhas") {
      if (o.bobina_superior_id) statusMap[o.bobina_superior_id] = { maquina: o.maquina || "Produção", status: o.status };
      if (o.bobina_inferior_id) statusMap[o.bobina_inferior_id] = { maquina: o.maquina || "Produção", status: o.status };
    } else {
      if (o.bobina_id) statusMap[o.bobina_id] = { maquina: "Desbobinadeira", status: o.status };
    }
  });

  const statusLabel = (s) => {
    if (!s) return null;
    const map = {
      em_producao:    { label: "Em produção",  cls: "bg-emerald-100 text-emerald-700" },
      pendente:       { label: "Aguardando",   cls: "bg-blue-100 text-blue-700" },
      pausado:        { label: "Parado",       cls: "bg-amber-100 text-amber-700" },
      aguardando_colagem: { label: "Aguardando colagem", cls: "bg-purple-100 text-purple-700" },
    };
    return map[s.status] || { label: s.status, cls: "bg-slate-100 text-slate-600" };
  };

  // Oculta bobinas reservadas
  const disponiveis = bobinas.filter(b => !b.reservada);

  const filtered = disponiveis.filter(b => {
    const q = search.toLowerCase();
    return b.cor?.toLowerCase().includes(q) || b.chapa?.toLowerCase().includes(q);
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onVoltar} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base leading-tight">{setorEmoji} Bobinas — {setorLabel}</h1>
            <p className="text-xs text-muted-foreground">Olá, <span className="font-semibold">{vendedorNome}</span></p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2 text-muted-foreground">
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        {/* Resumo */}
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bobinas disponíveis</span>
          <span className="text-2xl font-bold text-primary">{disponiveis.length}</span>
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
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma bobina disponível encontrada.</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="grid grid-cols-6 px-4 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
              <span className="col-span-1">Cor</span>
              <span>Qualidade</span>
              <span>Espessura</span>
              <span>Peso (kg)</span>
              <span>Status</span>
              <span></span>
            </div>
            <div className="divide-y divide-border">
              {filtered.map(b => {
                const st = statusMap[b.id];
                const info = statusLabel(st);
                return (
                <div key={b.id} className="grid grid-cols-6 px-4 py-3 items-center hover:bg-muted/20 transition-colors">
                  <span className="text-sm font-medium col-span-1">{b.cor || "-"}</span>
                  <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded w-fit">{b.qualidade || "-"}</span>
                  <span className="text-sm">{setor === "corte_dobra" ? (b.espessura_utilizada || b.chapa || "-") : (b.chapa || "-")}</span>
                  <span className="text-sm font-semibold">{b.peso_kg ? `${b.peso_kg.toLocaleString("pt-BR")} kg` : "-"}</span>
                  <span>
                    {info ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${info.cls}`} title={`Máquina: ${st.maquina}`}>
                        {info.label}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Disponível</span>
                    )}
                  </span>
                  <div className="flex justify-end">
                    <button
                      onClick={() => setSolicitarBobina(b)}
                      className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                      title="Solicitar reserva"
                    >
                      <BookmarkPlus className="w-4 h-4" />
                      <span className="hidden sm:inline">Reservar</span>
                    </button>
                  </div>
                </div>
              )})}
            </div>
          </div>
        )}

        {/* Aviso */}
        <p className="text-xs text-muted-foreground text-center">
          Bobinas já reservadas não aparecem nesta lista. Toque em "Reservar" para solicitar uma reserva ao admin.
        </p>
      </div>

      <SolicitarReservaDialog
        open={!!solicitarBobina}
        onClose={() => { setSolicitarBobina(null); refetch(); }}
        bobina={solicitarBobina}
        vendedorNome={vendedorNome}
        setor={setor}
      />
    </div>
  );
}

export default function VendedorEstoque() {
  const [autenticado, setAutenticado] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [vendedorNome, setVendedorNome] = useState(() => localStorage.getItem(NOME_KEY) || "");
  const [setor, setSetor] = useState(null);

  const handleLogin = (nome) => {
    localStorage.setItem(STORAGE_KEY, "true");
    localStorage.setItem(NOME_KEY, nome);
    setVendedorNome(nome);
    setAutenticado(true);
  };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAutenticado(false);
    setSetor(null);
  };

  if (!autenticado) return <LoginScreen onLogin={handleLogin} />;
  if (!setor) return <SetorSelector onSelect={setSetor} />;
  return <EstoqueView setor={setor} vendedorNome={vendedorNome} onLogout={handleLogout} onVoltar={() => setSetor(null)} />;
}