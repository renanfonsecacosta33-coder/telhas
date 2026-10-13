import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, History, Search, Filter, AlertTriangle, CheckCircle2,
  Clock, Package, CalendarClock, ArrowUpRight, Truck, ArrowRightLeft,
  Building2, User, FileText, ArrowDownLeft
} from "lucide-react";

// ── Validade ──────────────────────────────────────────────────
function getDiasRestantes(dv) {
  if (!dv) return null;
  return Math.floor((new Date(dv) - new Date()) / 86400000);
}
function getValidadeTag(dias) {
  if (dias === null) return null;
  if (dias < 0)  return { label: "VENCIDO",          color: "bg-gray-700 text-white border-gray-600" };
  if (dias < 15) return { label: `${dias}d — CRÍTICO`, color: "bg-red-100 text-red-700 border-red-300" };
  if (dias < 30) return { label: `${dias}d — URGENTE`, color: "bg-orange-100 text-orange-700 border-orange-300" };
  if (dias < 90) return { label: `${dias}d — ATENÇÃO`, color: "bg-amber-100 text-amber-700 border-amber-300" };
  return           { label: `${dias}d — OK`,           color: "bg-emerald-100 text-emerald-700 border-emerald-300" };
}

const STATUS_COLORS = {
  conferido:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  aprovado:   "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
  divergente: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  recebendo:  "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
};

export default function HistoricoExpedicao() {
  const navigate = useNavigate();
  const [tabAtiva, setTabAtiva] = useState("entradas"); // "entradas" | "saidas" | "cargas"
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroValidade, setFiltroValidade] = useState(false);

  // 1. Entradas de materiais
  const { data: entradas = [], isLoading: loadingEntradas } = useQuery({
    queryKey: ["entradas-expedicao"],
    queryFn: () => base44.entities.EntradaMaterialExpedicao?.filter?.({}, "-created_date", 200) ?? [],
    retry: false,
  });

  // 2. Saídas e transferências
  const { data: saidas = [], isLoading: loadingSaidas } = useQuery({
    queryKey: ["saidas-expedicao"],
    queryFn: () => base44.entities.SaidaMaterialExpedicao?.filter?.({}, "-created_date", 200) ?? [],
    retry: false,
  });

  // 3. Cargas / Romaneios expedidos
  const { data: cargas = [], isLoading: loadingCargas } = useQuery({
    queryKey: ["cargas-expedicao-historico"],
    queryFn: () => base44.entities.Carga?.filter?.({}, "-created_date", 200) ?? [],
    retry: false,
  });

  // Filtro Entradas
  const filteredEntradas = useMemo(() => {
    return entradas.filter(e => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        e.numero_nf?.toLowerCase().includes(q) ||
        e.fornecedor?.toLowerCase().includes(q) ||
        e.produto?.toLowerCase().includes(q) ||
        e.local_armazenagem?.toLowerCase().includes(q);
      const matchStatus = !filtroStatus || e.status === filtroStatus;
      const matchValidade = !filtroValidade || (getDiasRestantes(e.data_validade) ?? 999) < 90;
      return matchSearch && matchStatus && matchValidade;
    });
  }, [entradas, search, filtroStatus, filtroValidade]);

  // Filtro Saídas
  const filteredSaidas = useMemo(() => {
    return saidas.filter(s => {
      const q = search.toLowerCase();
      return !q ||
        s.numero_pedido?.toLowerCase().includes(q) ||
        s.numero_nf_origem?.toLowerCase().includes(q) ||
        s.produto?.toLowerCase().includes(q) ||
        s.filial_destino?.toLowerCase().includes(q) ||
        s.observacoes?.toLowerCase().includes(q);
    });
  }, [saidas, search]);

  // Filtro Cargas
  const filteredCargas = useMemo(() => {
    return cargas.filter(c => {
      const q = search.toLowerCase();
      return !q ||
        c.motorista_nome?.toLowerCase().includes(q) ||
        c.placa?.toLowerCase().includes(q) ||
        c.transportadora?.toLowerCase().includes(q) ||
        c.pedidos_json?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q);
    });
  }, [cargas, search]);

  const divergentes = entradas.filter(e => e.status === "divergente").length;
  const totalBarrasSaldo = entradas.reduce((acc, e) => acc + (e.quantidade_barras_saldo ?? e.quantidade_barras ?? 0), 0);
  const totalSaidasBarras = saidas.reduce((acc, s) => acc + (Number(s.quantidade_barras) || 0), 0);

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div>
        <button onClick={() => navigate("/expedicao")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
          <ChevronLeft className="w-4 h-4" /> Voltar ao Painel da Expedição
        </button>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <History className="w-6 h-6 text-muted-foreground" />
              Histórico Geral da Expedição
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Rastreamento de entradas de matéria-prima, saídas para clientes e romaneios de cargas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/expedicao/saida")}
              className="gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
            >
              <ArrowUpRight className="w-3.5 h-3.5" /> Nova Saída
            </Button>
            <Button
              size="sm"
              onClick={() => navigate("/expedicao/recebimento")}
              className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <ArrowDownLeft className="w-3.5 h-3.5" /> Receber Material
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Rápidos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-500" /> Total Entradas
          </span>
          <p className="text-xl font-black mt-1 text-foreground">
            {entradas.length} <span className="text-xs font-normal text-muted-foreground">NFs</span>
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-blue-500" /> Saldo em Barras
          </span>
          <p className="text-xl font-black mt-1 text-foreground">
            {totalBarrasSaldo} <span className="text-xs font-normal text-muted-foreground">disponíveis</span>
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" /> Total Saídas
          </span>
          <p className="text-xl font-black mt-1 text-foreground">
            {saidas.length} <span className="text-xs font-normal text-muted-foreground">({totalSaidasBarras} pçs)</span>
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-3 shadow-2xs">
          <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Truck className="w-3.5 h-3.5 text-indigo-500" /> Cargas Expedidas
          </span>
          <p className="text-xl font-black mt-1 text-foreground">
            {cargas.length} <span className="text-xs font-normal text-muted-foreground">viagens</span>
          </p>
        </div>
      </div>

      {divergentes > 0 && tabAtiva === "entradas" && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-900 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700 dark:text-red-300 font-semibold">
            {divergentes} entrada(s) com divergência aguardando aprovação do ADM
          </span>
        </div>
      )}

      {/* Abas Superiores */}
      <div className="flex items-center gap-1.5 border-b border-border pb-2 flex-wrap">
        <Button
          variant={tabAtiva === "entradas" ? "default" : "outline"}
          size="sm"
          onClick={() => setTabAtiva("entradas")}
          className={`gap-1.5 text-xs font-bold ${tabAtiva === "entradas" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
        >
          <ArrowDownLeft className="w-3.5 h-3.5" />
          <span>📥 Entradas de Material ({entradas.length})</span>
        </Button>

        <Button
          variant={tabAtiva === "saidas" ? "default" : "outline"}
          size="sm"
          onClick={() => setTabAtiva("saidas")}
          className={`gap-1.5 text-xs font-bold ${tabAtiva === "saidas" ? "bg-rose-600 hover:bg-rose-700 text-white" : ""}`}
        >
          <ArrowUpRight className="w-3.5 h-3.5" />
          <span>📤 Saídas & Transferências ({saidas.length})</span>
        </Button>

        <Button
          variant={tabAtiva === "cargas" ? "default" : "outline"}
          size="sm"
          onClick={() => setTabAtiva("cargas")}
          className={`gap-1.5 text-xs font-bold ${tabAtiva === "cargas" ? "bg-indigo-600 hover:bg-indigo-700 text-white" : ""}`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>🚚 Cargas Expedidas ({cargas.length})</span>
        </Button>
      </div>

      {/* Filtros e Busca */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 h-9 text-xs"
            placeholder={
              tabAtiva === "entradas"
                ? "Buscar por NF, fornecedor, produto, local..."
                : tabAtiva === "saidas"
                ? "Buscar por pedido, NF origem, produto ou filial..."
                : "Buscar por motorista, placa, transportadora..."
            }
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {tabAtiva === "entradas" && (
          <>
            <select
              className="border rounded-md px-3 py-1.5 text-xs bg-background h-9"
              value={filtroStatus}
              onChange={e => setFiltroStatus(e.target.value)}
            >
              <option value="">Todos os status</option>
              <option value="conferido">Conferido</option>
              <option value="aprovado">Aprovado</option>
              <option value="divergente">Divergente</option>
              <option value="recebendo">Recebendo</option>
              <option value="zerado">Saído (zerado)</option>
              <option value="transferido">Transferido</option>
            </select>
            <Button
              size="sm"
              variant={filtroValidade ? "default" : "outline"}
              onClick={() => setFiltroValidade(v => !v)}
              className={`h-9 text-xs ${filtroValidade ? "bg-amber-500 hover:bg-amber-600 text-white" : "border-amber-400 text-amber-700 hover:bg-amber-50"}`}
            >
              <CalendarClock className="w-3.5 h-3.5 mr-1" />
              Em Alerta
            </Button>
          </>
        )}
      </div>

      {/* Conteúdo Aba 1: ENTRADAS */}
      {tabAtiva === "entradas" && (
        loadingEntradas ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-muted border-t-emerald-500 rounded-full animate-spin" />
          </div>
        ) : filteredEntradas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-dashed rounded-xl">
            <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma entrada encontrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredEntradas.map(e => {
              const dias = getDiasRestantes(e.data_validade);
              const tag = getValidadeTag(dias);
              const saldo = e.quantidade_barras_saldo ?? e.quantidade_barras;
              const temSaldo = saldo > 0 && e.status !== "zerado" && e.status !== "transferido";
              return (
                <div key={e.id} className={`border rounded-xl p-4 bg-card ${
                  e.status === "divergente" ? "border-red-300 dark:border-red-900" :
                  dias !== null && dias < 30 ? "border-amber-300 dark:border-amber-900" : ""
                }`}>
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold">NF {e.numero_nf || "—"}</span>
                        <Badge className={`text-[10px] ${STATUS_COLORS[e.status] || "bg-gray-100 text-gray-700"} border-transparent`}>
                          {e.status === "divergente" && <AlertTriangle className="w-3 h-3 mr-1" />}
                          {e.status === "conferido" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                          {e.status}
                        </Badge>
                        {tag && (
                          <Badge className={`text-[10px] border shrink-0 ${tag.color}`}>
                            <CalendarClock className="w-3 h-3 mr-1" /> {tag.label}
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">{e.fornecedor}</div>
                      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        {e.produto && <span>{e.produto}</span>}
                        {saldo != null && <span className="text-emerald-600 font-bold">{saldo} barras</span>}
                        {e.peso_kg_nf && <span>NF: {e.peso_kg_nf.toLocaleString("pt-BR")} kg</span>}
                        {e.peso_kg_balanca && <span>Balança: {e.peso_kg_balanca.toLocaleString("pt-BR")} kg</span>}
                        {e.divergencia_percent != null && (
                          <span className={`font-bold ${Math.abs(e.divergencia_percent) > 3 ? "text-red-600" : "text-emerald-600"}`}>
                            Δ {e.divergencia_percent.toFixed(1)}%
                          </span>
                        )}
                        {e.local_armazenagem && <span>📍 {e.local_armazenagem}</span>}
                        {e.data_validade && (
                          <span className={dias !== null && dias < 30 ? "text-red-600 font-bold" : ""}>
                            Vence {new Date(e.data_validade).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {e.data_hora ? new Date(e.data_hora).toLocaleString("pt-BR") : e.created_date ? new Date(e.created_date).toLocaleString("pt-BR") : "—"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      {temSaldo && (
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-7 border-rose-300 text-rose-700 hover:bg-rose-50"
                          onClick={() => navigate("/expedicao/saida")}>
                          <ArrowUpRight className="w-3 h-3" /> Saída
                        </Button>
                      )}
                      <div className="flex gap-1">
                        {e.foto_balanca_url && (
                          <a href={e.foto_balanca_url} target="_blank" rel="noopener noreferrer">
                            <img src={e.foto_balanca_url} alt="Balança" className="w-12 h-12 rounded-lg object-cover border" />
                          </a>
                        )}
                        {e.foto_material_url && (
                          <a href={e.foto_material_url} target="_blank" rel="noopener noreferrer">
                            <img src={e.foto_material_url} alt="Material" className="w-12 h-12 rounded-lg object-cover border" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Conteúdo Aba 2: SAÍDAS & TRANSFERÊNCIAS */}
      {tabAtiva === "saidas" && (
        loadingSaidas ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-muted border-t-rose-500 rounded-full animate-spin" />
          </div>
        ) : filteredSaidas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-dashed rounded-xl">
            <ArrowUpRight className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma saída ou transferência registrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredSaidas.map(s => {
              const isTransf = s.tipo_operacao === "transferencia";
              return (
                <div key={s.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">
                          {isTransf ? `Transferência: ${s.numero_pedido || "Sem Ref"}` : `Pedido #${s.numero_pedido || "—"}`}
                        </span>
                        <Badge className={isTransf ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-rose-100 text-rose-800 border-rose-200"}>
                          {isTransf ? <Building2 className="w-3 h-3 mr-1" /> : <Package className="w-3 h-3 mr-1" />}
                          {isTransf ? `Para ${s.filial_destino || "Outra Filial"}` : "Saída Cliente"}
                        </Badge>
                        {s.numero_nf_origem && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">
                            NF Origem: {s.numero_nf_origem}
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm font-medium text-foreground">
                        {s.produto || "Material Expedido"}
                      </div>

                      <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="font-bold text-rose-600">{s.quantidade_barras || 0} barras</span>
                        {s.peso_kg != null && <span>{Number(s.peso_kg).toLocaleString("pt-BR")} kg</span>}
                        {s.observacoes && <span className="italic">Obs: {s.observacoes}</span>}
                      </div>

                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {s.data_hora ? new Date(s.data_hora).toLocaleString("pt-BR") : s.created_date ? new Date(s.created_date).toLocaleString("pt-BR") : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Conteúdo Aba 3: CARGAS & ROMANEIOS */}
      {tabAtiva === "cargas" && (
        loadingCargas ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 border-4 border-muted border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filteredCargas.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground bg-card border border-dashed rounded-xl">
            <Truck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma carga expedida encontrada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCargas.map(c => {
              let pedidos = [];
              try {
                if (c.pedidos_json) pedidos = JSON.parse(c.pedidos_json);
              } catch {}

              const statusColor =
                c.status === "entregue" ? "bg-emerald-100 text-emerald-800" :
                c.status === "em_transito" ? "bg-blue-100 text-blue-800" :
                c.status === "cancelada" ? "bg-rose-100 text-rose-800" :
                "bg-amber-100 text-amber-800";

              return (
                <div key={c.id} className="border border-border rounded-xl p-4 bg-card space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm">
                          Carga {c.id?.slice?.(-6)?.toUpperCase?.() || "—"}
                        </span>
                        <Badge className={statusColor}>
                          <Truck className="w-3 h-3 mr-1" />
                          {c.status || "Carregando"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {c.unidade || "Matriz AJL"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        {c.motorista_nome && <span>👤 Motorista: <strong>{c.motorista_nome}</strong></span>}
                        {c.placa && <span>🚛 Placa: <strong>{c.placa}</strong></span>}
                        {c.transportadora && <span>🏢 {c.transportadora}</span>}
                      </div>

                      {pedidos.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <span className="text-[11px] font-semibold text-muted-foreground">Pedidos:</span>
                          {pedidos.map((p, idx) => (
                            <Badge key={idx} variant="outline" className="text-[10px] bg-muted/40">
                              #{p.numero_pedido || p.id} {p.cliente ? `(${p.cliente.slice(0, 15)})` : ""}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {c.observacoes && (
                        <p className="text-xs text-muted-foreground italic">Obs: {c.observacoes}</p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                        {c.data_saida && (
                          <span>Saída: {new Date(c.data_saida).toLocaleString("pt-BR")}</span>
                        )}
                        <span>Criado: {c.data_criacao || (c.created_date ? new Date(c.created_date).toLocaleDateString("pt-BR") : "—")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
