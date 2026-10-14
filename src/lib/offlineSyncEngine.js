import { base44 } from "@/api/base44Client";
import { obterFilaPendente, removerItemFila, atualizarItemFila, limparTodaFilaOffline } from "./offlineStorage";
import { toast } from "sonner";
import { playFinishSound } from "./sounds";
import { queryClientInstance } from "./query-client";

let sincronizando = false;

/**
 * Processa a fila de ações acumuladas offline e envia para a nuvem Base44.
 * Executado automaticamente sempre que a conexão com a internet for restabelecida.
 *
 * @param {Object} options
 * @param {boolean} options.silencioso - Se true, não emite sons/toasts verbosos
 * @returns {Promise<{ processados: number, erros: number }>}
 */
export async function sincronizarFilaOffline(options = {}) {
  if (sincronizando) {
    console.log("[OfflineSync] Sincronização já em andamento. Ignorando chamada concorrente.");
    return { processados: 0, erros: 0 };
  }

  // Verifica conectividade real antes de processar
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return { processados: 0, erros: 0 };
  }

  sincronizando = true;
  let processados = 0;
  let erros = 0;

  try {
    const fila = await obterFilaPendente();
    if (!fila || fila.length === 0) {
      sincronizando = false;
      return { processados: 0, erros: 0 };
    }

    console.log(`[OfflineSync] Iniciando sincronização de ${fila.length} ação(ões) pendente(s)...`);

    // Dispara evento de início de sincronização para a UI
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ajl-sync-status", {
        detail: { status: "sincronizando", total: fila.length }
      }));
    }

    // Processa os itens em ordem cronológica
    for (const item of fila) {
      try {
        const { id, tipo, entidade, registroId, dados } = item;

        // Roteamento por tipo de ação
        if (tipo === "GENERIC_UPDATE" || tipo === "PEDIDO_UPDATE" || tipo === "ORDEM_CD_UPDATE") {
          const targetEntity = entidade || "Pedido";
          if (base44.entities[targetEntity] && registroId) {
            await base44.entities[targetEntity].update(registroId, dados);
          }
        } else if (tipo === "GENERIC_CREATE" || tipo === "PEDIDO_CREATE") {
          const targetEntity = entidade || "Pedido";
          if (base44.entities[targetEntity]) {
            await base44.entities[targetEntity].create(dados);
          }
        } else if (tipo === "GENERIC_DELETE" || tipo === "ORDEM_CD_DELETE") {
          const targetEntity = entidade || "OrdemMaquinaCD";
          if (base44.entities[targetEntity] && registroId) {
            await base44.entities[targetEntity].delete(registroId);
          }
        } else if (tipo === "AUDITORIA") {
          if (base44.entities.AuditLog) {
            await base44.entities.AuditLog.create(dados);
          }
        } else if (tipo === "SETUP_INICIAR" || tipo === "SETUP_CONCLUIR") {
          if (base44.entities.AuditLog && dados) {
            await base44.entities.AuditLog.create(dados);
          }
        } else if (base44.entities[entidade]) {
          // Fallback padrão: se tem registroId faz update, senão create
          if (registroId) {
            await base44.entities[entidade].update(registroId, dados);
          } else {
            await base44.entities[entidade].create(dados);
          }
        }

        // Removido da fila com sucesso
        await removerItemFila(id);
        processados++;
      } catch (itemErr) {
        console.error(`[OfflineSync] Falha ao sincronizar item #${item.id} (${item.tipo}):`, itemErr);
        erros++;

        const errMsg = String(itemErr?.message || "").toLowerCase();
        const errStatus = itemErr?.status || itemErr?.response?.status;
        const ehErroPermanente =
          errStatus === 400 ||
          errStatus === 404 ||
          errStatus === 422 ||
          errMsg.includes("not found") ||
          errMsg.includes("invalid") ||
          errMsg.includes("bad request") ||
          errMsg.includes("unprocessable");

        // Se for erro de rede/servidor offline (ex: fetch failed), para o loop para não queimar tentativas
        if ((errMsg.includes("network") || errMsg.includes("failed to fetch") || !navigator.onLine) && !ehErroPermanente) {
          console.warn("[OfflineSync] Interrompendo sincronização por oscilação de rede detectada.");
          break;
        }

        // Se for erro permanente de registro ou passar de 2 tentativas, descarta para desobstruir a interface
        const novasTentativas = (item.tentativas || 0) + 1;
        if (ehErroPermanente || novasTentativas >= 2) {
          console.warn(`[OfflineSync] Descartando item #${item.id} (${item.tipo}) devido a erro permanente ou limite de tentativas:`, itemErr);
          await removerItemFila(item.id);
        } else {
          item.tentativas = novasTentativas;
          await atualizarItemFila(item);
        }
      }
    }

    if (processados > 0) {
      if (!options.silencioso) {
        try { playFinishSound(); } catch {}
        toast.success(
          `Modo Offline: ${processados} apontamento(s) sincronizado(s) com a nuvem!`,
          { duration: 4000 }
        );
      }

      // Invalida dados na interface para atualizar as listas
      try {
        queryClientInstance.invalidateQueries();
      } catch (qErr) {
        console.warn("[OfflineSync] Erro ao invalidar queries:", qErr);
      }

      // Dispara evento global para que os componentes invalidem suas queries do React Query
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("ajl-sync-concluido", {
          detail: { processados, erros }
        }));
      }
    }
  } catch (err) {
    console.error("[OfflineSync] Erro crítico no motor de sincronização:", err);
  } finally {
    sincronizando = false;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ajl-sync-status", {
        detail: { status: "ocioso", processados, erros }
      }));
    }
  }

  return { processados, erros };
}

/**
 * Limpa manualmente todos os itens pendentes na fila offline
 */
export async function limparFilaManual() {
  await limparTodaFilaOffline();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("ajl-sync-concluido", {
      detail: { processados: 0, erros: 0 }
    }));
    window.dispatchEvent(new CustomEvent("ajl-sync-status", {
      detail: { status: "ocioso", processados: 0, erros: 0 }
    }));
  }
}
