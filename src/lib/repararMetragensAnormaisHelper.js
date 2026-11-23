import { base44 } from "@/api/base44Client";
import { sanitizarMetrosAnormais, calcKgDeMetros } from "@/lib/metrosHelper";

/**
 * 🛡️ AUTO-CORREÇÃO SILENCIOSA DE METRAGENS ANORMAIS
 * 
 * Varre ordens finalizadas de telhas, detecta discrepâncias matemáticas
 * (metros ao quadrado, cumeeiras com 60m, telhas com 69m por erro de escala de float)
 * e persiste a retificação definitiva no banco de dados.
 */
export async function executarAutoReparoMetragens(ordens = []) {
  if (!Array.isArray(ordens) || ordens.length === 0) return 0;

  let corrigidas = 0;

  for (const o of ordens) {
    if (!o || !o.id) continue;

    // Se já foi retificado explicitamente por um operador/gestor, respeita a decisão
    if (o.retificado_manualmente || Number(o.metros_retificados) > 0) continue;

    const metrosSugeridos = sanitizarMetrosAnormais(o);
    if (metrosSugeridos !== null && metrosSugeridos >= 0) {
      const novosMetros = Number(metrosSugeridos.toFixed(2));
      const mmAtual = Number(o.metragem_mm) || 0;
      let compMmNovo = mmAtual;

      // Corrige escala de mm se tinha zero extra
      const prodStr = String(o.produto || o.modelo || "").toUpperCase();
      if ((prodStr.includes("CUMEEIRA") || o.maquina === "CUMEEIRA") && mmAtual >= 10000) {
        compMmNovo = 1000;
      } else if (mmAtual >= 15000 && mmAtual % 10 === 0 && (mmAtual / 10) <= 14000) {
        compMmNovo = mmAtual / 10;
      }

      // Calcula peças coerentes com a metragem real
      let pecasNovas = Number(o.quantidade) || Number(o.metros) || 1;
      if (compMmNovo > 0) {
        pecasNovas = Math.max(1, Math.round(novosMetros / (compMmNovo / 1000)));
      }

      const espessura = parseFloat(o.espessura || o.chapa) || 0.43;
      const novoKg = Number(calcKgDeMetros(novosMetros, espessura).toFixed(1));

      const payload = {
        metros_retificados: novosMetros,
        metros_totais: novosMetros,
        metros: pecasNovas,
        quantidade: pecasNovas,
        quantidade_telhas: novosMetros,
        metragem_mm: compMmNovo,
        kg_total: novoKg,
        peso_kg: novoKg,
        retificado_manualmente: true,
        variacoes_telhas: JSON.stringify([{
          qty: pecasNovas,
          mm: compMmNovo,
          m: +(compMmNovo / 1000).toFixed(3),
          total_m: novosMetros,
        }]),
      };

      try {
        await base44.entities.Pedido.update(o.id, payload);
        corrigidas++;
        console.log(`[AutoReparoMetragens] Ordem #${o.numero_pedido || o.id} corrigida para ${novosMetros}m (${pecasNovas} pçs x ${compMmNovo}mm).`);
      } catch (err) {
        console.warn(`[AutoReparoMetragens] Falha ao atualizar ordem ${o.id}:`, err);
      }
    }
  }

  return corrigidas;
}
