import { base44 } from "@/api/base44Client";
import { extrairEspecificacao } from "@/lib/descricaoExtractor";
import { getItens } from "@/lib/pedidoOdooHelper";

/**
 * Normaliza e corrige itens de Bobininha em memória e no banco de dados.
 * Transforma quantidades que vieram com metragem total (ex: 60) em:
 * - quantidade: 2 (peças / bobininhas)
 * - medida: 30000 (30m de cada bobininha)
 * - metragem_total: 60 (total linear do pedido)
 * - maquina: "DESBOBINADOR"
 */
export function corrigirItensBobininha(itens = [], pedido = null) {
  let alterado = false;
  if (!Array.isArray(itens) || itens.length === 0) return { alterado: false, itens };

  const itensCorrigidos = itens.map((it) => {
    const prod = String(it.produto || "").trim();
    const desc = String(it.descricao || it.observacao || "").trim();
    const textoCompleto = `${prod} ${desc}`.trim();

    const isChapaOuPerfil = /(chapa|perfil|dobra|guilhotina|cartola|cantoneira|batente|tampa|telha|cumeeira|painel)/i.test(textoCompleto);
    if (isChapaOuPerfil) return it;

    const isBobininha = /(bobininha|bobinina|slitter|corte\s*longitudinal|fita\s*de\s*a[cç]o|fitas\s*de\s*a[cç]o|desbobinamento|desbobinador)/i.test(textoCompleto);
    if (!isBobininha) return it;

    const espTec = extrairEspecificacao(textoCompleto, it.quantidade, it.unidade);
    if (espTec && espTec.tipo_conformacao === "bobininha" && espTec.pecas > 0) {
      const qNova = espTec.pecas;
      const compMmNovo = String(espTec.comprimento_mm || 30000);
      const totalMNovo = espTec.metragem_total || (qNova * (espTec.comprimento_m || 30));

      const precisaAjuste =
        Number(it.quantidade) !== qNova ||
        String(it.medida || "").replace(/\D+/g, "") !== compMmNovo.replace(/\D+/g, "") ||
        Number(it.metragem_total || 0) !== totalMNovo;

      if (precisaAjuste) {
        alterado = true;
        return {
          ...it,
          quantidade: qNova,
          medida: compMmNovo,
          metragem_total: totalMNovo,
          unidade: "UN",
          maquina: "DESBOBINADOR"
        };
      }
    }

    return it;
  });

  return { alterado, itensCorrigidos };
}

/**
 * Varre pedidos do Odoo e OPs de produção na fábrica para reparar
 * qualquer ordem de bobininha com metragem multiplicada incorretamente.
 */
export async function executarReparoBobininhasBanco(pedidosOdoo = [], pedidosProducao = []) {
  try {
    const peds = Array.isArray(pedidosOdoo) ? pedidosOdoo : [];
    for (const ped of peds) {
      if (!ped || !ped.id) continue;
      const itens = getItens(ped);
      const { alterado, itensCorrigidos } = corrigirItensBobininha(itens, ped);

      if (alterado) {
        console.log(`[ReparoBobininhas] Corrigindo PedidoOdoo #${ped.numero_pedido} (${ped.of_nome || ped.id}) no banco...`);
        const jsonLimpo = JSON.stringify(itensCorrigidos.map(({ _idx, ...rest }) => rest));
        await base44.entities.PedidoOdoo.update(ped.id, {
          itens_json: jsonLimpo
        }).catch((err) => console.warn(`[ReparoBobininhas] Falha ao atualizar PedidoOdoo ${ped.id}:`, err));
      }
    }

    // Repara OPs filhas em Pedido (Telhas / Desbobinador)
    const ops = Array.isArray(pedidosProducao) ? pedidosProducao : [];
    for (const op of ops) {
      if (!op || !op.id) continue;
      const ehTelha = op.produto === "TELHA" || String(op.produto || "").toUpperCase().startsWith("TELHA") || op.produto === "CUMEEIRA";
      const isBobinaOp = !ehTelha && (op.produto === "BOBININHA" || op.maquina === "DESBOBINADOR" || /(bobininha|desbobinador|slitter|corte\s*longitudinal)/i.test(String(op.modelo || op.produto_rotulo_pcp || "")));
      if (!isBobinaOp) continue;

      // Se a OP foi gerada com metros > 10 (ex: 60) e metragem_mm >= 10.000 (ex: 30000), resultando em quantidade_telhas absurda (ex: 1800m)
      const metros = Number(op.metros || 0);
      const metragemMm = Number(op.metragem_mm || 0);
      const qtdTelhasLinear = Number(op.quantidade_telhas || op.metragem_planejada || 0);

      // Cenário de erro: 12 pçs x 12.000mm = 144m (ou metros > 1 onde a metragem planejada é metros * (metragem_mm/1000))
      // e o pedido original não tem observação de múltiplos rolos
      const textoObs = String(op.observacoes || op.observacoes_odoo || op.item_produto || "");
      const temMultiplosRolos = /\b(\d{1,2})\s*(?:x|\*|de|bobininhas?|rolos?)\s*(\d+)/i.test(textoObs);

      // Se multiplicou a quantidade de metros por ela mesma (ex: 12 pçs x 12m = 144m) sem ter múltiplos rolos
      const precisaReparo = (!temMultiplosRolos && metros > 1 && metragemMm > 0 && Math.abs(qtdTelhasLinear - (metros * (metragemMm / 1000))) < 0.1) ||
                            (metros > 10 && metragemMm >= 10000 && qtdTelhasLinear >= 100);

      if (precisaReparo) {
        // A metragem real do pedido é a metragem individual (ex: 12m)
        const metrosReal = Math.round(metragemMm / 1000) || metros;
        const compMmReal = metrosReal * 1000;
        const espNum = parseFloat(String(op.espessura_exigida || "0.43").replace(",", ".")) || 0.43;
        const pesoCorretoKg = Math.round(metrosReal * (espNum * 7.85 * 1.2));

        const novasVars = [{
          qty: 1,
          mm: compMmReal,
          m: metrosReal,
          total_m: metrosReal,
          largura_mm: 1200,
          corte: "1200",
          tipo: "bobininha"
        }];

        console.log(`[ReparoBobininhas] Corrigindo OP #${op.numero_pedido} (ID ${op.id}): metros ${metros} -> 1, total ${qtdTelhasLinear}m -> ${metrosReal}m, Corte 1200`);
        await base44.entities.Pedido.update(op.id, {
          metros: 1,
          quantidade_telhas: 1,
          metragem_mm: compMmReal,
          metragem_planejada: metrosReal,
          kg_total: pesoCorretoKg,
          variacoes_telhas: JSON.stringify(novasVars)
        }).catch((err) => console.warn(`[ReparoBobininhas] Falha ao atualizar Pedido ${op.id}:`, err));
      }
    }
  } catch (error) {
    console.warn("[ReparoBobininhas] Erro durante rotina de reparo:", error);
  }
}
