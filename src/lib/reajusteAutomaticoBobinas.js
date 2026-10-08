// =====================================================================
// REAJUSTE AUTOMÁTICO DE BOBINAS CONFORME O PEDIDO DO ODOO
// Preenche automaticamente o texto da bobina nas máquinas
// e permite ao operador ajustar livremente como campo escrito.
// =====================================================================

import { base44 } from "@/api/base44Client";
import {
  detectarTipoProdutoTelha,
  detectarMaquinaTelha,
  detectarEspessura,
  detectarOrigemAco,
  getItens
} from "@/lib/pedidoOdooHelper";
import { detectarCoresDuplaTelha } from "@/lib/autoBobinaTelhasHelper";
import { isCorCompativel, isEspessuraCompatible, isOrigemCompatible } from "@/lib/bobinaValidation";

/**
 * Formata o rótulo escrito padronizado da bobina para exibição e gravação na OP.
 * Ex: "TE0212 0, 38 (GL (IMP)) - NATURAL · 5308.5kg"
 */
export function formatarRotuloBobinaEscrita(bobina, corPadrao = "NATURAL", espPadrao = "0.43") {
  if (!bobina) {
    return `${espPadrao}mm - ${corPadrao}`;
  }
  const cod = bobina.codigo_bobina || bobina.codigo || "";
  const esp = bobina.espessura != null ? `${bobina.espessura}`.replace(".", ",") : espPadrao;
  const qual = bobina.qualidade || (bobina.origem === "importado" ? "GL (IMP)" : "GL");
  const cor = bobina.cor || corPadrao;
  const peso = bobina.peso_kg ? ` · ${Number(bobina.peso_kg).toFixed(1)}kg` : "";

  if (bobina.descricao && bobina.descricao.length > 5) {
    return bobina.descricao;
  }
  return `${cod} ${esp} (${qual}) - ${cor}${peso}`.trim();
}

/**
 * Realiza a varredura e reajuste automático de todas as Ordens de Produção (OPs) nas máquinas.
 * Conecta cada OP ao seu respectivo Pedido Odoo e preenche o texto da bobina automaticamente.
 */
export async function reajustarTodasBobinasMaquinasAutomaticamente() {
  const relatorio = {
    totalAnalisadas: 0,
    totalReajustadas: 0,
    detalhes: []
  };

  try {
    // 1. Carrega todas as OPs ativas ou recentes, Pedidos Odoo e Catálogo de Bobinas
    const [todasOps, todosPedidosOdoo, todasBobinas] = await Promise.all([
      base44.entities.Pedido.list("-created_date", 500).catch(() => []),
      base44.entities.PedidoOdoo.list("-data_recebimento", 1000).catch(() => []),
      base44.entities.Bobina.filter({ arquivada: false }).catch(() => [])
    ]);

    relatorio.totalAnalisadas = todasOps.length;

    // Indexa Pedidos Odoo por número do pedido e OF
    const mapOdoo = new Map();
    todosPedidosOdoo.forEach(p => {
      if (!p) return;
      const numPuro = String(p.numero_pedido || "").replace(/^#/, "").trim().toUpperCase();
      if (numPuro) mapOdoo.set(numPuro, p);
      if (p.of_nome) mapOdoo.set(String(p.of_nome).trim().toUpperCase(), p);
      if (p.of_odoo_id) mapOdoo.set(String(p.of_odoo_id).trim().toUpperCase(), p);
    });

    for (const op of todasOps) {
      if (!op || !op.id) continue;
      // Foca nas OPs ativas ou pendentes nas máquinas
      if (op.status === "cancelado") continue;

      const numPuro = String(op.numero_pedido || "").replace(/^#/, "").trim().toUpperCase();
      const pedOdoo = mapOdoo.get(numPuro) || mapOdoo.get(String(op.of_nome || "").toUpperCase());

      const updates = {};
      const motivos = [];

      // Extrai itens e dados técnicos do Odoo
      const itens = pedOdoo ? getItens(pedOdoo) : [];
      const primeiroItem = itens[0] || {};
      const textoItem = `${op.item_produto || ""} ${op.observacoes || ""} ${primeiroItem.produto || ""} ${primeiroItem.descricao || ""} ${pedOdoo?.descricao || ""}`;

      const ehDuplaTelha = op.produto === "TELHA + EPS + TELHA" ||
        /(dupla|sanduiche|\+\s*telha)/i.test(textoItem);

      const cores = ehDuplaTelha
        ? detectarCoresDuplaTelha(op.item_produto || primeiroItem.produto || "", textoItem)
        : { corSuperior: op.cor_exigida || "NATURAL", corInferior: null };

      const espExigida = op.espessura_exigida || detectarEspessura(textoItem) || "0.43";
      const origemExigida = op.origem_exigida || detectarOrigemAco(textoItem) || "ambas";

      // ── MÁQUINA E MODELO DA OP (Ex: Pedido com descrição "MAQUINA TP 25" mas enviado por engano para TP - 40) ──
      const maqEsperada = detectarMaquinaTelha(textoItem);
      if (maqEsperada && (op.maquina !== maqEsperada || op.modelo !== maqEsperada)) {
        const maqAnterior = op.maquina || op.modelo;
        updates.maquina = maqEsperada;
        updates.modelo = maqEsperada;
        if (op.observacoes && op.observacoes.includes("Auto-Roteado PCP")) {
          updates.observacoes = op.observacoes.replace(/Auto-Roteado PCP \([^)]+\)/, `Auto-Roteado PCP (${maqEsperada})`);
        }
        motivos.push(`Máquina transferida de "${maqAnterior}" para "${maqEsperada}" conforme descrição do pedido Odoo`);
      }

      // ── BOBINA SUPERIOR (CHAPA PRINCIPAL) ──
      // Se não tem bobina_superior ou se for texto genérico
      const precisaReajustarSup = !op.bobina_superior || op.bobina_superior === "Bobina não definida";

      let bobinaSupEleita = null;
      if (precisaReajustarSup) {
        // Encontra a melhor bobina no estoque
        const compativeisSup = todasBobinas.filter(b => {
          if (b.arquivada) return false;
          const corOk = isCorCompativel(b.cor, cores.corSuperior);
          const espOk = isEspessuraCompatible(b.espessura, espExigida);
          return corOk && espOk;
        });

        compativeisSup.sort((a, b) => {
          const aAberta = (a.status === "em_uso" || a.status === "aberta") ? 0 : 1;
          const bAberta = (b.status === "em_uso" || b.status === "aberta") ? 0 : 1;
          return aAberta - bAberta;
        });

        bobinaSupEleita = compativeisSup[0] || todasBobinas.find(b => isCorCompativel(b.cor, cores.corSuperior));
        const rotuloSup = formatarRotuloBobinaEscrita(bobinaSupEleita, cores.corSuperior, espExigida);

        updates.bobina_superior = rotuloSup;
        if (bobinaSupEleita?.id) updates.bobina_superior_id = bobinaSupEleita.id;
        updates.rvm_superior = bobinaSupEleita?.cor || cores.corSuperior;
        motivos.push(`Bobina superior preenchida automaticamente do Odoo: "${rotuloSup}"`);
      }

      // ── BOBINA INFERIOR (CHAPA INTERNA EM TELHA DUPLA) ──
      if (ehDuplaTelha) {
        const corInferiorExigida = cores.corInferior || "NATURAL";
        const ehFaceInternaColorida = corInferiorExigida !== "NATURAL";

        // Verifica se a bobina inferior precisa ser corrigida:
        // Caso A: Está vazia
        // Caso B: A cor inferior exigida é colorida (ex: PRETO/BRANCO) mas a bobina atual é Natural ou igual à superior
        const bobinaInfAtualTexto = String(op.bobina_inferior || "");
        const precisaReajustarInf =
          !op.bobina_inferior ||
          op.bobina_inferior === "Mesma bobina superior" ||
          (ehFaceInternaColorida && (bobinaInfAtualTexto.includes("NATURAL") || op.bobina_inferior === op.bobina_superior));

        if (precisaReajustarInf) {
          const compativeisInf = todasBobinas.filter(b => {
            if (b.arquivada) return false;
            const corOk = isCorCompativel(b.cor, corInferiorExigida);
            return corOk;
          });

          // Prioriza bobinas já em uso
          compativeisInf.sort((a, b) => {
            const aAberta = (a.status === "em_uso" || a.status === "aberta") ? 0 : 1;
            const bAberta = (b.status === "em_uso" || b.status === "aberta") ? 0 : 1;
            return aAberta - bAberta;
          });

          // Caso especial do Pedido S01148: TE0217 Preta
          const bobinaEspecifica1148 = compativeisInf.find(b =>
            (b.codigo_bobina || b.codigo || "").toUpperCase().includes("TE0217") ||
            (b.descricao || "").toUpperCase().includes("TE0217")
          );

          const bobinaInfEleita = (numPuro.includes("1148") && bobinaEspecifica1148)
            ? bobinaEspecifica1148
            : compativeisInf[0];

          const rotuloInf = formatarRotuloBobinaEscrita(bobinaInfEleita, corInferiorExigida, "0.40");

          updates.bobina_inferior = rotuloInf;
          if (bobinaInfEleita?.id) updates.bobina_inferior_id = bobinaInfEleita.id;
          updates.rvm_inferior = bobinaInfEleita?.cor || corInferiorExigida;
          motivos.push(`Bobina inferior reajustada automaticamente: "${rotuloInf}" (Cor: ${corInferiorExigida})`);
        }
      }

      // Aplica as atualizações se houver
      if (Object.keys(updates).length > 0) {
        try {
          await base44.entities.Pedido.update(op.id, updates);
          relatorio.totalReajustadas++;
          relatorio.detalhes.push({
            opId: op.id,
            numero_pedido: op.numero_pedido || numPuro,
            cliente: op.cliente || pedOdoo?.cliente_nome,
            maquina: op.maquina,
            motivos
          });
        } catch (errUpd) {
          console.warn(`[ReajusteBobinas] Falha ao atualizar OP ${op.id}:`, errUpd);
        }
      }
    }
  } catch (err) {
    console.error("[ReajusteBobinas] Erro durante o reajuste automático:", err);
  }

  return relatorio;
}
