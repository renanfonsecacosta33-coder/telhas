import React from "react";
import MapaBarracaoBase, { TIPOS_BASE } from "@/components/mapa/MapaBarracaoBase";

const TIPOS_CD = {
  maquina_corte:  { label: "Guilhotina",      cor: "#ef4444", icone: "✂",  w: 120, h: 60 },
  maquina_dobra:  { label: "Dobradeira",       cor: "#3b82f6", icone: "⚙",  w: 140, h: 60 },
  perfiladeira:   { label: "Perfiladeira",     cor: "#8b5cf6", icone: "⚙",  w: 200, h: 55 },
  desbobinadeira: { label: "Desbobinadeira",   cor: "#f59e0b", icone: "🔄", w: 100, h: 80 },
  bobinas:        { label: "Estoque Bobinas",  cor: "#10b981", icone: "🪙", w: 100, h: 100 },
  chaparia:       { label: "Chaparia",         cor: "#06b6d4", icone: "📦", w: 120, h: 80 },
  retalhos:       { label: "Retalhos",         cor: "#f97316", icone: "♻",  w: 80,  h: 80 },
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