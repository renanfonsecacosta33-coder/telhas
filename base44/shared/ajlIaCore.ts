/**
 * AJL IA — Cérebro de Inteligência Operacional da AJL Ferro e Aço
 * Núcleo compartilhado para Web App Copilot e Webhook Z-API (WhatsApp).
 */

export interface ContextoMensagem {
  mensagem: string;
  canal: "web_app" | "whatsapp";
  sessao_id: string;
  remetente_nome?: string;
  remetente_telefone?: string;
  filial_preferida?: string;
  historico_recente?: Array<{ role: "user" | "model"; content: string }>;
}

export interface RespostaAjlIa {
  texto: string;
  tools_usadas: string[];
  pdf_url?: string;
  pdf_nome?: string;
  pedido_id?: string;
  sucesso: boolean;
}

const DEFAULT_PROMPT_SISTEMA = `Você é o AJL IA, o copiloto de inteligência operacional e chão de fábrica da AJL Ferro e Aço.
Você tem acesso em tempo real aos dados de produção de telhas perfiladas, corte e dobra, bobinas em estoque, PCP integrado e expedição.
Suas características:
1. Respostas ágeis, precisas e objetivas em português do Brasil.
2. Usa formatação limpa com negrito, listas e emojis industriais (🏭, ⚡, 📋, 📦, 🚛, ⏱️, 🎯).
3. Quando perguntado sobre um pedido/OP, informe número, cliente, status atual, perfil/telha, metragem e se possui PDF do pedido.
4. Se o usuário quiser o PDF, use a ferramenta 'obter_pdf_pedido' para enviar o link do documento.
5. Para ações que alteram o banco (ex: mudar prioridade), sempre confira se o usuário disse "sim" ou "confirmo" antes de executar. Caso contrário, pergunte para confirmar.
6. Mantenha o foco nos processos da AJL (Matriz, Pinhais, Ivaiporã, Ponta Grossa).`;

export async function processarMensagemAjlIa(
  base44: any,
  contexto: ContextoMensagem
): Promise<RespostaAjlIa> {
  const { mensagem, canal, sessao_id, remetente_nome, remetente_telefone, filial_preferida, historico_recente } = contexto;
  const filial = filial_preferida || "Matriz AJL";

  // 1. Obter Configurações da IA
  let config: any = null;
  try {
    const configs = await base44.asServiceRole.entities.ConfiguracaoIA.list("-created_date", 1);
    if (configs && configs.length > 0) config = configs[0];
  } catch (err) {
    console.warn("[AJL IA] Falha ao carregar ConfiguracaoIA:", err);
  }

  const geminiApiKey = config?.gemini_api_key || Deno.env.get("GEMINI_API_KEY") || "";
  let modeloGemini = config?.modelo_gemini || "gemini-3.5-flash";
  if (!modeloGemini || modeloGemini.includes("1.5") || modeloGemini.includes("2.5")) {
    modeloGemini = "gemini-3.5-flash";
  }
  const promptSistema = config?.prompt_sistema || DEFAULT_PROMPT_SISTEMA;

  // 2. Declaração das Ferramentas (Tool Calling para Gemini)
  const toolsDeclarations = [
    {
      name: "consultar_pedido",
      description: "Consulta detalhes completos de um pedido ou OP pelo número (ex: S01635, 1635), nome da OF (ex: WH/MO/5760678) ou nome do cliente.",
      parameters: {
        type: "OBJECT",
        properties: {
          termo: { type: "STRING", description: "Número do pedido (ex: S01635), número da OP ou nome do cliente" }
        },
        required: ["termo"]
      }
    },
    {
      name: "status_maquinas_telhas",
      description: "Verifica em tempo real quais das 8 perfiladeiras de telhas (TP-40, TP-25, Ondulada, Colonial, Bandeja, Desbobinador, Cumeeira, Colagem) estão rodando agora, pausadas ou livres, e o tamanho da fila de cada uma.",
      parameters: {
        type: "OBJECT",
        properties: {
          unidade: { type: "STRING", description: "Filial (ex: Matriz AJL, Pinhais, Ivaiporã, Ponta Grossa)" }
        }
      }
    },
    {
      name: "consultar_bobinas_estoque",
      description: "Busca bobinas de aço em estoque por espessura (ex: 0.43, 0.50), tipo/cor (ex: Galvalume, Branca, Preta) ou código da bobina.",
      parameters: {
        type: "OBJECT",
        properties: {
          filtro: { type: "STRING", description: "Termo de busca como espessura (0.43), cor (branca, galvalume) ou código (BOB-01)" },
          setor: { type: "STRING", description: "telhas ou corte_dobra (opcional)" }
        }
      }
    },
    {
      name: "resumo_producao_dia",
      description: "Traz os metros lineares cortados hoje, toneladas de aço processadas e pedidos finalizados na data.",
      parameters: {
        type: "OBJECT",
        properties: {
          data: { type: "STRING", description: "Data no formato YYYY-MM-DD (deixe em branco para hoje)" },
          unidade: { type: "STRING", description: "Filial da fábrica" }
        }
      }
    },
    {
      name: "buscar_pedidos_atrasados_ou_urgentes",
      description: "Lista pedidos com alta prioridade (Retira Balcão, Carga de Rota) ou com prazos de entrega vencidos no PCP.",
      parameters: {
        type: "OBJECT",
        properties: {
          unidade: { type: "STRING", description: "Filial da fábrica" }
        }
      }
    },
    {
      name: "obter_pdf_pedido",
      description: "Obtém o link direto para download ou visualização do arquivo PDF oficial do pedido de venda.",
      parameters: {
        type: "OBJECT",
        properties: {
          numero_pedido: { type: "STRING", description: "Número do pedido (ex: S01635)" }
        },
        required: ["numero_pedido"]
      }
    },
    {
      name: "alterar_prioridade_pedido",
      description: "Altera o nível de prioridade de um pedido no PCP (ex: Urgente, Retira Agora, Normal). Exige confirmação explícita do usuário.",
      parameters: {
        type: "OBJECT",
        properties: {
          numero_pedido: { type: "STRING", description: "Número do pedido (ex: S01635)" },
          nova_prioridade: { type: "STRING", description: "Prioridade: 'alta', 'retira_balcao', 'carga_rota' ou 'normal'" },
          confirmado: { type: "BOOLEAN", description: "True se o usuário confirmou expressamente a alteração" }
        },
        required: ["numero_pedido", "nova_prioridade"]
      }
    }
  ];

  // 3. Funções executoras das Tools no Base44
  const executarTool = async (nome: string, args: any): Promise<any> => {
    try {
      if (nome === "consultar_pedido") {
        const termo = String(args.termo || "").trim().replace("#", "").toUpperCase();
        // 1. Tenta buscar em PedidoOdoo
        const odooList = await base44.asServiceRole.entities.PedidoOdoo.list("-data_recebimento", 500);
        const matchOdoo = (odooList || []).filter((p: any) => {
          const num = String(p.numero_pedido || "").toUpperCase();
          const ofN = String(p.of_nome || "").toUpperCase();
          const cli = String(p.cliente_nome || "").toUpperCase();
          return num.includes(termo) || ofN.includes(termo) || cli.includes(termo);
        }).slice(0, 5);

        // 2. Tenta buscar em Pedido (chão de fábrica)
        const chaoList = await base44.asServiceRole.entities.Pedido.list("-created_date", 500);
        const matchChao = (chaoList || []).filter((p: any) => {
          const num = String(p.numero_pedido || "").toUpperCase();
          const cli = String(p.cliente || "").toUpperCase();
          return num.includes(termo) || cli.includes(termo);
        }).slice(0, 5);

        return {
          pedidos_pcp: matchOdoo.map((p: any) => ({
            numero_pedido: p.numero_pedido,
            of_nome: p.of_nome,
            cliente: p.cliente_nome,
            vendedor: p.vendedor_nome,
            status_pcp: p.status_pcp,
            prioridade: p.prioridade_logistica || "Normal",
            unidade: p.unidade,
            tem_pdf: !!p.pdf_pedido_url,
            pdf_url: p.pdf_pedido_url || null,
            data_recebimento: p.data_recebimento,
            itens_resumo: p.itens_json ? (Array.isArray(p.itens_json) ? p.itens_json.length : "itens presentes") : 0
          })),
          ordens_chao_fabrica: matchChao.map((p: any) => ({
            id: p.id,
            numero_pedido: p.numero_pedido,
            maquina: p.maquina,
            modelo: p.modelo || p.produto,
            status: p.status,
            metros: p.metros,
            metragem_mm: p.metragem_mm,
            operador: p.operador || "Não atribuído",
            bobina: p.bobina_codigo || null
          }))
        };
      }

      if (nome === "status_maquinas_telhas") {
        const pedidos = await base44.asServiceRole.entities.Pedido.list("-created_date", 500);
        const maquinas = [
          "TP - 40", "TP - 25", "ONDULADA", "COLONIAL",
          "BANDEJA", "DESBOBINADOR", "CUMEEIRA", "COLAGEM"
        ];

        return maquinas.map(m => {
          const emProd = pedidos.find((p: any) => p.maquina === m && p.status === "em_producao");
          const pausadas = pedidos.filter((p: any) => p.maquina === m && p.status === "pausado");
          const fila = pedidos.filter((p: any) => p.maquina === m && p.status === "pendente");

          return {
            maquina: m,
            status: emProd ? "RODANDO" : pausadas.length > 0 ? "PAUSADA" : "LIVRE",
            ordem_ativa: emProd ? {
              pedido: emProd.numero_pedido,
              cliente: emProd.cliente,
              metros: emProd.metros,
              operador: emProd.operador,
              bobina: emProd.bobina_codigo
            } : null,
            total_fila: fila.length,
            proxima_op: fila[0] ? { pedido: fila[0].numero_pedido, cliente: fila[0].cliente } : null
          };
        });
      }

      if (nome === "consultar_bobinas_estoque") {
        const termo = String(args.filtro || "").toLowerCase();
        const raw = await base44.asServiceRole.entities.Bobina.list("-created_date", 300);
        const ativas = (raw || []).filter((b: any) => !b.arquivada && (!args.setor || b.setor === args.setor));

        const filtradas = ativas.filter((b: any) => {
          if (!termo) return true;
          const cod = String(b.codigo || "").toLowerCase();
          const esp = String(b.espessura || "").toLowerCase();
          const cor = String(b.cor || "").toLowerCase();
          const mat = String(b.material || "").toLowerCase();
          return cod.includes(termo) || esp.includes(termo) || cor.includes(termo) || mat.includes(termo);
        }).slice(0, 10);

        return filtradas.map((b: any) => ({
          codigo: b.codigo,
          espessura: b.espessura,
          cor: b.cor,
          material: b.material,
          peso_atual_kg: b.peso_atual_kg,
          metros_restantes: b.metros_restantes,
          unidade: b.unidade,
          status: b.peso_atual_kg < 150 ? "Estoque Baixo" : "OK"
        }));
      }

      if (nome === "resumo_producao_dia") {
        const hojeIso = new Date().toISOString().substring(0, 10);
        const dataAlvo = args.data || hojeIso;
        const pedidos = await base44.asServiceRole.entities.Pedido.list("-created_date", 600);

        const doDia = pedidos.filter((p: any) => {
          return p.status === "finalizado" && (p.data_finalizacao === dataAlvo || p.data === dataAlvo);
        });

        const totalMetros = doDia.reduce((sum: number, p: any) => sum + (Number(p.metros) || 0), 0);
        const totalKg = doDia.reduce((sum: number, p: any) => sum + (Number(p.peso_kg) || (Number(p.metros) * 3.8)), 0);

        return {
          data: dataAlvo,
          total_pedidos_finalizados: doDia.length,
          total_metros_linear: Math.round(totalMetros * 10) / 10,
          total_toneladas_aco: Math.round((totalKg / 1000) * 10) / 10,
          pedidos: doDia.slice(0, 5).map((p: any) => ({ pedido: p.numero_pedido, cliente: p.cliente, maquina: p.maquina, metros: p.metros }))
        };
      }

      if (nome === "buscar_pedidos_atrasados_ou_urgentes") {
        const odooList = await base44.asServiceRole.entities.PedidoOdoo.list("-data_recebimento", 500);
        const urgentes = (odooList || []).filter((p: any) => {
          const prioridade = String(p.prioridade_logistica || "").toLowerCase();
          const status = String(p.status_pcp || "").toLowerCase();
          const ehUrgente = prioridade.includes("retira") || prioridade.includes("rota") || prioridade.includes("alta") || prioridade.includes("urgente");
          return ehUrgente && status !== "concluido";
        }).slice(0, 10);

        return urgentes.map((p: any) => ({
          numero_pedido: p.numero_pedido,
          cliente: p.cliente_nome,
          prioridade: p.prioridade_logistica,
          status_pcp: p.status_pcp,
          data_prometida: p.data_entrega_prometida || "Não informada",
          unidade: p.unidade
        }));
      }

      if (nome === "obter_pdf_pedido") {
        const termo = String(args.numero_pedido || "").trim().replace("#", "").toUpperCase();
        const odooList = await base44.asServiceRole.entities.PedidoOdoo.filter({ numero_pedido: termo });
        if (odooList && odooList.length > 0 && odooList[0].pdf_pedido_url) {
          return {
            sucesso: true,
            numero_pedido: termo,
            pdf_url: odooList[0].pdf_pedido_url,
            pdf_nome: odooList[0].pdf_pedido_nome || `Pedido_${termo}.pdf`
          };
        }
        return {
          sucesso: false,
          mensagem: `Nenhum PDF arquivado encontrado para o pedido #${termo} no momento. O PCP pode anexá-lo ou solicitar sincronização com o Odoo.`
        };
      }

      if (nome === "alterar_prioridade_pedido") {
        const { numero_pedido, nova_prioridade, confirmado } = args;
        const termo = String(numero_pedido || "").trim().replace("#", "").toUpperCase();
        if (!confirmado) {
          return {
            pendente_confirmacao: true,
            mensagem: `Atenção: Para alterar o pedido #${termo} para a prioridade '${nova_prioridade}', responda confirmando ('sim, confirmo').`
          };
        }

        const odooList = await base44.asServiceRole.entities.PedidoOdoo.filter({ numero_pedido: termo });
        if (odooList && odooList.length > 0) {
          await base44.asServiceRole.entities.PedidoOdoo.update(odooList[0].id, {
            prioridade_logistica: nova_prioridade
          });
          return {
            sucesso: true,
            mensagem: `Prioridade do pedido #${termo} alterada para '${nova_prioridade}' com sucesso no PCP!`
          };
        }
        return { sucesso: false, mensagem: `Pedido #${termo} não localizado para alteração.` };
      }

      return { erro: `Ferramenta '${nome}' desconhecida` };
    } catch (err: any) {
      return { erro: `Falha ao executar ferramenta ${nome}: ${err?.message || err}` };
    }
  };

  // 4. Execução do Cérebro via Google Gemini API
  const toolsExecutadas: string[] = [];
  let pdfUrlExtraido: string | undefined;
  let pdfNomeExtraido: string | undefined;
  let textoFinal = "";

  if (!geminiApiKey) {
    // Modo Onboarding Inteligente caso ainda não tenha chave API salva
    textoFinal = `Olá! Sou o **AJL IA**, seu assistente de inteligência operacional da AJL Ferro e Aço 🏭.\n\n` +
      `Estou pronto para consultar pedidos, status das perfiladeiras, estoque de bobinas e relatórios em tempo real.\n\n` +
      `⚙️ *Dica para o Gestor:* Insira sua **Chave do Google Gemini (API Key)** no botão de configurações do chat para liberar o processamento por inteligência artificial!`;
  } else {
    try {
      // Montagem do payload Gemini com Tools
      const contents: any[] = [];

      // Histórico recente se houver
      if (Array.isArray(historico_recente)) {
        for (const h of historico_recente.slice(-4)) {
          contents.push({
            role: h.role === "user" ? "user" : "model",
            parts: [{ text: h.content }]
          });
        }
      }

      // Mensagem atual
      contents.push({
        role: "user",
        parts: [{ text: `[Usuário: ${remetente_nome || "Colaborador AJL"} | Canal: ${canal} | Filial: ${filial}]\n${mensagem}` }]
      });

      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modeloGemini}:generateContent?key=${geminiApiKey}`;

      // Chamada 1 para Gemini
      const resp1 = await fetch(geminiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: promptSistema }] },
          contents,
          tools: [{ function_declarations: toolsDeclarations }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
        })
      });

      if (!resp1.ok) {
        const erroJson = await resp1.text();
        throw new Error(`Erro Gemini (${resp1.status}): ${erroJson.substring(0, 300)}`);
      }

      const resJson1 = await resp1.json();
      const candidate1 = resJson1?.candidates?.[0]?.content;
      const parts1 = candidate1?.parts || [];

      // Verifica se o modelo pediu Function Calling
      const functionCalls = parts1.filter((p: any) => p.functionCall);

      if (functionCalls.length > 0) {
        const functionResponses: any[] = [];

        for (const call of functionCalls) {
          const fnName = call.functionCall.name;
          const fnArgs = call.functionCall.args || {};
          toolsExecutadas.push(fnName);

          const resultadoTool = await executarTool(fnName, fnArgs);

          if (fnName === "obter_pdf_pedido" && resultadoTool?.pdf_url) {
            pdfUrlExtraido = resultadoTool.pdf_url;
            pdfNomeExtraido = resultadoTool.pdf_nome;
          }

          functionResponses.push({
            functionResponse: {
              name: fnName,
              response: { output: resultadoTool }
            }
          });
        }

        // Chamada 2 para Gemini consolidar os dados da Tool em resposta amigável
        const contents2 = [
          ...contents,
          { role: "model", parts: parts1 },
          { role: "user", parts: functionResponses }
        ];

        const resp2 = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: promptSistema }] },
            contents: contents2,
            generationConfig: { temperature: 0.2, maxOutputTokens: 1000 }
          })
        });

        if (resp2.ok) {
          const resJson2 = await resp2.json();
          const candidate2 = resJson2?.candidates?.[0]?.content;
          const textPart = candidate2?.parts?.find((p: any) => p.text);
          textoFinal = textPart?.text || "Consulta executada com sucesso.";
        } else {
          textoFinal = "Dados consultados no sistema com sucesso pela equipe AJL IA.";
        }
      } else {
        const textPart = parts1.find((p: any) => p.text);
        textoFinal = textPart?.text || "Não consegui formular uma resposta no momento.";
      }
    } catch (errAi: any) {
      console.error("[AJL IA] Falha no processamento LLM:", errAi);
      textoFinal = `⚠️ **AJL IA:** Ocorreu uma oscilação na conexão com a inteligência artificial (${errAi?.message || "Erro desconhecido"}). Tente novamente em alguns segundos.`;
    }
  }

  // 5. Salva no Histórico para auditoria e contexto
  try {
    await base44.asServiceRole.entities.HistoricoAjlIa.create({
      canal,
      sessao_id: sessao_id || "geral",
      remetente_nome: remetente_nome || "Usuário",
      remetente_telefone: remetente_telefone || null,
      mensagem_usuario: mensagem,
      resposta_ia: textoFinal,
      tools_executadas: JSON.stringify(toolsExecutadas),
      filial
    });
  } catch (errHist) {
    console.warn("[AJL IA] Falha ao salvar histórico:", errHist);
  }

  return {
    texto: textoFinal,
    tools_usadas: toolsExecutadas,
    pdf_url: pdfUrlExtraido,
    pdf_nome: pdfNomeExtraido,
    sucesso: true
  };
}
