import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, History, Search, Filter, AlertTriangle, CheckCircle2, Clock, Package } from "lucide-react";

const STATUS_COLORS = {
  conferido:  "bg-emerald-100 text-emerald-700",
  aprovado:   "bg-green-100 text-green-700",
  divergente: "bg-red-100 text-red-700",
  recebendo:  "bg-blue-100 text-blue-700",
};

export default function HistoricoExpedicao() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");

  const { data: entradas = [], isLoading } = useQuery({
    queryKey: ["entradas-expedicao"],
    queryFn: () => base44.entities.EntradaMaterialExpedicao?.filter?.({}, "-created_date", 200) ?? [],
    retry: false,
  });

  const filtered = entradas.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      e.numero_nf?.toLowerCase().includes(q) ||
      e.fornecedor?.toLowerCase().includes(q) ||
      e.produto?.toLowerCase().includes(q) ||
      e.local_armazenagem?.toLowerCase().includes(q);
    const matchStatus = !filtroStatus || e.status === filtroStatus;
    return matchSearch && matchStatus;
  });

  const divergentes = entradas.filter(e => e.status === "divergente").length;

  return (
    <div className="space-y-5">
      <div>
        <button onClick={() => navigate("/expedicao")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <History className="w-6 h-6 text-muted-foreground" /> Histórico de Entradas
        </h1>
        <p className="text-sm text-muted-foreground">{entradas.length} entrada(s) registrada(s)</p>
      </div>

      {divergentes > 0 && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <span className="text-sm text-red-700 font-semibold">
            {divergentes} entrada(s) com divergência aguardando aprovação do ADM
          </span>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Buscar por NF, fornecedor, produto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select
          className="border rounded-md px-3 py-2 text-sm bg-background"
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="conferido">Conferido</option>
          <option value="aprovado">Aprovado</option>
          <option value="divergente">Divergente</option>
          <option value="recebendo">Recebendo</option>
        </select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-4 border-muted border-t-teal-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p>Nenhuma entrada encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(e => (
            <div key={e.id} className={`border rounded-xl p-4 bg-card ${e.status === "divergente" ? "border-red-300" : ""}`}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold">NF {e.numero_nf || "—"}</span>
                    <Badge className={`text-[10px] ${STATUS_COLORS[e.status] || "bg-gray-100 text-gray-700"} border-transparent`}>
                      {e.status === "divergente" && <AlertTriangle className="w-3 h-3 mr-1" />}
                      {e.status === "conferido" && <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {e.status}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{e.fornecedor}</div>
                  <div className="flex gap-4 text-xs text-muted-foreground flex-wrap">
                    {e.produto && <span>{e.produto}</span>}
                    {e.quantidade_barras && <span>{e.quantidade_barras} barras</span>}
                    {e.peso_kg_nf && <span>NF: {e.peso_kg_nf.toLocaleString("pt-BR")} kg</span>}
                    {e.peso_kg_balanca && <span>Balança: {e.peso_kg_balanca.toLocaleString("pt-BR")} kg</span>}
                    {e.divergencia_percent != null && (
                      <span className={`font-bold ${Math.abs(e.divergencia_percent) > 3 ? "text-red-600" : "text-emerald-600"}`}>
                        Δ {e.divergencia_percent.toFixed(1)}%
                      </span>
                    )}
                    {e.local_armazenagem && <span>📍 {e.local_armazenagem}</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {e.data_hora ? new Date(e.data_hora).toLocaleString("pt-BR") : e.created_date ? new Date(e.created_date).toLocaleString("pt-BR") : "—"}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {e.foto_balanca_url && (
                    <a href={e.foto_balanca_url} target="_blank" rel="noopener noreferrer">
                      <img src={e.foto_balanca_url} alt="Balança" className="w-14 h-14 rounded-lg object-cover border" />
                    </a>
                  )}
                  {e.foto_material_url && (
                    <a href={e.foto_material_url} target="_blank" rel="noopener noreferrer">
                      <img src={e.foto_material_url} alt="Material" className="w-14 h-14 rounded-lg object-cover border" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
