import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import {
  PackageCheck, AlertTriangle, Package, Wrench, TrendingUp,
  Plus, Clock, CheckCircle2, XCircle, RefreshCw, ArrowUpRight, Building2, CalendarClock
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Utilitários de validade ──────────────────────────────────
function getDiasRestantes(dataValidade) {
  if (!dataValidade) return null;
  return Math.floor((new Date(dataValidade) - new Date()) / 86400000);
}

function getValidadeInfo(dias) {
  if (dias === null) return null;
  if (dias < 0)   return { label: "VENCIDO",          color: "bg-gray-700 text-white",             borderCard: "border-gray-500",   dot: "bg-gray-600" };
  if (dias < 15)  return { label: `${dias}d — CRÍTICO`, color: "bg-red-100 text-red-700",           borderCard: "border-red-400",     dot: "bg-red-500" };
  if (dias < 30)  return { label: `${dias}d — URGENTE`, color: "bg-orange-100 text-orange-700",     borderCard: "border-orange-400",  dot: "bg-orange-500" };
  if (dias < 90)  return { label: `${dias}d — ATENÇÃO`, color: "bg-amber-100 text-amber-700",       borderCard: "border-amber-400",   dot: "bg-amber-400" };
  return           { label: `${dias}d — OK`,           color: "bg-emerald-100 text-emerald-700",   borderCard: "border-emerald-400", dot: "bg-emerald-500" };
}

const STATUS_COLORS = {
  recebendo:  { bg: "bg-blue-100 text-blue-700",   icon: Clock,          label: "Recebendo" },
  conferido:  { bg: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, label: "Conferido" },
  divergente: { bg: "bg-red-100 text-red-700",      icon: AlertTriangle,  label: "Divergência!" },
  aprovado:   { bg: "bg-green-100 text-green-700",  icon: CheckCircle2,   label: "Aprovado" },
};

export default function DashboardExpedicao() {
  const navigate = useNavigate();

  const { data: entradas = [], isLoading, refetch } = useQuery({
    queryKey: ["entradas-expedicao"],
    queryFn: () => base44.entities.EntradaMaterialExpedicao?.filter?.({}, "-created_date", 50) ?? [],
    retry: false,
  });

  const { data: estoqueBobinas = [] } = useQuery({
    queryKey: ["bobinas-expedicao"],
    queryFn: () => base44.entities.Bobina?.filter?.({ setor: "expedicao" }, "-created_date", 200) ?? [],
    retry: false,
  });

  const hoje = new Date().toISOString().slice(0, 10);
  const entradasHoje = entradas.filter(e => e.created_date?.startsWith(hoje));
  const divergencias = entradas.filter(e => e.status === "divergente");
  const totalPesoEstoque = estoqueBobinas.reduce((s, b) => s + (b.peso_kg || 0), 0);
  // Validade — materiais em alerta
  const emAlerta = entradas.filter(e => {
    const dias = getDiasRestantes(e.data_validade);
    return dias !== null && dias < 90 && e.status !== "zerado" && e.status !== "transferido";
  }).sort((a, b) => getDiasRestantes(a.data_validade) - getDiasRestantes(b.data_validade));

  const ultimas = entradas.slice(0, 6);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PackageCheck className="w-7 h-7 text-teal-600" />
            Expedição
          </h1>
          <p className="text-muted-foreground text-sm">Recebimento, estoque e produção de frisada</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/expedicao/saida")} className="gap-2 border-rose-300 text-rose-700 hover:bg-rose-50">
            <ArrowUpRight className="w-4 h-4" /> Saída / Transferência
          </Button>
          <Button onClick={() => navigate("/expedicao/recebimento")} className="bg-teal-600 hover:bg-teal-700 gap-2">
            <Plus className="w-4 h-4" /> Nova Entrada
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Entradas Hoje"
          value={entradasHoje.length}
          icon={PackageCheck}
          color="text-teal-600"
          bg="bg-teal-50 border-teal-200"
        />
        <StatCard
          label="Divergências"
          value={divergencias.length}
          icon={AlertTriangle}
          color={divergencias.length > 0 ? "text-red-600" : "text-gray-400"}
          bg={divergencias.length > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}
        />
        <StatCard
          label="Bobinas em Estoque"
          value={estoqueBobinas.filter(b => !b.arquivada).length}
          icon={Package}
          color="text-blue-600"
          bg="bg-blue-50 border-blue-200"
        />
        <StatCard
          label="Kg Disponível"
          value={totalPesoEstoque > 0 ? `${(totalPesoEstoque / 1000).toFixed(1)}t` : "0"}
          icon={TrendingUp}
          color="text-purple-600"
          bg="bg-purple-50 border-purple-200"
        />
      </div>

      {/* Alertas de divergência */}
      {divergencias.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="font-bold text-red-700">⚠️ {divergencias.length} entrada(s) com divergência de peso precisam de aprovação</h3>
          </div>
          <div className="space-y-2">
            {divergencias.slice(0, 3).map(e => (
              <div key={e.id} className="bg-white border border-red-200 rounded-lg px-3 py-2 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-sm">NF {e.numero_nf}</span>
                  <span className="text-muted-foreground text-xs ml-2">— {e.fornecedor}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-red-600 text-xs font-bold">
                    Δ {e.divergencia_percent?.toFixed(1) || "—"}%
                  </span>
                  <Button size="sm" variant="outline" className="text-xs h-7 border-red-300"
                    onClick={() => navigate("/expedicao/historico")}>
                    Ver
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🟡 Alertas de Validade / Material Ocioso */}
      {emAlerta.length > 0 && (
        <div className="border border-amber-300 bg-amber-50/60 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="w-5 h-5 text-amber-600" />
            <h3 className="font-bold text-amber-700">
              ⏰ {emAlerta.length} material(is) próximo(s) do vencimento (6 meses)
            </h3>
          </div>
          <div className="space-y-2">
            {emAlerta.slice(0, 5).map(e => {
              const dias = getDiasRestantes(e.data_validade);
              const info = getValidadeInfo(dias);
              return (
                <div key={e.id} className={`bg-white border-2 rounded-lg px-3 py-2.5 flex items-center justify-between ${info?.borderCard}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${info?.dot}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm">NF {e.numero_nf}</span>
                        <span className="text-muted-foreground text-xs">— {e.produto}</span>
                      </div>
                      <div className="text-xs text-muted-foreground flex gap-2 mt-0.5">
                        <span>{e.quantidade_barras_saldo ?? e.quantidade_barras} barras em estoque</span>
                        {e.local_armazenagem && <span>📍 {e.local_armazenagem}</span>}
                        {e.data_validade && <span>Vence: {new Date(e.data_validade).toLocaleDateString("pt-BR")}</span>}
                      </div>
                    </div>
                  </div>
                  <Badge className={`text-[10px] border-transparent shrink-0 ${info?.color}`}>
                    {info?.label}
                  </Badge>
                </div>
              );
            })}
          </div>
          {emAlerta.length > 5 && (
            <button className="mt-2 text-xs text-amber-600 underline" onClick={() => navigate("/expedicao/historico")}>
              Ver todos os {emAlerta.length} materiais em alerta →
            </button>
          )}
        </div>
      )}

      {/* Últimas entradas */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-base">Últimas Entradas</h2>
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Atualizar
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-7 h-7 border-4 border-muted border-t-teal-500 rounded-full animate-spin" />
          </div>
        ) : ultimas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <PackageCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma entrada registrada ainda</p>
            <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={() => navigate("/expedicao/recebimento")}>
              <Plus className="w-4 h-4 mr-2" /> Registrar Primeira Entrada
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {ultimas.map(e => {
              const st = STATUS_COLORS[e.status] || STATUS_COLORS.recebendo;
              const Icon = st.icon;
              return (
                <div key={e.id} className="bg-card border rounded-xl px-4 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                  <div className="hidden sm:flex w-8 h-8 rounded-full bg-teal-100 items-center justify-center flex-shrink-0">
                    <PackageCheck className="w-4 h-4 text-teal-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold font-mono text-sm">NF {e.numero_nf || "—"}</span>
                      <span className="text-muted-foreground text-xs truncate">{e.fornecedor}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-3 flex-wrap mt-0.5">
                      <span>{e.produto || "—"}</span>
                      <span>{e.peso_kg_nf ? `${e.peso_kg_nf.toLocaleString("pt-BR")} kg (NF)` : ""}</span>
                      {e.quantidade_barras && <span>{e.quantidade_barras} barras</span>}
                    </div>
                  </div>
                  <Badge className={`text-[10px] font-bold ${st.bg} border-transparent shrink-0`}>
                    <Icon className="w-3 h-3 mr-1" /> {st.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
        {[
          { label: "Estoque Bobinas", icon: Package,       to: "/expedicao/estoque",    color: "border-blue-200 hover:border-blue-400 text-blue-700" },
          { label: "Mapa Armazenagem", icon: null,          to: "/expedicao/mapa",       color: "border-teal-200 hover:border-teal-400 text-teal-700" },
          { label: "Frisada",          icon: Wrench,        to: "/expedicao/frisada",    color: "border-purple-200 hover:border-purple-400 text-purple-700" },
        ].map(({ label, icon: Icon, to, color }) => (
          <button key={to} onClick={() => navigate(to)}
            className={`border-2 rounded-xl p-4 text-center font-semibold text-sm hover:bg-muted/20 transition-all ${color}`}>
            {Icon && <Icon className="w-5 h-5 mx-auto mb-1" />}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, bg }) {
  return (
    <div className={`border rounded-xl p-4 text-center ${bg}`}>
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
