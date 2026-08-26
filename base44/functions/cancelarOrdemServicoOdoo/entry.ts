import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Cancela e exclui uma Ordem de Serviço (OS) da fábrica e do Odoo.
 *
 * Fluxo:
 *  1) Dispara o Webhook de Retorno ao Odoo notificando o cancelamento (status: 'cancelado').
 *  2) Remove a OS da entidade PedidoOdoo.
 *  3) Arquiva (status = 'cancelado') as Ordens de Produção vinculadas
 *     (OrdemMaquinaCD, OrdemDesbobinadeira e Pedido) casadas por numero_pedido.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { numero_pedido, odoo_id, motivo } = body;
    if (!numero_pedido && !odoo_id) {
      return Response.json({ error: 'numero_pedido ou odoo_id é obrigatório' }, { status: 400 });
    }

    const numeroStr = numero_pedido ? String(numero_pedido) : null;

    // ── 1) Webhook de Retorno ao Odoo (cancelamento da OS) ──
    // Ponto liberado para implementação manual: caso ODOO_WEBHOOK_URL e ODOO_API_KEY
    // estejam configurados, dispara o POST notificando o cancelamento da sale.order.
    let odoo_notificado = false;
    let odoo_erro = null;
    const odooWebhookUrl = Deno.env.get('ODOO_WEBHOOK_URL');
    const odooApiKey = Deno.env.get('ODOO_API_KEY');
    if (odooWebhookUrl) {
      try {
        const resp = await fetch(odooWebhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(odooApiKey ? { Authorization: `Bearer ${odooApiKey}` } : {}),
          },
          body: JSON.stringify({
            event: 'os_cancelada',
            odoo_id: odoo_id || null,
            numero_pedido: numeroStr,
            status: 'cancelado',
            cancel_status: 'cancel',
            motivo: motivo || 'Cancelamento pela Central PCP / Galpão de Produção',
            cancelado_por: user.full_name || user.email || user.id,
            data_cancelamento: new Date().toISOString(),
          }),
        });
        odoo_notificado = resp.ok;
        if (!resp.ok) {
          odoo_erro = `Odoo respondeu ${resp.status}`;
        }
      } catch (e) {
        odoo_erro = e.message;
      }
    }

    // ── 2) Busca a OS no PedidoOdoo ──
    let pedidoOdooRemovido = false;
    if (numeroStr) {
      const pedidos = await base44.asServiceRole.entities.PedidoOdoo
        .filter({ numero_pedido: numeroStr }, '-data_recebimento', 50)
        .catch(() => []);
      for (const p of pedidos) {
        await base44.asServiceRole.entities.PedidoOdoo.delete(p.id).catch(() => {});
      }
      pedidoOdooRemovido = pedidos.length > 0;
    }

    // ── 3) Arquiva as Ordens de Produção vinculadas (status = cancelado) ──
    const ordens_canceladas = { ordem_maquina_cd: 0, ordem_desbobinadeira: 0, pedido: 0 };
    if (numeroStr) {
      // OrdemMaquinaCD (Corte e Dobra)
      try {
        await base44.asServiceRole.entities.OrdemMaquinaCD.updateMany(
          { numero_pedido: numeroStr, status: { $ne: 'cancelado' } },
          { $set: { status: 'cancelado', data_finalizacao: new Date().toISOString().slice(0, 10) } }
        );
        const cds = await base44.asServiceRole.entities.OrdemMaquinaCD
          .filter({ numero_pedido: numeroStr, status: 'cancelado' }, '-data', 500)
          .catch(() => []);
        ordens_canceladas.ordem_maquina_cd = cds.length;
      } catch {}

      // OrdemDesbobinadeira (Desbobinadeira)
      try {
        await base44.asServiceRole.entities.OrdemDesbobinadeira.updateMany(
          { numero_pedido: numeroStr, status: { $ne: 'cancelado' } },
          { $set: { status: 'cancelado', data_finalizacao: new Date().toISOString().slice(0, 10) } }
        );
        const dbs = await base44.asServiceRole.entities.OrdemDesbobinadeira
          .filter({ numero_pedido: numeroStr, status: 'cancelado' }, '-data', 500)
          .catch(() => []);
        ordens_canceladas.ordem_desbobinadeira = dbs.length;
      } catch {}

      // Pedido (Telhas)
      try {
        await base44.asServiceRole.entities.Pedido.updateMany(
          { numero_pedido: numeroStr, status: { $ne: 'cancelado' } },
          { $set: { status: 'cancelado', data_finalizacao: new Date().toISOString().slice(0, 10) } }
        );
        const peds = await base44.asServiceRole.entities.Pedido
          .filter({ numero_pedido: numeroStr, status: 'cancelado' }, '-data', 500)
          .catch(() => []);
        ordens_canceladas.pedido = peds.length;
      } catch {}
    }

    return Response.json({
      status: 'ok',
      numero_pedido: numeroStr,
      odoo_id: odoo_id || null,
      odoo_notificado,
      odoo_erro,
      pedido_odoo_removido: pedidoOdooRemovido,
      ordens_canceladas,
      cancelado_por: user.full_name || user.email || user.id,
      data: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});