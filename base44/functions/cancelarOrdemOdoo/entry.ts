import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * Cancela uma Ordem de Serviço (OS) no Odoo — POST server-to-server
 * (evita o bloqueio de CORS do navegador).
 *
 * Recebe { odoo_id } (string ou número), extrai a parte numérica
 * (ex: "S00549" → 549) e faz POST ao webhook de cancelamento do Odoo.
 *
 * Logs:
 *  - Sucesso (2xx): "OS cancelada no Odoo com sucesso"
 *  - Erro: detalhe do status/resposta para auditoria no painel.
 */
const ODOO_CANCEL_WEBHOOK_URL = process.env.ODOO_WEBHOOK_URL || 'https://ajlferroeaco.odoo.com/web/hook/97a79bb4-0850-4b49-b9a3-89894d0b0517';
const ODOO_CANCEL_API_KEY = process.env.ODOO_API_KEY || 'AJL_BASE44_DELETE_OF_2026_8fk92xLm';

Deno.serve(async (req) => {
  try {
    // ── 1) Autenticação (app user) ──
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // ── 2) Payload { odoo_id } ──
    let body = {};
    try { body = await req.json(); } catch { body = {}; }
    const odooIdRaw = body.odoo_id ?? body.odooId;
    if (odooIdRaw === undefined || odooIdRaw === null || String(odooIdRaw).trim() === '') {
      return Response.json({
        status: 'erro_validacao',
        message: 'odoo_id é obrigatório.',
      }, { status: 400 });
    }

    // Extrai apenas a parte numérica (ex: "S00549" → 549, "549" → 549)
    const digitos = String(odooIdRaw).replace(/\D/g, '');
    if (!digitos) {
      return Response.json({
        status: 'erro_validacao',
        message: `odoo_id inválido (sem dígitos numéricos): "${odooIdRaw}"`,
      }, { status: 400 });
    }
    const odooIdNumerico = Number(digitos);

    // ── 3) POST server-to-server ao Odoo ──
    const payload = {
      api_key: ODOO_CANCEL_API_KEY,
      odoo_id: odooIdNumerico,
    };

    let odoo_status = null;
    let odoo_notificado = false;
    let odoo_erro = null;
    let odoo_resposta = null;
    const tentado_em = new Date().toISOString();
    const solicitado_por = user.full_name || user.email || user.id;

    try {
      const resp = await fetch(ODOO_CANCEL_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      odoo_status = resp.status;
      // Trava atômica: sucesso com qualquer HTTP 2xx (200-299).
      // Odoo pode responder 200, 201, 202 (Accepted) ou 204 (No Content).
      odoo_notificado = resp.status >= 200 && resp.status < 300;
      const txt = await resp.text().catch(() => '');
      odoo_resposta = txt.slice(0, 500);

      if (!odoo_notificado) {
        odoo_erro = `Odoo respondeu ${resp.status}${txt ? `: ${txt.slice(0, 200)}` : ''}`;
        console.error('[cancelarOrdemOdoo] ERRO Odoo:', {
          odoo_id: odooIdNumerico,
          status: resp.status,
          resposta: odoo_resposta,
          solicitado_por,
        });
      } else {
        console.log('[cancelarOrdemOdoo] OS cancelada no Odoo com sucesso:', {
          odoo_id: odooIdNumerico,
          status: resp.status,
          solicitado_por,
        });
      }
    } catch (e) {
      odoo_erro = `Falha de rede/conexão ao Odoo: ${e.message}`;
      console.error('[cancelarOrdemOdoo] ERRO de conexão:', {
        odoo_id: odooIdNumerico,
        erro: e.message,
        solicitado_por,
      });
    }

    // ── 4) Retorno + Log de auditoria ──
    const log = {
      tentado_em,
      solicitado_por,
      solicitado_por_id: user.id,
      odoo_id_enviado: odooIdNumerico,
      odoo_status,
      odoo_notificado,
      odoo_erro,
      odoo_resposta,
    };

    if (odoo_notificado) {
      return Response.json({
        status: 'ok',
        message: '🟢 OS cancelada no Odoo com sucesso',
        ...log,
      });
    }

    return Response.json({
      status: 'erro_odoo',
      message: odoo_erro || 'O Odoo não confirmou o cancelamento.',
      ...log,
    }, { status: 502 });
  } catch (error) {
    console.error('[cancelarOrdemOdoo] ERRO inesperado:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});