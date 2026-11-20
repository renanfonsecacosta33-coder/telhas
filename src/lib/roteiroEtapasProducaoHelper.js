import { base44 } from "@/api/base44Client";
import { isTelhaBandeja } from "@/lib/bandejaHelper";
import { detectarMaquinaTelha } from "@/lib/pedidoOdooHelper";
import { normalizarNumeroPedido } from "@/lib/normalizacaoPedidoHelper";
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

  // Coleta texto completo de todos os campos possíveis do item e do pedido
  const partesTexto = [
    item?.produto,
    item?.item_produto,
    item?.modelo,
    item?.descricao,
    item?.nome_produto,
    pedido?.produto,
    pedido?.modelo,
    pedido?.item_produto,
    pedido?.descricao,
    pedido?.observacoes_odoo,
    pedido?.observacoes,
    pedido?.eps,
    item?.eps
  ];

  if (pedido?.itens_json) {
    try {
      const its = typeof pedido.itens_json === "string" ? JSON.parse(pedido.itens_json) : pedido.itens_json;
      if (Array.isArray(its)) {
        its.forEach((it) => {
          partesTexto.push(it.produto, it.descricao, it.item_produto, it.modelo, it.eps);
        });
      }
    } catch {}
  }

  const textoCompleto = partesTexto.filter(Boolean).map(normalizarTexto).join(" ");

  // Se já tiver etapas salvas anteriormente no pedido ou no item:
  const rawSalvasGeral = item?.etapas_concluidas_json || pedido.etapas_concluidas_json;
  if (rawSalvasGeral) {
    try {
      const salvas = typeof rawSalvasGeral === "string" ? JSON.parse(rawSalvasGeral) : rawSalvasGeral;
      if (Array.isArray(salvas) && salvas.length > 0) {
        return salvas.map((s) => ({
          ...s,
          ativo: s.ativo !== false,
          tag:
            s.tag ||
            (s.id?.includes("desbobinadeira")
              ? "Desbobinadeira"
              : s.id?.includes("guilhotina") || s.id?.includes("corte")
              ? "Guilhotina"
              : s.id?.includes("dobradeira")
              ? "Dobradeira"
              : s.id?.includes("telha_superior")
              ? "Telha Superior"
              : s.id?.includes("telha_inferior")
              ? "Telha Inferior"
              : s.id?.includes("bandeja")
              ? "Bandeja Inferior"
              : s.id?.includes("colagem")
              ? "Colagem"
              : s.nome?.split(" ")[1] || "Etapa"),
          concluida: Boolean(s.concluida)
        }));
      }
    } catch {}
  }

  const etapas = [];
  const maquinaDetectada = detectarMaquinaTelha(item || pedido);
  const maquinaBaseTelha = pedido.maquina && pedido.maquina !== "BANDEJA" && pedido.maquina !== "COLAGEM"
    ? pedido.maquina
    : (pedido.maquina_origem || (maquinaDetectada && maquinaDetectada !== "BANDEJA" && maquinaDetectada !== "COLAGEM" ? maquinaDetectada : "TP - 40"));

  const alvoAtual = item || pedido;
  const jaEstaNaColagem = Boolean(
    alvoAtual.maquina === "COLAGEM" ||
    pedido.maquina === "COLAGEM" ||
    alvoAtual.status === "aguardando_colagem" ||
    pedido.status === "aguardando_colagem" ||
    alvoAtual.perfilacao_concluida ||
    pedido.perfilacao_concluida ||
    String(alvoAtual.onde_esta || "").toUpperCase().includes("COLAGEM") ||
    String(pedido.onde_esta || "").toUpperCase().includes("COLAGEM")
  );

  const jaTotalmenteConcluido = Boolean(
    alvoAtual.status === "finalizado" ||
    pedido.status === "finalizado" ||
    alvoAtual.status_pcp === "concluido" ||
    pedido.status_pcp === "concluido" ||
    (Number(alvoAtual.percentual_concluido) || 0) >= 100 ||
    (Number(pedido.percentual_concluido) || 0) >= 100
  );

  // ─────────────────────────────────────────────────────────────
  // 1. CASO: TELHA BANDEJA (Colonial / TP-25 / TP-40 ➔ BANDEJA ➔ COLAGEM)
  // ─────────────────────────────────────────────────────────────
  if (isTelhaBandeja(pedido) || isTelhaBandeja(item) || textoCompleto.includes("bandeja")) {
    etapas.push({
      id: "telha_superior",
      ordem: 1,
      tag: "Telha Superior",
      nome: `1. Perfiladeira Telha Superior (${maquinaBaseTelha})`,
      maquina: maquinaBaseTelha,
      setor: "telha",
      descricao: `Perfilação da telha superior na ${maquinaBaseTelha}`,
      ativo: true,
      concluida: jaTotalmenteConcluido || jaEstaNaColagem || Boolean(alvoAtual.perfilacao_concluida || alvoAtual.maquina === "BANDEJA")
    });

    etapas.push({
      id: "bandeja_inferior",
      ordem: 2,
      tag: "Bandeja Inferior",
      nome: "2. Perfiladeira Bandeja (BANDEJA)",
      maquina: "BANDEJA",
      setor: "telha",
      descricao: "Perfilação da bandeja inferior de aço",
      ativo: true,
      concluida: jaTotalmenteConcluido || jaEstaNaColagem
    });

    etapas.push({
      id: "colagem_final",
      ordem: 3,
      tag: "Colagem",
      nome: "3. Colagem Final (COLAGEM)",
      maquina: "COLAGEM",
      setor: "telha",
      descricao: "Injeção de EPS/PU, cola e prensagem final",
      ativo: true,
      concluida: jaTotalmenteConcluido
    });

    return etapas;
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CASO: TELHA SANDUÍCHE (Dupla vs Semi-Sanduíche / Manta)
  // ─────────────────────────────────────────────────────────────
  const temEps =
    Boolean(pedido.eps || item?.eps) ||
    /\b(eps|isopor|sanduiche|sanduíche|manta|filme|termoacustica|termoacústica|semi[- ]?sanduiche)\b/i.test(textoCompleto);

  if (temEps) {
    // Verifica se é SANDUÍCHE DUPLO (Telha + EPS + Telha, ou tem chapa superior e inferior)
    const isSanduicheDuplo =
      /\b(telha\s*\+\s*eps\w*\s*\+\s*telha|telha\s*\+\s*isopor\s*\+\s*telha|sandu[ií]che\s*dupl[oa]|duplo|dupla)\b/i.test(textoCompleto) ||
      (/\bsuperior\b/i.test(textoCompleto) && /\binferior\b/i.test(textoCompleto));

    if (isSanduicheDuplo) {
      // 3 Processos: Telha Superior + Telha Inferior + Colagem
      etapas.push({
        id: "telha_superior",
        ordem: 1,
        tag: "Telha Superior",
        nome: `1. Perfiladeira Telha Superior (${maquinaBaseTelha})`,
        maquina: maquinaBaseTelha,
        setor: "telha",
        descricao: "Perfilação da telha superior de aço",
        ativo: true,
        concluida: jaTotalmenteConcluido || jaEstaNaColagem
      });

      etapas.push({
        id: "telha_inferior",
        ordem: 2,
        tag: "Telha Inferior",
        nome: `2. Perfiladeira Telha Inferior (${maquinaBaseTelha})`,
        maquina: maquinaBaseTelha,
        setor: "telha",
        descricao: "Perfilação da telha inferior de aço",
        ativo: true,
        concluida: jaTotalmenteConcluido || jaEstaNaColagem
      });

      etapas.push({
        id: "colagem_final",
        ordem: 3,
        tag: "Colagem",
        nome: "3. Colagem Final (COLAGEM)",
        maquina: "COLAGEM",
        setor: "telha",
        descricao: "Injeção de EPS e colagem final do sanduíche duplo",
        ativo: true,
        concluida: jaTotalmenteConcluido
      });

      return etapas;
    }

    // Semi-Sanduíche / Filme / Manta (Telha Superior + Colagem)
    etapas.push({
      id: "telha_superior",
      ordem: 1,
      tag: "Telha Superior",
      nome: `1. Perfiladeira Telha Superior (${maquinaBaseTelha})`,
      maquina: maquinaBaseTelha,
      setor: "telha",
      descricao: "Perfilação da telha superior de aço",
      ativo: true,
      concluida: jaTotalmenteConcluido || jaEstaNaColagem
    });

    etapas.push({
      id: "colagem_final",
      ordem: 2,
      tag: "Colagem",
      nome: "2. Colagem Final (COLAGEM)",
      maquina: "COLAGEM",
      setor: "telha",
      descricao: "Injeção de EPS/filme/manta e colagem final",
      ativo: true,
      concluida: jaTotalmenteConcluido
    });

    return etapas;
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CASO: CORTE E DOBRA (Desbobinadeira ➔ Guilhotina ➔ Dobradeira)
  // ─────────────────────────────────────────────────────────────
  const isCD =
    pedido.setor === "corte_dobra" ||
    pedido.setor === "cd" ||
    item?.setor === "corte_dobra" ||
    item?.setor === "cd" ||
    /\b(dobra|dobradeira|guilhotina|desbobinadeira|chapa|perfil dobrado|rufo|calha|cartola|cantoneira|u enrijecido)\b/i.test(textoCompleto);

  if (isCD) {
    const precisaDobra = /\b(dobra|dobradeira|perfil dobrado|rufo|calha|pingadeira|cantoneira|u enrijecido|cartola)\b/i.test(textoCompleto);

    // Se o pedido/item já possui roteiro oficial de máquinas configurado pelo PCP:
    let maquinasRoteiroOficiais = [];
    if (Array.isArray(item?.roteiro_maquinas)) maquinasRoteiroOficiais = item.roteiro_maquinas;
    else if (typeof item?.roteiro_maquinas === "string") {
      try { maquinasRoteiroOficiais = JSON.parse(item.roteiro_maquinas); } catch {}
    } else if (Array.isArray(pedido?.roteiro_maquinas)) maquinasRoteiroOficiais = pedido.roteiro_maquinas;
    else if (typeof pedido?.roteiro_maquinas === "string") {
      try { maquinasRoteiroOficiais = JSON.parse(pedido.roteiro_maquinas); } catch {}
    }

    const maqDesb = maquinasRoteiroOficiais.find((m) => /DESBOBINADEIRA/i.test(m)) || "DESBOBINADEIRA 01";
    const maqCorte = maquinasRoteiroOficiais.find((m) => /CORTE|GUILHOTINA/i.test(m)) || "GUILHOTINA 3M";
    const maqDobra = maquinasRoteiroOficiais.find((m) => /DOBRA/i.test(m)) || "DOBRADEIRA 3M";

    const temDesbOficial = maquinasRoteiroOficiais.length > 0 ? maquinasRoteiroOficiais.some((m) => /DESBOBINADEIRA/i.test(m)) : true;
    const temCorteOficial = maquinasRoteiroOficiais.length > 0 ? maquinasRoteiroOficiais.some((m) => /CORTE|GUILHOTINA/i.test(m)) : true;
    const temDobraOficial = maquinasRoteiroOficiais.length > 0 ? maquinasRoteiroOficiais.some((m) => /DOBRA/i.test(m)) : Boolean(precisaDobra);

    etapas.push({
      id: "cd_desbobinadeira",
      ordem: 1,
      tag: "Desbobinadeira",
      nome: `1. Desbobinadeira (${maqDesb})`,
      maquina: maqDesb,
      setor: "cd",
      descricao: "Avanço e corte inicial da chapa na bobina",
      ativo: temDesbOficial,
      concluida: false
    });

    etapas.push({
      id: "cd_guilhotina",
      ordem: 2,
      tag: "Guilhotina",
      nome: `2. Corte na Guilhotina (${maqCorte})`,
      maquina: maqCorte,
      setor: "cd",
      descricao: "Corte das peças no esquadro conforme croqui",
      ativo: temCorteOficial,
      concluida: false
    });

    etapas.push({
      id: "cd_dobradeira",
      ordem: 3,
      tag: "Dobradeira",
      nome: `3. Conformação na Dobradeira (${maqDobra})`,
      maquina: maqDobra,
      setor: "cd",
      descricao: "Dobra dos perfis conforme ângulos do croqui",
      ativo: temDobraOficial,
      concluida: false
    });

    // Se já havia etapas salvas no pedido/item, recupera ativo e concluida
    const rawSalvas = item?.etapas_concluidas_json || pedido.etapas_concluidas_json;
    if (rawSalvas) {
      try {
        const salvas = typeof rawSalvas === "string" ? JSON.parse(rawSalvas) : rawSalvas;
        if (Array.isArray(salvas) && salvas.length > 0) {
          return etapas.map((etp) => {
            const salva = salvas.find((s) => s.id === etp.id);
            if (salva) {
              return {
                ...etp,
                ativo: salva.ativo !== undefined ? salva.ativo : etp.ativo,
                concluida: Boolean(salva.concluida)
              };
            }
            return etp;
          });
        }
      } catch {}
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

    const etapasAtivas = etapas.filter((e) => e.ativo !== false);
    const totalEtapas = etapasAtivas.length;
    const etapasConcluidas = etapasAtivas.filter((e) => e.concluida);
    const totalConcluidas = etapasConcluidas.length;
    const todasConcluidas = totalEtapas > 0 && totalConcluidas === totalEtapas;

    // Próxima etapa pendente (se houver)
    const proximaEtapa = etapasAtivas.find((e) => !e.concluida);

    // Percentual calculado
    const novoPercentual = todasConcluidas
      ? 100
      : Math.max(10, Math.min(95, Math.round((totalConcluidas / (totalEtapas || 1)) * 100)));

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

      // Se for Corte & Dobra:
      if (proximaEtapa.setor === "cd") {
        const opsCD = await base44.entities.OrdemMaquinaCD.filter({
          numero_pedido: pedido.numero_pedido
        }).catch(() => []);

        if (opsCD && opsCD.length > 0) {
          for (const op of opsCD) {
            await base44.entities.OrdemMaquinaCD.update(op.id, {
              maquina: maquinaDestino,
              status: "pendente"
            });
          }
        } else {
          await base44.entities.OrdemMaquinaCD.create({
            numero_pedido: pedido.numero_pedido,
            cliente: pedido.cliente_nome || "Cliente",
            vendedor: pedido.vendedor_nome || "—",
            produto: item?.produto || pedido.produto || "Corte e Dobra",
            maquina: maquinaDestino,
            status: "pendente",
            data: todayIso,
            data_entrega: pedido.data_entrega || todayIso,
            unidade: pedido.unidade || "Matriz AJL"
          }).catch(() => {});
        }
      } else {
        // Telhas:
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
