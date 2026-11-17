/**
 * Detecta contradição/divergência entre o modelo cadastrado no Odoo e a anotação técnica do vendedor.
 * Regra AJL: A descrição técnica do vendedor é a VERDADE ABSOLUTA.
 * Exemplo: Produto "Telha TP 40 (0,43)", Descrição "5x 3000 tp 25 superior verde"
 * -> Título ajustado: "1492 - Telha TP 25 (0,43) • Conforme Descrição"
 * -> Mensagem de aviso: '✏️ Modelo ajustado pela descrição do vendedor: "tp 25"'
 */
export function verificarDivergenciaModeloDescricao(pedido) {
  if (!pedido) return { temDivergencia: false, tituloAjustado: "" };

  const textoProduto = String(pedido.item_produto || pedido.produto || "").trim();
  const textoDescricao = String(
    pedido.observacoes_odoo ||
    pedido.observacoes ||
    pedido.descricao ||
    ""
  ).trim();

  if (!textoDescricao) {
    return { temDivergencia: false, tituloAjustado: textoProduto };
  }

  // 1. Detectar modelo na descrição técnica do vendedor
  let modeloDesc = null;
  let termoDesc = "";
  const matchDescTp25 = textoDescricao.match(/\b(TP\s*[-/]?\s*25|TR\s*[-/]?\s*25|TRAP[EÉ]ZIO\s*25|PERFIL\s*25)\b/i);
  const matchDescColonial = textoDescricao.match(/\b(COLONIAL)\b/i);
  const matchDescOndulada = textoDescricao.match(/\b(ONDULAD[AO]|PERFIL\s*17)\b/i);
  const matchDescTp40 = textoDescricao.match(/\b(TP\s*[-/]?\s*40|TR\s*[-/]?\s*40|TRAP[EÉ]ZIO\s*40|PERFIL\s*40)\b/i);

  if (matchDescTp25) {
    modeloDesc = "TP - 25";
    termoDesc = matchDescTp25[0];
  } else if (matchDescColonial) {
    modeloDesc = "COLONIAL";
    termoDesc = matchDescColonial[0];
  } else if (matchDescOndulada) {
    modeloDesc = "ONDULADA";
    termoDesc = matchDescOndulada[0];
  } else if (matchDescTp40) {
    modeloDesc = "TP - 40";
    termoDesc = matchDescTp40[0];
  }

  if (!modeloDesc) {
    return { temDivergencia: false, tituloAjustado: textoProduto };
  }

  // 2. Detectar modelo no nome do produto do ERP
  let modeloProd = null;
  const matchProdTp25 = textoProduto.match(/\b(TP\s*[-/]?\s*25|TR\s*[-/]?\s*25|TRAP[EÉ]ZIO\s*25|PERFIL\s*25)\b/i);
  const matchProdColonial = textoProduto.match(/\b(COLONIAL)\b/i);
  const matchProdOndulada = textoProduto.match(/\b(ONDULAD[AO]|PERFIL\s*17)\b/i);
  const matchProdTp40 = textoProduto.match(/\b(TP\s*[-/]?\s*40|TR\s*[-/]?\s*40|TRAP[EÉ]ZIO\s*40|PERFIL\s*40)\b/i);

  if (matchProdTp25) modeloProd = "TP - 25";
  else if (matchProdColonial) modeloProd = "COLONIAL";
  else if (matchProdOndulada) modeloProd = "ONDULADA";
  else if (matchProdTp40) modeloProd = "TP - 40";

  // Se o modelo do produto é CONTRADITÓRIO ao modelo da descrição técnica:
  if (modeloProd && modeloProd !== modeloDesc) {
    let tituloAjustado = textoProduto;
    if (matchProdTp40) {
      tituloAjustado = tituloAjustado.replace(matchProdTp40[0], modeloDesc === "TP - 25" ? "TP 25" : (modeloDesc === "COLONIAL" ? "Colonial" : modeloDesc));
    } else if (matchProdTp25) {
      tituloAjustado = tituloAjustado.replace(matchProdTp25[0], modeloDesc === "TP - 40" ? "TP 40" : (modeloDesc === "COLONIAL" ? "Colonial" : modeloDesc));
    } else if (matchProdColonial) {
      tituloAjustado = tituloAjustado.replace(matchProdColonial[0], modeloDesc);
    } else if (matchProdOndulada) {
      tituloAjustado = tituloAjustado.replace(matchProdOndulada[0], modeloDesc);
    }

    if (!tituloAjustado.includes("Conforme Descrição")) {
      tituloAjustado = `${tituloAjustado} • Conforme Descrição`;
    }

    return {
      temDivergencia: true,
      modeloProduto: modeloProd,
      modeloDescricao: modeloDesc,
      termoDescricao: termoDesc,
      tituloAjustado,
      mensagemAviso: `✏️ Modelo ajustado pela descrição do vendedor: "${termoDesc}"`
    };
  }

  return { temDivergencia: false, tituloAjustado: textoProduto };
}

/**
 * Texto EXATO do item como chegou do Odoo na Central PCP.
 * Em caso de divergência com a verdade técnica da descrição do vendedor,
 * alinha o modelo mantendo o código e espessura do ERP com o sufixo "• Conforme Descrição".
 */
export function descricaoItemOriginal(pedido) {
  if (!pedido) return "";
  const div = verificarDivergenciaModeloDescricao(pedido);
  if (div.temDivergencia && div.tituloAjustado) {
    return div.tituloAjustado;
  }
  const bruto = String(pedido.item_produto || "").replace(/\s+/g, " ").trim();
  if (bruto) return bruto;
  // OP criada manualmente (sem vínculo Odoo): usa o rótulo digitado
  return [pedido.produto, pedido.modelo].filter(Boolean).join(" ").trim();
}

/**
 * Espessura exatamente como escrita no item do PCP (ex.: "0,43").
 * Usa o texto original quando existir, para não exibir "0.43" no chão de fábrica.
 */
export function espessuraOriginalItem(pedido) {
  if (!pedido) return "";
  const texto = String(pedido.item_produto || pedido.produto || "");
  const noTexto = texto.match(/\((\d+[,.]\d+)\)/);
  if (noTexto) return noTexto[1].replace(".", ",");
  return String(pedido.espessura_exigida || "").replace(".", ",");
}
