import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';
import { processarMensagemAjlIa } from '../../shared/ajlIaCore.ts';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      return Response.json({ status: "ignored_non_json" });
    }

    // 1. Extração de dados da Z-API
    // Z-API envia mensagens no formato { phone: "5541999999999", text: { message: "Olá" }, isGroup: false, fromMe: false }
    const isFromMe = payload.fromMe || payload.isFromMe;
    if (isFromMe) {
      // Ignora mensagens enviadas pelo próprio bot
      return Response.json({ status: "ignored_from_me" });
    }

    const telefoneRemetente = String(payload.phone || payload.senderPhone || payload.from || "").replace(/\D/g, "");
    const nomeRemetente = payload.senderName || payload.chatName || "Colaborador";
    const textoMensagem = String(payload.text?.message || payload.body || payload.message || "").trim();

    if (!telefoneRemetente || !textoMensagem) {
      return Response.json({ status: "ignored_no_text_or_phone" });
    }

    // 2. Carrega configurações e valida Whitelist de telefones
    let config: any = null;
    try {
      const configs = await base44.asServiceRole.entities.ConfiguracaoIA.list("-created_date", 1);
      if (configs && configs.length > 0) config = configs[0];
    } catch (e) {
      console.warn("[zapiWebhook] Erro ao ler config:", e);
    }

    const instanceId = config?.zapi_instance_id || Deno.env.get("ZAPI_INSTANCE_ID") || "";
    const token = config?.zapi_token || Deno.env.get("ZAPI_TOKEN") || "";
    const clientToken = config?.zapi_client_token || Deno.env.get("ZAPI_CLIENT_TOKEN") || "";
    const telefonesAutorizadosRaw = String(config?.telefones_autorizados || "").split(",");

    const listaPermitidos = telefonesAutorizadosRaw
      .map(t => t.replace(/\D/g, "").trim())
      .filter(t => t.length >= 8);

    // Função auxiliar para responder via Z-API
    const enviarZApiTexto = async (texto: string) => {
      if (!instanceId || !token) {
        console.warn("[zapiWebhook] Z-API não configurada (instanceId/token ausentes).");
        return;
      }
      try {
        await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(clientToken ? { "Client-Token": clientToken } : {})
          },
          body: JSON.stringify({
            phone: telefoneRemetente,
            message: texto
          })
        });
      } catch (errZ) {
        console.error("[zapiWebhook] Erro ao enviar texto via Z-API:", errZ);
      }
    };

    const enviarZApiPdf = async (pdfUrl: string, nomeArquivo: string) => {
      if (!instanceId || !token || !pdfUrl) return;
      try {
        await fetch(`https://api.z-api.io/instances/${instanceId}/token/${token}/send-document/pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(clientToken ? { "Client-Token": clientToken } : {})
          },
          body: JSON.stringify({
            phone: telefoneRemetente,
            document: pdfUrl,
            fileName: nomeArquivo || "Pedido.pdf"
          })
        });
      } catch (errPdf) {
        console.error("[zapiWebhook] Erro ao enviar PDF via Z-API:", errPdf);
      }
    };

    // Validação de número autorizado
    const ehAutorizado = listaPermitidos.length === 0 || listaPermitidos.some(perm => telefoneRemetente.endsWith(perm) || perm.endsWith(telefoneRemetente));

    if (!ehAutorizado) {
      await enviarZApiTexto(
        `Olá! Sou o *AJL IA*, assistente operacional da AJL Ferro e Aço 🏭.\n\n` +
        `🔒 *Acesso Restrito:* Seu número de WhatsApp (${telefoneRemetente}) não consta na lista de colaboradores autorizados para consultar a fábrica.\n\n` +
        `Solicite liberação ao seu gestor ou departamento de TI.`
      );
      return Response.json({ status: "blocked_unauthorized_phone", phone: telefoneRemetente });
    }

    // 3. Processa mensagem através do cérebro AJL IA
    const resposta = await processarMensagemAjlIa(base44, {
      mensagem: textoMensagem,
      canal: "whatsapp",
      sessao_id: telefoneRemetente,
      remetente_nome: nomeRemetente,
      remetente_telefone: telefoneRemetente,
      filial_preferida: "Matriz AJL"
    });

    // 4. Envia resposta de volta no WhatsApp
    if (resposta.texto) {
      await enviarZApiTexto(resposta.texto);
    }

    if (resposta.pdf_url) {
      await enviarZApiPdf(resposta.pdf_url, resposta.pdf_nome || "Pedido_AJL.pdf");
    }

    return Response.json({
      status: "success",
      phone: telefoneRemetente,
      tools_usadas: resposta.tools_usadas,
      teve_pdf: !!resposta.pdf_url
    });
  } catch (error: any) {
    console.error("[zapiWebhook] Erro fatal:", error);
    return Response.json({ error: error?.message || "Erro interno" }, { status: 500 });
  }
});
