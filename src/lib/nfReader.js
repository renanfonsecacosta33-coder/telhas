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
 * Extrai automaticamente todos os dados para preenchimento de Nova Bobina.
 */
export async function lerNotaFiscalBobina(rawFile) {
  if (!rawFile) throw new Error("Nenhum arquivo fornecido.");

  // Otimiza imagem se for foto
  const file = await compressImage(rawFile, 2048, 0.90);

  // Faz upload do anexo
  const { file_url } = await base44.integrations.Core.UploadFile({ file });
  if (!file_url) throw new Error("Falha ao enviar arquivo da Nota Fiscal.");

  // Invoca a IA com prompt especializado em bobinas de aço
  const prompt = `Você é um leitor especialista em Notas Fiscais Eletrônicas (DANFE / NF-e) emitidas para fábricas de telhas, corte & dobra e perfis de aço.
Analise a imagem da Nota Fiscal e extraia as informações referentes à(s) bobina(s) de aço:

1. numero_nf: Número da Nota Fiscal (apenas dígitos numéricos ou string limpa, ex: "105423")
2. fornecedor: Razão Social ou Nome Fantasia do EMITENTE da NF (ex: "ArcelorMittal Brasil", "CSN - Cia Siderúrgica Nacional", "Bekaert", "Usiminas", etc.)
3. data_emissao: Data de emissão no formato AAAA-MM-DD (ex: "2026-09-21"). Se não encontrar, use null.
4. peso_liquido_kg: Peso Líquido total dos produtos ou da bobina em kg (number).
5. peso_bruto_kg: Peso Bruto total declarado no rodapé da nota em kg (number).
6. chapa: Espessura nominal ou número da chapa (ex: "0,43", "0,50", "0,65", "0,95", "1,25"). Formate com vírgula ou ponto, ex: "0,43".
7. largura_mm: Largura da bobina em milímetros (ex: 1200, 1000, 1220, etc.). Se constar em metros (ex: 1,20m), converta para mm (1200). Se não constar, coloque 1200 se for telha ou null.
8. cor: Cor ou acabamento superficial do aço mencionado na descrição (ex: "Galvanizado", "Zincado", "Branco Neve", "Cinza", "Natural", "Galvalume", "Preto", "Azul", etc.). Se for bobina galvanizada padrão, use "Galvanizado".
9. qualidade: Código de qualidade do aço: escolha rigorosamente entre ["GV", "PP", "FF", "FQ", "GL (IMP)"].
   - "PP": Pré-pintado / bobina com cor pintada.
   - "GV": Galvanizado / Zincado convencional.
   - "GL (IMP)": Galvalume importado.
   - "FF": Fita a Frio / Aço laminado a frio.
   - "FQ": Aço laminado a quente.
10. origem: "Nacional" ou "Importado". Se a nota for de usina brasileira (CSN, ArcelorMittal, Gerdau, Usiminas) ou CST 0/4, marque "Nacional". Se tiver CST 1/2 ou origem estrangeira, marque "Importado".
11. custo_kg: Preço do aço por kg (R$/kg). Se constar o valor unitário por kg na nota, use-o. Se constar apenas o valor total dos produtos em R$, divida o valor total pelo peso líquido em kg para obter o custo em R$/kg com 2 casas decimais.
12. sub_cod: Código do produto ou especificação da bobina informada pelo fabricante (se houver).
13. resumo_itens: Breve descrição literal dos produtos encontrados na nota.`;

  const jsonSchema = {
    type: "object",
    properties: {
      numero_nf: { type: "string" },
      fornecedor: { type: "string" },
      data_emissao: { type: "string" },
      peso_liquido_kg: { type: "number" },
      peso_bruto_kg: { type: "number" },
      chapa: { type: "string" },
      largura_mm: { type: "number" },
      cor: { type: "string" },
      qualidade: { type: "string", enum: ["GV", "PP", "FF", "FQ", "GL (IMP)"] },
      origem: { type: "string", enum: ["Nacional", "Importado"] },
      custo_kg: { type: "number" },
      sub_cod: { type: "string" },
      resumo_itens: { type: "string" }
    }
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
