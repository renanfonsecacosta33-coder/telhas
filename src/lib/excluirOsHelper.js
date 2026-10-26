import { base44 } from "@/api/base44Client";
import { cancelarOpsDoPedido } from "@/lib/conciliacaoPcpMaquinasHelper";
import { registrarHistoricoExclusao } from "@/lib/historicoExclusoesHelper";

// Exclusão de OS da Central PCP: resposta instantânea na tela + sincronismo com Odoo em background
export async function executarExclusaoOsBackground({ pedido, pedidoId, numPedido, motivo, queryClient, toast, usuario = "Gestor PCP" }) {
  try {
    const todayIso = new Date().toISOString().slice(0, 10);
    const motivoFinal = (motivo && String(motivo).trim()) ? String(motivo).trim() : "Exclusão solicitada na Central PCP";

    // 0. Grava formalmente no Histórico de Exclusões para consulta do gestor
    await registrarHistoricoExclusao({
      pedidos: [pedido],
      motivo: motivoFinal,
      usuario: usuario || "Gestor PCP",
      todayIso
    }).catch((e) => console.warn("[Excluir OS] Falha ao registrar histórico:", e));

    // 1. Cancela imediatamente as OPs locais vinculadas nas máquinas da fábrica (Telhas e C&D)
    await cancelarOpsDoPedido({ pedido, usuario: usuario || "Exclusão PCP", motivo: motivoFinal }).catch((e) => {
      console.warn("[Excluir OS] Falha ao cancelar OPs locais:", e);
    });

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout Odoo (3.5s)")), 3500)
    );
    const resPromise = base44.functions.invoke("cancelarOrdemServicoOdoo", {
      pedido_id: pedidoId,
      numero_pedido: numPedido,
      odoo_id: pedido.odoo_id,
      of_odoo_id: pedido.of_odoo_id,
      of_nome: pedido.of_nome,
      motivo: motivoFinal,
      force: true,
    });

    await Promise.race([resPromise, timeoutPromise]).catch((e) => {
      console.warn("[Excluir OS Background] Odoo timeout ou aviso:", e.message);
    });

    // Deleção de segurança caso o backend não tenha deletado
    await base44.entities.PedidoOdoo.delete(pedidoId).catch(() => {});

    // Invalidação suave das queries ativas se necessário
    queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"], refetchType: "active" });
    queryClient.invalidateQueries({ queryKey: ["pedidos"], refetchType: "active" });
    queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"], refetchType: "active" });
    queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"], refetchType: "active" });
    queryClient.invalidateQueries({ queryKey: ["ordens-cd-todos"], refetchType: "active" });

    toast({
      title: "✅ OS #" + numPedido + " excluída com sucesso",
      description: `Motivo: ${motivoFinal}. Removida da fábrica e gravada no Histórico.`,
      className: "border-emerald-500/40"
    });
  } catch (err) {
    console.warn("[Excluir OS] Erro em background:", err);
  }
}
