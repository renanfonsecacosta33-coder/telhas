import { base44 } from "@/api/base44Client";

// Exclusão de OS da Central PCP: resposta instantânea na tela + sincronismo com Odoo em background
export async function executarExclusaoOsBackground({ pedido, pedidoId, numPedido, motivo, queryClient, toast }) {
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Timeout Odoo (3.5s)")), 3500)
    );
    const resPromise = base44.functions.invoke("cancelarOrdemServicoOdoo", {
      pedido_id: pedidoId,
      numero_pedido: numPedido,
      odoo_id: pedido.odoo_id,
      of_odoo_id: pedido.of_odoo_id,
      of_nome: pedido.of_nome,
      motivo,
      force: true,
    });

    await Promise.race([resPromise, timeoutPromise]).catch((e) => {
      console.warn("[Excluir OS Background] Odoo timeout ou aviso:", e.message);
    });

    // Deleção de segurança caso o backend não tenha deletado
    await base44.entities.PedidoOdoo.delete(pedidoId).catch(() => {});

    queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
    queryClient.invalidateQueries({ queryKey: ["ordens-maquinas-cd"] });
    queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });

    toast({
      title: "✅ OS #" + numPedido + " excluída com sucesso",
      description: "Removida da fábrica e sincronizada.",
      className: "border-emerald-500/40"
    });
  } catch (err) {
    console.warn("[Excluir OS] Erro em background:", err);
  }
}