import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Executa uma leitura/escrita com paciência: respeita a janela "Retry after N seconds"
// informada pelo servidor (limite de volume de tráfego) em vez de falhar rápido.
async function comPaciencia(fn, tentativas = 5) {
  let ultimoErro;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await fn();
    } catch (e) {
      ultimoErro = e;
      const msg = String(e?.message || e?.detail || e || "");
      const m = msg.match(/Retry after (\d+) seconds/i);
      const espera = m ? Math.min(Number(m[1]) * 1000 + 2000, 35000) : 12000 * (i + 1);
      console.log(`[ReenvioBobininhas] tentativa ${i + 1} falhou: ${msg.slice(0, 90)}. Aguardando ${Math.round(espera / 1000)}s...`);
      await sleep(espera);
    }
  }
  throw ultimoErro;
}

// AUDITORIA E REENVIO DE BOBININHAS → DESBOBINADOR
// Garante que todo pedido ativo com item de Bobininha tenha uma OP viva
// na máquina DESBOBINADOR e o item marcado como em produção.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Não autenticado' }, { status: 401 });
    }
    const role = String(user.role || "").toLowerCase();
    if (!['admin', 'super_admin', 'gestor'].includes(role)) {
      return Response.json({ error: 'Apenas gestores podem executar esta manutenção' }, { status: 403 });
    }

    const hoje = new Date().toISOString().slice(0, 10);
    const srv = base44.asServiceRole;

    // 1. Pedidos ativos com bobininhas (leitura mínima — filtro aplicado no servidor)
    const comBob = await comPaciencia(() =>
      srv.entities.PedidoOdoo.filter({
        status_pcp: { $nin: ['concluido'] },
        itens_json: { $regex: 'obininh' }
      }, '-data_recebimento', 100)
    );

    // 2. OPs de bobininha existentes (vivas e canceladas)
    const ops = await comPaciencia(() =>
      srv.entities.Pedido.filter({ $or: [{ maquina: 'DESBOBINADOR' }, { produto: 'BOBININHA' }] }, '-created_date', 200)
    );

    const vivaPorPedido = new Map();
    for (const o of ops || []) {
      if (o.status === 'cancelado' || o.status === 'finalizado') continue;
      if (o.pedido_odoo_id) vivaPorPedido.set(String(o.pedido_odoo_id), o);
      if (o.numero_pedido) vivaPorPedido.set('NUM_' + o.numero_pedido, o);
    }

    const resultados = [];
    for (const p of comBob || []) {
      let itens = [];
      try { itens = JSON.parse(p.itens_json || '[]'); } catch { continue; }

      const idxBob = [];
      itens.forEach((it, idx) => {
        const t = `${it.produto || ''} ${it.descricao || ''} ${it.observacao || ''}`;
        if (/obininh|slitter|fita\s*de\s*a[cç]o|desbobinamento/i.test(t) && it.status !== 'concluido') idxBob.push(idx);
      });
      if (idxBob.length === 0) continue;

      const opViva = vivaPorPedido.get(String(p.id)) || vivaPorPedido.get('NUM_' + p.numero_pedido);
      const it0 = itens[idxBob[0]];
      const texto = `${it0.produto || ''} ${it0.descricao || ''}`.toUpperCase();

      let qtd = Number((texto.match(/(\d+)\s*BOBINA/i) || [])[1]) || Number(it0.quantidade) || 1;
      if (qtd > 50) qtd = 1;
      const mmRaw = (texto.match(/COM\s*([\d.,]+)\s*MM/i) || [])[1] || '';
      const mm = Number(mmRaw.replace(/[.,]/g, '')) || Math.round((Number(it0.quantidade) || 1) * 1000);
      const espMatch = texto.match(/(\d+[.,]\d{2})/);
      const esp = espMatch ? espMatch[1] : '0,43';
      const espNum = parseFloat(esp.replace(',', '.')) || 0.43;
      const totalM = +((qtd * mm) / 1000).toFixed(2) || Number(it0.quantidade) || 1;
      const kg = Math.round(totalM * espNum * 7.85 * 1.2);
      const origem = /IMPORT/i.test(texto) ? 'Importado' : (/NACIONAL/i.test(texto) ? 'Nacional' : 'ambas');
      const dataReceb = p.data_recebimento ? String(p.data_recebimento).slice(0, 10) : hoje;

      let acao;
      if (opViva) {
        acao = 'op_ja_viva';
      } else {
        const nova = await comPaciencia(() =>
          srv.entities.Pedido.create({
            data: hoje,
            data_pedido: dataReceb,
            data_prevista: p.data_entrega ? String(p.data_entrega).slice(0, 10) : hoje,
            numero_pedido: p.numero_pedido || '',
            numero_oc: p.numero_oc || '',
            cliente: p.cliente_nome || p.cliente || '',
            vendedor: p.vendedor_nome || p.vendedor || '',
            unidade: p.unidade || 'Matriz AJL',
            produto: 'BOBININHA',
            modelo: 'DESBOBINADOR',
            maquina: 'DESBOBINADOR',
            maquina_origem: 'DESBOBINADOR',
            status: 'pendente',
            espessura_exigida: esp,
            origem_exigida: origem,
            cor_exigida: 'NATURAL',
            metros: qtd,
            quantidade_telhas: qtd,
            metragem_mm: mm,
            metragem_planejada: totalM,
            kg_total: kg,
            variacoes_telhas: JSON.stringify([{ qty: qtd, mm, m: +(mm / 1000).toFixed(3), total_m: totalM, largura_mm: 1200, corte: '1200', tipo: 'bobininha' }]),
            observacoes: `Reenvio automático PCP → Desbobinador — ${(it0.descricao || it0.produto || '').slice(0, 120)}`,
            pedido_odoo_id: p.id,
            of_odoo_id: p.of_odoo_id || '',
            of_nome: p.of_nome || '',
            item_idx: idxBob[0],
            item_produto: it0.produto || '',
            foto_pedido_url: p.foto_pedido_url || ''
          })
        );
        acao = 'op_recriada';
        if (p.id) vivaPorPedido.set(String(p.id), nova);
      }

      // Marca os itens de bobininha como em produção no Desbobinador
      const novosItens = itens.map((it, idx) =>
        idxBob.includes(idx) ? { ...it, status: 'em_producao', distribuido: true, maquina: 'DESBOBINADOR' } : it
      );

      const log = (() => { try { return JSON.parse(p.historico_log || '[]'); } catch { return []; } })();
      log.push({
        data: new Date().toISOString(),
        usuario: user.full_name || user.email || 'PCP',
        acao: 'reenvio_bobininha_desbobinador',
        detalhes: 'Auditoria de bobininhas: OP garantida no DESBOBINADOR e item marcado em produção.'
      });

      const todosDistribuidos = novosItens.every((it) => it.status === 'concluido' || it.status === 'em_producao' || it.distribuido);
      const novoStatusPcp = todosDistribuidos ? 'em_producao' : (p.status_pcp === 'pendente_distribuicao' ? 'distribuido' : p.status_pcp);

      await comPaciencia(() =>
        srv.entities.PedidoOdoo.update(p.id, {
          itens_json: JSON.stringify(novosItens),
          status_pcp: novoStatusPcp,
          percentual_concluido: Math.max(p.percentual_concluido || 0, 15),
          retirado_manualmente_ts: '',
          historico_log: JSON.stringify(log)
        })
      );

      resultados.push({ pedido: p.numero_pedido, unidade: p.unidade, acao });
    }

    return Response.json({ ok: true, total: resultados.length, processados: resultados });
  } catch (error) {
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});