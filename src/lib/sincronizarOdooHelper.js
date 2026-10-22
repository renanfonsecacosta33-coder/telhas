import { parseItensPedido } from "@/lib/regrasFabrica";
import { notificarStatus } from "@/lib/biNotificador";

// Sincroniza em lote o status de OSs da Central PCP com o Odoo ERP
export async function sincronizarLoteOdoo(pedidosParaSincronizar, { isPedidoConcluido, setSincronizandoOdoo, toast, queryClient }) {
  const lista = (pedidosParaSincronizar || []).filter(Boolean);
  if (!lista.length) return;
  setSincronizandoOdoo(true);
  let okCount = 0;
  let failCount = 0;

  for (const p of lista) {
    try {
      const itens = parseItensPedido(p.itens_json);
      const isConc = isPedidoConcluido(p);
      const itensSinc = isConc
        ? itens.map(i => ({ ...i, concluido: true, status: "concluido", status_detalhado: "Concluído" }))
        : itens;

      const res = await notificarStatus(
        {
          ...p,
          percentual_concluido: isConc ? 100 : (p.percentual_concluido || 0),
          status_pcp: isConc ? "concluido" : (p.status_pcp || "em_producao"),
          itens_json: JSON.stringify(itensSinc)
        },
        isConc ? "concluido" : "sincronizacao_manual",
        {
          percentual_concluido: isConc ? 100 : (p.percentual_concluido || 0),
          status_novo: isConc ? "concluido" : (p.status_pcp || "em_producao"),
          item_nome: `Pedido #${p.numero_pedido}`
        }
      );
      if (res && res.ok) okCount++;
      else failCount++;
    } catch (err) {
      console.error("Erro sincronizando pedido com Odoo:", p.numero_pedido, err);
      failCount++;
    }
  }

  setSincronizandoOdoo(false);
  if (failCount === 0) {
    toast({
      title: "Sincronização com Odoo concluída!",
      description: `${okCount} OF(s) sincronizada(s) com sucesso no Odoo ERP como Finalizado/Concluído.`
    });
  } else {
    toast({
      title: "Sincronização com Odoo realizada",
      description: `${okCount} enviada(s) com sucesso, ${failCount} falha(s).`,
      variant: failCount > 0 && okCount === 0 ? "destructive" : "default"
    });
  }
  queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
}