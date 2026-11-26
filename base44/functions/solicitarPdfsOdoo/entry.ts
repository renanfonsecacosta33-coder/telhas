import { createClientFromRequest } from 'npm:@base44/sdk@0.8.63';
import { normalizarPedidoPdf, numeroOdooRota } from '../../shared/logisticaPdfCore.ts';

/**
 * Função de Solicitação de PDFs ao Odoo ERP (Base44 -> Odoo)
 *
 * Envia uma requisição HTTP POST para a URL secreta do Webhook do Odoo,
 * contendo o identificador único da requisição (request_id) e a lista
 * de números de pedidos de venda cujos PDFs são necessários.
 *
 * Payload enviado ao Odoo:
 * {
 *   "request_id": "LOG-2026-0001",
 *   "pedidos": ["S07671", "S07672", "S07673"]
 * }
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const usuario = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!usuario) return Response.json({ success: false, message: 'Não autenticado.' }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    const rotaId = body.rota_id || '';
    const pedidosEntrada = Array.isArray(body.pedidos) ? body.pedidos : [];
    const urlDestinoManual = body.odoo_webhook_url || '';

    // A rota salva é a fonte dos números Odoo e dos PDFs já disponíveis.
    // Repetir a ação não reenvia os documentos que já chegaram.
    let pedidos = [...pedidosEntrada];
    let rotaTitulo = '';
    if (rotaId) {
      const rota = await base44.entities.RotaEntrega.get(rotaId)
        .catch(e => e.status === 404 ? null : Promise.reject(e));
      if (!rota) return Response.json({ success: false, message: 'Rota não encontrada.' }, { status: 404 });
      rotaTitulo = rota.titulo || '';
      const itens = JSON.parse(rota.itens_json || '[]');
      pedidos = itens.filter(item => !item.pdf_url).map(numeroOdooRota).filter(Boolean);
      if (pedidos.length === 0) return Response.json({
        success: true, total_pedidos: 0, pedidos: [], ja_disponiveis: true,
        message: 'Não há PDFs pendentes de solicitação nesta rota.'
      });
    }
    const pedidosNormalizados = [...new Set(pedidos.map(normalizarPedidoPdf).filter(Boolean))];
    if (pedidosNormalizados.length === 0) return Response.json({
      success: false, message: 'Nenhum número de pedido Odoo válido para solicitar.'
    }, { status: 400 });

    // Gera um request_id único e rastreável
    const agora = new Date();
    const dataStr = agora.toISOString().slice(0, 10).replace(/-/g, '');
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    const requestId = body.request_id || `LOG-${dataStr}-${randSuffix}`;

    // Obtém a URL do Webhook do Odoo (URL padrão acordada ou Variável de ambiente)
    const odooWebhookUrl = (
      urlDestinoManual ||
      Deno.env.get('ODOO_WEBHOOK_PDFS_URL') ||
      Deno.env.get('ODOO_PDF_WEBHOOK_URL') ||
      'https://ajlferroeaco.odoo.com/web/hook/4c36f83e-8eae-4949-8f3e-0a515fc158a3'
    ).trim();

    const tokenOdoo = (
      Deno.env.get('LOGISTICA_PDF_TOKEN') ||
      'AJL_ok32kf46ncwo15_PDF'
    ).trim();

    const payloadOdoo = {
      request_id: requestId,
      pedidos: pedidosNormalizados,
      token: tokenOdoo,
      timestamp: agora.toISOString(),
      rota_id: rotaId || undefined,
      rota_titulo: rotaTitulo || undefined
    };

    if (!odooWebhookUrl) {
      // URL ainda não cadastrada no ambiente do Base44
      console.warn('[solicitarPdfsOdoo] ODOO_WEBHOOK_PDFS_URL não configurada no ambiente.');
      return Response.json(
        {
          success: false,
          config_pendente: true,
          request_id: requestId,
          pedidos: pedidosNormalizados,
          payload_preparado: payloadOdoo,
          message:
            'A URL secreta do Webhook do Odoo ainda não foi configurada no ambiente do Base44 (variável ODOO_WEBHOOK_PDFS_URL). Assim que a equipe do Odoo fornecer a URL, configure-a no Base44 para envio automático.'
        },
        { status: 200 }
      );
    }

    // Realiza o disparo HTTP POST para o Odoo
    console.log(`[solicitarPdfsOdoo] Enviando solicitação ${requestId} com ${pedidosNormalizados.length} pedido(s) para Odoo...`);
    const respOdoo = await fetch(odooWebhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${tokenOdoo}`,
        'x-api-key': tokenOdoo,
      },
      body: JSON.stringify(payloadOdoo),
      signal: AbortSignal.timeout(180000)
    });

    const odooRespostaTexto = await respOdoo.text();
    let odooRespostaJson: any = null;
    try {
      odooRespostaJson = JSON.parse(odooRespostaTexto);
    } catch {
      odooRespostaJson = { raw: odooRespostaTexto };
    }

    if (!respOdoo.ok) {
      console.error(`[solicitarPdfsOdoo] Erro HTTP ${respOdoo.status} retornado pelo Odoo:`, odooRespostaTexto);
      return Response.json(
        {
          success: false,
          request_id: requestId,
          status_odoo: respOdoo.status,
          message: `Odoo retornou status ${respOdoo.status}. Verifique se o Guilherme já salvou a URL do Base44 no Odoo.`,
          resposta_odoo: odooRespostaJson
        },
        { status: 200 }
      );
    }

    return Response.json(
      {
        success: true,
        request_id: requestId,
        total_pedidos: pedidosNormalizados.length,
        pedidos: pedidosNormalizados,
        message: `Solicitação de PDFs enviada ao Odoo com sucesso (${pedidosNormalizados.length} pedidos).`,
        resposta_odoo: odooRespostaJson
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error('[solicitarPdfsOdoo] Erro fatal:', err);
    return Response.json(
      {
        success: false,
        message: `Erro interno ao solicitar PDFs ao Odoo: ${err.message || String(err)}`
      },
      { status: 500 }
    );
  }
}