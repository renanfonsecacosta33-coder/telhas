export const chavePedidoPdf = (valor) => String(valor ?? '').replace(/\D/g, '').replace(/^0+/, '');

export function numeroOdooRota(item) {
  const numero = String(item.numero_odoo || item.numero_pedido || '').trim();
  return numero.toUpperCase() === 'NT' ? '' : numero;
}

export function normalizarPedidoPdf(valor) {
  const texto = String(valor ?? '').trim().toUpperCase();
  if (/^S[A-Z0-9]+$/.test(texto)) return texto;
  const digitos = texto.replace(/\D/g, '');
  return digitos ? `S${digitos.padStart(5, '0')}` : '';
}

// Cada callback altera só seu pedido. A comparação com o JSON lido impede
// que dois PDFs recebidos juntos apaguem os vínculos um do outro.
export async function associarPdfRotas(entidade, pedido, fileUrl, nomeOriginal) {
  const chave = chavePedidoPdf(pedido);
  const resultado = { atualizadas: 0, falhas: [] };
  if (!chave) return resultado;
  let cursor;
  do {
    const pagina = await entidade.filter({ itens_json: { $regex: chave } }, {
      sort: '-created_date', limit: 50, cursor, fields: ['id', 'itens_json']
    });
    for (let i = 0; i < pagina.items.length; i += 6) {
      await Promise.all(pagina.items.slice(i, i + 6).map(async (original) => {
        let rota = original;
        for (let tentativa = 0; tentativa < 3; tentativa++) {
          const itens = JSON.parse(rota.itens_json || '[]');
          if (!itens.some(item => chavePedidoPdf(numeroOdooRota(item)) === chave)) return;
          const novos = itens.map(item => chavePedidoPdf(numeroOdooRota(item)) === chave
            ? { ...item, pdf_url: fileUrl, pdf_nome: nomeOriginal } : item);
          const json = JSON.stringify(novos);
          if (json === rota.itens_json) { resultado.atualizadas++; return; }
          const gravacao = await entidade.updateMany(
            { id: rota.id, itens_json: rota.itens_json },
            { $set: { itens_json: json } }
          );
          if (gravacao.updated === 1) { resultado.atualizadas++; return; }
          // Conflito de versão, não erro de rede/rate limit: relê antes de mesclar.
          rota = await entidade.get(rota.id);
        }
        throw new Error('A rota foi alterada durante a associação do PDF. Reenvie este pedido.');
      }).map(async operacao => {
        try { await operacao; }
        catch (erro) { resultado.falhas.push(erro.message); }
      }));
    }
    cursor = pagina.has_more ? pagina.next_cursor : null;
  } while (cursor);
  return resultado;
}