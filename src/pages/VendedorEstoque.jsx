import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, LogOut, Lock, ChevronRight, ArrowLeft, BookmarkPlus, ShieldCheck, Filter, Calculator } from "lucide-react";
import SolicitarReservaDialog from "@/components/vendedor/SolicitarReservaDialog";
import CalculadoraVendedor from "@/components/vendedor/CalculadoraVendedor";

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
          <button
            onClick={() => onSelect("calculos")}
            className="w-full bg-card border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary hover:bg-primary/5 transition-all group"
          >
            <div className="text-left">
              <p className="font-bold text-base">🧮 Cálculos</p>
              <p className="text-sm text-muted-foreground mt-1">Calculadora de peso teórico de chapas</p>
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
  const [filtroQualidade, setFiltroQualidade] = useState(null); // null = todas

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

  // Qualidades únicas para filtros
  const qualidadesUnicas = [...new Set(disponiveis.map(b => b.qualidade).filter(Boolean))].sort();

  // Filtro + ordenação
  const filtered = disponiveis
    .filter(b => {
      if (filtroQualidade && b.qualidade !== filtroQualidade) return false;
      const q = search.toLowerCase();
      return b.cor?.toLowerCase().includes(q) || b.chapa?.toLowerCase().includes(q) || b.espessura_real?.toLowerCase().includes(q) || b.espessura_utilizada?.toLowerCase().includes(q) || String(b.largura_mm || "").includes(q);
    })
    .sort((a, b) => {
      // Ordenar por qualidade (alfabético) depois por chapa (numérico crescente)
      const qA = a.qualidade || "";
      const qB = b.qualidade || "";
      if (qA !== qB) return qA.localeCompare(qB);
      return parseFloat(a.chapa || "0") - parseFloat(b.chapa || "0");
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

      <div className="p-4 space-y-4 max-w-5xl mx-auto">
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

        {/* Filtros por qualidade */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <button
            onClick={() => setFiltroQualidade(null)}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
              !filtroQualidade
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70"
            }`}
          >
            Todas
          </button>
          {qualidadesUnicas.map(q => (
            <button
              key={q}
              onClick={() => setFiltroQualidade(filtroQualidade === q ? null : q)}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full transition-colors ${
                filtroQualidade === q
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Tabela */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma bobina disponível encontrada.</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Cor</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Qual.</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Espessura</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Q. Bobina</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap bg-amber-50/60">Esp. Util.</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Largura</th>
                  <th className="text-right px-3 py-2.5 whitespace-nowrap">Peso (kg)</th>
                  <th className="text-left px-3 py-2.5 whitespace-nowrap">Status</th>
                  <th className="text-center px-3 py-2.5 whitespace-nowrap">Cert.</th>
                  <th className="px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(b => {
                  const st = statusMap[b.id];
                  const info = statusLabel(st);
                  return (
                  <tr key={b.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-medium whitespace-nowrap">{b.cor || "-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{b.qualidade || "-"}</span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{b.chapa || "-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{b.espessura_real || "-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap bg-amber-50/40 font-semibold text-amber-900">
                      {b.espessura_utilizada || "-"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{b.largura_mm ? `${b.largura_mm} mm` : "-"}</td>
                    <td className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">{b.peso_kg ? `${b.peso_kg.toLocaleString("pt-BR")} kg` : "-"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {info ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${info.cls}`} title={`Máquina: ${st.maquina}`}>
                          {info.label}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Disponível</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {b.anexo_cert_url ? (
                        <a href={b.anexo_cert_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors"
                          title="Ver certificado digital">
                          <ShieldCheck className="w-4 h-4" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => setSolicitarBobina(b)}
                        className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                        title="Solicitar reserva"
                      >
                        <BookmarkPlus className="w-4 h-4" />
                        <span className="hidden sm:inline">Reservar</span>
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
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

// Tela de cálculos
function CalculosView({ vendedorNome, onLogout, onVoltar }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onVoltar} className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base leading-tight">🧮 Cálculos de Peso</h1>
            <p className="text-xs text-muted-foreground">Olá, <span className="font-semibold">{vendedorNome}</span></p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} className="gap-2 text-muted-foreground">
          <LogOut className="w-4 h-4" />
          Sair
        </Button>
      </div>
      <div className="p-4 max-w-6xl mx-auto">
        <CalculadoraVendedor vendedorNome={vendedorNome} />
      </div>
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
  if (setor === "calculos") return <CalculosView vendedorNome={vendedorNome} onLogout={handleLogout} onVoltar={() => setSetor(null)} />;
  return <EstoqueView setor={setor} vendedorNome={vendedorNome} onLogout={handleLogout} onVoltar={() => setSetor(null)} />;
}