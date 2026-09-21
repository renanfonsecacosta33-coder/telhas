import { base44 } from "@/api/base44Client";

/**
 * Registra um evento centralizado no AuditLog do sistema AJL.
 * Projetado para ser não-bloqueante (fire-and-forget seguro).
 */
export async function registrarAuditoria({
  usuario = null,
  acao = "status", // 'criacao' | 'edicao' | 'status' | 'exclusao' | 'setup' | 'transferencia' | 'aprovacao'
  entidade = "Pedido", // 'Pedido' | 'OrdemMaquinaCD' | 'OrdemDesbobinadeira' | 'Bobina' | 'RotaEntrega' | 'User' | 'Setup' | 'EntregaEPI'
  registroId = "",
  registroIdentificador = "", // ex: '#299371', 'TE0137', 'TP-25'
  detalhes = "",
  dadosAnteriores = null,
  dadosNovos = null,
  unidade = null
}) {
  try {
    let userObj = usuario;
    if (!userObj) {
      try {
        userObj = await base44.auth.me();
      } catch {}
    }

    const payload = {
      unidade: unidade || userObj?.unidade || "Matriz AJL",
      usuario_nome: userObj?.full_name || userObj?.email || "Sistema / Automático",
      usuario_email: userObj?.email || "sistema@ajl.com.br",
      usuario_role: userObj?.role || "operador",
      acao,
      entidade,
      registro_id: String(registroId || ""),
      registro_identificador: String(registroIdentificador || ""),
      detalhes: String(detalhes || ""),
      dados_anteriores: dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
      dados_novos: dadosNovos ? JSON.stringify(dadosNovos) : null,
      data_hora: new Date().toISOString()
    };

    // Salva na entidade AuditLog online ou enfileira se estiver offline
    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("Offline");
      }
      await base44.entities.AuditLog.create(payload);
    } catch (saveErr) {
      // Enfileira offline para envio posterior
      try {
        const { enfileirarAcaoOffline } = await import("./offlineStorage");
        await enfileirarAcaoOffline({
          tipo: "AUDITORIA",
          entidade: "AuditLog",
          dados: payload,
          descricao: `Auditoria: ${acao} em ${entidade}`
        });
      } catch (queueErr) {
        console.warn("Erro ao salvar auditoria offline:", queueErr);
      }
    }
  } catch (err) {
    console.warn("Aviso ao registrar auditoria no sistema:", err);
  }
}

/**
 * Compara dois objetos de bobina e retorna uma descrição detalhada em texto do que foi modificado.
 */
export function gerarDescricaoAlteracoesBobina(anterior = {}, novo = {}) {
  const alteracoes = [];

  // Peso
  if (anterior.peso_kg !== undefined && novo.peso_kg !== undefined && Number(anterior.peso_kg) !== Number(novo.peso_kg)) {
    const dif = Number(novo.peso_kg) - Number(anterior.peso_kg);
    alteracoes.push(`Peso alterado de ${Number(anterior.peso_kg).toLocaleString("pt-BR")} kg para ${Number(novo.peso_kg).toLocaleString("pt-BR")} kg (${dif > 0 ? `+${dif.toLocaleString("pt-BR")}` : dif.toLocaleString("pt-BR")} kg)`);
  }

  // Status
  if (anterior.status && novo.status && anterior.status !== novo.status) {
    alteracoes.push(`Status alterado de "${anterior.status}" para "${novo.status}"`);
  }

  // Chapa
  if (anterior.chapa !== undefined && novo.chapa !== undefined && anterior.chapa !== novo.chapa) {
    alteracoes.push(`Chapa alterada de ${anterior.chapa} mm para ${novo.chapa} mm`);
  }

  // Cor / RVM
  if (anterior.cor !== undefined && novo.cor !== undefined && anterior.cor !== novo.cor) {
    alteracoes.push(`Cor alterada de "${anterior.cor || 'Sem cor'}" para "${novo.cor || 'Sem cor'}"`);
  }

  // Qualidade
  if (anterior.qualidade !== undefined && novo.qualidade !== undefined && anterior.qualidade !== novo.qualidade) {
    alteracoes.push(`Qualidade alterada de ${anterior.qualidade || '—'} para ${novo.qualidade || '—'}`);
  }

  // Fornecedor
  if (anterior.fornecedor !== undefined && novo.fornecedor !== undefined && anterior.fornecedor !== novo.fornecedor) {
    alteracoes.push(`Fornecedor alterado de "${anterior.fornecedor || '—'}" para "${novo.fornecedor || '—'}"`);
  }

  // NF
  if (anterior.nf !== undefined && novo.nf !== undefined && anterior.nf !== novo.nf) {
    alteracoes.push(`NF alterada de "${anterior.nf || '—'}" para "${novo.nf || '—'}"`);
  }

  // Custo
  if (anterior.custo !== undefined && novo.custo !== undefined && Number(anterior.custo) !== Number(novo.custo)) {
    alteracoes.push(`Custo/kg alterado de R$ ${Number(anterior.custo).toFixed(2)} para R$ ${Number(novo.custo).toFixed(2)}`);
  }

  // Reserva
  if (!anterior.reservada && novo.reservada) {
    const tipo = novo.reserva_tipo === "parcial" ? `Parcial (${novo.reserva_kg} kg)` : "Bobina Inteira";
    alteracoes.push(`Reserva efetuada: ${tipo}. Motivo: ${novo.reserva_motivo || 'N/A'}. Autorizado por: ${novo.reserva_autorizado_por || 'N/A'}${novo.reserva_numero_pedido ? ` (Pedido: ${novo.reserva_numero_pedido})` : ''}`);
  } else if (anterior.reservada && !novo.reservada) {
    alteracoes.push(`Reserva liberada / cancelada`);
  } else if (anterior.reservada && novo.reservada) {
    if (anterior.reserva_motivo !== novo.reserva_motivo) {
      alteracoes.push(`Motivo da reserva alterado para "${novo.reserva_motivo || ''}"`);
    }
    if (anterior.reserva_autorizado_por !== novo.reserva_autorizado_por) {
      alteracoes.push(`Autorizador da reserva alterado para "${novo.reserva_autorizado_por || ''}"`);
    }
    if (anterior.reserva_numero_pedido !== novo.reserva_numero_pedido) {
      alteracoes.push(`Pedido da reserva alterado para "${novo.reserva_numero_pedido || ''}"`);
    }
  }

  // Arquivada
  if (anterior.arquivada !== undefined && novo.arquivada !== undefined && anterior.arquivada !== novo.arquivada) {
    alteracoes.push(novo.arquivada ? `Bobina arquivada` : `Bobina desarquivada / retornada ao estoque`);
  }

  return alteracoes;
}

/**
 * Registra auditoria automática para qualquer alteração em bobinas
 */
export async function auditarModificacaoBobina({
  usuario = null,
  bobinaAnterior = null,
  bobinaNova = null,
  acaoTipo = "edicao",
  detalheCustom = null
}) {
  try {
    const identificador = bobinaNova?.codigo || bobinaAnterior?.codigo || "Bobina";
    const regId = bobinaNova?.id || bobinaAnterior?.id || "";
    const unidade = bobinaNova?.unidade || bobinaAnterior?.unidade || "Matriz AJL";

    let detalhes = detalheCustom;
    if (!detalhes) {
      if (acaoTipo === "criacao") {
        detalhes = `Nova bobina cadastrada: ${identificador} (${bobinaNova?.cor || 'Sem cor'} · ${bobinaNova?.chapa || ''}mm · ${Number(bobinaNova?.peso_kg || 0).toLocaleString("pt-BR")} kg). NF: ${bobinaNova?.nf || '—'}, Fornecedor: ${bobinaNova?.fornecedor || '—'}.`;
      } else if (acaoTipo === "exclusao") {
        detalhes = `Bobina excluída do sistema: ${identificador}.`;
      } else {
        const alteracoes = gerarDescricaoAlteracoesBobina(bobinaAnterior, bobinaNova);
        if (alteracoes.length === 0) {
          detalhes = `Bobina ${identificador} atualizada no cadastro.`;
        } else {
          detalhes = `Alterações na bobina ${identificador}: ${alteracoes.join("; ")}.`;
        }
      }
    }

    await registrarAuditoria({
      usuario,
      acao: acaoTipo,
      entidade: "Bobina",
      registroId: regId,
      registroIdentificador: identificador,
      detalhes,
      dadosAnteriores: bobinaAnterior,
      dadosNovos: bobinaNova,
      unidade
    });
  } catch (err) {
    console.warn("Erro ao auditar modificação de bobina:", err);
  }
}

/**
 * Retorna cores e rótulos para cada tipo de ação de auditoria
 */
export const ACAO_CONFIG = {
  criacao: {
    label: "Criação",
    cor: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700",
    badge: "bg-emerald-600 text-white",
    icon: "PlusCircle"
  },
  status: {
    label: "Mudança de Status",
    cor: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700",
    badge: "bg-blue-600 text-white",
    icon: "RefreshCw"
  },
  edicao: {
    label: "Edição / Ajuste",
    cor: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700",
    badge: "bg-amber-600 text-white",
    icon: "Edit3"
  },
  setup: {
    label: "Setup / Máquina",
    cor: "bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700",
    badge: "bg-indigo-600 text-white",
    icon: "Sliders"
  },
  transferencia: {
    label: "Transferência Filial",
    cor: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-700",
    badge: "bg-purple-600 text-white",
    icon: "ArrowRightLeft"
  },
  aprovacao: {
    label: "Aprovação",
    cor: "bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-700",
    badge: "bg-teal-600 text-white",
    icon: "CheckCircle"
  },
  exclusao: {
    label: "Exclusão / Cancelamento",
    cor: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700",
    badge: "bg-rose-600 text-white",
    icon: "Trash2"
  }
};
