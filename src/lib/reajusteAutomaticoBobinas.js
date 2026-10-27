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
import {
  extrairRotuloBobinaSimplificado,
  extrairRotuloFaceInferior,
  ehRotuloAntigoEstoque,
  extrairCorFace
} from "@/lib/bobinaRotuloHelper";

/**
 * Formata o rótulo escrito padronizado da bobina para exibição e gravação na OP.
 * Retorna texto 100% limpo conforme especificação fabril (ex: "NACIONAL", "IMPORTADA", "BRANCA", "GRAFITE").
 */
export function formatarRotuloBobinaEscrita(bobina, corPadrao = "NATURAL", espPadrao = "0.43", textoOrigem = "") {
  if (textoOrigem) {
    return extrairRotuloBobinaSimplificado(textoOrigem);
  }
  const cor = bobina?.cor ? extrairCorFace(bobina.cor) : null;
  if (cor) return cor;
  if (bobina?.origem === "importado" || bobina?.origem === "importada") return "IMPORTADA";
  if (bobina?.origem === "nacional") return "NACIONAL";
  return corPadrao || "NACIONAL";
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

      const ehDuplaTelha = op.produto === "TELHA + EPS + TELHA" || op.produto === "TELHA BANDEJA" ||
        /(dupla|sanduiche|\+\s*telha|telha\s*bandeja)/i.test(textoItem);

      const cores = ehDuplaTelha
        ? detectarCoresDuplaTelha(op.item_produto || primeiroItem.produto || "", textoItem)
        : { corSuperior: op.cor_exigida || "NATURAL", corInferior: null };

      const espExigida = op.espessura_exigida || detectarEspessura(textoItem) || "0.43";
      const origemExigida = op.origem_exigida || detectarOrigemAco(textoItem) || "ambas";

      // ── MÁQUINA E MODELO DA OP (Ex: Pedido com descrição "MAQUINA TP 25" mas enviado para TP - 40, ou TELHA BANDEJA que deve iniciar na TP - 40) ──
      const ehTelhaBandeja = op.produto === "TELHA BANDEJA" || /(telha\s*(\+|\/|\s+)?\s*bandeja)/i.test(textoItem);
      const jaPerfilouPrimeiraEtapa = Boolean(
        op.etapa_anterior_concluida ||
        op.data_perfilacao ||
        (ehTelhaBandeja && op.maquina === "BANDEJA" && op.maquina_origem && op.maquina_origem !== "BANDEJA")
      );

      const ehBobininha = /(BOBININHA|BOBININHAS|BOBININA|SLITTER|CORTE\s*LONGITUDINAL|FITA\s*DE\s*A[CÇ]O|FITAS\s*DE\s*A[CÇ]O|DESBOBINAMENTO)/i.test(textoItem) || op.produto === "BOBININHA";
      const ehTelha = !ehBobininha && (op.produto === "TELHA" || String(op.produto || "").toUpperCase().startsWith("TELHA"));
      const estaNoDesbobinadorErroneamente = (op.maquina === "DESBOBINADOR" || op.modelo === "DESBOBINADOR") && ehTelha;

      const maqEsperada = ehBobininha
        ? "DESBOBINADOR"
        : (detectarMaquinaTelha(textoItem) || (ehTelha ? "TP - 40" : ""));

      if (ehBobininha && op.produto !== "BOBININHA") {
        updates.produto = "BOBININHA";
      }

      if (maqEsperada && (op.maquina !== maqEsperada || op.modelo !== maqEsperada) && (!jaPerfilouPrimeiraEtapa || estaNoDesbobinadorErroneamente || ehBobininha)) {
        const maqAnterior = op.maquina || op.modelo;
        updates.maquina = maqEsperada;
        updates.modelo = maqEsperada;
        if (!op.maquina_origem || op.maquina_origem === "DESBOBINADOR" || ehBobininha) {
          updates.maquina_origem = maqEsperada;
        }
        if (op.observacoes && op.observacoes.includes("Auto-Roteado PCP")) {
          updates.observacoes = op.observacoes.replace(/Auto-Roteado PCP \([^)]+\)/, `Auto-Roteado PCP (${maqEsperada})`);
        }
        motivos.push(
          ehBobininha
            ? `Item de bobininha/slitter direcionado para o DESBOBINADOR`
            : estaNoDesbobinadorErroneamente
            ? `Telha simples estava indevidamente no DESBOBINADOR -> Transferida para perfiladeira "${maqEsperada}"`
            : `Máquina transferida de "${maqAnterior}" para "${maqEsperada}" conforme fluxo correto`
        );
      }

      // ── BOBINA SUPERIOR (CHAPA PRINCIPAL) ──
      // Se não tem bobina_superior ou se for formato antigo de estoque físico (ex: "CD0247 0,43 (GV)...")
      // respeita ajuste manual salvo pelo operador
      const rotuloAtualSup = String(op.bobina_superior || "").trim();
      const precisaReajustarSup = !op.bobina_superior_manual && (
        !rotuloAtualSup ||
        rotuloAtualSup === "Bobina não definida" ||
        ehRotuloAntigoEstoque(rotuloAtualSup)
      );

      let bobinaSupEleita = null;
      if (precisaReajustarSup) {
        // Encontra a melhor bobina no estoque para manter o vínculo interno de ID
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

        // RÓTULO SIMPLIFICADO DIRETO DO PEDIDO: "NACIONAL", "IMPORTADA", "BRANCA", "PRETA SUPERIOR NACIONAL INFERIOR", ETC.
        const rotuloSup = extrairRotuloBobinaSimplificado(textoItem, ehDuplaTelha);

        updates.bobina_superior = rotuloSup;
        if (bobinaSupEleita?.id) updates.bobina_superior_id = bobinaSupEleita.id;
        updates.rvm_superior = bobinaSupEleita?.cor || cores.corSuperior;
        motivos.push(`Bobina superior simplificada: "${rotuloSup}"`);
      }

      // ── BOBINA INFERIOR (CHAPA INTERNA EM TELHA DUPLA) ──
      if (ehDuplaTelha) {
        const corInferiorExigida = cores.corInferior || "NATURAL";
        const rotuloAtualInf = String(op.bobina_inferior || "").trim();

        // Verifica se a bobina inferior precisa ser corrigida (respeita ajuste manual do operador)
        const precisaReajustarInf =
          !op.bobina_inferior_manual && (
            !rotuloAtualInf ||
            rotuloAtualInf === "Mesma bobina superior" ||
            ehRotuloAntigoEstoque(rotuloAtualInf)
          );

        if (precisaReajustarInf) {
          const compativeisInf = todasBobinas.filter(b => {
            if (b.arquivada) return false;
            return isCorCompativel(b.cor, corInferiorExigida);
          });

          compativeisInf.sort((a, b) => {
            const aAberta = (a.status === "em_uso" || a.status === "aberta") ? 0 : 1;
            const bAberta = (b.status === "em_uso" || b.status === "aberta") ? 0 : 1;
            return aAberta - bAberta;
          });

          const bobinaInfEleita = compativeisInf[0];
          const rotuloInf = extrairRotuloFaceInferior(textoItem, corInferiorExigida);

          updates.bobina_inferior = rotuloInf;
          if (bobinaInfEleita?.id) updates.bobina_inferior_id = bobinaInfEleita.id;
          updates.rvm_inferior = bobinaInfEleita?.cor || corInferiorExigida;
          motivos.push(`Bobina inferior simplificada: "${rotuloInf}"`);
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