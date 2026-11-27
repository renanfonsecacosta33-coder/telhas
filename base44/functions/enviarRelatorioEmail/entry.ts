import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const destinatario = String(body.destinatario || body.to || 'renan.costa@ajlferroeaco.com.br').trim();
    const assunto = String(body.assunto || body.subject || '📋 Relatório Diário de Operações — AJL Fábricas').trim();
    const texto = String(body.texto || body.body || '').trim();

    if (!texto) {
      return Response.json({ error: "Campo 'texto' ou 'body' é obrigatório" }, { status: 400 });
    }

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: destinatario,
      subject: assunto,
      body: texto
    });

    return Response.json({
      sucesso: true,
      destinatario,
      assunto,
      enviado_em: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
