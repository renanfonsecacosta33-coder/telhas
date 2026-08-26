import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/**
 * Notifica a equipe de PCP (in-app) quando um novo PedidoOdoo é criado.
 *
 * Cria um registro de MensagemChat no canal "Central PCP — Novos Pedidos Odoo"
 * com o resumo do pedido (número, cliente, vendedor, unidade, itens).
 *
 * SCAFFOLD: ajuste o conteúdo da mensagem / canal / destinatários conforme
 * a sua operação. Hoje é um broadcast para o canal de PCP.
 */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { pedido_id } = body;

    if (!pedido_id) {
      return Response.json({ error: 'pedido_id é obrigatório' }, { status: 400 });
    }

    // Busca o pedido recém-criado (service role: o gatilho não tem sessão de usuário)
    const pedido = await base44.asServiceRole.entities.PedidoOdoo.get(pedido_id);

    const numero = pedido.numero_pedido || '(sem número)';
    const cliente = pedido.cliente_nome || '(sem cliente)';
    const vendedor = pedido.vendedor_nome || '—';
    const unidade = pedido.unidade || '—';
    const totalItens = pedido.total_itens ?? 0;
    const telhas = pedido.itens_telha_count ?? 0;
    const cd = pedido.itens_cd_count ?? 0;

    const conteudo = [
      `🆕 Novo pedido Odoo recebido`,
      `Número: ${numero}`,
      `Cliente: ${cliente}`,
      `Vendedor: ${vendedor}`,
      `Unidade: ${unidade}`,
      `Itens: ${totalItens} total (Telhas: ${telhas} | Corte & Dobra: ${cd})`,
    ].join('\n');

    // Notificação in-app no canal de PCP
    await base44.asServiceRole.entities.MensagemChat.create({
      canal_tipo: 'pedido',
      canal_id: 'pcp-central',
      canal_label: 'Central PCP — Novos Pedidos Odoo',
      remetente_id: 'system-odoo',
      remetente_nome: 'Integração Odoo',
      conteudo,
      lido: false,
      data_hora: new Date().toISOString(),
    });

    return Response.json({
      status: 'ok',
      notificado: true,
      canal: 'pcp-central',
      numero_pedido: numero,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}