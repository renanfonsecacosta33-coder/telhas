import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, LogOut, Lock, ChevronRight, ArrowLeft, BookmarkPlus, ShieldCheck, Filter, Calculator, Home, BarChart3, RefreshCw } from "lucide-react";
import SolicitarReservaDialog from "@/components/vendedor/SolicitarReservaDialog";
import CalculadoraVendedor from "@/components/vendedor/CalculadoraVendedor";
import VendedorChapas from "@/components/vendedor/VendedorChapas";
import VendedorSlitter from "@/components/vendedor/VendedorSlitter";
import FiliaisMultiSelect, { FILIAIS_LIST, getFilialColor } from "@/components/vendedor/FiliaisMultiSelect";
import ImageLink from "@/components/ui/ImageLink";
import { useFilial } from "@/contexts/FilialContext";
import { usePreBaixaBobinas } from "@/hooks/usePreBaixaBobinas";

const SENHA = "ajl1234";
const STORAGE_KEY = "vendedor_autenticado";
const NOME_KEY = "vendedor_nome";

// Tela de seleção de setor
function SetorSelector({ onSelect }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      {/* Botão de retorno ao painel principal ERP (para ADM / Gerência) */}
      <div className="absolute top-4 left-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate("/setor")}
          className="gap-2 text-xs font-semibold bg-white shadow-sm border-slate-300 hover:bg-slate-100"
        >
          <Home className="w-4 h-4 text-primary" />
          Painel Principal (ADM)
        </Button>
      </div>

      <div className="w-full max-w-sm space-y-6 my-auto">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto shadow-md">
            <span className="text-primary-foreground font-bold text-2xl">A</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">AJL - Estoque & Vendas</h1>
          <p className="text-sm text-muted-foreground">Selecione o setor para consultar ou seu dashboard</p>
        </div>
        <div className="space-y-3">
          <button
            onClick={() => onSelect("telhas")}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary hover:bg-primary/5 transition-all group shadow-sm"
          >
            <div className="text-left">
              <p className="font-bold text-base text-slate-900">🏗️ Telhas</p>
              <p className="text-xs text-muted-foreground mt-0.5">Bobinas do barracão de telhas</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
          <button
            onClick={() => onSelect("corte_dobra")}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary hover:bg-primary/5 transition-all group shadow-sm"
          >
            <div className="text-left">
              <p className="font-bold text-base text-slate-900">✂️ Corte e Dobra</p>
              <p className="text-xs text-muted-foreground mt-0.5">Bobinas, Chapas e Slitter de corte e dobra</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>
          <button
            onClick={() => onSelect("calculos")}
            className="w-full bg-card border border-border rounded-xl p-4 flex items-center justify-between hover:border-primary hover:bg-primary/5 transition-all group shadow-sm"
          >
            <div className="text-left">
              <p className="font-bold text-base text-slate-900">🧮 Cálculos</p>
              <p className="text-xs text-muted-foreground mt-0.5">Calculadora de peso teórico de chapas</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          {/* Card Dashboard do Vendedor */}
          <button
            onClick={() => navigate("/vendedor-dashboard")}
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white border border-blue-700 rounded-xl p-4 flex items-center justify-between hover:opacity-95 transition-all group shadow-md"
          >
            <div className="text-left">
              <p className="font-bold text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-200" /> Meu Dashboard Vendedor
              </p>
              <p className="text-xs text-blue-100 mt-0.5">Acompanhamento de OPs, Vendas e Reservas</p>
            </div>
            <ChevronRight className="w-5 h-5 text-blue-200 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="pt-2 text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/setor")}
            className="text-xs text-muted-foreground gap-1.5"
          >
            <Home className="w-3.5 h-3.5" /> Voltar ao Painel Geral (ADM)
          </Button>
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
  const navigate = useNavigate();
  const { filialAtiva } = useFilial();
  const [selectedFiliais, setSelectedFiliais] = useState(FILIAIS_LIST);
  const [search, setSearch] = useState("");
  const [solicitarBobina, setSolicitarBobina] = useState(null);
  const [filtroQualidade, setFiltroQualidade] = useState(null); // null = todas
  const [abaCD, setAbaCD] = useState("bobinas"); // bobinas | chapas | slitter

  const setorLabel = setor === "telhas" ? "Telhas" : "Corte e Dobra";
  const setorEmoji = setor === "telhas" ? "🏗️" : "✂️";
  const isCorteDobra = setor === "corte_dobra";

  const { data: todasBobinas = [], isLoading, refetch } = useQuery({
    queryKey: ["bobinas-vendedor-todas"],
    queryFn: () => base44.entities.Bobina.filter({ arquivada: false }),
  });

  // Filtra por setor se especificado (se bobina não tem setor, exibe no setor atual por compatibilidade)
  const bobinas = todasBobinas.filter(b => !setor || !b.setor || b.setor === setor);

  // Filtra bobinas pelas filiais selecionadas (se nenhuma selecionada, usa todas)
  const activeFiliais = selectedFiliais && selectedFiliais.length > 0 ? selectedFiliais : FILIAIS_LIST;
  const bobinasFiltradas = bobinas.filter(b => activeFiliais.includes(b.unidade || "Matriz AJL"));

  // Pré-baixa e status das bobinas via hook compartilhado
  const { preBaixaMap, statusMap } = usePreBaixaBobinas(setor);

  const statusLabel = (st, bobina) => {
    if (st) {
      const maq = st.maquina || "Máquina";
      if (st.status === "em_producao") {
        const label = maq === "Desbobinadeira" ? "Na Desbobinadeira" : `Na Máquina: ${maq}`;
        return { label, cls: "bg-emerald-100 text-emerald-800 border-emerald-300 border font-bold" };
      } else {
        const label = maq === "Desbobinadeira" ? "Agendada p/ Desbobinadeira" : `Agendada para: ${maq}`;
        return { label, cls: "bg-blue-100 text-blue-800 border-blue-300 border font-bold" };
      }
    }
    const pesoAtual = bobina.peso_kg || 0;
    const pesoInicial = bobina.peso_inicial || 0;
    if (pesoInicial > 0 && pesoAtual >= pesoInicial - 1) {
      return { label: "Fechada", cls: "bg-slate-100 text-slate-600 border border-slate-200 font-bold" };
    }
    return { label: "Aberta", cls: "bg-orange-100 text-orange-800 border border-orange-200 font-bold" };
  };

  // Pré-baixa (pedidos ativos) + reserva manual (parcial ou inteira)
  const getPreBaixaKg = (b) => preBaixaMap[b.id] || 0;
  const getPesoReservadoManual = (b) => {
    const peso = b.peso_kg || 0;
    if (!b.reservada) return 0;
    return b.reserva_tipo === "parcial" ? (b.reserva_kg || 0) : peso;
  };
  const getPesoReservadoBobina = (b) => getPesoReservadoManual(b) + getPreBaixaKg(b);
  const getPesoDisponivel = (b) => (b.peso_kg || 0) - getPesoReservadoBobina(b);
  const disponiveis = bobinasFiltradas.filter(b => getPesoDisponivel(b) > 0);

  // Totais de KG
  const totalKg = bobinasFiltradas.reduce((s, b) => s + (b.peso_kg || 0), 0);
  const totalPreBaixaKg = bobinasFiltradas.reduce((s, b) => s + getPreBaixaKg(b), 0);
  const totalReservadoManualKg = bobinasFiltradas.reduce((s, b) => s + getPesoReservadoManual(b), 0);
  const totalDisponivelKg = totalKg - totalReservadoManualKg - totalPreBaixaKg;
  const fmtKg = (v) => Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  // Qualidades únicas para filtros (das bobinas filtradas)
  const qualidadesUnicas = [...new Set(bobinasFiltradas.map(b => b.qualidade).filter(Boolean))].sort();

  // Filtro + ordenação (inclui reservadas)
  const filtered = bobinasFiltradas
    .filter(b => {
      if (filtroQualidade && b.qualidade !== filtroQualidade) return false;
      const q = search.toLowerCase();
      return b.codigo?.toLowerCase().includes(q) || b.cor?.toLowerCase().includes(q) || b.chapa?.toLowerCase().includes(q) || b.espessura_real?.toLowerCase().includes(q) || b.espessura_utilizada?.toLowerCase().includes(q) || String(b.largura_mm || "").includes(q);
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
      <div className="bg-card border-b border-border px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onVoltar} className="p-1 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted" title="Trocar Setor">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-base leading-tight flex items-center gap-2">
              {setorEmoji} Bobinas — {setorLabel}
            </h1>
            <p className="text-xs text-muted-foreground">Olá, <span className="font-semibold">{vendedorNome}</span></p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={onVoltar} className="h-8 text-xs gap-1.5 border-slate-300">
            <RefreshCw className="w-3.5 h-3.5" /> Trocar Setor
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/vendedor-dashboard")} className="h-8 text-xs gap-1.5 text-blue-700 border-blue-300 bg-blue-50 hover:bg-blue-100 font-semibold">
            <BarChart3 className="w-3.5 h-3.5" /> Meu Dashboard
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/setor")} className="h-8 text-xs gap-1.5 border-slate-300">
            <Home className="w-3.5 h-3.5" /> Painel ADM
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout} className="h-8 text-xs gap-1 text-muted-foreground">
            <LogOut className="w-3.5 h-3.5" /> Sair
          </Button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-7xl mx-auto">
        {/* Seletor de filiais (multi-seleção) */}
        <FiliaisMultiSelect selected={selectedFiliais} onChange={setSelectedFiliais} />

        {/* Abas Corte e Dobra: Bobinas / Chapas / Slitter */}
        {isCorteDobra && (
          <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
            <button
              onClick={() => setAbaCD("bobinas")}
              className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                abaCD === "bobinas" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              🌀 Bobinas
            </button>
            <button
              onClick={() => setAbaCD("chapas")}
              className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                abaCD === "chapas" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              📋 Chapas
            </button>
            <button
              onClick={() => setAbaCD("slitter")}
              className={`flex-1 text-xs font-semibold px-3 py-2 rounded-lg transition-colors ${
                abaCD === "slitter" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              ✂️ Slitter
            </button>
          </div>
        )}

        {/* Resumo */}
        <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-baseline gap-2">
            <span className="text-sm text-muted-foreground">Bobinas em estoque</span>
            <span className="text-2xl font-bold text-primary">{bobinas.length}</span>
            <span className="text-xs text-muted-foreground">({disponiveis.length} disponíveis)</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">KG Disponível</span>
              <span className="text-sm font-bold text-emerald-700">{fmtKg(totalDisponivelKg)} kg</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">KG Pré-baixa</span>
              <span className="text-sm font-bold text-blue-700">{fmtKg(totalPreBaixaKg)} kg</span>
            </div>
            <div className="w-px h-6 bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">KG Reservado</span>
              <span className="text-sm font-bold text-amber-700">{fmtKg(totalReservadoManualKg)} kg</span>
            </div>
          </div>
        </div>

        {/* Busca */}
        {!isCorteDobra || abaCD === "bobinas" ? (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cor ou espessura..."
            className="pl-9"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        ) : null}

        {/* Filtros por qualidade */}
        {!isCorteDobra || abaCD === "bobinas" ? (
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
        ) : null}

        {/* Tabela de Bobinas */}
        {(!isCorteDobra || abaCD === "bobinas") && (
        <>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Nenhuma bobina disponível encontrada.</div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className={`w-full text-xs ${isCorteDobra ? "min-w-[1300px]" : "min-w-[1000px]"}`}>
              <thead>
                <tr className="bg-muted/50 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                  <th className="text-left px-2 py-2 whitespace-nowrap">Cód.</th>
                  <th className="text-left px-2 py-2 whitespace-nowrap">Cor</th>
                  <th className="text-center px-2 py-2 whitespace-nowrap">Foto</th>
                  <th className="text-left px-2 py-2 whitespace-nowrap">Qual.</th>
                  <th className="text-left px-2 py-2 whitespace-nowrap">Espessura</th>
                  {isCorteDobra && <th className="text-left px-2 py-2 whitespace-nowrap">Q. Bobina</th>}
                  {isCorteDobra && <th className="text-left px-2 py-2 whitespace-nowrap bg-amber-50/60">Esp. Util.</th>}
                  <th className="text-left px-2 py-2 whitespace-nowrap">Largura</th>
                  <th className="text-right px-2 py-2 whitespace-nowrap">Peso (kg)</th>
                  <th className="text-right px-2 py-2 whitespace-nowrap">Peso Inicial</th>
                  <th className="text-right px-2 py-2 whitespace-nowrap bg-amber-50/60">Reservado</th>
                  <th className="text-right px-2 py-2 whitespace-nowrap bg-blue-50/60">Pré-baixa</th>
                  <th className="text-right px-2 py-2 whitespace-nowrap bg-emerald-50/60">Disponível</th>
                  <th className="text-left px-2 py-2 whitespace-nowrap">Status</th>
                  <th className="text-center px-2 py-2 whitespace-nowrap">Cert.</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(b => {
                  const st = statusMap[b.id];
                  const info = statusLabel(st, b);
                  const filialColor = getFilialColor(b.unidade || "Matriz AJL");
                  const showFilialBadge = selectedFiliais.length > 1;
                  return (
                  <tr key={b.id} className={`transition-colors ${filialColor.rowBorder} ${
                    b.reservada
                      ? "bg-amber-50/60 hover:bg-amber-100/70"
                      : `${filialColor.rowBg} ${filialColor.rowHover}`
                  }`}>
                    <td className="px-2 py-2 font-medium whitespace-nowrap text-primary">
                      {b.codigo || "-"}
                    </td>
                    <td className="px-2 py-2 font-medium whitespace-nowrap">
                      {b.cor || "-"}
                      {showFilialBadge && (
                        <span className={`ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded ${filialColor.badge}`}>
                          {filialColor.short}
                        </span>
                      )}
                      {b.reservada && (
                        <span className="ml-1.5 text-[10px] font-semibold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded whitespace-nowrap">Reservada</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center whitespace-nowrap">
                      {b.foto_cor_url ? (
                        <ImageLink url={b.foto_cor_url} name={b.foto_cor_nome || "Foto Cor"}
                          className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors"
                          title="Ver foto da cor">
                          <img src={b.foto_cor_url} alt="Cor" className="w-8 h-8 rounded object-cover border border-border mx-auto" />
                        </ImageLink>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <span className="text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded">{b.qualidade || "-"}</span>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{b.chapa || "-"}</td>
                    {isCorteDobra && <td className="px-2 py-2 whitespace-nowrap">{b.espessura_real || "-"}</td>}
                    {isCorteDobra && (
                      <td className={`px-2 py-2 whitespace-nowrap font-semibold ${b.reservada ? "bg-amber-100/50 text-amber-900" : "bg-amber-50/40 text-amber-900"}`}>
                        {b.espessura_utilizada || "-"}
                      </td>
                    )}
                    <td className="px-2 py-2 whitespace-nowrap">{b.largura_mm ? `${b.largura_mm} mm` : "-"}</td>
                    <td className="px-2 py-2 text-right font-semibold whitespace-nowrap">{b.peso_kg ? `${b.peso_kg.toLocaleString("pt-BR")} kg` : "-"}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap text-muted-foreground">{b.peso_inicial ? `${b.peso_inicial.toLocaleString("pt-BR")} kg` : "-"}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap bg-amber-50/40 font-semibold text-amber-800">{getPesoReservadoManual(b) > 0 ? `${getPesoReservadoManual(b).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : "-"}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap bg-blue-50/40 font-semibold text-blue-700">{getPreBaixaKg(b) > 0 ? `${getPreBaixaKg(b).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : "-"}</td>
                    <td className="px-2 py-2 text-right whitespace-nowrap bg-emerald-50/40 font-bold text-emerald-700">{getPesoDisponivel(b) > 0 ? `${getPesoDisponivel(b).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : "-"}</td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      {b.reservada ? (
                        <span className="text-xs font-semibold bg-amber-200 text-amber-800 px-2 py-0.5 rounded whitespace-nowrap" title={`Reservada por: ${b.reserva_autorizado_por || "Admin"} — Pedido: ${b.reserva_numero_pedido || "-"}`}>
                          Reservada
                        </span>
                      ) : (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded whitespace-nowrap ${info.cls}`}>
                          {info.label}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center">
                      {b.anexo_cert_url ? (
                        <ImageLink url={b.anexo_cert_url} name={b.anexo_cert_nome || "Certificado"}
                          className="inline-flex items-center justify-center text-blue-600 hover:text-blue-800 transition-colors"
                          title="Ver certificado digital">
                          <ShieldCheck className="w-4 h-4" />
                        </ImageLink>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {getPesoDisponivel(b) > 0 ? (
                        <button
                          onClick={() => setSolicitarBobina(b)}
                          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                          title="Solicitar reserva"
                        >
                          <BookmarkPlus className="w-4 h-4" />
                          <span className="hidden sm:inline">Reservar</span>
                        </button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground italic">Já reservada</span>
                      )}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {/* Aviso */}
        <p className="text-xs text-muted-foreground text-center">
          Bobinas reservadas aparecem em destaque (fundo amarelo). Toque em "Reservar" para solicitar uma reserva ao admin.
        </p>
        </>
        )}

        {/* Aba Chapas */}
        {isCorteDobra && abaCD === "chapas" && <VendedorChapas vendedorNome={vendedorNome} selectedFiliais={selectedFiliais} />}

        {/* Aba Slitter */}
        {isCorteDobra && abaCD === "slitter" && <VendedorSlitter vendedorNome={vendedorNome} selectedFiliais={selectedFiliais} />}
      </div>

      <SolicitarReservaDialog
        open={!!solicitarBobina}
        onClose={() => { setSolicitarBobina(null); refetch(); }}
        item={solicitarBobina}
        itemTipo="bobina"
        itemLabel={solicitarBobina ? `${solicitarBobina.codigo || "-"} — ${solicitarBobina.cor || "-"} — ${solicitarBobina.chapa || "-"}mm` : ""}
        vendedorNome={vendedorNome}
        setor={setor}
        unidade={solicitarBobina?.unidade || filialAtiva}
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