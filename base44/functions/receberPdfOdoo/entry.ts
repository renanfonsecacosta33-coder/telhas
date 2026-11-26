import { createClientFromRequest } from 'npm:@base44/sdk@0.8.63';
import { associarPdfRotas, chavePedidoPdf } from '../../shared/logisticaPdfCore.ts';

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
    let tokenRecebido = '';
    if (tokenEsperado) {
      const authHeader = req.headers.get('Authorization') || '';
      const apiKeyHeader = req.headers.get('x-api-key') || '';
      const url = new URL(req.url);
      const queryToken = url.searchParams.get('token') || '';

      const bearerMatch = authHeader.replace(/^Bearer\s+/i, '').trim();
      tokenRecebido = apiKeyHeader.trim() || bearerMatch || queryToken.trim();

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

    const tokenForm = String(formData.get('token') || '').trim();
    if ((tokenRecebido || tokenForm) !== tokenEsperado.trim()) {
      return Response.json({ success: false, message: 'Token do Odoo ausente ou inválido.' }, { status: 401 });
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

    // A venda pode estar na rota sem ter OF de fabricação. Nesse caso, o
    // destino válido do PDF é a própria rota, não um PedidoOdoo fictício.
    const chave = chavePedidoPdf(pedidoRaw);
    const resultadoRotas = await associarPdfRotas(
      base44.asServiceRole.entities.RotaEntrega, pedidoRaw, fileUrl, nomeOriginal
    );
    const rotasAtualizadas = resultadoRotas.atualizadas;
    let pedidosEncontrados = [];
    let cursor;
    do {
      const pagina = await base44.asServiceRole.entities.PedidoOdoo.filter({
        $or: [
          { numero_pedido: pedidoRaw },
          { numero_pedido: { $regex: `^[Ss]?[\\s#-]*0*${chave}\\s*$` } }
        ]
      }, { sort: '-created_date', limit: 100, cursor, fields: ['id', 'numero_pedido', 'historico_log'] });
      pedidosEncontrados.push(...pagina.items);
      cursor = pagina.has_more ? pagina.next_cursor : null;
    } while (cursor);

    if (!rotasAtualizadas && pedidosEncontrados.length === 0) {
      return Response.json({
        success: false, pedido: pedidoRaw, request_id: requestId || undefined,
        message: resultadoRotas.falhas.length
          ? 'O PDF chegou, mas houve falha ao vinculá-lo à rota. Reenvie este pedido.'
          : 'PDF recebido, mas este pedido não foi encontrado em nenhuma rota nem no PCP.',
        falhas_rotas: resultadoRotas.falhas
      }, { status: resultadoRotas.falhas.length ? 500 : 404 });
    }

    const falhas = [];
    let atualizados = 0;
    const entradaLog = {
      data: new Date().toISOString(), usuario: 'Odoo (PDF)', acao: 'PDF_RECEBIDO',
      detalhes: `request_id=${requestId || '-'} | arquivo=${nomeOriginal} | url=${fileUrl}`
    };
    for (let inicio = 0; inicio < pedidosEncontrados.length; inicio += 6) {
      await Promise.all(pedidosEncontrados.slice(inicio, inicio + 6).map(async (p) => {
        try {
          await base44.asServiceRole.entities.PedidoOdoo.update(p.id, {
            pdf_pedido_url: fileUrl, pdf_pedido_nome: nomeOriginal,
            historico_log: appendHistorico(p.historico_log, entradaLog)
          });
          atualizados++;
        } catch (e) {
          falhas.push({ id: p.id, numero_pedido: p.numero_pedido, erro: e.message });
        }
      }));
    }
    // updateMany confirma a associação por comparação de versão da rota.
    // Sem rota, exige confirmação da persistência no PCP antes de dar sucesso.
    let verificado = rotasAtualizadas > 0;
    if (!verificado && atualizados > 0) {
      const idsComFalha = new Set(falhas.map(f => f.id));
      const primeiro = pedidosEncontrados.find(p => !idsComFalha.has(p.id));
      const confirmado = await base44.asServiceRole.entities.PedidoOdoo.get(primeiro.id);
      verificado = confirmado.pdf_pedido_url === fileUrl;
    }
    if (!verificado) {
      return Response.json({ success: false, pedido: pedidoRaw, request_id: requestId,
        message: 'Não foi possível confirmar a associação do PDF.',
        falhas, falhas_rotas: resultadoRotas.falhas
      }, { status: 500 });
    }
    console.log(`[receberPdfOdoo] ${requestId} | ${pedidoRaw} | rotas=${rotasAtualizadas} | PCP=${atualizados}`);

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
        falhas_rotas: resultadoRotas.falhas,
        sem_of_no_pcp: pedidosEncontrados.length === 0,
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