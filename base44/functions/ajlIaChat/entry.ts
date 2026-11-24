import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { processarMensagemAjlIa } from '../../shared/ajlIaCore.ts';

// Entry point do Copilot AJL IA - v1.0.1
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

    const payload = (body && typeof body === 'object' && body.data && typeof body.data === 'object')
      ? { ...body, ...body.data }
      : (body || {});

    // Suporte para salvar configurações com asServiceRole
    if (payload.acao === "salvar_config") {
      const { gemini_api_key, zapi_instance_id, zapi_token, telefones_autorizados } = payload;
      const existentes = await base44.asServiceRole.entities.ConfiguracaoIA.list("-created_date", 1).catch(() => []);
      let salvo: any;
      const dados = {
        gemini_api_key: gemini_api_key || "",
        zapi_instance_id: zapi_instance_id || "",
        zapi_token: zapi_token || "",
        telefones_autorizados: telefones_autorizados || "",
        modelo_gemini: "gemini-3.5-flash",
        ativo: true
      };
      if (existentes && existentes.length > 0) {
        salvo = await base44.asServiceRole.entities.ConfiguracaoIA.update(existentes[0].id, dados);
      } else {
        salvo = await base44.asServiceRole.entities.ConfiguracaoIA.create(dados);
      }
      return Response.json({ status: "success", config: salvo }, {
        headers: { "Access-Control-Allow-Origin": "*" }
      });
    }

    const { mensagem, filial, historico_recente } = payload;
    if (!mensagem || typeof mensagem !== "string" || !mensagem.trim()) {
      return Response.json({ error: "Campo 'mensagem' é obrigatório", debug_body: body }, { status: 400 });
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
