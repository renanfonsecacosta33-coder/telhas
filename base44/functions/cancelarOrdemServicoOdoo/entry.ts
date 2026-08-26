import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Cancela e exclui uma Ordem de Serviço (OS) da fábrica e do Odoo.
 *
 * Fluxo:
 *  1) Resolve o odoo_id (do corpo ou buscando o PedidoOdoo por numero_pedido).
 *  2) Dispara POST para o Webhook de Cancelamento do Odoo com o payload:
 *       { "api_key": "AJL_BASE44_DELETE_OF_2026_8fk92xLm", "odoo_id": <odoo_id> }
 *  3) Somente após resposta de sucesso do Odoo:
 *       - Exclui o registro da entidade PedidoOdoo.
 *       - Arquiva (status = cancelado) as Ordens de Produção vinculadas.
 *  4) Retorna sucesso para o frontend exibir o aviso final.
 */
const ODOO_CANCEL_WEBHOOK_URL = process.env.ODOO_WEBHOOK_URL || 'https://ajlferroeaco.odoo.com/web/hook/97a79bb4-0850-4b49-b9a3-89894d0b0517';
const ODOO_CANCEL_API_KEY = process.env.ODOO_API_KEY || 'AJL_BASE44_DELETE_OF_2026_8fk92xLm';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const { numero_pedido, odoo_id: odoo_id_in, motivo } = body;
    if (!numero_pedido && !odoo_id_in) {
      return Response.json({ error: 'numero_pedido ou odoo_id é obrigatório' }, { status: 400 });
    }

    const numeroStr = numero_pedido ? String(numero_pedido) : null;

    // ── 1) Resolve o odoo_id numérico (do corpo ou buscando o PedidoOdoo) ──
    // Extrai o ID numérico puro do Odoo, removendo prefixos como 'S', 'SO', 'SO-' etc.
    // Ex: 'S00549' → 549, '549' → 549, 'SO-2026-283427' (fallback) → 2026283427.
    const extrairIdNumerico = (raw) => {
      if (raw === null || raw === undefined) return null;
      const str = String(raw).trim();
      if (!str) return null;
      const digitos = str.replace(/\D/g, '');
      if (!digitos) return null;
      const n = Number(digitos);
      return Number.isFinite(n) ? n : null;
    };

    let odoo_id_raw = odoo_id_in || null;
    let pedidoOdooId = null;
    if (numeroStr) {
      const pedidos = await base44.asServiceRole.entities.PedidoOdoo
        .filter({ numero_pedido: numeroStr }, '-data_recebimento', 50)
        .catch(() => []);
      if (pedidos.length > 0) {
        if (!odoo_id_raw) odoo_id_raw = pedidos[0].odoo_id || null;
        pedidoOdooId = pedidos[0].id;
      }
    }

    // Tenta extrair do odoo_id; se não houver, extrai do numero_pedido.
    const odooIdNumerico = extrairIdNumerico(odoo_id_raw) ?? extrairIdNumerico(numeroStr);

    if (!odooIdNumerico) {
      return Response.json({
        error: 'Não foi possível extrair o ID numérico do Odoo para este pedido. Não é possível cancelar no Odoo.',
        numero_pedido: numeroStr,
        odoo_id_raw,
      }, { status: 422 });
    }

    // ── 2) POST para o Webhook de Cancelamento do Odoo ──
    // Payload estrito: { "api_key": "...", "odoo_id": <Number> }
    let odoo_notificado = false;
    let odoo_erro = null;
    let odoo_status = 0;
    try {
      const resp = await fetch(ODOO_CANCEL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: ODOO_CANCEL_API_KEY,
          odoo_id: odooIdNumerico,
        }),
      });
      odoo_status = resp.status;
      // Trava atômica: sucesso SOMENTE com HTTP 200 ou 201.
      odoo_notificado = resp.status === 200 || resp.status === 201;
      if (!odoo_notificado) {
        const txt = await resp.text().catch(() => '');
        odoo_erro = `Odoo respondeu ${resp.status}${txt ? `: ${txt.slice(0, 200)}` : ''}`;
      }
    } catch (e) {
      odoo_erro = e.message;
    }

    // Se o Odoo não confirmou sucesso, NÃO exclui nada no App.
    if (!odoo_notificado) {
      return Response.json({
        status: 'erro_odoo',
        numero_pedido: numeroStr,
        odoo_id: odooIdNumerico,
        odoo_notificado: false,
        odoo_status,
        odoo_erro,
        message: 'O Odoo não confirmou o cancelamento. Nenhum registro foi excluído no App.',
      }, { status: 502 });
    }

    // ── 3) Sucesso no Odoo → exclui PedidoOdoo + arquiva Ordens de Produção ──
    let pedidoOdooRemovido = false;
    if (pedidoOdooId) {
      await base44.asServiceRole.entities.PedidoOdoo.delete(pedidoOdooId).catch(() => {});
      pedidoOdooRemovido = true;
    } else if (numeroStr) {
      // fallback: remove qualquer PedidoOdoo casado por numero_pedido
      const pedidos = await base44.asServiceRole.entities.PedidoOdoo
        .filter({ numero_pedido: numeroStr }, '-data_recebimento', 50)
        .catch(() => []);
      for (const p of pedidos) {
        await base44.asServiceRole.entities.PedidoOdoo.delete(p.id).catch(() => {});
      }
      pedidoOdooRemovido = pedidos.length > 0;
    }

    const ordens_canceladas = { ordem_maquina_cd: 0, ordem_desbobinadeira: 0, pedido: 0 };
    if (numeroStr) {
      const todayIso = new Date().toISOString().slice(0, 10);

      // OrdemMaquinaCD (Corte e Dobra)
      try {
        await base44.asServiceRole.entities.OrdemMaquinaCD.updateMany(
          { numero_pedido: numeroStr, status: { $ne: 'cancelado' } },
          { $set: { status: 'cancelado', data_finalizacao: todayIso } }
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
          { $set: { status: 'cancelado', data_finalizacao: todayIso } }
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
          { $set: { status: 'cancelado', data_finalizacao: todayIso } }
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
      odoo_id: odooIdNumerico,
      odoo_notificado: true,
      odoo_status,
      pedido_odoo_removido: pedidoOdooRemovido,
      ordens_canceladas,
      message: `🟢 Ordem de Serviço ${numeroStr || `#${odooIdNumerico}`} cancelada com sucesso no Odoo e removida do App!`,
      cancelado_por: user.full_name || user.email || user.id,
      data: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});