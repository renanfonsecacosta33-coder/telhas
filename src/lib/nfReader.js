import { base44 } from "@/api/base44Client";

/**
 * Utilitário de compressão mantendo altíssima nitidez (2048px @ 0.90)
 * para leitura de pequenos textos e tabelas em DANFE/NF-e.
 */
export async function compressImage(file, maxDimension = 2048, quality = 0.90) {
  if (!file || !file.type || !file.type.startsWith("image/")) return file;
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) resolve(file);
          else resolve(new File([blob], file.name || "nf_otimizada.jpg", { type: "image/jpeg" }));
        },
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

/**
 * Lê uma Nota Fiscal (foto ou PDF) de Bobina de Aço usando o modelo de Visão da IA.
 * Extrai automaticamente todos os dados para preenchimento de Nova Bobina,
 * suportando tanto NFs com 1 bobina quanto NFs com múltiplas bobinas (2, 3, 4+ bobinas em lotes ou itens).
 */
export async function lerNotaFiscalBobina(rawFile) {
  if (!rawFile) throw new Error("Nenhum arquivo fornecido.");

  // Otimiza imagem se for foto
  const file = await compressImage(rawFile, 2048, 0.90);

  // Faz upload do anexo
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  if (!file_url) throw new Error("Falha ao enviar arquivo da Nota Fiscal.");

  // Invoca a IA com prompt especializado em bobinas de aço e detecção de lotes múltiplos
  const prompt = `Você é um leitor especialista em Notas Fiscais Eletrônicas (DANFE / NF-e) emitidas para fábricas de telhas, corte & dobra e perfis de aço.
Analise detalhadamente a imagem da Nota Fiscal e extraia as informações referentes à(s) bobina(s) de aço:

1. numero_nf: Número da Nota Fiscal (apenas dígitos numéricos ou string limpa, ex: "5041", "105423")
2. fornecedor: Razão Social ou Nome Fantasia do EMITENTE da NF (ex: "ASIV STEEL DO BRASIL LTDA", "ArcelorMittal Brasil", "CSN", etc.)
3. data_emissao: Data de emissão no formato AAAA-MM-DD (ex: "2026-09-16").
4. quantidade_bobinas_nf: Quantidade de bobinas declarada na nota (verifique no campo 'QUANTIDADE' / 'ESPÉCIE: BOBINAS' dos dados de transporte ou a soma dos lotes de bobinas).
5. peso_liquido_total_kg: Peso Líquido total declarado na nota em kg.
6. peso_bruto_total_kg: Peso Bruto total declarado no rodapé da nota em kg.
7. chapa_padrao: Espessura nominal ou chapa padrão (ex: "0,38", "0,43", "0,50", "0,65", "0,95", "1,25"). Formate com vírgula (ex: "0,38").
8. largura_mm_padrao: Largura da bobina em milímetros (ex: 1200, 1000). Se constar em metros (ex: 1,20m), converta para mm (1200). Se não constar, use 1200.
9. cor_padrao: Cor ou acabamento superficial mencionado (ex: "Galvalume / ALZ", "Galvanizado", "Zincado", "Branco Neve", "Cinza", "Natural", "Preto", etc.). Se constar ALZ ou AZ100/AZ150, é Galvalume.
10. qualidade_padrao: Código de qualidade do aço: escolha rigorosamente entre ["GV", "PP", "FF", "FQ", "GL (IMP)"].
   - "GL (IMP)": Galvalume importado ou ALZ importado.
   - "PP": Pré-pintado / bobina com cor pintada.
   - "GV": Galvanizado / Zincado convencional nacional.
   - "FF": Fita a Frio / Aço laminado a frio.
   - "FQ": Aço laminado a quente.
11. origem_padrao: "Nacional" ou "Importado". Verifique CST (ex: CST 100 = Importado) e o emitente/importador.
12. custo_kg_padrao: Custo por kg em R$/kg (ex: se o valor unitário for 6.330,00 por tonelada, o custo é 6.33 por kg. Se o valor total for R$ 183.316,80 para 28.960 kg, custo é 6.33).

ATENÇÃO CRÍTICA PARA NOTAS COM MÚLTIPLAS BOBINAS (MUITO COMUM):
Frequentemente uma NF fatura 2, 3, 4 ou mais bobinas juntas. Isso pode ocorrer de 2 formas:
Forma A: Na descrição do produto estão listados os LOTES individuais e seus respectivos pesos (exemplo real: 'ALZ 0,38 X 1200 AZ100 Lotes: 1260522B3103200 (7,24 T ) 1260522A3104000 (6,98 T ) 1260523A3100100 (7,33 T ) 1260522B3101800 (7,41 T )').
ATENÇÃO: Cada lote desse representa UMA BOBINA FÍSICA SEPARADA! '7,24 T' significa 7,24 Toneladas = 7240 kg.
Forma B: Múltiplas linhas de produtos na tabela de itens.

Preencha o array 'bobinas' com CADA BOBINA FÍSICA identificada na nota:
Para cada bobina:
- lote: Número do lote / corrida ou sub_cod daquela bobina específica (ex: "1260522B3103200"). Se não tiver, use null.
- peso_kg: Peso líquido exato DESSA bobina em KG (converta de T para KG se necessário, ex: 7,24 T -> 7240).
- peso_inicial: Mesmo peso em kg ou peso bruto da bobina.
- chapa: Espessura nominal (ex: "0,38").
- largura_mm: Largura em mm (ex: 1200).
- cor: Cor/acabamento (ex: "Galvalume / ALZ").
- qualidade: ["GV", "PP", "FF", "FQ", "GL (IMP)"].
- origem: ["Nacional", "Importado"].
- custo_kg: Custo por kg em R$.

Se a nota tiver apenas 1 bobina simples, o array 'bobinas' deve conter exatamente 1 item com os dados dela.`;

  const jsonSchema = {
    type: "object",
    properties: {
      numero_nf: { type: "string" },
      fornecedor: { type: "string" },
      data_emissao: { type: "string" },
      quantidade_bobinas_nf: { type: "number" },
      peso_liquido_total_kg: { type: "number" },
      peso_bruto_total_kg: { type: "number" },
      chapa_padrao: { type: "string" },
      largura_mm_padrao: { type: "number" },
      cor_padrao: { type: "string" },
      qualidade_padrao: { type: "string", enum: ["GV", "PP", "FF", "FQ", "GL (IMP)"] },
      origem_padrao: { type: "string", enum: ["Nacional", "Importado"] },
      custo_kg_padrao: { type: "number" },
      bobinas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            lote: { type: "string" },
            peso_kg: { type: "number" },
            peso_inicial: { type: "number" },
            chapa: { type: "string" },
            largura_mm: { type: "number" },
            cor: { type: "string" },
            qualidade: { type: "string", enum: ["GV", "PP", "FF", "FQ", "GL (IMP)"] },
            origem: { type: "string", enum: ["Nacional", "Importado"] },
            custo_kg: { type: "number" }
          },
          required: ["peso_kg"]
        }
      }
    },
    required: ["numero_nf", "fornecedor", "bobinas"]
  };

  const resposta = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: jsonSchema
  });

  return {
    file_url,
    file_name: rawFile.name || "NotaFiscal.jpg",
    dados: resposta || {}
  };
}

/**
 * Compara dois números de Nota Fiscal de forma inteligente, tolerando
 * zeros à esquerda, pontos, traços e espaços (ex: "000.005.041" === "5041").
 */
export function compararNFs(nf1, nf2) {
  if (!nf1 || !nf2) return false;
  const s1 = String(nf1).trim();
  const s2 = String(nf2).trim();
  if (s1.toLowerCase() === s2.toLowerCase()) return true;
  const d1 = s1.replace(/\D/g, "").replace(/^0+/, "");
  const d2 = s2.replace(/\D/g, "").replace(/^0+/, "");
  return Boolean(d1 && d2 && d1 === d2);
}

/**
 * Busca na lista de itens existentes (bobinas, chapas, slitters, colas, isopores) se já há algum cadastrado com a mesma NF
 */
export function encontrarItensPorNF(lista = [], nf = "", itemIdAtual = null) {
  if (!nf || !String(nf).trim()) return [];
  return lista.filter(item => {
    if (!item) return false;
    if (itemIdAtual && (item.id === itemIdAtual || item.codigo === itemIdAtual)) return false;
    return compararNFs(item.nf || item.lote, nf);
  });
}

export const encontrarBobinasPorNF = encontrarItensPorNF;

/**
 * Lê Nota Fiscal de Chaparia (Corte & Dobra) via IA Multimodal
 */
export async function lerNotaFiscalChapa(file) {
  const rawFile = file?.target?.files?.[0] || file;
  if (!rawFile) throw new Error("Arquivo de Nota Fiscal não fornecido");

  const { file_url } = await base44.integrations.Core.UploadFile({ file: rawFile });

  const prompt = `Você é um assistente especialista em leitura de Notas Fiscais Eletrônicas (DANFE) de chapas metálicas, aço plano e chaparia de corte e dobra.
Analise a imagem da Nota Fiscal e extraia com precisão os dados fiscais e as medidas das chapas:
- "numero_nf": Número da NF (ex: 5041, 12345).
- "fornecedor": Nome ou Razão Social do emitente/fornecedor.
- "data_emissao": Data de emissão no formato AAAA-MM-DD.
- "comprimento_mm": Comprimento da chapa em milímetros (ex: 3000, 2000, 6000).
- "largura_mm": Largura da chapa em milímetros (ex: 1200, 1000, 1500).
- "espessura_mm": Espessura da chapa em milímetros (ex: 0.43, 0.50, 0.65, 0.95, 1.25, 2.00).
- "material": Tipo ou descrição do material (ex: "Chapa lisa", "Chapa xadrez", "Galvalume", "Galvanizada", "Fina a Frio").
- "qualidade": Sigla de qualidade do aço, se houver: "GV", "PP", "FF", "FQ", "GL (IMP)".
- "quantidade_total": Quantidade total de peças ou chapas faturadas.
- "peso_kg": Peso líquido total em kg (se vier em Toneladas, multiplique por 1000).
- "cliente": Destinatário se for faturamento para cliente específico.
- "numero_pedido": Número do pedido de compra/venda mencionado na NF.`;

  const jsonSchema = {
    type: "object",
    properties: {
      numero_nf: { type: "string" },
      fornecedor: { type: "string" },
      data_emissao: { type: "string" },
      comprimento_mm: { type: "number" },
      largura_mm: { type: "number" },
      espessura_mm: { type: "number" },
      material: { type: "string" },
      qualidade: { type: "string", enum: ["GV", "PP", "FF", "FQ", "GL (IMP)"] },
      quantidade_total: { type: "number" },
      peso_kg: { type: "number" },
      cliente: { type: "string" },
      numero_pedido: { type: "string" }
    },
    required: ["numero_nf", "fornecedor"]
  };

  const resposta = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: jsonSchema
  });

  return {
    file_url,
    file_name: rawFile.name || "NotaFiscal_Chapa.jpg",
    dados: resposta || {}
  };
}

/**
 * Lê Nota Fiscal de Slitter / Fitas de Aço via IA Multimodal
 */
export async function lerNotaFiscalSlitter(file) {
  const rawFile = file?.target?.files?.[0] || file;
  if (!rawFile) throw new Error("Arquivo de Nota Fiscal não fornecido");

  const { file_url } = await base44.integrations.Core.UploadFile({ file: rawFile });

  const prompt = `Você é um assistente especialista em leitura de Notas Fiscais Eletrônicas (DANFE) de tiras/fitas de aço e bobinas slitter.
Analise a imagem da Nota Fiscal e extraia com precisão os dados do produto siderúrgico:
- "numero_nf": Número da NF (ex: 5041).
- "fornecedor": Nome ou Razão Social do emitente/fornecedor.
- "data_emissao": Data de emissão no formato AAAA-MM-DD.
- "peso_kg": Peso em quilogramas (se estiver em Toneladas, multiplique por 1000).
- "largura_mm": Largura da tira em milímetros (ex: 75, 100, 150, 200, 300, etc.).
- "espessura_mm": Espessura do aço em milímetros (ex: 0.43, 0.50, 0.65, 0.95, 1.25).
- "qualidade": Qualidade do aço: "GV", "PP", "FF", "FQ", "GL (IMP)".
- "origem": "Nacional" ou "Importado".
- "materiais_producao": Descrição do perfil ou material (ex: "75x40 / 68x30 / 100x40").
- "lote": Número do lote de fabricação ou corrida.`;

  const jsonSchema = {
    type: "object",
    properties: {
      numero_nf: { type: "string" },
      fornecedor: { type: "string" },
      data_emissao: { type: "string" },
      peso_kg: { type: "number" },
      largura_mm: { type: "number" },
      espessura_mm: { type: "number" },
      qualidade: { type: "string", enum: ["GV", "PP", "FF", "FQ", "GL (IMP)"] },
      origem: { type: "string", enum: ["Nacional", "Importado"] },
      materiais_producao: { type: "string" },
      lote: { type: "string" }
    },
    required: ["numero_nf", "fornecedor"]
  };

  const resposta = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: jsonSchema
  });

  return {
    file_url,
    file_name: rawFile.name || "NotaFiscal_Slitter.jpg",
    dados: resposta || {}
  };
}

/**
 * Lê Nota Fiscal de Cola / Adesivo Industrial via IA Multimodal
 */
export async function lerNotaFiscalCola(file) {
  const rawFile = file?.target?.files?.[0] || file;
  if (!rawFile) throw new Error("Arquivo de Nota Fiscal não fornecido");

  const { file_url } = await base44.integrations.Core.UploadFile({ file: rawFile });

  const prompt = `Você é um assistente especialista em leitura de Notas Fiscais Eletrônicas (DANFE) de colas e adesivos para telhas termoacústicas (PUR, Termofusível, Base Água, Poliuretano).
Analise a imagem da Nota Fiscal e extraia com precisão:
- "numero_nf": Número da NF.
- "fornecedor": Razão social do fornecedor da cola.
- "data_emissao": Data de emissão no formato AAAA-MM-DD.
- "tipo": Tipo de cola identificado: "Cola Termofusível", "Cola PUR", "Cola Base Água", "Cola Poliuretano" ou "Outro".
- "tambores_qtd": Quantidade de tambores (se faturado em tambores, bombonas ou barris).
- "tambor_peso_kg": Peso de cada tambor em kg (padrão é 200kg se for tambor padrão).
- "sacos_qtd": Quantidade de sacos ou pacotes se faturado em sacos.
- "custo_tambor": Valor unitário do tambor ou custo total dividido pela quantidade.
- "lote": Número do lote do fabricante.
- "data_validade": Data de validade mencionada (AAAA-MM-DD).`;

  const jsonSchema = {
    type: "object",
    properties: {
      numero_nf: { type: "string" },
      fornecedor: { type: "string" },
      data_emissao: { type: "string" },
      tipo: {
        type: "string",
        enum: ["Cola Termofusível", "Cola PUR", "Cola Base Água", "Cola Poliuretano", "Outro"]
      },
      tambores_qtd: { type: "number" },
      tambor_peso_kg: { type: "number" },
      sacos_qtd: { type: "number" },
      custo_tambor: { type: "number" },
      lote: { type: "string" },
      data_validade: { type: "string" }
    },
    required: ["numero_nf", "fornecedor"]
  };

  const resposta = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: jsonSchema
  });

  return {
    file_url,
    file_name: rawFile.name || "NotaFiscal_Cola.jpg",
    dados: resposta || {}
  };
}

/**
 * Lê Nota Fiscal de Isopor / EPS para Telhas Térmicas via IA Multimodal
 */
export async function lerNotaFiscalIsopor(file) {
  const rawFile = file?.target?.files?.[0] || file;
  if (!rawFile) throw new Error("Arquivo de Nota Fiscal não fornecido");

  const { file_url } = await base44.integrations.Core.UploadFile({ file: rawFile });

  const prompt = `Você é um assistente especialista em leitura de Notas Fiscais Eletrônicas (DANFE) de EPS / Isopor e núcleos isolantes para telhas sanduíche e termoacústicas.
Analise a imagem da Nota Fiscal e extraia com precisão:
- "numero_nf": Número da NF.
- "fornecedor": Razão social do fornecedor de EPS.
- "data_emissao": Data de emissão no formato AAAA-MM-DD.
- "tipo": Modelo de perfil compatível com a telha:
  "EPS - TP 40", "EPS - TP 25", "EPS - TP 40 BANDEJA", "EPS - COLONIAL", "EPS - COLONIAL BANDEJA" ou "EPS - ONDULADO".
- "espessura_mm": Espessura do núcleo em milímetros (ex: 30, 40, 50, 60, 100).
- "quantidade": Quantidade de barras/unidades de 2 metros.
- "metragem_total": Metragem linear total em metros (quantidade × 2).
- "lote": Lote de fabricação se informado.`;

  const jsonSchema = {
    type: "object",
    properties: {
      numero_nf: { type: "string" },
      fornecedor: { type: "string" },
      data_emissao: { type: "string" },
      tipo: {
        type: "string",
        enum: [
          "EPS - TP 25",
          "EPS - TP 40",
          "EPS - TP 40 BANDEJA",
          "EPS - COLONIAL",
          "EPS - COLONIAL BANDEJA",
          "EPS - ONDULADO"
        ]
      },
      espessura_mm: { type: "number" },
      quantidade: { type: "number" },
      metragem_total: { type: "number" },
      lote: { type: "string" }
    },
    required: ["numero_nf", "fornecedor"]
  };

  const resposta = await base44.integrations.Core.InvokeLLM({
    prompt,
    file_urls: [file_url],
    response_json_schema: jsonSchema
  });

  return {
    file_url,
    file_name: rawFile.name || "NotaFiscal_Isopor.jpg",
    dados: resposta || {}
  };
}
