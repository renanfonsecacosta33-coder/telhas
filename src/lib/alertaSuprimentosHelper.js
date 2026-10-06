import { base44 } from "@/api/base44Client";

// Limites padrão inteligentes de segurança por espessura (Ponto de Ressuprimento em KG)
export const LIMITES_PADRAO_ESPESSURA = {
  // Telhas e Bobinas Finas
  "0,43": { minimo_kg: 3000, setor: "telha", label: "Chapa 28 (0,43mm)" },
  "0,50": { minimo_kg: 3000, setor: "telha", label: "Chapa 26 (0,50mm)" },
  "0,65": { minimo_kg: 1500, setor: "telha", label: "Chapa 24 (0,65mm)" },
  "0,80": { minimo_kg: 1000, setor: "telha", label: "Chapa 22 (0,80mm)" },

  // Corte e Dobra / Perfis / Chapas Grossas
  "1,25": { minimo_kg: 2000, minimo_chapas: 25, setor: "cd", label: "Chapa 18 (1,25mm)" },
  "1,55": { minimo_kg: 2000, minimo_chapas: 20, setor: "cd", label: "Chapa 16 (1,55mm)" },
  "1,95": { minimo_kg: 2500, minimo_chapas: 20, setor: "cd", label: "Chapa 14 (1,95mm)" },
  "2,25": { minimo_kg: 2000, minimo_chapas: 15, setor: "cd", label: "Chapa 13 (2,25mm)" },
  "2,65": { minimo_kg: 2000, minimo_chapas: 15, setor: "cd", label: "Chapa 12 (2,65mm)" },
  "3,00": { minimo_kg: 1500, minimo_chapas: 10, setor: "cd", label: "Chapa 1/8\" (3,00mm)" },
  "4,75": { minimo_kg: 1500, minimo_chapas: 8, setor: "cd", label: "Chapa 3/16\" (4,75mm)" },
  "6,35": { minimo_kg: 1500, minimo_chapas: 5, setor: "cd", label: "Chapa 1/4\" (6,35mm)" }
};

/**
 * Envia mensagem via Z-API do WhatsApp se credenciais estiverem disponíveis
 */
export async function enviarZApiWhatsApp({ phone, message, instanceId = null, token = null }) {
  if (!phone || !message) return false;

  const inst = instanceId || localStorage.getItem("zapi_instance_id") || "";
  const tok = token || localStorage.getItem("zapi_token") || "";

  if (!inst || !tok) {
    console.warn("[Z-API] Credenciais não configuradas (instanceId ou token ausentes).");
    return false;
  }

  const cleanPhone = String(phone).replace(/\D+/g, "");
  const formattedPhone = cleanPhone.startsWith("55") ? cleanPhone : `55${cleanPhone}`;

  try {
    const url = `https://api.z-api.io/instances/${inst}/token/${tok}/send-text`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": tok
      },
      body: JSON.stringify({
        phone: formattedPhone,
        message
      })
    });
    return res.ok;
  } catch (err) {
    console.error("[Z-API] Falha ao enviar WhatsApp:", err?.message || err);
    return false;
  }
}

/**
 * Dispara alerta automático de falta de material / compras para o Leonardo e equipe PCP
 */
export async function enviarAlertaComprasLeonardo({
  pedido,
  item = null,
  espessura = "",
  setor = "telha",
  pesoNecessarioKg = 0,
  saldoDisponivelKg = 0,
  preBaixaTotalKg = 0,
  pecasQueDa = 0,
  pecasPedidas = 0,
  motivo = "Saldo insuficiente após pré-baixas acumuladas"
}) {
  const pedNum = pedido?.numero_pedido || pedido?.id || "—";
  const cliente = pedido?.cliente_nome || pedido?.cliente || "Cliente não informado";
  const prodNome = item?.produto || item?.descricao || pedido?.produto || "Material Fabril";
  const filial = pedido?.unidade || "Matriz AJL";

  const pecasFaltantes = Math.max(0, pecasPedidas - pecasQueDa);
  const kgFaltantes = Math.max(0, Math.round(pesoNecessarioKg - saldoDisponivelKg));

  // 1. Busca contatos em AlertaRegra ou admins
  let emailsDestino = [];
  let whatsappsDestino = [];

  try {
    const regras = await base44.entities.AlertaRegra.filter({ evento: "estoque_baixo", ativo: true });
    if (regras && regras.length > 0) {
      regras.forEach(r => {
        if (r.destinatarios_email) {
          r.destinatarios_email.split(",").forEach(e => {
            const clean = e.trim();
            if (clean && !emailsDestino.includes(clean)) emailsDestino.push(clean);
          });
        }
        if (r.destinatarios_whatsapp) {
          r.destinatarios_whatsapp.split(",").forEach(w => {
            const clean = w.trim();
            if (clean && !whatsappsDestino.includes(clean)) whatsappsDestino.push(clean);
          });
        }
      });
    }
  } catch (e) {
    console.warn("[alertaSuprimentos] Erro ao carregar AlertaRegra:", e?.message);
  }

  // Fallback: busca admins no sistema
  if (emailsDestino.length === 0) {
    try {
      const users = await base44.entities.User.filter({ role: "admin" });
      if (users && users.length > 0) {
        emailsDestino = users.map(u => u.email).filter(Boolean);
      }
    } catch {}
  }

  // Se ainda estiver vazio, inclui e-mail corporativo de compras
  if (emailsDestino.length === 0) {
    emailsDestino.push("compras@ajlferroeaco.com.br");
  }

  const titulo = `⚠️ ALERTA DE COMPRAS: Falta de Matéria-Prima no Pedido #${pedNum}`;
  const corpoTexto = `
ALERTA DE SUPRIMENTOS / COMPRAS — AJL FERRO & AÇO
=============================================================
Atenção Leonardo / PCP: O pedido #${pedNum} necessita de reposição urgente de bobina/chapa!

DADOS DO PEDIDO:
• Pedido: #${pedNum}
• Cliente: ${cliente}
• Unidade / Filial: ${filial}
• Produto Solicitado: ${prodNome}
• Espessura Necessária: ${espessura ? `${espessura}mm` : "A verificar"}

DIAGNÓSTICO DA PRÉ-BAIXA ACUMULADA:
• Motivo: ${motivo}
• Quantidade Solicitada no Pedido: ${pecasPedidas} peças (${pesoNecessarioKg.toLocaleString("pt-BR")} kg)
• Pré-Baixa Acumulada em Outras OPs: ${preBaixaTotalKg.toLocaleString("pt-BR")} kg
• Saldo Disponível Real Restante em Estoque: ${saldoDisponivelKg.toLocaleString("pt-BR")} kg
• Capacidade do Saldo Atual: DÁ PARA TIRAR APENAS ${pecasQueDa} de ${pecasPedidas} peças!
• FALTA CRÍTICA: ${pecasFaltantes} peça(s) (~${kgFaltantes.toLocaleString("pt-BR")} kg)

AÇÃO RECOMENDADA:
Providenciar compra ou transferência urgente de bobina de aço espessura ${espessura}mm para a unidade ${filial}.

Enviado automaticamente pelo Sistema PCP Industrial AJL.
Data/Hora: ${new Date().toLocaleString("pt-BR")}
`.trim();

  // 2. Envio de E-mail via base44.integrations.Core.SendEmail
  let emailEnviado = false;
  try {
    await base44.integrations.Core.SendEmail({
      to: emailsDestino.join(", "),
      subject: titulo,
      body: corpoTexto
    });
    emailEnviado = true;
  } catch (err) {
    console.error("[alertaSuprimentos] Erro ao enviar e-mail:", err?.message || err);
  }

  // 3. Envio de WhatsApp via Z-API se houver números
  let whatsappEnviado = false;
  if (whatsappsDestino.length > 0) {
    const msgZap = `🚨 *ALERTA DE ESTOQUE / COMPRAS - AJL FERRO & AÇO*\n\n` +
      `*Pedido:* #${pedNum} - ${cliente}\n` +
      `*Produto:* ${prodNome}\n` +
      `*Espessura:* ${espessura}mm\n` +
      `*Filial:* ${filial}\n\n` +
      `⚠️ *Situação das Pré-Baixas:* ${motivo}\n` +
      `• *Pré-baixa de outras OPs:* ${preBaixaTotalKg.toLocaleString("pt-BR")} kg\n` +
      `• *Disponível real restante:* ${saldoDisponivelKg.toLocaleString("pt-BR")} kg\n` +
      `• *Capacidade:* Dá para tirar *${pecasQueDa} de ${pecasPedidas} peças*\n` +
      `• *FALTAM:* *${pecasFaltantes} peças* (~${kgFaltantes.toLocaleString("pt-BR")} kg)\n\n` +
      `_Favor providenciar compra/reposição de matéria-prima urgente._`;

    for (const phone of whatsappsDestino) {
      const ok = await enviarZApiWhatsApp({ phone, message: msgZap });
      if (ok) whatsappEnviado = true;
    }
  }

  // 4. Cria registro na entidade Notificacao interna
  try {
    await base44.entities.Notificacao.create({
      titulo: `Falta de Estoque #${pedNum}`,
      mensagem: `Dá para tirar apenas ${pecasQueDa} de ${pecasPedidas} pçs (${espessura}mm). Pré-baixa acumulada: ${preBaixaTotalKg}kg. Faltam ${pecasFaltantes} pçs.`,
      tipo: "estoque_minimo",
      unidade: filial === "Pinhais" ? "Pinhais" : filial === "Ivaiporã" ? "Ivaiporã" : filial === "Ponta Grossa" ? "Ponta Grossa" : "Matriz AJL",
      usuario_destino: "admin",
      lida: false,
      link: "/pcp",
      data_hora: new Date().toISOString(),
      autor_nome: "Sistema PCP / IA"
    });
  } catch {}

  return { emailEnviado, whatsappEnviado, destinatarios: emailsDestino };
}

/**
 * Diagnóstico consolidado de bobinas por espessura considerando as pré-baixas acumuladas.
 * Identifica espessuras abaixo do limite mínimo geral (Ponto de Ressuprimento).
 */
export function analisarEstoqueCriticoGeral({
  bobinas = [],
  chapas = [],
  preBaixaMap = {},
  limitesConfig = LIMITES_PADRAO_ESPESSURA
}) {
  const porEspessura = {};

  // Agrupa bobinas
  bobinas.forEach(b => {
    if (b.arquivada) return false;
    const espRaw = String(b.espessura_utilizada || b.chapa || b.espessura_mm || "").replace(".", ",");
    const esp = espRaw.match(/\d+,\d+/) ? espRaw.match(/\d+,\d+/)[0] : (espRaw || "Outras");
    const setor = String(b.setor || "").toLowerCase().includes("cd") || String(b.codigo || "").startsWith("CD") ? "cd" : "telha";

    if (!porEspessura[esp]) {
      const cfg = limitesConfig[esp] || { minimo_kg: 2000, setor, label: `Espessura ${esp}mm` };
      porEspessura[esp] = {
        espessura: esp,
        label: cfg.label || `Chapa ${esp}mm`,
        setor,
        minimo_kg: cfg.minimo_kg || 2000,
        peso_total: 0,
        pre_baixa_total: 0,
        disponivel_real: 0,
        bobinas_count: 0,
        bobinas: []
      };
    }

    const peso = Number(b.peso_kg) || 0;
    const reserva = b.reservada ? (b.reserva_tipo === "parcial" ? (b.reserva_kg || 0) : peso) : 0;
    const preKg = (preBaixaMap[b.id] || preBaixaMap[b.codigo] || 0);
    const disp = Math.max(0, peso - reserva - preKg);

    porEspessura[esp].peso_total += peso;
    porEspessura[esp].pre_baixa_total += preKg;
    porEspessura[esp].disponivel_real += disp;
    porEspessura[esp].bobinas_count++;
    porEspessura[esp].bobinas.push({
      id: b.id,
      codigo: b.codigo,
      cor: b.cor,
      peso,
      preKg,
      disp
    });
  });

  const analise = Object.values(porEspessura).map(item => {
    const isCritico = item.disponivel_real < item.minimo_kg;
    const pctSaldo = item.minimo_kg > 0 ? Math.min(100, Math.round((item.disponivel_real / item.minimo_kg) * 100)) : 100;
    return {
      ...item,
      isCritico,
      pctSaldo,
      deficitKg: isCritico ? Math.round(item.minimo_kg - item.disponivel_real) : 0
    };
  });

  return analise.sort((a, b) => (a.isCritico === b.isCritico ? a.pctSaldo - b.pctSaldo : a.isCritico ? -1 : 1));
}
