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
      },
    },
  },
};

const PROMPT = `Analise esta imagem de "ROTA DE ENTREGA" da AJL Ferro e Aço. Extraia TODOS os dados estruturados visíveis:
- Título da rota (ex: "ROTA DE ENTREGA PONTA GROSSA - EDUARDO")
- Data de entrega (campo ENTREGA)
- Data de embarque (campo EMBARQUE)
- Valor total (campo TOTAL)
- Nome do motorista (campo MOTORISTA, se houver)
- Placa do caminhão (campo PLACA, se houver)
- Lista completa de pedidos na tabela. Para cada pedido: ordem de entrega, número do pedido, cliente, vendedor, bairro, forma de pagamento, valor do pedido e observação (se houver).
- Qualquer nota/observação geral no rodapé da imagem.
Seja preciso com os números de pedido. Se um campo não estiver visível, use string vazia.`;

export async function parseRotaImage(imageUrl, filialAtiva = null) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: PROMPT,
    file_urls: [imageUrl],
    response_json_schema: SCHEMA,
  });

  const rawItens = res.itens || [];
  const numeros = rawItens.map((i) => i.numero_pedido).filter(Boolean);

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

    const deps = [];
    if (info) {
      if (info.temTelhas) deps.push("telhas");
      if (info.temCD) deps.push("corte_dobra");
      if (!info.temTelhas && !info.temCD) deps.push("expedicao");
    } else {
      deps.push("expedicao");
    }

    return {
      ...item,
      departamentos: deps.length ? deps : ["expedicao"],
      barracao_sugerido: info ? info.barracao : "aguardando",
      barracao_label: info ? info.barracaoLabel : "Aguardando Entrada",
      status_producao: info ? info.statusGeralLabel : "⏳ Aguardando Entrada",
    };
  });

  return { ...res, itens };
}