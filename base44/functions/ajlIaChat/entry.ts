import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { processarMensagemAjlIa } from '../../shared/ajlIaCore.ts';

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "Payload JSON inválido" }, { status: 400 });
    }

    const { mensagem, filial, historico_recente } = body;
    if (!mensagem || typeof mensagem !== "string" || !mensagem.trim()) {
      return Response.json({ error: "Campo 'mensagem' é obrigatório" }, { status: 400 });
    }

    const resposta = await processarMensagemAjlIa(base44, {
      mensagem: mensagem.trim(),
      canal: "web_app",
      sessao_id: user?.id || "anonimo",
      remetente_nome: user?.full_name || user?.email || "Colaborador",
      filial_preferida: filial || "Matriz AJL",
      historico_recente: Array.isArray(historico_recente) ? historico_recente : []
    });

    return Response.json(resposta, {
      headers: { "Access-Control-Allow-Origin": "*" }
    });
  } catch (error: any) {
    console.error("[ajlIaChat] Erro fatal:", error);
    return Response.json({
      error: error?.message || "Erro interno do AJL IA",
      sucesso: false
    }, { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
});
