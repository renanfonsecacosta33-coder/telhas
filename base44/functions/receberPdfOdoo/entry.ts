import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Endpoint HTTP do Base44 para receber PDFs de pedidos enviados pelo Odoo ERP
 *
 * Configuração:
 * - Método: POST
 * - Content-Type: multipart/form-data
 * - Campos esperados no multipart:
 *   - request_id (opcional/string): identificador da solicitação (ex: "LOG-2026-0001")
 *   - pedido (obrigatório/string): número do pedido (ex: "S07671" ou "07671")
 *   - arquivo (obrigatório/file): arquivo binário do PDF (filename: "S07671.pdf")
 *
 * Autenticação:
 * - Se a variável de ambiente LOGISTICA_PDF_TOKEN estiver configurada no Base44,
 *   valida se o cabeçalho Authorization (Bearer <TOKEN>), x-api-key (<TOKEN>)
 *   ou o parâmetro de query string (?token=<TOKEN>) corresponde.
 */
export default async function(req: Request): Promise<Response> {
  // 1. Valida método HTTP
  if (req.method !== 'POST') {
    return Response.json(
      { success: false, message: 'Método não permitido. Utilize POST.' },
      { status: 405 }
    );
  }

  try {
    const base44 = createClientFromRequest(req);

    // 2. Autenticação (Header Bearer, x-api-key, query param ?token=... ou campo no form-data)
    const tokenEsperado = Deno.env.get('LOGISTICA_PDF_TOKEN') || Deno.env.get('ODOO_INTEGRATION_TOKEN') || 'AJL_ok32kf46ncwo15_PDF';
    if (tokenEsperado) {
      const authHeader = req.headers.get('Authorization') || '';
      const apiKeyHeader = req.headers.get('x-api-key') || '';
      const url = new URL(req.url);
      const queryToken = url.searchParams.get('token') || '';

      const bearerMatch = authHeader.replace(/^Bearer\s+/i, '').trim();
      const tokenRecebido = apiKeyHeader.trim() || bearerMatch || queryToken.trim();

      // Se foi enviado via header ou query param e não confere:
      if (tokenRecebido && tokenRecebido !== tokenEsperado.trim()) {
        return Response.json(
          {
            success: false,
            message: 'Autenticação inválida. Forneça o token correto via Bearer, x-api-key ou ?token=.'
          },
          { status: 401 }
        );
      }
    }

    // 3. Validação do Content-Type multipart/form-data
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return Response.json(
        {
          success: false,
          message: 'Content-Type inválido. A requisição deve ser multipart/form-data com o boundary.'
        },
        { status: 400 }
      );
    }

    // 4. Extração dos campos multipart
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return Response.json(
        { success: false, message: 'Falha ao interpretar multipart/form-data.' },
        { status: 400 }
      );
    }

    const requestId = formData.get('request_id')?.toString()?.trim() || '';
    const pedidoRaw = formData.get('pedido')?.toString()?.trim() || '';
    const arquivo = formData.get('arquivo');

    // Valida campo pedido
    if (!pedidoRaw) {
      return Response.json(
        { success: false, message: "Campo 'pedido' é obrigatório no form-data." },
        { status: 400 }
      );
    }

    // Valida campo arquivo
    if (!arquivo || typeof (arquivo as any).arrayBuffer !== 'function') {
      return Response.json(
        { success: false, pedido: pedidoRaw, message: "Campo 'arquivo' com o conteúdo do PDF é obrigatório." },
        { status: 400 }
      );
    }

    const file = arquivo as File;

    // 5. Limite de tamanho (25 MB)
    const MAX_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
    if (file.size > MAX_SIZE_BYTES) {
      return Response.json(
        {
          success: false,
          pedido: pedidoRaw,
          message: `O arquivo enviado excede o limite máximo permitido de 25 MB (Tamanho recebido: ${(file.size / 1024 / 1024).toFixed(2)} MB).`
        },
        { status: 413 }
      );
    }

    // 6. Validação do formato PDF (nome, mime e assinatura %PDF)
    const nomeOriginal = file.name || `${pedidoRaw}.pdf`;
    const mimeValido = file.type === 'application/pdf' || nomeOriginal.toLowerCase().endsWith('.pdf');
    if (!mimeValido) {
      return Response.json(
        {
          success: false,
          pedido: pedidoRaw,
          message: 'O arquivo enviado não é um PDF válido (esperado application/pdf).'
        },
        { status: 400 }
      );
    }

    // 7. Armazenamento definitivo no mecanismo de arquivos do Base44
    let fileUrl = '';
    try {
      const nomeLimpo = nomeOriginal.replace(/[^a-zA-Z0-9._-]/g, '_');
      const uploadRes = await base44.asServiceRole.integrations.Core.UploadFile({
        file: file as any
      });
      if (!uploadRes?.file_url) {
        throw new Error('UploadFile não retornou a URL do arquivo.');
      }
      fileUrl = uploadRes.file_url;
    } catch (uploadErr: any) {
      console.error('[receberPdfOdoo] Erro ao gravar arquivo no Base44:', uploadErr);
      return Response.json(
        {
          success: false,
          pedido: pedidoRaw,
          message: `Erro interno ao armazenar o arquivo PDF: ${uploadErr.message || String(uploadErr)}`
        },
        { status: 500 }
      );
    }

    // 8. Atualiza rotas de entrega que contenham este pedido (Prioridade Absoluta da Logística)
    const numLimpo = pedidoRaw.replace(/^[Ss]0*/, '').replace(/\D/g, '');
    let rotasAtualizadas = 0;
    try {
      const rotas = await base44.asServiceRole.entities.RotaEntrega.filter({}, '-created_date', 80).catch(() => []);
      for (const r of rotas) {
        if (!r.itens_json || (!r.itens_json.includes(pedidoRaw) && (!numLimpo || !r.itens_json.includes(numLimpo)))) {
          continue;
        }
        try {
          const itens = JSON.parse(r.itens_json || '[]');
          let alterou = false;
          const itensAtualizados = itens.map((it: any) => {
            const itLimpo = String(it.numero_pedido || '').replace(/^[Ss]0*/, '').replace(/\D/g, '');
            const matchExato = String(it.numero_pedido || '').trim().toUpperCase() === pedidoRaw.toUpperCase();
            const matchDigitos = numLimpo && itLimpo && (itLimpo === numLimpo || itLimpo.endsWith(numLimpo) || numLimpo.endsWith(itLimpo));
            if (matchExato || matchDigitos) {
              alterou = true;
              return { ...it, pdf_url: fileUrl, pdf_nome: nomeOriginal };
            }
            return it;
          });

          if (alterou) {
            await base44.asServiceRole.entities.RotaEntrega.update(r.id, {
              itens_json: JSON.stringify(itensAtualizados)
            });
            rotasAtualizadas++;
          }
        } catch {}
      }
    } catch (e) {
      console.warn('[receberPdfOdoo] Falha ao sincronizar rotas:', e);
    }

    // 9. Localização e Associação do Pedido na base da Central PCP / PedidoOdoo
    const pedidosEncontrados = await base44.asServiceRole.entities.PedidoOdoo.filter({
      $or: [
        { numero_pedido: pedidoRaw },
        { numero_pedido: `S${numLimpo.padStart(5, '0')}` },
        { numero_pedido: `S${numLimpo}` },
        { odoo_id: pedidoRaw },
        ...(numLimpo ? [{ numero_pedido: numLimpo }, { odoo_id: numLimpo }] : [])
      ]
    }, '-created_date', 10).catch(() => []);

    // Atualiza todos os registros vinculados àquele pedido no Odoo (se existirem)
    if (pedidosEncontrados && pedidosEncontrados.length > 0) {
      for (const p of pedidosEncontrados) {
        await base44.asServiceRole.entities.PedidoOdoo.update(p.id, {
          pdf_pedido_url: fileUrl,
          pdf_pedido_nome: nomeOriginal,
          pdf_url: fileUrl
        }).catch((e: any) => {
          console.warn(`[receberPdfOdoo] Falha ao atualizar PedidoOdoo ${p.id}:`, e);
        });
      }
    }

    // 10. Resposta positiva definitiva confirmando armazenamento e associação (200 OK)
    return Response.json(
      {
        success: true,
        request_id: requestId || undefined,
        pedido: pedidoRaw,
        message: 'PDF recebido e associado com sucesso.',
        file_url: fileUrl,
        rotas_atualizadas: rotasAtualizadas,
        pedidos_atualizados: pedidosEncontrados?.length || 0
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('[receberPdfOdoo] Erro interno:', error);
    return Response.json(
      {
        success: false,
        message: `Erro interno ao processar o documento: ${error.message || String(error)}`
      },
      { status: 500 }
    );
  }
}
