import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Weight, Ruler, CalendarDays, FileCheck, Package, ClipboardList, Loader2, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const STATUS_STYLES = {
  pendente: "bg-gray-100 text-gray-700 border-gray-300",
  em_producao: "bg-blue-100 text-blue-800 border-blue-300",
  pausado: "bg-amber-100 text-amber-800 border-amber-300",
  aguardando_corte: "bg-orange-100 text-orange-800 border-orange-300",
  finalizado: "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelado: "bg-red-100 text-red-700 border-red-300",
};

export default function BobinaQR() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await base44.functions.invoke("getBobinaQRData", { bobina_id: id });
        setData(res.data);
      } catch (e) {
        setError(e?.response?.data?.error || e?.message || "Erro ao carregar");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          <p className="text-sm text-gray-500">Carregando bobina...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center max-w-md">
          <p className="text-lg font-bold text-red-600 mb-2">Erro</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  const { bobina, ordensDesbob = [], ordensMaquina = [] } = data;

  const todasOrdens = [
    ...ordensDesbob.map(o => ({
      ...o,
      _tipo: "Desbobinadeira",
      _label: o.observacoes || `Corte ${o.comprimento_mm || ""}mm`,
      _qtd: o.quantidade,
      _kg: o.kg_estimado,
    })),
    ...ordensMaquina.map(o => ({
      ...o,
      _tipo: o.maquina,
      _label: o.tipo_peca || o.desenvolvimento_descricao || o.dimensoes_livres || "",
      _qtd: o.quantidade,
      _kg: o.peso_kg,
    })),
  ].sort((a, b) => (b.data || "").localeCompare(a.data || ""));

  const totalPecas = todasOrdens.filter(o => o.status === "finalizado").reduce((s, o) => s + (o._qtd || 0), 0);
  const totalKg = todasOrdens.filter(o => o.status === "finalizado").reduce((s, o) => s + (o._kg || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gray-900 text-white px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-5 h-5" />
            <h1 className="text-xl font-bold">Bobina {bobina.codigo || ""}</h1>
          </div>
          <p className="text-sm text-gray-300">{bobina.cor} · {bobina.qualidade}</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Resumo de pedidos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-bold text-gray-800 flex items-center gap-1.5 mb-3">
            <ClipboardList className="w-4 h-4" /> Resumo de Pedidos
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-900">{todasOrdens.length}</p>
              <p className="text-[10px] text-gray-500">Pedidos</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-900">{totalPecas.toLocaleString("pt-BR")}</p>
              <p className="text-[10px] text-gray-500">Peças</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-lg font-bold text-gray-900">{totalKg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</p>
              <p className="text-[10px] text-gray-500">kg consumidos</p>
            </div>
          </div>
        </div>

        {/* Dados da bobina */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-bold text-gray-800 mb-3">Informações da Bobina</p>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info icon={<Weight className="w-3 h-3" />} label="Peso Atual" value={`${bobina.peso_kg?.toLocaleString("pt-BR") || "—"} kg`} />
            <Info icon={<Weight className="w-3 h-3" />} label="Peso Inicial" value={`${bobina.peso_inicial?.toLocaleString("pt-BR") || "—"} kg`} />
            <Info icon={<Ruler className="w-3 h-3" />} label="Largura" value={`${bobina.largura_mm || "—"} mm`} />
            <Info label="Chapa" value={`${bobina.chapa || "—"} mm`} />
            <Info label="Espessura Util." value={bobina.espessura_utilizada || bobina.espessura_real || "—"} />
            <Info icon={<CalendarDays className="w-3 h-3" />} label="Recebimento" value={bobina.data_recebimento || "—"} />
            <Info icon={<FileCheck className="w-3 h-3" />} label="NF" value={bobina.nf || "—"} />
            <Info label="Fornecedor" value={bobina.fornecedor || "—"} />
            <Info label="Custo/kg" value={bobina.custo ? `R$ ${Number(bobina.custo).toFixed(2)}` : "—"} />
            <Info label="Estoque Mín." value={`${bobina.estoque_minimo_kg?.toLocaleString("pt-BR") || "—"} kg`} />
          </div>
          {bobina.reservada && (
            <div className="mt-3 p-2 rounded-lg bg-purple-50 border border-purple-200 text-xs">
              <p className="font-semibold text-purple-800">🔒 Reservada — {bobina.reserva_tipo === "inteira" ? "Bobina Inteira" : `${bobina.reserva_kg?.toLocaleString("pt-BR")} kg`}</p>
              {bobina.reserva_numero_pedido && <p className="text-purple-700">Pedido: {bobina.reserva_numero_pedido}</p>}
              {bobina.reserva_motivo && <p className="text-purple-700">Motivo: {bobina.reserva_motivo}</p>}
              {bobina.reserva_autorizado_por && <p className="text-purple-700">Autorizado por: {bobina.reserva_autorizado_por}</p>}
            </div>
          )}
          {bobina.observacoes && (
            <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{bobina.observacoes}</p>
          )}
        </div>

        {/* Lista de pedidos */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-1.5">
            <ClipboardList className="w-4 h-4" /> Pedidos ({todasOrdens.length})
          </p>
          {todasOrdens.length === 0 ? (
            <p className="text-xs text-gray-500 py-4 text-center">Nenhum pedido registrado para esta bobina.</p>
          ) : (
            <div className="space-y-2">
              {todasOrdens.map((o, i) => (
                <div key={o.id || i} className="border border-gray-200 rounded-lg p-3 text-xs">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_STYLES[o.status] || ""}`}>{o.status}</Badge>
                      <span className="font-medium text-gray-800 truncate">{o._label}</span>
                    </div>
                    <span className="text-gray-400 shrink-0">{o.data}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-gray-500">
                    <span className="font-medium text-indigo-600">{o._tipo}</span>
                    <span>{o._qtd || 0} pçs</span>
                    {o._kg && <span>{o._kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg</span>}
                    {o.cliente && <span>· {o.cliente}</span>}
                    {o.numero_pedido && <span>· Ped: {o.numero_pedido}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {bobina.anexo_nf_url && (
          <a href={bobina.anexo_nf_url} target="_blank" rel="noopener noreferrer"
            className="block text-center text-xs py-2 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-700 font-medium">
            Ver Nota Fiscal
          </a>
        )}

        <p className="text-center text-[10px] text-gray-400 pt-2 pb-4">
          AJL Ferro e Aço · Sistema de Gestão de Bobinas
        </p>
      </div>
    </div>
  );
}

function Info({ icon, label, value }) {
  return (
    <div className="bg-gray-50 rounded-lg p-2">
      <p className="text-gray-400 mb-0.5 flex items-center gap-1">{icon}{label}</p>
      <p className="font-semibold text-gray-800">{value}</p>
    </div>
  );
}