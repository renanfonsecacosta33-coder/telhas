/**
 * Algoritmo de Otimização de Corte 2D
 * Implementa Guillotine Cut com First Fit Decreasing
 * Similar ao CutList Optimizer
 */

/**
 * Expande peças com quantidade > 1 em peças individuais
 */
function expandirPecas(pecas, kerf = 0) {
  const resultado = [];
  pecas.forEach((p, idx) => {
    const qtd = parseInt(p.quantidade) || 1;
    for (let i = 0; i < qtd; i++) {
      resultado.push({
        id: `${p.id}_${i}`,
        nome: p.nome,
        comp: parseFloat(p.comprimento) + (i === 0 ? 0 : 0), // kerf aplicado no posicionamento
        larg: parseFloat(p.largura),
        corIdx: idx,
        original_id: p.id,
        pecaIdx: idx,
      });
    }
  });
  return resultado;
}

/**
 * Nó da árvore de espaços livres (algoritmo Guillotine)
 * Cada nó representa um retângulo livre na chapa
 */
class GuilhotineNode {
  constructor(x, y, w, h) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
  }
}

/**
 * Tenta inserir uma peça em um nó usando corte guilhotina
 * Retorna { x, y, rotacionado, noSobrantes } ou null
 */
function inserirEmNo(nos, comp_peca, larg_peca, kerf, permitirRotacao = true) {
  // Tenta orientação normal e rotacionada
  const orientacoes = [
    { c: comp_peca, l: larg_peca, rotacionado: false },
    ...(permitirRotacao && comp_peca !== larg_peca
      ? [{ c: larg_peca, l: comp_peca, rotacionado: true }]
      : []),
  ];

  let melhorFit = null;

  for (let ni = 0; ni < nos.length; ni++) {
    const no = nos[ni];
    for (const ori of orientacoes) {
      const c_k = ori.c + kerf;
      const l_k = ori.l + kerf;
      if (c_k <= no.w + kerf && l_k <= no.h + kerf) {
        const sobra = (no.w - ori.c) * no.h + (no.h - ori.l) * ori.c;
        if (!melhorFit || sobra < melhorFit.sobra) {
          melhorFit = { ni, x: no.x, y: no.y, c: ori.c, l: ori.l, rotacionado: ori.rotacionado, sobra };
        }
      }
    }
  }

  if (!melhorFit) return null;

  const no = nos[melhorFit.ni];
  const { x, y, c, l } = melhorFit;

  // Remove o nó usado e adiciona dois novos (divisão guilhotina)
  nos.splice(melhorFit.ni, 1);

  const sobra_dir_w = no.w - c - kerf;
  const sobra_bx_h = no.h - l - kerf;

  // Divisão horizontal-first (mais estável)
  if (sobra_dir_w > 0) {
    nos.push(new GuilhotineNode(x + c + kerf, y, sobra_dir_w, no.h));
  }
  if (sobra_bx_h > 0) {
    nos.push(new GuilhotineNode(x, y + l + kerf, c, sobra_bx_h));
  }

  return { x, y, rotacionado: melhorFit.rotacionado, c, l };
}

/**
 * Otimiza o corte de múltiplas peças em chapas disponíveis
 * @param {Array} pecas - lista de peças { id, nome, comprimento, largura, quantidade }
 * @param {Array} chapas - lista de chapas { id, nome, comprimento, largura, quantidade }
 * @param {Object} opcoes - { kerf: number, permitirRotacao: boolean }
 * @returns {Object} resultado da otimização
 */
export function otimizarCorte(pecas, chapas, opcoes = {}) {
  const { kerf = 0, permitirRotacao = true } = opcoes;

  // Validação básica
  const pecasValidas = pecas.filter(p =>
    parseFloat(p.comprimento) > 0 && parseFloat(p.largura) > 0 && parseInt(p.quantidade) > 0
  );
  const chapasValidas = chapas.filter(c =>
    parseFloat(c.comprimento) > 0 && parseFloat(c.largura) > 0 && parseInt(c.quantidade) > 0
  );

  if (!pecasValidas.length || !chapasValidas.length) {
    return { chapasUsadas: [], naoCouberam: [], stats: null };
  }

  // Expande chapas disponíveis
  const chapasDisp = [];
  chapasValidas.forEach(c => {
    const qtd = parseInt(c.quantidade) || 1;
    for (let i = 0; i < Math.min(qtd, 20); i++) {
      chapasDisp.push({ ...c, instancia: i });
    }
  });

  // Expande peças (com quantidade) e ordena por área decrescente (FFD)
  let pecasExp = expandirPecas(pecasValidas, kerf);
  pecasExp.sort((a, b) => (b.comp * b.larg) - (a.comp * a.larg));

  // Resultado por chapa
  const chapasUsadas = [];
  const naoCouberam = [];

  // Índice de uso de chapas
  let chapaIdx = 0;

  // Processa cada peça
  const pecasRestantes = [...pecasExp];

  while (pecasRestantes.length > 0 && chapaIdx < chapasDisp.length) {
    const chapa = chapasDisp[chapaIdx];
    const comp_chapa = parseFloat(chapa.comprimento);
    const larg_chapa = parseFloat(chapa.largura);

    const nosLivres = [new GuilhotineNode(0, 0, comp_chapa, larg_chapa)];
    const pecasNaChapa = [];
    const naoEncaixaram = [];

    for (const peca of pecasRestantes) {
      const resultado = inserirEmNo(nosLivres, peca.comp, peca.larg, kerf, permitirRotacao);
      if (resultado) {
        pecasNaChapa.push({
          ...peca,
          x: resultado.x,
          y: resultado.y,
          w: resultado.c,
          h: resultado.l,
          rotacionado: resultado.rotacionado,
        });
      } else {
        naoEncaixaram.push(peca);
      }
    }

    if (pecasNaChapa.length > 0) {
      // Calcula área usada
      const area_total = comp_chapa * larg_chapa;
      const area_usada = pecasNaChapa.reduce((s, p) => s + p.w * p.h, 0);
      const aproveitamento = area_total > 0 ? (area_usada / area_total) * 100 : 0;

      chapasUsadas.push({
        chapa: { ...chapa },
        pecas: pecasNaChapa,
        area_total,
        area_usada,
        area_desperdicada: area_total - area_usada,
        aproveitamento: aproveitamento.toFixed(1),
        n_cortes: estimarCortes(pecasNaChapa),
      });
    }

    // Atualiza pecas restantes
    pecasRestantes.length = 0;
    pecasRestantes.push(...naoEncaixaram);
    chapaIdx++;
  }

  // Peças que não couberam em nenhuma chapa
  naoCouberam.push(...pecasRestantes);

  // Stats globais
  const area_total_global = chapasUsadas.reduce((s, c) => s + c.area_total, 0);
  const area_usada_global = chapasUsadas.reduce((s, c) => s + c.area_usada, 0);
  const total_cortes = chapasUsadas.reduce((s, c) => s + c.n_cortes, 0);

  const stats = {
    chapas_usadas: chapasUsadas.length,
    total_pecas: pecasExp.length,
    pecas_encaixadas: pecasExp.length - naoCouberam.length,
    nao_couberam: naoCouberam.length,
    area_total_mm2: area_total_global,
    area_usada_mm2: area_usada_global,
    area_desperdicada_mm2: area_total_global - area_usada_global,
    aproveitamento_geral: area_total_global > 0
      ? ((area_usada_global / area_total_global) * 100).toFixed(1)
      : "0.0",
    total_cortes,
  };

  return { chapasUsadas, naoCouberam, stats };
}

function estimarCortes(pecas) {
  // Estimativa simples: cada peça gera ~2 cortes (guilhotina)
  return pecas.length * 2;
}