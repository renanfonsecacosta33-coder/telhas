import { base44 } from "@/api/base44Client";
import { investigarBarracoesParaPedidos, limparNumeroPedido } from "@/lib/investigacaoBarracoesHelper";

const SCHEMA = {
  type: "object",
  properties: {
    titulo: { type: "string" },
    entrega_date: { type: "string" },
    embarque_date: { type: "string" },
    total_valor: { type: "string" },
    nota_geral: { type: "string" },
    motorista_nome: { type: "string" },
    placa: { type: "string" },
    itens: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ordem: { type: "string" },
          numero_pedido: { type: "string" },
          cliente: { type: "string" },
          vendedor: { type: "string" },
          bairro: { type: "string" },
          pagamento: { type: "string" },
          valor: { type: "string" },
          observacao: { type: "string" },
        },
        required: ["numero_pedido", "cliente"],
      },
    },
  },
  required: ["titulo", "itens"],
};

const PROMPT = `Você é o leitor de rotas e manifestos de expedição da AJL Ferro e Aço.
Analise com máxima precisão a imagem da ROTA DE ENTREGA da AJL Ferro e Aço e extraia TODOS os campos da tabela e do cabeçalho com fidelidade absoluta:

1. DADOS DE CABEÇALHO E TÍTULO:
- titulo: Título completo que aparece no topo (ex: "ROTA DE ENTREGA CHAPARIA - WELINGTON" ou "ROTA DE ENTREGA PONTA GROSSA - EDUARDO").
- motorista_nome: Nome do motorista. Se houver campo MOTORISTA, use-o. Se o título contiver um hífen como "ROTA DE ENTREGA CHAPARIA - WELINGTON", o nome do motorista é o texto após o hífen ("WELINGTON").
- placa: Placa do caminhão se constar no documento (ex: "ABC-1234").
- entrega_date: Data de entrega (campo "ENTREGA:", ex: "16/set").
- embarque_date: Data de embarque (campo "EMBARQUE:", ex: "15/09/2026").
- total_valor: Valor total da rota (campo "TOTAL:", ex: "R$ 51.839,21").
- nota_geral: Qualquer observação geral ou instrução anotada na folha ou rodapé.

2. TABELA DE PEDIDOS (extraia TODAS as linhas da tabela, sem faltar nenhuma):
Para CADA linha:
- ordem: Número na coluna "Ordem p/ Entrega" (ex: "1", "2").
- numero_pedido: Número do pedido na coluna "Nº Pedido" (ex: "298249", "296502", "298767", "298524"). Extraia apenas os dígitos do número do pedido.
- cliente: Nome do cliente na coluna "Cliente" (ex: "CRW", "BR7 SISTEMAS").
- vendedor: Nome do vendedor na coluna "Vendedor" (ex: "WENDELL").
- bairro: Bairro ou destino na coluna "BAIRRO" (ex: "MARACANÃ", "CARA-CARA").
- pagamento: Forma de pagamento na coluna "Pagamento" (ex: "PAGO", "BOLETO").
- valor: Valor do pedido na coluna "Valor do Pedido" (ex: "R$ 5.844,16", "R$ 40.202,73", "R$ 5.792,32" ou vazio se não houver).
- observacao: CRUCIAL / OBRIGATÓRIO! Extraia com exatidão todo o texto escrito na coluna "Observação" (ex: "SOMENTE CORTE E DOBRA", "SOMENTE SALDO CORTE E DOBRA", "VOLTOU NO PITTI", etc.). NUNCA deixe a observação vazia se houver texto escrito na coluna correspondente!

Seja rigoroso e preciso em cada número de pedido e em cada observação.`;

export async function parseRotaImage(imageUrl, filialAtiva = null) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: PROMPT,
    file_urls: [imageUrl],
    response_json_schema: SCHEMA,
  });

  const rawItens = res.itens || [];
  const numeros = rawItens.map((i) => i.numero_pedido).filter(Boolean);

  // Extrai motorista do título se não veio no campo motorista_nome
  let motoristaNome = (res.motorista_nome || "").trim();
  if (!motoristaNome && res.titulo && res.titulo.includes("-")) {
    const partes = res.titulo.split("-");
    const possivel = partes[partes.length - 1].trim();
    if (possivel && !possivel.toLowerCase().includes("rota")) {
      motoristaNome = possivel;
    }
  }

  let mapaBarracoes = {};
  if (numeros.length) {
    try {
      mapaBarracoes = await investigarBarracoesParaPedidos(numeros, filialAtiva);
    } catch (e) {
      console.error("[parseRotaImage] Erro ao investigar barracões:", e);
    }
  }

  const itens = rawItens.map((item) => {
    const chave = limparNumeroPedido(item.numero_pedido);
    const info = mapaBarracoes[chave];

    // Inferência inteligente usando a coluna Observação da linha e o título da rota
    const obsTexto = (item.observacao || "").trim();
    const tituloTexto = (res.titulo || "").trim();
    const textoAnalise = (obsTexto + " " + tituloTexto).toLowerCase();

    const temCDObs = /(corte|dobra|chaparia|chapa|calha|rufo|slitter|perfil|barra|tubo|cantoneira|desbobin)/i.test(textoAnalise);
    const temTelhasObs = /(telha|sandu[ií]|eps|isopor|manta|cumeeir|ondulad|coloni|bandej|bobininha|perfiladeir)/i.test(textoAnalise);

    let barracaoSugerido = "aguardando";
    let barracaoLabel = "Aguardando Entrada";
    let statusProducao = "⏳ Aguardando Entrada";
    const deps = [];

    if (info && (info.temTelhas || info.temCD)) {
      if (info.temTelhas) deps.push("telhas");
      if (info.temCD) deps.push("corte_dobra");
      barracaoSugerido = info.barracao;
      barracaoLabel = info.barracaoLabel;
      statusProducao = info.statusGeralLabel || "⏳ Aguardando Início";
    } else {
      // Pedido ainda não encontrado nas OPs: inferência direta pela observação e título do manifesto
      if (temCDObs && temTelhasObs) {
        deps.push("telhas", "corte_dobra");
        barracaoSugerido = "ambos";
        barracaoLabel = "Ambos os Barracões";
        statusProducao = "⏳ Aguardando Entrada (Ambos)";
      } else if (temCDObs) {
        deps.push("corte_dobra");
        barracaoSugerido = "corte_dobra";
        barracaoLabel = "Corte & Dobra";
        statusProducao = "⏳ Aguardando Entrada (C&D)";
      } else if (temTelhasObs) {
        deps.push("telhas");
        barracaoSugerido = "telhas";
        barracaoLabel = "Telhas";
        statusProducao = "⏳ Aguardando Entrada (Telhas)";
      } else {
        deps.push("expedicao");
      }
    }

    return {
      ...item,
      departamentos: deps.length ? deps : ["expedicao"],
      barracao_sugerido: barracaoSugerido,
      barracao_label: barracaoLabel,
      status_producao: statusProducao,
    };
  });

  return {
    ...res,
    motorista_nome: motoristaNome,
    itens,
  };
}