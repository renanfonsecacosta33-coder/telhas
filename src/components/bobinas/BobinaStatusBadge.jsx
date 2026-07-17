import React from "react";

const STATUS_CONFIG = {
  em_producao:         { label: "Em produção",   cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  pendente:            { label: "Aguardando",    cls: "bg-blue-100 text-blue-700 border-blue-200" },
  pausado:             { label: "Parado",        cls: "bg-amber-100 text-amber-700 border-amber-200" },
  aguardando_colagem:  { label: "Agl. colagem",  cls: "bg-purple-100 text-purple-700 border-purple-200" },
  aguardando_material: { label: "Sem material",  cls: "bg-orange-100 text-orange-700 border-orange-200" },
  aguardando_corte:    { label: "Agl. corte",    cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

/**
 * Badge de status da bobina — consistente entre Telhas e Corte e Dobra.
 * Usa o statusMap do usePreBaixaBobinas (mesma lógica da tabela de vendedores).
 *
 * @param {Object} bobina - A bobina
 * @param {Object|null} statusInfo - { maquina, status } do statusMap, ou null
 * @param {string} size - "xs" ou "sm"
 */
export default function BobinaStatusBadge({ bobina, statusInfo, size = "xs" }) {
  if (!bobina) return null;

  let label, cls;
  if (bobina.reservada) {
    label = "Reservada";
    cls = "bg-amber-200 text-amber-800 border-amber-300";
  } else if (statusInfo && STATUS_CONFIG[statusInfo.status]) {
    label = STATUS_CONFIG[statusInfo.status].label;
    cls = STATUS_CONFIG[statusInfo.status].cls;
  } else {
    label = "Disponível";
    cls = "bg-slate-100 text-slate-500 border-slate-200";
  }

  const sizeClass = size === "xs" ? "text-[9px] px-1 py-0" : "text-[10px] px-1.5 py-0";
  return (
    <span className={`inline-flex items-center rounded border font-semibold whitespace-nowrap ${cls} ${sizeClass}`}>
      {label}
    </span>
  );
}