import { base44 } from "@/api/base44Client";

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

export async function parseRotaImage(imageUrl) {
  const res = await base44.integrations.Core.InvokeLLM({
    prompt: PROMPT,
    file_urls: [imageUrl],
    response_json_schema: SCHEMA,
  });

  const numeros = (res.itens || []).map((i) => i.numero_pedido).filter(Boolean);
  let itens = res.itens || [];
  if (numeros.length) {
    try {
      const odooRecords = await base44.entities.PedidoOdoo.filter(
        { numero_pedido: { $in: numeros } },
        null,
        500
      );
      const mapa = {};
      odooRecords.forEach((p) => { mapa[p.numero_pedido] = p; });
      itens = itens.map((item) => {
        const odoo = mapa[item.numero_pedido];
        const deps = [];
        if (odoo) {
          if (odoo.itens_telha_count > 0) deps.push("telhas");
          if (odoo.itens_cd_count > 0) deps.push("corte_dobra");
          if (odoo.itens_frisada_count > 0) deps.push("expedicao");
        }
        return { ...item, departamentos: deps.length ? deps : ["telhas", "corte_dobra", "expedicao"] };
      });
    } catch {
      itens = itens.map((item) => ({ ...item, departamentos: ["telhas", "corte_dobra", "expedicao"] }));
    }
  } else {
    itens = itens.map((item) => ({ ...item, departamentos: ["telhas", "corte_dobra", "expedicao"] }));
  }
  return { ...res, itens };
}