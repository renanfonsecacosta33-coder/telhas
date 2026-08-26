import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: "Não autenticado" }, { status: 401 });
    }

    let body = {};
    try { body = await req.json(); } catch (e) { body = {}; }
    const { ordem_id, ordem_tipo, numero_pedido } = body;
    if (!ordem_id || !ordem_tipo) {
      return Response.json({ error: "ordem_id e ordem_tipo são obrigatórios" }, { status: 400 });
    }

    // Busca todos os apontamentos da OP (assinaturas por etapa)
    const apontamentos = await base44.asServiceRole.entities.ApontamentoEtapa
      .filter({ ordem_id, ordem_tipo }, "data_hora", 50)
      .catch(() => []);

    const etapasConcluidas = apontamentos.length;
    const etapaFinal = apontamentos.find((a) => a.is_etapa_final);

    // Marca o apontamento final como "PDF final gerado" e guarda o link do documento vivo
    const pdf_url = `${new URL(req.url).origin}/producao?pedido=${ordem_id}`;
    if (etapaFinal && !etapaFinal.pdf_final_gerado) {
      await base44.asServiceRole.entities.ApontamentoEtapa.update(etapaFinal.id, {
        pdf_final_gerado: true,
        pdf_final_url: pdf_url,
      });
    }

    // ── Sincronização do link do PDF no Pedido de Vendas do Odoo ──
    // Observação: o Odoo não possui conector OAuth nativo na plataforma Base44.
    // A sincronização real requer a API do Odoo (XML-RPC/REST) configurada via
    // backend function com credenciais (url/database/api_key). Quando o endpoint
    // do Odoo estiver disponível, substituir o bloco abaixo pelo PUT/POST no
    // sale.order correspondente (external_id = numero_pedido), anexando pdf_url
    // como anexo ou campo customizado.
    const odoo_sync = {
      status: "pendente_configuracao_conector_odoo",
      numero_pedido: numero_pedido || null,
      pdf_url,
      mensagem: "PDF final gerado. Sincronização com Odoo aguarda configuração da API/credenciais do Odoo.",
    };

    return Response.json({
      status: "ok",
      ordem_id,
      ordem_tipo,
      numero_pedido: numero_pedido || null,
      etapas_concluidas: etapasConcluidas,
      pdf_final_gerado: !!etapaFinal,
      pdf_url,
      odoo_sync,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});