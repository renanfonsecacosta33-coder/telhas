/**
 * tabelaBlanksAJL.js
 * 
 * Engenharia e padronização prática da AJL Ferro & Aço.
 * ATENÇÃO: Na AJL NÃO se utiliza Fator K. 
 * A planificação é baseada diretamente na Tabela Física de Blanks da fábrica
 * ou na regra prática de dedução de dobra:
 * Para 90°: Dedução = 2 × Espessura da Chapa.
 */

// Colunas de espessura da tabela física impressa da AJL
export const ESP_COLS = [1.95, 2.0, 2.25, 2.3, 2.65, 2.7, 3.0];
export const ESP_LABELS = ["1,95", "2,0", "2,25", "2,3", "2,65", "2,7", "3,0"];

// Tabela de blanks digitalizada da folha da fábrica (14 perfis padrão)
export const TABELA_BLANKS = {
  "25x50x25":          [92,  92,  91,  91,  89,  89,  88],
  "30x68x30":          [120, 120, 119, 119, 117, 117, 116],
  "38x75x38":          [143, 143, 142, 142, 140, 140, 139],
  "30x92x30":          [144, 144, 143, 143, 141, 141, 140],
  "40x100x40":         [172, 172, 171, 171, 169, 169, 168],
  "50x100x50":         [192, 192, 191, 191, 189, 189, 188],
  "50x125x50":         [217, 217, 216, 216, 214, 214, 213],
  "50x150x50":         [242, 242, 241, 241, 239, 239, 238],
  "50x200x50":         [292, 292, 291, 291, 289, 289, 288],
  "75x38 ENRRU.":      [171, 171, 169, 169, 166, 165, 173],
  "100x40 ENRRU.":     [200, 200, 198, 198, 195, 194, 202],
  "100x50 ENRRU.":     [220, 220, 218, 218, 215, 214, 222],
  "125x50 ENRRU.":     [245, 245, 243, 243, 240, 239, 247],
  "150x50 ENRRU.":     [270, 270, 268, 268, 265, 264, 272],
};

// Detalhes completos de cada perfil padrão para geração de peças e presets
export const PERFIS_CATALOGO_AJL = [
  {
    codigo: "25x50x25",
    nome: "Perfil U 25×50×25",
    tipo: "Perfil U",
    descricao: "Aba 25 · Alma 50 · Aba 25 (2 dobras 90°)",
    abasPadrao: [25, 50, 25],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 1.5, descricao: "Dobra 1" },
      { angulo: 90, direcao: "cima", raio: 1.5, descricao: "Dobra 2" },
    ],
  },
  {
    codigo: "30x68x30",
    nome: "Perfil U 30×68×30",
    tipo: "Perfil U",
    descricao: "Aba 30 · Alma 68 · Aba 30 (2 dobras 90°)",
    abasPadrao: [30, 68, 30],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 1.5, descricao: "Dobra 1" },
      { angulo: 90, direcao: "cima", raio: 1.5, descricao: "Dobra 2" },
    ],
  },
  {
    codigo: "38x75x38",
    nome: "Perfil U 38×75×38",
    tipo: "Perfil U",
    descricao: "Aba 38 · Alma 75 · Aba 38 (2 dobras 90°)",
    abasPadrao: [38, 75, 38],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 1.5, descricao: "Dobra 1" },
      { angulo: 90, direcao: "cima", raio: 1.5, descricao: "Dobra 2" },
    ],
  },
  {
    codigo: "30x92x30",
    nome: "Perfil U 30×92×30",
    tipo: "Perfil U",
    descricao: "Aba 30 · Alma 92 · Aba 30 (2 dobras 90°)",
    abasPadrao: [30, 92, 30],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 1.5, descricao: "Dobra 1" },
      { angulo: 90, direcao: "cima", raio: 1.5, descricao: "Dobra 2" },
    ],
  },
  {
    codigo: "40x100x40",
    nome: "Perfil C 40×100×40",
    tipo: "Perfil C",
    descricao: "Aba 40 · Alma 100 · Aba 40 (2 dobras 90°)",
    abasPadrao: [40, 100, 40],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 2" },
    ],
  },
  {
    codigo: "50x100x50",
    nome: "Perfil C 50×100×50",
    tipo: "Perfil C",
    descricao: "Aba 50 · Alma 100 · Aba 50 (2 dobras 90°)",
    abasPadrao: [50, 100, 50],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 2" },
    ],
  },
  {
    codigo: "50x125x50",
    nome: "Perfil C 50×125×50",
    tipo: "Perfil C",
    descricao: "Aba 50 · Alma 125 · Aba 50 (2 dobras 90°)",
    abasPadrao: [50, 125, 50],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 2" },
    ],
  },
  {
    codigo: "50x150x50",
    nome: "Perfil C 50×150×50",
    tipo: "Perfil C",
    descricao: "Aba 50 · Alma 150 · Aba 50 (2 dobras 90°)",
    abasPadrao: [50, 150, 50],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 2" },
    ],
  },
  {
    codigo: "50x200x50",
    nome: "Perfil C 50×200×50",
    tipo: "Perfil C",
    descricao: "Aba 50 · Alma 200 · Aba 50 (2 dobras 90°)",
    abasPadrao: [50, 200, 50],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Dobra 2" },
    ],
  },
  {
    codigo: "75x38 ENRRU.",
    nome: "75×38 Enrijecido (Ue)",
    tipo: "Enrijecido",
    descricao: "Perfil Ue enrijecido · 75×38",
    abasPadrao: [15, 38, 75, 38, 15],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 2" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 2" },
    ],
  },
  {
    codigo: "100x40 ENRRU.",
    nome: "100×40 Enrijecido (Ue)",
    tipo: "Enrijecido",
    descricao: "Perfil Ue enrijecido · 100×40",
    abasPadrao: [17, 40, 100, 40, 17],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 2" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 2" },
    ],
  },
  {
    codigo: "100x50 ENRRU.",
    nome: "100×50 Enrijecido (Ue)",
    tipo: "Enrijecido",
    descricao: "Perfil Ue enrijecido · 100×50",
    abasPadrao: [17, 50, 100, 50, 17],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 2" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 2" },
    ],
  },
  {
    codigo: "125x50 ENRRU.",
    nome: "125×50 Enrijecido (Ue)",
    tipo: "Enrijecido",
    descricao: "Perfil Ue enrijecido · 125×50",
    abasPadrao: [20, 50, 125, 50, 20],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 2" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 2" },
    ],
  },
  {
    codigo: "150x50 ENRRU.",
    nome: "150×50 Enrijecido (Ue)",
    tipo: "Enrijecido",
    descricao: "Perfil Ue enrijecido · 150×50",
    abasPadrao: [20, 50, 150, 50, 20],
    dobrasPadrao: [
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 1" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Aba 2" },
      { angulo: 90, direcao: "cima", raio: 2.0, descricao: "Enrijecedor 2" },
    ],
  },
];

/**
 * Dedução de dobra prática (Bend Deduction) sem Fator K.
 * Na caldeiraria da AJL: 
 * Para 90°: BD = 2 × Espessura.
 * Para outros ângulos: BD = 2 × Espessura × tan(angulo / 2).
 */
export function calcDeducaoDobraAJL(anguloGraus, espessuraMm) {
  const esp = Number(espessuraMm) || 0;
  if (esp <= 0) return 0;
  const ang = Number(anguloGraus) || 90;
  const rad = (ang / 2) * (Math.PI / 180);
  const tanVal = Math.tan(rad);
  return 2 * esp * (isNaN(tanVal) ? 1 : tanVal);
}

/**
 * Interpreta o nome da peça e extrai tipo de perfil, abas, dobras e dimensões
 * Suporta formatos industriais comuns da AJL e Odoo:
 *  - "Perfil U 40x75x40", "U 40x75x40", "40x75x40"
 *  - "Perfil C 150x50x17", "C 50x150x50x17", "100x50 ENRRU."
 *  - "Cantoneira 50x50", "L 50x50", "40x40"
 *  - "Perfil Z 30x80x30", "Z 25x60x25"
 *  - "Rufo Pingadeira 15x120x50x15"
 *  - "Cartola 20x35x50x35x20", "Omega 20x40x50x40x20"
 */
export function interpretarGeometriaNomePeca(nomePeca) {
  if (!nomePeca || typeof nomePeca !== "string") return null;

  const raw = nomePeca.trim();
  const up = raw.toUpperCase();

  // Substitui caracteres de multiplicação e normaliza
  const normStr = up.replace(/[×*]/g, "x").replace(/(\d+)\s*x\s*(\d+)/gi, "$1x$2");

  // Extrai sequência de números como 40x75x40 ou 50x150x50x17
  const matchSeq = normStr.match(/(\d+(?:[.,]\d+)?(?:\s*x\s*\d+(?:[.,]\d+)?)+)/i);
  if (!matchSeq) return null;

  const nums = matchSeq[1]
    .split(/x/i)
    .map(s => parseFloat(s.trim().replace(",", ".")))
    .filter(n => !isNaN(n) && n > 0);

  if (nums.length < 2) return null;

  let tipo = "Personalizado";
  let abas = [];
  let dobras = [];
  let largura_final_mm = "";
  let altura_final_mm = "";

  const isCantoneira = up.includes("CANTONEIRA") || /\bL\b/.test(up) || up.startsWith("L ") || (nums.length === 2 && !up.includes("ENRRU"));
  const isZ = up.includes("PERFIL Z") || /\bZ\b/.test(up) || up.startsWith("Z ");
  const isRufo = up.includes("RUFO") || up.includes("PINGADEIRA") || up.includes("CALHA");
  const isCartola = up.includes("CARTOLA") || up.includes("OMEGA") || up.includes("ÔMEGA");
  const isEnrijecido = up.includes("ENRRU") || up.includes("ENRIJECIDO") || up.includes("PERFIL C") || (up.includes(" C ") || up.startsWith("C ")) || (nums.length === 5 && !isCartola);

  if (isCantoneira && nums.length === 2) {
    tipo = "Cantoneira / Perfil L";
    abas = [nums[0], nums[1]];
    dobras = [
      { angulo: 90, direcao: "cima", descricao: "Dobra central 90°", raio: "1.5" },
    ];
    largura_final_mm = String(nums[1]);
    altura_final_mm = String(nums[0]);
  } else if (isZ && nums.length === 3) {
    tipo = "Perfil Z";
    abas = [nums[0], nums[1], nums[2]];
    dobras = [
      { angulo: 90, direcao: "cima", descricao: "Aba superior", raio: "1.5" },
      { angulo: 90, direcao: "baixo", descricao: "Alma vertical", raio: "1.5" },
    ];
    largura_final_mm = String(nums[1]);
    altura_final_mm = String(Math.max(nums[0], nums[2]));
  } else if (isCartola && nums.length === 5) {
    tipo = "Perfil Cartola (Ômega)";
    abas = [nums[0], nums[1], nums[2], nums[3], nums[4]];
    dobras = [
      { angulo: 90, direcao: "cima", descricao: "Aba base esq.", raio: "1.5" },
      { angulo: 90, direcao: "baixo", descricao: "Lateral esq.", raio: "1.5" },
      { angulo: 90, direcao: "baixo", descricao: "Topo", raio: "1.5" },
      { angulo: 90, direcao: "cima", descricao: "Lateral dir.", raio: "1.5" },
    ];
    largura_final_mm = String(nums[2]);
    altura_final_mm = String(nums[1]);
  } else if (isEnrijecido) {
    tipo = "Perfil C Enrijecido";
    if (nums.length === 5) {
      abas = [nums[0], nums[1], nums[2], nums[3], nums[4]];
      largura_final_mm = String(nums[1]);
      altura_final_mm = String(nums[2]);
    } else if (nums.length === 4) {
      const enr = nums[3];
      abas = [enr, nums[0], nums[1], nums[2], enr];
      largura_final_mm = String(nums[0]);
      altura_final_mm = String(nums[1]);
    } else if (nums.length === 3) {
      const maior = Math.max(nums[0], nums[1]);
      const menor = Math.min(nums[0], nums[1]);
      const enr = nums[2];
      abas = [enr, menor, maior, menor, enr];
      largura_final_mm = String(menor);
      altura_final_mm = String(maior);
    } else if (nums.length === 2) {
      const alma = Math.max(nums[0], nums[1]);
      const flange = Math.min(nums[0], nums[1]);
      const enr = 17;
      abas = [enr, flange, alma, flange, enr];
      largura_final_mm = String(flange);
      altura_final_mm = String(alma);
    }
    dobras = [
      { angulo: 90, direcao: "baixo", descricao: "Enrijecedor sup.", raio: "1.5" },
      { angulo: 90, direcao: "baixo", descricao: "Flange superior", raio: "1.5" },
      { angulo: 90, direcao: "baixo", descricao: "Alma principal", raio: "1.5" },
      { angulo: 90, direcao: "baixo", descricao: "Flange inferior", raio: "1.5" },
    ];
  } else if (nums.length === 3) {
    tipo = "Perfil U Simples";
    abas = [nums[0], nums[1], nums[2]];
    dobras = [
      { angulo: 90, direcao: "cima", descricao: "Flange esquerdo", raio: "1.5" },
      { angulo: 90, direcao: "cima", descricao: "Flange direito", raio: "1.5" },
    ];
    largura_final_mm = String(nums[1]);
    altura_final_mm = String(Math.max(nums[0], nums[2]));
  } else if (isRufo && nums.length >= 3) {
    tipo = "Rufo com Pingadeira";
    abas = nums;
    dobras = abas.slice(0, -1).map((_, i) => ({
      angulo: i === 0 ? 135 : 90,
      direcao: i % 2 === 0 ? "cima" : "baixo",
      descricao: `Dobra ${i + 1}`,
      raio: "1.5"
    }));
  } else {
    tipo = `Perfil ${nums.length} Abas`;
    abas = nums;
    dobras = abas.slice(0, -1).map((_, i) => ({
      angulo: 90,
      direcao: "cima",
      descricao: `Dobra ${i + 1}`,
      raio: "1.5"
    }));
    largura_final_mm = String(nums[1] || nums[0]);
    altura_final_mm = String(nums[0]);
  }

  return {
    tipo,
    abas,
    dobras,
    largura_final_mm,
    altura_final_mm,
    numsIdentificados: nums,
    textoResumo: `${tipo}: ${abas.join(" × ")} mm (${dobras.length} dobras)`,
  };
}

/**
 * Busca se existe blank padronizado tabelado para o perfil e espessura
 */
export function getBlankPadraoAJL(nomeOuCodigo, espessuraMm) {
  if (!nomeOuCodigo || !espessuraMm) return null;
  const espNum = parseFloat(espessuraMm);
  const str = String(nomeOuCodigo).toUpperCase().replace(/\s+/g, "");

  for (const [perfil, blanks] of Object.entries(TABELA_BLANKS)) {
    const pLimpo = perfil.toUpperCase().replace("ENRRU.", "").replace(/\s+/g, "");
    // Verifica correspondência exata do padrão de medidas no nome
    if (str.includes(pLimpo)) {
      let melhorIdx = -1;
      let menorDiff = 999;
      ESP_COLS.forEach((e, idx) => {
        const diff = Math.abs(e - espNum);
        if (diff < menorDiff) {
          menorDiff = diff;
          melhorIdx = idx;
        }
      });

      if (melhorIdx >= 0) {
        return {
          perfil,
          blank: blanks[melhorIdx],
          espessuraTabelada: ESP_COLS[melhorIdx],
          isExato: menorDiff <= 0.05,
        };
      }
    }
  }
  return null;
}

/**
 * Calcula o Blank desenvolvido pela regra da AJL (sem Fator K).
 */
export function calcBlankDesenvolvidoAJL(abas, dobras, espessuraMm, nomePeca = "") {
  const esp = parseFloat(espessuraMm) || 0;
  if (!abas || abas.length === 0) return null;

  // 1. Tenta correspondência exata na tabela física AJL
  const padrao = getBlankPadraoAJL(nomePeca, esp);
  if (padrao && padrao.isExato) {
    return padrao.blank;
  }

  // 2. Se for perfil livre ou espessura intermediária:
  // Soma das abas externas - Dedução prática por dobra (2 x espessura para 90°)
  const somaAbas = abas.reduce((acc, a) => acc + (Number(a) || 0), 0);
  let totalDeducao = 0;

  if (dobras && dobras.length > 0) {
    for (const d of dobras) {
      totalDeducao += calcDeducaoDobraAJL(d.angulo || 90, esp);
    }
  } else if (abas.length > 1) {
    // Se não tem dobras informadas, assume que cada quina é 90°
    totalDeducao = (abas.length - 1) * (2 * esp);
  }

  const blank = Math.round(somaAbas - totalDeducao);
  return blank > 0 ? blank : somaAbas;
}

/**
 * Analisa o aproveitamento de um Blank específico em uma largura de chapa.
 */
export function analisarAproveitamentoChapa(larguraChapaMm, blankMm) {
  const larg = parseFloat(larguraChapaMm) || 0;
  const blank = parseFloat(blankMm) || 0;

  if (larg <= 0 || blank <= 0 || blank > larg) {
    return {
      qtdBlanks: 0,
      sobraMm: larg,
      aproveitamentoPerc: 0,
      classe: "C",
      cor: "rose",
      label: "Incompatível / Não cabe",
    };
  }

  const qtdBlanks = Math.floor(larg / blank);
  const sobraMm = larg - qtdBlanks * blank;
  const aproveitamentoPerc = Number(((qtdBlanks * blank) / larg * 100).toFixed(1));

  let classe = "B";
  let cor = "amber";
  let label = "Bom aproveitamento";

  if (aproveitamentoPerc >= 96.0) {
    classe = "A+";
    cor = "emerald";
    label = "Máximo Rendimento (Excelente)";
  } else if (aproveitamentoPerc >= 92.0) {
    classe = "A";
    cor = "green";
    label = "Ótimo Aproveitamento";
  } else if (aproveitamentoPerc < 85.0) {
    classe = "C";
    cor = "rose";
    label = "Aproveitamento Baixo (Sobra Alta)";
  }

  return {
    qtdBlanks,
    sobraMm,
    aproveitamentoPerc,
    classe,
    cor,
    label,
  };
}

/**
 * Analisa e ranqueia TODOS os 14 perfis da tabela AJL para a chapa selecionada.
 * Retorna do MAIOR aproveitamento para o MENOR.
 */
export function calcularRankingPerfisParaChapa(larguraChapaMm, espessuraMm) {
  const larg = parseFloat(larguraChapaMm) || 0;
  const esp = parseFloat(espessuraMm) || 2.0;
  if (larg <= 0) return [];

  // Encontra coluna mais próxima na tabela
  let colIdx = 1; // default 2.0mm
  let menorDiff = 999;
  ESP_COLS.forEach((e, idx) => {
    const diff = Math.abs(e - esp);
    if (diff < menorDiff) {
      menorDiff = diff;
      colIdx = idx;
    }
  });

  const resultados = [];

  for (const cat of PERFIS_CATALOGO_AJL) {
    const blanks = TABELA_BLANKS[cat.codigo];
    let blank = 0;

    if (blanks && blanks[colIdx]) {
      // Se a espessura for muito diferente das colunas tabeladas (ex: chapa 1.25), 
      // ajusta o blank pela dedução prática real
      if (menorDiff > 0.3) {
        blank = calcBlankDesenvolvidoAJL(cat.abasPadrao, cat.dobrasPadrao, esp, cat.nome);
      } else {
        blank = blanks[colIdx];
      }
    } else {
      blank = calcBlankDesenvolvidoAJL(cat.abasPadrao, cat.dobrasPadrao, esp, cat.nome);
    }

    if (blank && blank > 0 && blank <= larg) {
      const analise = analisarAproveitamentoChapa(larg, blank);
      resultados.push({
        perfil: cat.codigo,
        nome: cat.nome,
        tipo: cat.tipo,
        descricao: cat.descricao,
        abasPadrao: cat.abasPadrao,
        dobrasPadrao: cat.dobrasPadrao,
        blank,
        espessuraUsada: esp,
        ...analise,
      });
    }
  }

  // Ordena pelo maior aproveitamento % (e em caso de empate, menor sobra)
  resultados.sort((a, b) => {
    if (b.aproveitamentoPerc !== a.aproveitamentoPerc) {
      return b.aproveitamentoPerc - a.aproveitamentoPerc;
    }
    return a.sobraMm - b.sobraMm;
  });

  return resultados;
}
