import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const titulo = body.titulo || 'Rota de Entrega';
    const unidade = body.unidade || '—';
    const motorista = body.motorista || '';
    const placa = body.placa || '';
    const itens_count = body.itens_count || 0;
    const entrega_date = body.entrega_date || '';
    const criado_por = body.criado_por || user.full_name || '—';

    // Busca encarregados / admins para notificar
    const users = await base44.asServiceRole.entities.User.list();
    const destinatarios = users.filter(
      (u) => ['admin', 'super_admin', 'gestor'].includes(u.role) && u.email
    );

    const assunto = `🚚 Nova Rota de Entrega — ${titulo}`;
    const linhas = [
      `Uma nova rota de entrega foi adicionada ao sistema:`,
      ``,
      `📋 Rota: ${titulo}`,
      `🏭 Unidade: ${unidade}`,
      entrega_date ? `📅 Entrega: ${entrega_date}` : null,
      motorista ? `👤 Motorista: ${motorista}` : null,
      placa ? `🚛 Placa: ${placa}` : null,
      `📦 Pedidos: ${itens_count}`,
      `👤 Adicionada por: ${criado_por}`,
      ``,
      `Acesse o app para visualizar e organizar o carregamento nos barracões.`
    ].filter(Boolean);
    const texto = linhas.join('\n');

    let enviados = 0;
    for (const u of destinatarios) {
      try {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: u.email,
          subject: assunto,
          body: texto
        });
        enviados++;
      } catch {}
    }

    return Response.json({ success: true, enviados, total: destinatarios.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}