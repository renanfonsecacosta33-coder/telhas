import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Package, Layers, X } from "lucide-react";
import { Link } from "react-router-dom";

const LIMITE_BOBINA_KG = 500;   // kg — avisa se abaixo disso
const LIMITE_ISOPOR_QTD = 50;  // unidades — avisa se abaixo disso

export default function AlertasEstoque({ onClose }) {
  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-alertas"],
    queryFn: () => base44.entities.Bobina.filter({ arquivada: false }),
  });

  const { data: isopores = [] } = useQuery({
    queryKey: ["isopores-alertas"],
    queryFn: () => base44.entities.Isopor.list(),
  });

  const bobinasCriticas = bobinas.filter(b => (b.peso_kg || 0) < LIMITE_BOBINA_KG);
  const isoporesCriticos = isopores.filter(i => (i.quantidade || 0) < LIMITE_ISOPOR_QTD);

  const total = bobinasCriticas.length + isoporesCriticos.length;
  if (total === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 relative">
      <button onClick={onClose} className="absolute top-3 right-3 text-amber-400 hover:text-amber-600">
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
        <h3 className="font-bold text-amber-800 text-sm">
          {total} alerta{total > 1 ? "s" : ""} de estoque baixo
        </h3>
      </div>

      <div className="space-y-2">
        {bobinasCriticas.map(b => (
          <div key={b.id} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/80 rounded-lg px-3 py-2">
            <Package className="w-3 h-3 flex-shrink-0" />
            <span className="font-semibold">Bobina</span>
            <span className="text-amber-600">{b.chapa} {b.qualidade ? `(${b.qualidade})` : ""} — {b.cor}</span>
            <span className="ml-auto font-bold text-amber-800">{b.peso_kg?.toFixed(0) || 0} kg</span>
          </div>
        ))}

        {isoporesCriticos.map(i => (
          <div key={i.id} className="flex items-center gap-2 text-xs text-amber-700 bg-amber-100/80 rounded-lg px-3 py-2">
            <Layers className="w-3 h-3 flex-shrink-0" />
            <span className="font-semibold">Isopor</span>
            <span className="text-amber-600">{i.tipo}</span>
            <span className="ml-auto font-bold text-amber-800">{i.quantidade || 0} un</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        {bobinasCriticas.length > 0 && (
          <Link to="/bobinas" className="text-xs text-amber-700 underline hover:text-amber-900">Ver Bobinas →</Link>
        )}
        {isoporesCriticos.length > 0 && (
          <Link to="/isopor" className="text-xs text-amber-700 underline hover:text-amber-900">Ver Isopor →</Link>
        )}
      </div>
    </div>
  );
}