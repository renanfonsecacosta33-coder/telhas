import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { playAlertSound } from "@/lib/sounds";

/**
 * Cria uma nova notificação no sistema
 */
export async function criarNotificacao({
  titulo,
  mensagem,
  tipo = "sistema",
  link = "",
  unidade = "Todas",
  usuario_destino = "todos",
  autor_nome = "Sistema AJL"
}) {
  try {
    const data_hora = new Date().toISOString();
    const created = await base44.entities.Notificacao.create({
      titulo,
      mensagem,
      tipo,
      link,
      unidade,
      usuario_destino,
      autor_nome,
      data_hora,
      lida: false
    });
    return created;
  } catch (err) {
    console.error("Erro ao criar notificacao:", err);
    return null;
  }
}

/**
 * Marca uma notificação como lida
 */
export async function marcarComoLida(notificacaoId) {
  try {
    await base44.entities.Notificacao.update(notificacaoId, { lida: true });
    return true;
  } catch (err) {
    console.error("Erro ao marcar notificacao como lida:", err);
    return false;
  }
}

/**
 * Marca todas as notificações da lista como lidas
 */
export async function marcarTodasComoLidas(notificacoes = []) {
  try {
    const naoLidas = notificacoes.filter(n => !n.lida);
    await Promise.all(
      naoLidas.map(n => base44.entities.Notificacao.update(n.id, { lida: true }))
    );
    toast.success("Todas as notificações marcadas como lidas");
    return true;
  } catch (err) {
    console.error("Erro ao marcar todas como lidas:", err);
    toast.error("Erro ao atualizar notificações");
    return false;
  }
}

/**
 * Exclui uma notificação
 */
export async function excluirNotificacao(notificacaoId) {
  try {
    await base44.entities.Notificacao.delete(notificacaoId);
    return true;
  } catch (err) {
    console.error("Erro ao excluir notificacao:", err);
    return false;
  }
}
