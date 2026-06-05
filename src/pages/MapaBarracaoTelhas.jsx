import React from "react";
import MapaBarracaoBase, { TIPOS_BASE } from "@/components/mapa/MapaBarracaoBase";

const TIPOS_TELHAS = {
  // Máquinas
  tp40:         { label: "TP-40",           cor: "#ef4444", icone: "🏭", w: 220, h: 70 },
  tp25:         { label: "TP-25",           cor: "#f97316", icone: "🏭", w: 200, h: 70 },
  ondulada:     { label: "Ondulada",        cor: "#eab308", icone: "🏭", w: 200, h: 70 },
  colonial:     { label: "Colonial",        cor: "#84cc16", icone: "🏭", w: 200, h: 70 },
  bandeja:      { label: "Bandeja",         cor: "#06b6d4", icone: "🏭", w: 200, h: 70 },
  desbobinador: { label: "Desbobinador",    cor: "#8b5cf6", icone: "🔄", w: 100, h: 80 },
  cumeeira:     { label: "Cumeeira",        cor: "#3b82f6", icone: "⛺", w: 160, h: 65 },
  colagem:      { label: "Colagem",         cor: "#10b981", icone: "🔧", w: 180, h: 70 },
  
  // Estoques internos
  bobinas:      { label: "Estoque Bobinas", cor: "#059669", icone: "🪙", w: 120, h: 100 },
  isopor:       { label: "Estoque Isopor",  cor: "#60a5fa", icone: "🧊", w: 120, h: 100 },
  cumeeiras_est:{ label: "Estoque Cumeeiras",cor: "#a78bfa", icone: "📦", w: 120, h: 80 },
  cola_est:     { label: "Estoque Cola",    cor: "#f59e0b", icone: "🛢", w: 80,  h: 80 },
  
  // Estrutura
  segundo_andar:{ label: "2º Andar",        cor: "#7c3aed", icone: "⬆", w: 200, h: 120 },
  escada:       { label: "Escada",          cor: "#9333ea", icone: "🪜", w: 50,  h: 80 },
  expedicao:    { label: "Expedição",       cor: "#64748b", icone: "🚛", w: 160, h: 80 },
  
  // Pátio externo e docas
  porta_caminhao:{ label: "Porta Caminhão", cor: "#dc2626", icone: "🚚", w: 100, h: 40 },
  doca:         { label: "Doca",            cor: "#b91c1c", icone: "📦", w: 120, h: 60 },
  patio_externo:{ label: "Pátio Externo",  cor: "#16a34a", icone: "🌳", w: 200, h: 150 },
  estacionamento:{ label: "Estacionamento", cor: "#6b7280", icone: "🅿️", w: 180, h: 100 },
  area_carregamento:{ label: "Área Carregamento", cor: "#ea580c", icone: "📦", w: 140, h: 80 },
  
  // Áreas de armazenagem
  area_armazenagem_a:{ label: "Armazenagem A", cor: "#0891b2", icone: "📍", w: 100, h: 100 },
  area_armazenagem_b:{ label: "Armazenagem B", cor: "#0e7490", icone: "📍", w: 100, h: 100 },
  area_armazenagem_c:{ label: "Armazenagem C", cor: "#155e75", icone: "📍", w: 100, h: 100 },
  deposito:     { label: "Depósito",        cor: "#475569", icone: "🏢", w: 150, h: 120 },
  
  // Utilitários
  banheiro:     { label: "Banheiro",        cor: "#0ea5e9", icone: "🚻", w: 60, h: 60 },
  escritorio:   { label: "Escritório",      cor: "#7c3aed", icone: "🖥️", w: 100, h: 80 },
  copa:         { label: "Copa",            cor: "#f59e0b", icone: "☕", w: 60, h: 60 },
  vestiario:    { label: "Vestiário",       cor: "#8b5cf6", icone: "👕", w: 80, h: 60 },
  
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