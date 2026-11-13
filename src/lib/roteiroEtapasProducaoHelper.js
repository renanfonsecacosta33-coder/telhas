import { base44 } from "@/api/base44Client";
import { isTelhaBandeja } from "@/lib/bandejaHelper";
import { normalizarNumeroPedido } from "@/lib/conciliacaoPcpMaquinasHelper";
import { toast } from "sonner";

/**
 * Normaliza textos e modelos para comparação precisa
 */
function normalizarTexto(txt) {
  return String(txt || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Monta o roteiro inteligente padrão de etapas para um pedido ou item específico
 */
export function identificarRoteiroDoPedido(pedido, item = null) {
  if (!pedido) return [];

  const prod = normalizarTexto(item?.produto || pedido.produto || "");
  const mod = normalizarTexto(item?.modelo || pedido.modelo || item?.item_produto || pedido.item_produto || "");
  const obs = normalizarTexto(item?.observacoes || pedido.observacoes_odoo || pedido.observacoes || "");
  const textoCompleto = `${prod} ${mod} ${obs}`;

  // Se já tiver etapas salvas anteriormente no pedido ou no item:
  if (pedido.etapas_concluidas_json) {
    try {
      const salvas = JSON.parse(pedido.etapas_concluidas_json);
      if (Array.isArray(salvas) && salvas.length > 0) {
        return salvas;
      }
    } catch {}
  }

  const etapas = [];
  const maquinaBaseTelha = pedido.maquina && pedido.maquina !== "BANDEJA" && pedido.maquina !== "COLAGEM"
    ? pedido.maquina
    : "TP - 40";

  // ─────────────────────────────────────────────────────────────
  // 1. CASO: TELHA BANDEJA (TP-40 / Colonial ➔ BANDEJA ➔ COLAGEM)
  // ─────────────────────────────────────────────────────────────
  if (isTelhaBandeja(pedido) || isTelhaBandeja(item) || textoCompleto.includes("bandeja")) {
    etapas.push({
      id: "telha_superior",
      ordem: 1,
      nome: `1. Perfiladeira Telha (${maquinaBaseTelha})`,
      maquina: maquinaBaseTelha,
      setor: "telha",
      descricao: "Perfilação da chapa superior da telha",
      concluida: Boolean(pedido.perfilacao_concluida || pedido.status === "aguardando_colagem" || pedido.maquina === "BANDEJA" || pedido.maquina === "COLAGEM")
    });

    etapas.push({
      id: "bandeja_inferior",
      ordem: 2,
      nome: "2. Perfiladeira Bandeja (BANDEJA)",
      maquina: "BANDEJA",
      setor: "telha",
      descricao: "Perfilação da bandeja inferior de aço",
      concluida: Boolean(pedido.status === "aguardando_colagem" || pedido.maquina === "COLAGEM")
    });

    etapas.push({
      id: "colagem_final",
      ordem: 3,
      nome: "3. Colagem Final (COLAGEM)",
      maquina: "COLAGEM",
      setor: "telha",
      descricao: "Injeção de EPS/PU, cola e prensagem final",
      concluida: Boolean(pedido.status === "finalizado" || pedido.status_pcp === "concluido" || pedido.percentual_concluido >= 100)
    });

    return etapas;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CASO: TELHA SANDUÍCHE CONVENCIONAL (TP-40 / TP-25 ➔ COLAGEM)
  // ─────────────────────────────────────────────────────────────
  const isSanduiche =
    Boolean(pedido.eps) ||
    /\b(eps|isopor|sanduiche|sanduíche|manta|termoacustica|termoacústica|semi[- ]?sanduiche)\b/i.test(textoCompleto);

  if (isSanduiche) {
    etapas.push({
      id: "perfilacao_telha",
      ordem: 1,
      nome: `1. Perfiladeira Telha (${maquinaBaseTelha})`,
      maquina: maquinaBaseTelha,
      setor: "telha",
      descricao: "Perfilação das telhas de aço",
      concluida: Boolean(pedido.perfilacao_concluida || pedido.status === "aguardando_colagem" || pedido.maquina === "COLAGEM")
    });

    etapas.push({
      id: "colagem_final",
      ordem: 2,
      nome: "2. Colagem Final (COLAGEM)",
      maquina: "COLAGEM",
      setor: "telha",
      descricao: "Injeção de EPS e colagem final do sanduíche",
      concluida: Boolean(pedido.status === "finalizado" || pedido.status_pcp === "concluido" || pedido.percentual_concluido >= 100)
    });

    return etapas;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CASO: CORTE E DOBRA (Desbobinadeira ➔ Guilhotina ➔ Dobradeira)
  // ─────────────────────────────────────────────────────────────
  const isCD =
    pedido.setor === "corte_dobra" ||
    pedido.setor === "cd" ||
    /\b(dobra|dobradeira|guilhotina|desbobinadeira|chapa|perfil dobrado|rufo|calha)\b/i.test(textoCompleto);

  if (isCD) {
    const precisaDobra = /\b(dobra|dobradeira|perfil dobrado|rufo|calha|pingadeira|cantoneira|u enrijecido)\b/i.test(textoCompleto);
    const precisaGuilhotina = precisaDobra || /\b(guilhotina|corte|blank|chapa cortada)\b/i.test(textoCompleto);

    etapas.push({
      id: "cd_desbobinadeira",
      ordem: 1,
      nome: "1. Desbobinadeira (DESBOBINADEIRA 01)",
      maquina: "DESBOBINADEIRA 01",
      setor: "cd",
      descricao: "Avanço e corte inicial da chapa na bobina",
      concluida: false
    });

    if (precisaGuilhotina) {
      etapas.push({
        id: "cd_guilhotina",
        ordem: 2,
        nome: "2. Corte na Guilhotina (GUILHOTINA 3M / 6M)",
        maquina: "GUILHOTINA 3M",
        setor: "cd",
        descricao: "Corte das peças no esquadro conforme croqui",
        concluida: false
      });
    }

    if (precisaDobra) {
      etapas.push({
        id: "cd_dobradeira",
        ordem: etapas.length + 1,
        nome: "3. Conformação na Dobradeira (DOBRADEIRA 3M / 6M)",
        maquina: "DOBRADEIRA 3M",
        setor: "cd",
        descricao: "Dobra dos perfis conforme ângulos do croqui",
        concluida: false
      });
    }

    return etapas;
  }

  // ─────────────────────────────────────────────────────────────
  // 4. CASO: TELHA SIMPLES PURA (Apenas 1 etapa na Perfiladeira)
  // ─────────────────────────────────────────────────────────────
  etapas.push({
    id: "perfilacao_telha_simples",
    ordem: 1,
    nome: `1. Perfiladeira Telha (${maquinaBaseTelha})`,
    maquina: maquinaBaseTelha,
    setor: "telha",
    descricao: "Perfilação e corte no comprimento das telhas simples",
    concluida: Boolean(pedido.status === "finalizado" || pedido.status_pcp === "concluido" || pedido.percentual_concluido >= 100)
  });

  return etapas;
}

/**
 * Processa a conclusão de etapas selecionadas:
 * - Se concluiu todas: fecha o pedido em 100%.
 * - Se concluiu etapas intermediárias: move a OP para a próxima máquina (ex: Colagem) e calcula o percentual.
 */
export async function processarConclusaoEtapas({
  pedido,
  item = null,
  etapas = [],
  usuario = "PCP",
  queryClient
}) {
  if (!pedido || !etapas || etapas.length === 0) {
    return { sucesso: false, erro: "Dados insuficientes para concluir etapas." };
  }

  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    const numPed = normalizarNumeroPedido(pedido.numero_pedido);

    const totalEtapas = etapas.length;
    const etapasConcluidas = etapas.filter(e => e.concluida);
    const totalConcluidas = etapasConcluidas.length;
    const todasConcluidas = totalConcluidas === totalEtapas;

    // Próxima etapa pendente (se houver)
    const proximaEtapa = etapas.find(e => !e.concluida);

    // Percentual calculado
    const novoPercentual = todasConcluidas
      ? 100
      : Math.max(10, Math.min(95, Math.round((totalConcluidas / totalEtapas) * 100)));

    // ─────────────────────────────────────────────────────────────
    // CASO A: TODAS AS ETAPAS FORAM CONCLUÍDAS (100% FINALIZADO)
    // ─────────────────────────────────────────────────────────────
    if (todasConcluidas) {
      await base44.entities.PedidoOdoo.update(pedido.id, {
        status_pcp: "concluido",
        percentual_concluido: 100,
        onde_esta: "Expedição / Concluído",
        data_conclusao: todayIso,
        etapas_concluidas_json: JSON.stringify(etapas)
      });

      // Finaliza OPs locais em todas as máquinas
      const [opsTelhas, opsCD] = await Promise.all([
        base44.entities.Pedido.filter({ numero_pedido: pedido.numero_pedido }),
        base44.entities.OrdemMaquinaCD.filter({ numero_pedido: pedido.numero_pedido })
      ]);

      for (const op of (opsTelhas || [])) {
        if (op.status !== "finalizado" && op.status !== "cancelado") {
          await base44.entities.Pedido.update(op.id, {
            status: "finalizado",
            data_finalizacao: todayIso,
            operador_finalizacao: usuario
          });
        }
      }

      for (const op of (opsCD || [])) {
        if (op.status !== "finalizado" && op.status !== "cancelado") {
          await base44.entities.OrdemMaquinaCD.update(op.id, {
            status: "finalizado",
            data_finalizacao: todayIso,
            operador: usuario
          });
        }
      }

      toast.success(`🎉 Pedido #${pedido.numero_pedido} concluído com sucesso em 100%!`);
    }

    // ─────────────────────────────────────────────────────────────
    // CASO B: ETAPA INTERMEDIÁRIA (Ex: Telha e Bandeja feitas ➔ vai para a COLAGEM)
    // ─────────────────────────────────────────────────────────────
    else if (proximaEtapa) {
      const maquinaDestino = proximaEtapa.maquina;
      const statusPcpNovo = "em_producao";
      const statusOpNovo = maquinaDestino === "COLAGEM" ? "aguardando_colagem" : "pendente";
      const ondeEstaNovo = `Fila da ${maquinaDestino} (Galpão)`;

      // Atualiza o PedidoOdoo
      await base44.entities.PedidoOdoo.update(pedido.id, {
        maquina: maquinaDestino,
        status_pcp: statusPcpNovo,
        status: statusOpNovo,
        onde_esta: ondeEstaNovo,
        percentual_concluido: novoPercentual,
        perfilacao_concluida: true,
        bloqueado_colagem: false,
        etapas_concluidas_json: JSON.stringify(etapas)
      });

      // Atualiza as OPs no chão de fábrica:
      // Se estamos movendo para a COLAGEM (Telha e/ou Bandeja finalizadas):
      const opsTelhas = await base44.entities.Pedido.filter({ numero_pedido: pedido.numero_pedido });

      if (opsTelhas && opsTelhas.length > 0) {
        for (const op of opsTelhas) {
          // Se for a OP principal de Telha Bandeja ou Colagem:
          if (maquinaDestino === "COLAGEM") {
            await base44.entities.Pedido.update(op.id, {
              maquina: "COLAGEM",
              status: "aguardando_colagem",
              bloqueado_colagem: false,
              perfilacao_concluida: true,
              data_perfilacao: todayIso,
              operador_perfilacao: usuario
            });
          } else {
            // Mover para outra máquina intermediária (ex: BANDEJA)
            await base44.entities.Pedido.update(op.id, {
              maquina: maquinaDestino,
              status: "pendente"
            });
          }
        }
      } else {
        // Se ainda não existia OP criada na máquina, cria a OP na máquina de destino
        await base44.entities.Pedido.create({
          numero_pedido: pedido.numero_pedido,
          cliente: pedido.cliente_nome || "Cliente",
          vendedor: pedido.vendedor_nome || "—",
          produto: pedido.produto || "TELHA",
          modelo: pedido.modelo || "TP - 40",
          maquina: maquinaDestino,
          maquina_origem: pedido.maquina || "TP - 40",
          status: statusOpNovo,
          bloqueado_colagem: false,
          perfilacao_concluida: true,
          data: todayIso,
          data_entrega: pedido.data_entrega || todayIso,
          unidade: pedido.unidade || "Matriz AJL"
        });
      }

      toast.success(
        `🚀 Pedido #${pedido.numero_pedido} avançou para a ${maquinaDestino} (${novoPercentual}% concluído)!`,
        {
          description: `Etapas anteriores finalizadas por ${usuario}. A OP agora está visível no painel da ${maquinaDestino}.`
        }
      );
    }

    // Invalida os caches para atualizar o PCP e as telas das máquinas
    if (queryClient) {
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-cd-todos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina"] });
    }

    return { sucesso: true, percentual: novoPercentual, proximaEtapa };
  } catch (err) {
    console.error("Erro ao processar conclusão de etapas:", err);
    toast.error(`Falha ao concluir etapas: ${err.message}`);
    return { sucesso: false, erro: err.message };
  }
}
