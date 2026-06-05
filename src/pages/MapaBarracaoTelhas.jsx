import React from "react";
import MapaBarracaoBase, { TIPOS_BASE } from "@/components/mapa/MapaBarracaoBase";

const TIPOS_TELHAS = {
  tp40:         { label: "TP-40",           cor: "#ef4444", icone: "🏭", w: 220, h: 70 },
  tp25:         { label: "TP-25",           cor: "#f97316", icone: "🏭", w: 200, h: 70 },
  ondulada:     { label: "Ondulada",        cor: "#eab308", icone: "🏭", w: 200, h: 70 },
  colonial:     { label: "Colonial",        cor: "#84cc16", icone: "🏭", w: 200, h: 70 },
  bandeja:      { label: "Bandeja",         cor: "#06b6d4", icone: "🏭", w: 200, h: 70 },
  desbobinador: { label: "Desbobinador",    cor: "#8b5cf6", icone: "🔄", w: 100, h: 80 },
  cumeeira:     { label: "Cumeeira",        cor: "#3b82f6", icone: "⛺", w: 160, h: 65 },
  colagem:      { label: "Colagem",         cor: "#10b981", icone: "🔧", w: 180, h: 70 },
  bobinas:      { label: "Estoque Bobinas", cor: "#059669", icone: "🪙", w: 120, h: 100 },
  isopor:       { label: "Estoque Isopor",  cor: "#60a5fa", icone: "🧊", w: 120, h: 100 },
  cumeeiras_est:{ label: "Estoque Cumeeiras",cor: "#a78bfa", icone: "📦", w: 120, h: 80 },
  cola_est:     { label: "Estoque Cola",    cor: "#f59e0b", icone: "🛢", w: 80,  h: 80 },
  expedicao:    { label: "Expedição",       cor: "#64748b", icone: "🚛", w: 160, h: 80 },
  segundo_andar:{ label: "2º Andar",        cor: "#7c3aed", icone: "⬆", w: 200, h: 120 },
  escada:       { label: "Escada",          cor: "#9333ea", icone: "🪜", w: 50,  h: 80 },
  ...TIPOS_BASE,
};

export default function MapaBarracaoTelhas() {
  return (
    <MapaBarracaoBase
      storageKey="ajl_mapa_barracao_telhas"
      titulo="Mapa do Barracão — Fábrica de Telhas"
      subtitulo="Arraste os elementos · Duplo clique para editar · Alça para redimensionar · 2º andar disponível"
      tipos={TIPOS_TELHAS}
    />
  );
}