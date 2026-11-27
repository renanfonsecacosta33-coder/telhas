import { createClientFromRequest } from 'npm:@base44/sdk@0.8.63';
import { PDFDocument } from 'npm:pdf-lib@1.17.1';

// A4 deitado em pontos: a foto da folha de rota ocupa a primeira página.
const A4 = { largura: 841.89, altura: 595.28 };
const MAX_BYTES = 25 * 1024 * 1024;

const ehPng = (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;
const ehJpg = (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
const ehPdf = (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46;

async function baixar(url) {
  try {
    const resposta = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!resposta.ok) return null;
    const bytes = new Uint8Array(await resposta.arrayBuffer());
    return bytes.length && bytes.length <= MAX_BYTES ? bytes : null;
  } catch {
    return null;
  }
}

/**
 * Monta o romaneio de impressão de uma rota: foto original da rota na
 * primeira página e, em seguida, uma página para cada PDF recebido do Odoo.
 * Nenhuma folha resumo, tabela ou canhoto é gerada.
 */
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const usuario = await base44.auth.me().catch(e => e.status === 401 ? null : Promise.reject(e));
    if (!usuario) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const { rota_id } = await req.json().catch(() => ({}));
    if (!rota_id) return Response.json({ error: 'rota_id é obrigatório' }, { status: 400 });

    const rota = await base44.entities.RotaEntrega.get(rota_id)
      .catch(e => e.status === 404 ? null : Promise.reject(e));
    if (!rota) return Response.json({ error: 'Rota não encontrada' }, { status: 404 });

    const itens = JSON.parse(rota.itens_json || '[]');
    const documento = await PDFDocument.create();
    let fotoIncluida = false;
    let pdfsIncluidos = 0;
    const falhas = [];

    if (rota.rota_imagem_url) {
      const bytes = await baixar(rota.rota_imagem_url);
      if (bytes) {
        try {
          const imagem = ehPng(bytes) ? await documento.embedPng(bytes)
            : ehJpg(bytes) ? await documento.embedJpg(bytes) : null;
          if (imagem) {
            const pagina = documento.addPage([A4.largura, A4.altura]);
            const escala = Math.min((A4.largura - 36) / imagem.width, (A4.altura - 36) / imagem.height);
            pagina.drawImage(imagem, {
              x: (A4.largura - imagem.width * escala) / 2,
              y: (A4.altura - imagem.height * escala) / 2,
              width: imagem.width * escala,
              height: imagem.height * escala
            });
            fotoIncluida = true;
          }
        } catch {
          falhas.push({ documento: 'Foto da rota', motivo: 'Formato de imagem não suportado' });
        }
      } else {
        falhas.push({ documento: 'Foto da rota', motivo: 'Não foi possível ler a imagem' });
      }
    }

    // Uma página por PDF, na ordem das paradas da rota. O limite de 4 em
    // paralelo mantém a função dentro das conexões simultâneas do runtime.
    const comPdf = itens.filter(item => item.pdf_url);
    for (let inicio = 0; inicio < comPdf.length; inicio += 4) {
      const lote = await Promise.allSettled(comPdf.slice(inicio, inicio + 4).map(async (item) => {
        const bytes = await baixar(item.pdf_url);
        if (!bytes || !ehPdf(bytes)) throw new Error('PDF ilegível');
        return { item, origem: await PDFDocument.load(bytes, { ignoreEncryption: true }) };
      }));
      for (let i = 0; i < lote.length; i++) {
        const resultado = lote[i];
        if (resultado.status === 'rejected') {
          falhas.push({ documento: comPdf[inicio + i].numero_pedido, motivo: resultado.reason?.message || 'PDF ilegível' });
          continue;
        }
        const paginas = await documento.copyPages(resultado.value.origem, resultado.value.origem.getPageIndices());
        paginas.forEach(pagina => documento.addPage(pagina));
        pdfsIncluidos++;
      }
    }

    if (documento.getPageCount() === 0) {
      return Response.json({
        success: false,
        message: 'Esta rota não tem foto nem PDFs para imprimir.',
        falhas
      }, { status: 400 });
    }

    const nome = `Romaneio_${(rota.titulo || 'Rota').replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
    const arquivo = new File([await documento.save()], nome, { type: 'application/pdf' });
    const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file: arquivo });

    return Response.json({
      success: true,
      file_url,
      paginas: documento.getPageCount(),
      foto_incluida: fotoIncluida,
      pdfs_incluidos: pdfsIncluidos,
      sem_pdf: itens.filter(item => !item.pdf_url).map(item => item.numero_pedido),
      falhas
    });
  } catch (error) {
    return Response.json({ error: error.message || String(error) }, { status: 500 });
  }
}