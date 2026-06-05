import React from "react";
import MapaBarracaoBase, { TIPOS_BASE } from "@/components/mapa/MapaBarracaoBase";

const TIPOS_CD = {
  // Máquinas
  maquina_corte:  { label: "Guilhotina",      cor: "#ef4444", icone: "✂",  w: 120, h: 60 },
  maquina_dobra:  { label: "Dobradeira",       cor: "#3b82f6", icone: "⚙",  w: 140, h: 60 },
  perfiladeira:   { label: "Perfiladeira",     cor: "#8b5cf6", icone: "⚙",  w: 200, h: 55 },
  desbobinadeira: { label: "Desbobinadeira",   cor: "#f59e0b", icone: "🔄", w: 100, h: 80 },
  
  // Estoques
  bobinas:        { label: "Estoque Bobinas",  cor: "#10b981", icone: "🪙", w: 100, h: 100 },
  chaparia:       { label: "Chaparia",         cor: "#06b6d4", icone: "📦", w: 120, h: 80 },
  retalhos:       { label: "Retalhos",         cor: "#f97316", icone: "♻",  w: 80,  h: 80 },
  
  // Pátio e docas
  porta_caminhao: { label: "Porta Caminhão",  cor: "#dc2626", icone: "🚚", w: 100, h: 40 },
  doca:           { label: "Doca",            cor: "#b91c1c", icone: "📦", w: 120, h: 60 },
  patio_externo:  { label: "Pátio Externo",   cor: "#16a34a", icone: "🌳", w: 200, h: 150 },
  estacionamento: { label: "Estacionamento",  cor: "#6b7280", icone: "🅿️", w: 180, h: 100 },
  area_carregamento:{ label: "Área Carregamento", cor: "#ea580c", icone: "📦", w: 140, h: 80 },
  
  // Áreas de armazenagem
  area_armazenagem_a:{ label: "Armazenagem A", cor: "#0891b2", icone: "📍", w: 100, h: 100 },
  area_armazenagem_b:{ label: "Armazenagem B", cor: "#0e7490", icone: "📍", w: 100, h: 100 },
  area_armazenagem_c:{ label: "Armazenagem C", cor: "#155e75", icone: "📍", w: 100, h: 100 },
  deposito:       { label: "Depósito",        cor: "#475569", icone: "🏢", w: 150, h: 120 },
  
  // Utilitários
  banheiro:       { label: "Banheiro",        cor: "#0ea5e9", icone: "🚻", w: 60, h: 60 },
  escritorio:     { label: "Escritório",      cor: "#7c3aed", icone: "🖥️", w: 100, h: 80 },
  copa:           { label: "Copa",            cor: "#f59e0b", icone: "☕", w: 60, h: 60 },
  vestiario:      { label: "Vestiário",       cor: "#8b5cf6", icone: "👕", w: 80, h: 60 },
  
  ...TIPOS_BASE,
};

export default function MapaBarracaoCD() {
  return (
    <MapaBarracaoBase
      storageKey="ajl_mapa_barracao_cd"
      titulo="Mapa do Barracão — Corte & Dobra"
      subtitulo="Arraste os elementos para posicionar · Duplo clique para editar nome · Alça no canto para redimensionar"
      tipos={TIPOS_CD}
    />
  );
}