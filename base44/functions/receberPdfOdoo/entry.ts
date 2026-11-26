import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Compara números ignorando "S", espaços, hífens e zeros à esquerda (S05623 = S-5623 = 5623)
const chaveNumero = (valor: any): string =>
  String(valor ?? '').replace(/\D/g, '').replace(/^0+/, '');

// Registra o recebimento no histórico do pedido para auditoria por request_id
const appendHistorico = (atual: any, entrada: any): string => {
  let arr: any[] = [];
  try {
    const parsed = JSON.parse(atual || '[]');
    arr = Array.isArray(parsed) ? parsed : [];
  } catch {
    arr = [];
  }
  arr.push(entrada);
  return JSON.stringify(arr.slice(-100));
};

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

    // 8. Localização e Associação do Pedido na base da Logística / PCP
    const numLimpo = pedidoRaw.replace(/^[Ss]0*/, '').replace(/\D/g, '');
    const chave = chaveNumero(pedidoRaw);

    let pedidosEncontrados: any[] = await base44.asServiceRole.entities.PedidoOdoo.filter({
      $or: [
        { numero_pedido: pedidoRaw },
        { numero_pedido: `S${numLimpo.padStart(5, '0')}` },
        { numero_pedido: `S${numLimpo}` },
        { odoo_id: pedidoRaw },
        ...(numLimpo ? [{ numero_pedido: numLimpo }, { odoo_id: numLimpo }] : [])
      ]
    }, '-created_date', 10).catch(() => []);

    // Busca tolerante: compara somente os dígitos (cobre "S05623", "S-05623", "05623", espaços etc.)
    if (pedidosEncontrados.length === 0 && chave) {
      const recentes: any[] = await base44.asServiceRole.entities.PedidoOdoo
        .filter({}, '-created_date', 3000)
        .catch(() => []);
      pedidosEncontrados = recentes.filter((p: any) =>
        chaveNumero(p.numero_pedido) === chave ||
        chaveNumero(p.numero_oc) === chave ||
        chaveNumero(p.of_nome) === chave
      );
    }

    if (pedidosEncontrados.length === 0) {
      // Pedido não localizado na base do Base44: o PDF fica no storage, mas NÃO existe
      // registro na Logística para recebê-lo. Não é sucesso.
      console.warn(`[receberPdfOdoo] ${requestId || '-'} | ${pedidoRaw} não existe em PedidoOdoo. Arquivo: ${fileUrl}`);
      return Response.json(
        {
          success: false,
          pedido: pedidoRaw,
          request_id: requestId || undefined,
          message: 'Pedido não encontrado na Logística: não existe registro deste número em PedidoOdoo (o pedido não chegou pelo webhook do Odoo). O PDF foi mantido no storage, mas não foi associado.',
          chave_buscada: chave,
          file_url_salvo: fileUrl
        },
        { status: 404 }
      );
    }

    // Atualiza todos os registros vinculados àquele pedido no Odoo
    const falhas: any[] = [];
    let atualizados = 0;
    const entradaLog = {
      data: new Date().toISOString(),
      usuario: 'Odoo (PDF)',
      acao: 'PDF_RECEBIDO',
      detalhes: `request_id=${requestId || '-'} | arquivo=${nomeOriginal} | url=${fileUrl}`
    };

    for (const p of pedidosEncontrados) {
      try {
        await base44.asServiceRole.entities.PedidoOdoo.update(p.id, {
          pdf_pedido_url: fileUrl,
          pdf_pedido_nome: nomeOriginal,
          historico_log: appendHistorico(p.historico_log, entradaLog)
        });
        atualizados++;
      } catch (e: any) {
        falhas.push({ id: p.id, numero_pedido: p.numero_pedido, erro: e?.message || String(e) });
        console.error(`[receberPdfOdoo] Falha ao atualizar PedidoOdoo ${p.id} (${p.numero_pedido}):`, e);
      }
    }

    if (atualizados === 0) {
      return Response.json(
        {
          success: false,
          pedido: pedidoRaw,
          request_id: requestId || undefined,
          message: 'PDF salvo no storage, mas nenhum registro da Logística pôde ser atualizado.',
          file_url_salvo: fileUrl,
          pedidos_encontrados: pedidosEncontrados.length,
          falhas
        },
        { status: 500 }
      );
    }

    // Confirma a gravação lendo o registro de volta antes de responder sucesso
    let verificado = false;
    try {
      const conf = await base44.asServiceRole.entities.PedidoOdoo.get(pedidosEncontrados[0].id);
      verificado = String(conf?.pdf_pedido_url || '') === String(fileUrl);
      if (!verificado) {
        return Response.json(
          {
            success: false,
            pedido: pedidoRaw,
            request_id: requestId || undefined,
            message: 'O PDF foi salvo, mas a confirmação de gravação no pedido falhou. Nada foi associado.',
            file_url_salvo: fileUrl,
            pedidos_encontrados: pedidosEncontrados.length,
            falhas
          },
          { status: 500 }
        );
      }
    } catch (eVer: any) {
      console.warn('[receberPdfOdoo] Não foi possível reler o registro para conferência:', eVer?.message || eVer);
    }

    // 9. Atualiza rotas de entrega que contenham este pedido
    let rotasAtualizadas = 0;
    try {
      const rotas = await base44.asServiceRole.entities.RotaEntrega.filter({}, '-created_date', 200).catch(() => []);
      for (const r of rotas) {
        if (!r.itens_json || (!r.itens_json.includes(pedidoRaw) && (!numLimpo || !r.itens_json.includes(numLimpo)))) {
          continue;
        }
        try {
          const itens = JSON.parse(r.itens_json || '[]');
          let alterou = false;
          const itensAtualizados = itens.map((it: any) => {
            if (chave && chaveNumero(it.numero_pedido) === chave) {
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
        } catch (eRota: any) {
          console.warn(`[receberPdfOdoo] Falha ao atualizar rota ${r.id}:`, eRota?.message || eRota);
        }
      }
    } catch (e) {
      console.warn('[receberPdfOdoo] Falha ao sincronizar rotas:', e);
    }

    // 10. Resposta positiva definitiva confirmando armazenamento e associação
    return Response.json(
      {
        success: true,
        request_id: requestId || undefined,
        pedido: pedidoRaw,
        message: 'PDF salvo e associado ao pedido na Logística.',
        file_url: fileUrl,
        pedidos_encontrados: pedidosEncontrados.length,
        pedidos_atualizados: atualizados,
        pedidos_com_falha: falhas,
        rotas_atualizadas: rotasAtualizadas,
        gravacao_confirmada: verificado
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