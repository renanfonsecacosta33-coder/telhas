import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

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
    const body = await req.json().catch(() => ({}));

    const rotaId = body.rota_id || '';
    const pedidosEntrada = Array.isArray(body.pedidos) ? body.pedidos : [];
    const urlDestinoManual = body.odoo_webhook_url || '';

    // Se pedidos não foram informados mas rota_id foi, extrai da rota
    let pedidos = [...pedidosEntrada];
    let rotaTitulo = '';

    if (pedidos.length === 0 && rotaId) {
      try {
        const rota = await base44.asServiceRole.entities.RotaEntrega.get(rotaId);
        if (rota) {
          rotaTitulo = rota.titulo || '';
          const itens = JSON.parse(rota.itens_json || '[]');
          pedidos = itens.map((it: any) => it.numero_pedido).filter(Boolean);
        }
      } catch (e) {
        console.warn('[solicitarPdfsOdoo] Falha ao ler rota:', e);
      }
    }

    if (pedidos.length === 0) {
      return Response.json(
        { success: false, message: 'Nenhum pedido informado para solicitação de PDF.' },
        { status: 400 }
      );
    }

    // Normaliza os números para o padrão do Odoo (ex: "07671" -> "S07671", "7671" -> "S07671")
    const pedidosNormalizados: string[] = Array.from(
      new Set(
        pedidos.map((p: any) => {
          const str = String(p).trim().toUpperCase();
          if (str.startsWith('S') && /^[A-Z0-9]+$/.test(str)) {
            return str;
          }
          const digitos = str.replace(/\D/g, '');
          if (digitos) {
            return `S${digitos.padStart(5, '0')}`;
          }
          return str;
        }).filter(Boolean)
      )
    );

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

    const hostReq = req.headers.get('host') || '6a0467e5d5ff5dda4351d2c3.base44.app';
    const callbackUrl = `https://${hostReq}/api/functions/receberPdfOdoo`;

    const payloadOdoo = {
      request_id: requestId,
      pedidos: pedidosNormalizados,
      token: tokenOdoo,
      timestamp: agora.toISOString(),
      rota_id: rotaId || undefined,
      rota_titulo: rotaTitulo || undefined,
      callback_url: callbackUrl,
      webhook_url: callbackUrl,
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
      body: JSON.stringify(payloadOdoo)
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
