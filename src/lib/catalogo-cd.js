// ─── CATÁLOGO COMPLETO AJL — CORTE E DOBRA ───────────────────────────────────
// Comprimento desenvolvido calculado via BD simplificada (para perfis padrão):
// L = soma das abas (fórmula prática) usando BD = 2*T por dobra de 90°

// Categorias
export const CATEGORIAS_CATALOGO = [
  { id: "perfil_estrutural_simples", label: "Perfil Estrutural Simples", cor: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "perfil_estrutural_enrijecido", label: "Perfil Estrutural Enrijecido", cor: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { id: "chapa_plana", label: "Chapas Planas", cor: "bg-slate-100 text-slate-700 border-slate-200" },
  { id: "perfil_serralheiro_u", label: "Perfil Serralheiro — U", cor: "bg-purple-100 text-purple-800 border-purple-200" },
  { id: "perfil_serralheiro_l", label: "Perfil Serralheiro — L/Cantoneira", cor: "bg-violet-100 text-violet-800 border-violet-200" },
  { id: "perfil_serralheiro_cartola", label: "Perfil Serralheiro — Cartola", cor: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "perfil_serralheiro_especial", label: "Perfil Serralheiro — Especial", cor: "bg-orange-100 text-orange-800 border-orange-200" },
  { id: "caixa_basculante", label: "Caixa Basculante (PS 55)", cor: "bg-teal-100 text-teal-800 border-teal-200" },
  { id: "batente_basculante", label: "Batente Basculante", cor: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { id: "fabricacao_especial", label: "Fabricação Especial AJL", cor: "bg-red-100 text-red-700 border-red-200" },
];

// Máquinas disponíveis (sem Plasma!)
export const MAQUINAS_CORTE = ["CORTE 3M", "CORTE 6M"];
export const MAQUINAS_DOBRA = ["DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M", "PERFILADEIRA"];

// Espessuras disponíveis das chapas (mm)
export const ESPESSURAS_CHAPA = [
  { label: "Chapa 28 (0,43mm)", valor: 0.43 },
  { label: "Chapa 26 (0,50mm)", valor: 0.50 },
  { label: "Chapa 24 (0,60mm)", valor: 0.60 },
  { label: "Chapa 22 (0,75mm)", valor: 0.75 },
  { label: "Chapa 20 (0,90mm)", valor: 0.90 },
  { label: "Chapa 18 (1,20mm)", valor: 1.20 },
  { label: "Chapa 16 (1,50mm)", valor: 1.50 },
  { label: "Chapa 14 (2,00mm)", valor: 2.00 },
  { label: "Chapa 13 (2,25mm)", valor: 2.25 },
  { label: "Chapa 12 (2,65mm)", valor: 2.65 },
  { label: "Chapa 11 (3,00mm)", valor: 3.00 },
  { label: "Chapa 10 (3,35mm)", valor: 3.35 },
  { label: "Chapa 9 (3,75mm)",  valor: 3.75 },
  { label: "Chapa 8 (4,25mm)",  valor: 4.25 },
  { label: "Chapa 3/16\" (4,75mm)", valor: 4.75 },
  { label: "Chapa 1/4\" (6,30mm)",  valor: 6.30 },
  { label: "Chapa 5/16\" (8,00mm)", valor: 8.00 },
  { label: "Chapa 3/8\" (9,50mm)",  valor: 9.50 },
  { label: "Chapa 1/2\" (12,70mm)", valor: 12.70 },
];

// ─── Função: calcula comprimento desenvolvido aproximado via BD simplificada
// para perfis U simples: soma das abas externas - n_dobras * 2 * espessura
// para perfis L: soma das duas abas - 2 * espessura
export function calcDesenvolvido(abas_mm, n_dobras_90, espessura_mm) {
  const soma = abas_mm.reduce((s, a) => s + a, 0);
  const deducao = n_dobras_90 * 2 * espessura_mm;
  return Math.round(soma - deducao);
}

// ─── CATÁLOGO DE PRODUTOS ───────────────────────────────────────────────────
// abas: dimensões externas em mm
// dobras: número de dobras de 90°
// maquina_corte / maquina_dobra: máquinas recomendadas
// comprimento_padrao_mm: comprimento padrão de fabricação (3000 ou 6000mm)
// largura_necessaria_mm: largura de bobina/chapa necessária

export const CATALOGO = [
  // ─── PERFIL ESTRUTURAL SIMPLES ───
  {
    id: "pes_50x25", categoria: "perfil_estrutural_simples",
    nome: "Perfil Estrutural Simples 50x25", codigo: "PS 50x25",
    dimensoes: "25x50x25", abas: [25, 50, 25], dobras: 2,
    largura_necessaria_mm: 100,
    espessuras_disponiveis: [2.00, 2.25, 2.65, 3.00],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
    observacao: "Perfil U simples. Dobras em 90°.",
  },
  {
    id: "pes_68x30", categoria: "perfil_estrutural_simples",
    nome: "Perfil Estrutural Simples 68x30", codigo: "PS 68x30",
    dimensoes: "30x68x30", abas: [30, 68, 30], dobras: 2,
    largura_necessaria_mm: 128,
    espessuras_disponiveis: [2.00, 2.25, 2.65],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pes_75x38", categoria: "perfil_estrutural_simples",
    nome: "Perfil Estrutural Simples 75x38", codigo: "PS 75x38",
    dimensoes: "38x75x38", abas: [38, 75, 38], dobras: 2,
    largura_necessaria_mm: 151,
    espessuras_disponiveis: [2.00, 2.25, 2.65, 3.00, 4.75],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pes_92x30", categoria: "perfil_estrutural_simples",
    nome: "Perfil Estrutural Simples 92x30", codigo: "PS 92x30",
    dimensoes: "30x92x30", abas: [30, 92, 30], dobras: 2,
    largura_necessaria_mm: 152,
    espessuras_disponiveis: [2.00, 2.25, 2.65],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pes_100x40", categoria: "perfil_estrutural_simples",
    nome: "Perfil Estrutural Simples 100x40", codigo: "PS 100x40",
    dimensoes: "40x100x40", abas: [40, 100, 40], dobras: 2,
    largura_necessaria_mm: 180,
    espessuras_disponiveis: [2.00, 2.25, 2.65, 3.00, 4.75],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pes_100x50", categoria: "perfil_estrutural_simples",
    nome: "Perfil Estrutural Simples 100x50", codigo: "PS 100x50",
    dimensoes: "50x100x50", abas: [50, 100, 50], dobras: 2,
    largura_necessaria_mm: 200,
    espessuras_disponiveis: [2.00, 2.25, 2.65, 3.00, 4.75],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pes_125x50", categoria: "perfil_estrutural_simples",
    nome: "Perfil Estrutural Simples 125x50", codigo: "PS 125x50",
    dimensoes: "50x125x50", abas: [50, 125, 50], dobras: 2,
    largura_necessaria_mm: 225,
    espessuras_disponiveis: [2.65, 3.00, 4.75],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pes_150x50", categoria: "perfil_estrutural_simples",
    nome: "Perfil Estrutural Simples 150x50", codigo: "PS 150x50",
    dimensoes: "50x150x50", abas: [50, 150, 50], dobras: 2,
    largura_necessaria_mm: 250,
    espessuras_disponiveis: [2.65, 3.00, 4.75],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pes_200x50", categoria: "perfil_estrutural_simples",
    nome: "Perfil Estrutural Simples 200x50", codigo: "PS 200x50",
    dimensoes: "50x200x50", abas: [50, 200, 50], dobras: 2,
    largura_necessaria_mm: 300,
    espessuras_disponiveis: [2.65, 3.00],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },

  // ─── PERFIL ESTRUTURAL ENRIJECIDO ───
  {
    id: "pee_75x38x18", categoria: "perfil_estrutural_enrijecido",
    nome: "Perfil Estrutural Enrijecido 75x38x18", codigo: "PE 75x38x18",
    dimensoes: "18x38x75x38x18", abas: [18, 38, 75, 38, 18], dobras: 4,
    largura_necessaria_mm: 187,
    espessuras_disponiveis: [2.00, 2.25, 2.65, 3.00],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
    observacao: "Perfil U com enrijecedores nas abas.",
  },
  {
    id: "pee_100x40x18", categoria: "perfil_estrutural_enrijecido",
    nome: "Perfil Estrutural Enrijecido 100x40x18", codigo: "PE 100x40x18",
    dimensoes: "18x40x100x40x18", abas: [18, 40, 100, 40, 18], dobras: 4,
    largura_necessaria_mm: 216,
    espessuras_disponiveis: [2.00, 2.25, 2.65, 3.00],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pee_100x50x18", categoria: "perfil_estrutural_enrijecido",
    nome: "Perfil Estrutural Enrijecido 100x50x18", codigo: "PE 100x50x18",
    dimensoes: "18x50x100x50x18", abas: [18, 50, 100, 50, 18], dobras: 4,
    largura_necessaria_mm: 236,
    espessuras_disponiveis: [2.00, 2.25, 2.65, 3.00],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pee_125x50x18", categoria: "perfil_estrutural_enrijecido",
    nome: "Perfil Estrutural Enrijecido 125x50x18", codigo: "PE 125x50x18",
    dimensoes: "18x50x125x50x18", abas: [18, 50, 125, 50, 18], dobras: 4,
    largura_necessaria_mm: 261,
    espessuras_disponiveis: [2.65, 3.00],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },
  {
    id: "pee_150x50x18", categoria: "perfil_estrutural_enrijecido",
    nome: "Perfil Estrutural Enrijecido 150x50x18", codigo: "PE 150x50x18",
    dimensoes: "18x50x150x50x18", abas: [18, 50, 150, 50, 18], dobras: 4,
    largura_necessaria_mm: 286,
    espessuras_disponiveis: [2.65, 3.00],
    maquina_corte: "CORTE 6M", maquina_dobra: "DOBRA FUNDO 6M",
    comprimento_padrao_mm: 6000,
  },

  // ─── CHAPAS PLANAS (Blanks) ───
  {
    id: "chapa_1200x3000", categoria: "chapa_plana",
    nome: "Chapa Plana 1200x3000", codigo: "Chapa",
    dimensoes: "1200x3000", abas: [1200, 3000], dobras: 0,
    largura_necessaria_mm: 1200,
    espessuras_disponiveis: [0.43,0.50,0.60,0.75,0.90,1.20,1.50,2.00,2.25,2.65,3.00,3.35,3.75,4.25,4.75,6.30,8.00,9.50,12.70],
    maquina_corte: "CORTE 6M", maquina_dobra: null,
    comprimento_padrao_mm: 3000,
    observacao: "Chapa cortada na guilhotina conforme medida solicitada.",
  },

  // ─── PERFIS SERRALHEIRO U ───
  {
    id: "ps1", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 1 (U 12,5x25)", codigo: "PS-1",
    dimensoes: "12,5x25x12,5", abas: [12.5, 25, 12.5], dobras: 2,
    largura_necessaria_mm: 50, espessuras_disponiveis: [1.20, 1.25, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps2", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 2 (U 15x25)", codigo: "PS-2",
    dimensoes: "15x25x15", abas: [15, 25, 15], dobras: 2,
    largura_necessaria_mm: 55, espessuras_disponiveis: [1.20, 1.25, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps3", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 3 (U 12,5x38)", codigo: "PS-3",
    dimensoes: "12,5x38x12,5", abas: [12.5, 38, 12.5], dobras: 2,
    largura_necessaria_mm: 63, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps4", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 4 (U 15x38)", codigo: "PS-4",
    dimensoes: "15x38x15", abas: [15, 38, 15], dobras: 2,
    largura_necessaria_mm: 68, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps5", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 5 (U 15x50)", codigo: "PS-5",
    dimensoes: "15x50x15", abas: [15, 50, 15], dobras: 2,
    largura_necessaria_mm: 80, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55, 2.00],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps6", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 6 (U 15x75)", codigo: "PS-6",
    dimensoes: "15x75x15", abas: [15, 75, 15], dobras: 2,
    largura_necessaria_mm: 105, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55, 2.00],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps8", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 8 (U 25x50)", codigo: "PS-8",
    dimensoes: "25x50x25", abas: [25, 50, 25], dobras: 2,
    largura_necessaria_mm: 100, espessuras_disponiveis: [1.20, 1.25, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps9", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 9 (U 20x35)", codigo: "PS-9",
    dimensoes: "20x35x20", abas: [20, 35, 20], dobras: 2,
    largura_necessaria_mm: 75, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps10", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 10 (U 25x75)", codigo: "PS-10",
    dimensoes: "25x75x25", abas: [25, 75, 25], dobras: 2,
    largura_necessaria_mm: 125, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps16", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 16 (U 16x25)", codigo: "PS-16",
    dimensoes: "16x25x16", abas: [16, 25, 16], dobras: 2,
    largura_necessaria_mm: 57, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps17", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 17 (U 17x25)", codigo: "PS-17",
    dimensoes: "17x25x17", abas: [17, 25, 17], dobras: 2,
    largura_necessaria_mm: 59, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps19", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 19 (U 12,5x19)", codigo: "PS-19",
    dimensoes: "12,5x19x12,5", abas: [12.5, 19, 12.5], dobras: 2,
    largura_necessaria_mm: 44, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps20", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 20 (U 16x20)", codigo: "PS-20",
    dimensoes: "16x20x16", abas: [16, 20, 16], dobras: 2,
    largura_necessaria_mm: 52, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55, 2.00],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps21", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 21 (U 13x21)", codigo: "PS-21",
    dimensoes: "13x21x13", abas: [13, 21, 13], dobras: 2,
    largura_necessaria_mm: 47, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps22", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 22 (U 14x22)", codigo: "PS-22",
    dimensoes: "14x22x14", abas: [14, 22, 14], dobras: 2,
    largura_necessaria_mm: 50, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps23", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 23 (U 20x25)", codigo: "PS-23",
    dimensoes: "20x25x20", abas: [20, 25, 20], dobras: 2,
    largura_necessaria_mm: 65, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps25", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 25 (U 14x18)", codigo: "PS-25",
    dimensoes: "14x18x14", abas: [14, 18, 14], dobras: 2,
    largura_necessaria_mm: 46, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps26", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 26 (U 22x27)", codigo: "PS-26",
    dimensoes: "22x27x22", abas: [22, 27, 22], dobras: 2,
    largura_necessaria_mm: 71, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps28", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 28 (U 16x50)", codigo: "PS-28",
    dimensoes: "16x50x16", abas: [16, 50, 16], dobras: 2,
    largura_necessaria_mm: 82, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps38", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 38 (U 15x15)", codigo: "PS-38",
    dimensoes: "15x15x15", abas: [15, 15, 15], dobras: 2,
    largura_necessaria_mm: 45, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps39", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 39 (U 15x20)", codigo: "PS-39",
    dimensoes: "15x20x15", abas: [15, 20, 15], dobras: 2,
    largura_necessaria_mm: 50, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps53", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 53 (U 100x100)", codigo: "PS-53",
    dimensoes: "100x100x100", abas: [100, 100, 100], dobras: 2,
    largura_necessaria_mm: 300, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55, 2.00],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps59", categoria: "perfil_serralheiro_u", nome: "Perfil Serralheiro 59 (U 53x13)", codigo: "PS-59",
    dimensoes: "53x13x53", abas: [53, 13, 53], dobras: 2,
    largura_necessaria_mm: 119, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55, 2.00],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },

  // ─── PERFIS SERRALHEIRO L ───
  {
    id: "ps11", categoria: "perfil_serralheiro_l", nome: "Perfil Serralheiro 11 (L 28x28)", codigo: "PS-11",
    dimensoes: "28x28", abas: [28, 28], dobras: 1,
    largura_necessaria_mm: 56, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55, 2.00],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps12", categoria: "perfil_serralheiro_l", nome: "Perfil Serralheiro 12 (L 20x20)", codigo: "PS-12",
    dimensoes: "20x20", abas: [20, 20], dobras: 1,
    largura_necessaria_mm: 40, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55, 2.00],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps13", categoria: "perfil_serralheiro_l", nome: "Perfil Serralheiro 13 (L 28x35)", codigo: "PS-13",
    dimensoes: "28x35", abas: [28, 35], dobras: 1,
    largura_necessaria_mm: 63, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps14", categoria: "perfil_serralheiro_l", nome: "Perfil Serralheiro 14 (L 23x23)", codigo: "PS-14",
    dimensoes: "23x23", abas: [23, 23], dobras: 1,
    largura_necessaria_mm: 46, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps18", categoria: "perfil_serralheiro_l", nome: "Perfil Serralheiro 18 (L 18x18)", codigo: "PS-18",
    dimensoes: "18x18", abas: [18, 18], dobras: 1,
    largura_necessaria_mm: 36, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },

  // ─── CARTOLAS ───
  {
    id: "ps33", categoria: "perfil_serralheiro_cartola", nome: "Perfil Serralheiro 33 (Cartola 50)", codigo: "PS-33",
    dimensoes: "27x16x50x16x66x8x9", abas: [27,16,50,16,66,8,9], dobras: 6,
    largura_necessaria_mm: 192, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps40", categoria: "perfil_serralheiro_cartola", nome: "Perfil Serralheiro 40 (Cartola 30)", codigo: "PS-40",
    dimensoes: "15x19x30x15x20", abas: [15,19,30,15,20], dobras: 4,
    largura_necessaria_mm: 99, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps41", categoria: "perfil_serralheiro_cartola", nome: "Perfil Serralheiro 41 (Cartola 41)", codigo: "PS-41",
    dimensoes: "15x15x41x15x15", abas: [15,15,41,15,15], dobras: 4,
    largura_necessaria_mm: 101, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps42", categoria: "perfil_serralheiro_cartola", nome: "Perfil Serralheiro 42 (Cartola 100)", codigo: "PS-42",
    dimensoes: "20x22x100x16x25", abas: [20,22,100,16,25], dobras: 4,
    largura_necessaria_mm: 183, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps47", categoria: "perfil_serralheiro_cartola", nome: "Perfil Serralheiro 47 (Cartola 85)", codigo: "PS-47",
    dimensoes: "15x38x85x20x15", abas: [15,38,85,20,15], dobras: 4,
    largura_necessaria_mm: 173, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },

  // ─── ESPECIAIS ───
  {
    id: "ps15", categoria: "perfil_serralheiro_especial", nome: "Perfil Serralheiro 15 (Cadeirinha)", codigo: "PS-15",
    dimensoes: "30x27x31x27x30", abas: [30,27,31,27,30], dobras: 4,
    largura_necessaria_mm: 145, espessuras_disponiveis: [1.20, 1.25],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps55_120", categoria: "caixa_basculante", nome: "Caixa Basculante PS-55 (120)", codigo: "PS-55/120",
    dimensoes: "10x15x120x120", abas: [10,15,120,120], dobras: 3,
    largura_necessaria_mm: 265, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps55_150", categoria: "caixa_basculante", nome: "Caixa Basculante PS-55 (150)", codigo: "PS-55/150",
    dimensoes: "10x15x150x150", abas: [10,15,150,150], dobras: 3,
    largura_necessaria_mm: 325, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "ps55_200", categoria: "caixa_basculante", nome: "Caixa Basculante PS-55 (200)", codigo: "PS-55/200",
    dimensoes: "10x15x200x200", abas: [10,15,200,200], dobras: 3,
    largura_necessaria_mm: 425, espessuras_disponiveis: [1.20, 1.25, 1.50, 1.55],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "batente_120", categoria: "batente_basculante", nome: "Batente Basculante 15x120", codigo: "BB-120",
    dimensoes: "15x120", abas: [15, 120], dobras: 1,
    largura_necessaria_mm: 135, espessuras_disponiveis: [1.20, 1.25, 1.50],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "batente_150", categoria: "batente_basculante", nome: "Batente Basculante 15x150", codigo: "BB-150",
    dimensoes: "15x150", abas: [15, 150], dobras: 1,
    largura_necessaria_mm: 165, espessuras_disponiveis: [1.20, 1.25, 1.50],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "batente_180", categoria: "batente_basculante", nome: "Batente Basculante 15x180", codigo: "BB-180",
    dimensoes: "15x180", abas: [15, 180], dobras: 1,
    largura_necessaria_mm: 195, espessuras_disponiveis: [1.20, 1.25, 1.50],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "batente_200", categoria: "batente_basculante", nome: "Batente Basculante 15x200", codigo: "BB-200",
    dimensoes: "15x200", abas: [15, 200], dobras: 1,
    largura_necessaria_mm: 215, espessuras_disponiveis: [1.20, 1.25, 1.50],
    maquina_corte: "CORTE 3M", maquina_dobra: "DOBRA 3M", comprimento_padrao_mm: 3000,
  },
  {
    id: "tira_raiada", categoria: "fabricacao_especial", nome: "Tira Raiada (AJL)", codigo: "TR",
    dimensoes: "-", abas: [], dobras: 0,
    largura_necessaria_mm: null, espessuras_disponiveis: [0.43, 0.50],
    maquina_corte: "CORTE 3M", maquina_dobra: "PERFILADEIRA", comprimento_padrao_mm: 3000,
    observacao: "Chapas 26 (0,50mm) e 28 (0,43mm). Sob medida.",
  },
];

// ─── Utilitário: para um retalho (comp x larg x esp), retorna quais produtos do catálogo cabem ───
export function sugerirProdutosParaRetalho(comp_mm, larg_mm, esp_mm) {
  return CATALOGO.filter(p => {
    if (!p.espessuras_disponiveis.some(e => Math.abs(e - esp_mm) < 0.05)) return false;
    if (!p.largura_necessaria_mm) return false;
    const devolvido = calcDesenvolvido(p.abas, p.dobras, esp_mm);
    return p.largura_necessaria_mm <= larg_mm && devolvido <= comp_mm;
  }).map(p => ({
    ...p,
    comprimento_desenvolvido: calcDesenvolvido(p.abas, p.dobras, esp_mm),
    qtd_possivel: Math.floor(comp_mm / calcDesenvolvido(p.abas, p.dobras, esp_mm)) || 0,
  }));
}