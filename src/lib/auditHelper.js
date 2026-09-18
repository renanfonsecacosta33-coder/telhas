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
