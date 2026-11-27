import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

/**
 * Helper de Impressão e Geração de PDF Oficial do Romaneio AJL
 *
 * REGRA EXCLUSIVA (Atendendo ao usuário):
 * - PÁGINA 1: A foto original da folha de rota inserida manualmente (nítida, em alta resolução).
 * - PÁGINAS SEGUINTES: Exclusivamente os arquivos PDF oficiais dos pedidos em sequência direta (vindos do Odoo).
 * - Se algum pedido ainda não tiver PDF: inclui uma folha formal A4 informando "PDF Pendente no Odoo".
 * - Sem tabelas duplicadas, sem canhotos genéricos de assinatura.
 */

/**
 * Converte Data URI base64 para Uint8Array
 */
function base64ToUint8Array(base64Str) {
  const base64Data = base64Str.includes(",") ? base64Str.split(",")[1] : base64Str;
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Faz download de URL para ArrayBuffer (suporta blob:, data: e http(s):)
 */
async function fetchBinaryData(url) {
  if (!url) return null;
  if (url.startsWith("data:")) {
    return base64ToUint8Array(url);
  }
  const resp = await fetch(url);
  if (!resp.ok) {
    throw new Error(`Falha ao baixar arquivo: HTTP ${resp.status}`);
  }
  const buffer = await resp.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Tenta incorporar imagem no PDFDocument (JPG ou PNG)
 */
async function embedImageSafely(pdfDoc, imageBytes) {
  // Checa assinatura PNG (89 50 4E 47)
  const isPng =
    imageBytes[0] === 0x89 &&
    imageBytes[1] === 0x50 &&
    imageBytes[2] === 0x4e &&
    imageBytes[3] === 0x47;

  if (isPng) {
    try {
      return await pdfDoc.embedPng(imageBytes);
    } catch {
      return await pdfDoc.embedJpg(imageBytes);
    }
  } else {
    try {
      return await pdfDoc.embedJpg(imageBytes);
    } catch {
      return await pdfDoc.embedPng(imageBytes);
    }
  }
}

/**
 * Busca de fallback direto no banco de PedidoOdoo para garantir 100% dos PDFs
 */
async function buscarPedidoOdooBanco(numeroPedido) {
  if (!numeroPedido) return null;
  const numLimpo = String(numeroPedido).replace(/^[Ss]0*/, "").replace(/\D/g, "");
  try {
    const res = await base44.entities.PedidoOdoo.filter({
      $or: [
        { numero_pedido: String(numeroPedido) },
        { numero_pedido: `S${numLimpo.padStart(5, "0")}` },
        { numero_pedido: `S${numLimpo}` },
        { odoo_id: String(numeroPedido) },
        ...(numLimpo ? [{ numero_pedido: numLimpo }, { odoo_id: numLimpo }] : []),
      ]
    }, "-created_date", 1);
    return res && res.length > 0 ? res[0] : null;
  } catch {
    return null;
  }
}

/**
 * Gera o documento PDF unificado e definitivo do Romaneio AJL com pdf-lib:
 * Página 1: Foto original da folha de rota (Landscape)
 * Páginas seguintes: Os PDFs oficiais de cada pedido em ordem
 */
export async function gerarRomaneioPdfCompleto(rota, options = {}) {
  let itens = [];
  try {
    itens = typeof rota.itens_json === "string" ? JSON.parse(rota.itens_json || "[]") : rota.itens_json || [];
  } catch {
    itens = [];
  }

  const infoMap = options.infoPedidosMap || {};
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 1. PÁGINA 1: FOTO ORIGINAL DA ROTA
  if (rota.rota_imagem_url) {
    try {
      const imgBytes = await fetchBinaryData(rota.rota_imagem_url);
      if (imgBytes) {
        const image = await embedImageSafely(pdfDoc, imgBytes);
        const imgDims = image.scale(1);

        // Se a imagem for mais larga que alta, usa Landscape A4 (841.89 x 595.28 pt)
        // Se for retrato, usa Retrato A4 (595.28 x 841.89 pt)
        const isLandscape = imgDims.width >= imgDims.height;
        const pageWidth = isLandscape ? 841.89 : 595.28;
        const pageHeight = isLandscape ? 595.28 : 841.89;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);

        // Margens
        const margin = 20;
        const headerH = 35;
        const availW = pageWidth - margin * 2;
        const availH = pageHeight - margin * 2 - headerH;

        // Cabeçalho institucional discreto no topo
        page.drawRectangle({
          x: margin,
          y: pageHeight - margin - 25,
          width: availW,
          height: 25,
          color: rgb(0.06, 0.09, 0.16), // #0f172a
        });

        page.drawText("AJL FERRO & AÇO — EXPEDIÇÃO & LOGÍSTICA", {
          x: margin + 10,
          y: pageHeight - margin - 17,
          size: 11,
          font: fontBold,
          color: rgb(1, 1, 1),
        });

        const tituloRota = `${rota.titulo || "Rota de Entrega"} | Placa: ${rota.placa || "—"} | Motorista: ${rota.motorista_nome || "—"}`;
        page.drawText(tituloRota.slice(0, 75), {
          x: margin + 300,
          y: pageHeight - margin - 17,
          size: 9,
          font: fontNormal,
          color: rgb(0.18, 0.83, 0.75), // #2dd4bf
        });

        // Escala da imagem mantendo proporção
        const scale = Math.min(availW / imgDims.width, availH / imgDims.height);
        const drawW = imgDims.width * scale;
        const drawH = imgDims.height * scale;
        const drawX = margin + (availW - drawW) / 2;
        const drawY = margin + (availH - drawH) / 2;

        page.drawImage(image, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH,
        });
      }
    } catch (errFoto) {
      console.warn("Aviso ao incorporar foto da rota no PDF:", errFoto);
    }
  }

  // 2. PÁGINAS SEGUINTES: PDFS OFICIAIS DOS PEDIDOS
  for (let idx = 0; idx < itens.length; idx++) {
    const it = itens[idx];
    const info = infoMap[it.numero_pedido];

    // Resolução da URL do PDF
    let pdfUrl =
      it.pdf_url ||
      info?.pedidoOdoo?.pdf_pedido_url ||
      info?.pedidoOdoo?.pdf_url ||
      info?.anexos?.find((a) => a?.toLowerCase?.()?.endsWith(".pdf"));

    // Se ainda não achou, faz busca no banco
    if (!pdfUrl) {
      const pedidoBanco = await buscarPedidoOdooBanco(it.numero_pedido);
      if (pedidoBanco?.pdf_pedido_url || pedidoBanco?.pdf_url) {
        pdfUrl = pedidoBanco.pdf_pedido_url || pedidoBanco.pdf_url;
      }
    }

    let pdfCarregado = false;

    if (pdfUrl) {
      try {
        const bytes = await fetchBinaryData(pdfUrl);
        if (bytes && bytes.length > 0) {
          const srcPdf = await PDFDocument.load(bytes);
          const indices = srcPdf.getPageIndices();
          const copied = await pdfDoc.copyPages(srcPdf, indices);
          for (const cpPage of copied) {
            pdfDoc.addPage(cpPage);
          }
          pdfCarregado = true;
        }
      } catch (errPdf) {
        console.warn(`Erro ao carregar PDF do pedido #${it.numero_pedido}:`, errPdf);
      }
    }

    // Se o pedido não tem PDF ou falhou o carregamento:
    // Gera página formal de identificação do pedido na rota
    if (!pdfCarregado) {
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 Retrato
      const pW = 595.28;
      const pH = 841.89;
      const m = 35;

      // Topo
      page.drawRectangle({
        x: m,
        y: pH - m - 45,
        width: pW - m * 2,
        height: 45,
        color: rgb(0.06, 0.09, 0.16),
      });

      page.drawText("AJL FERRO & AÇO — EXPEDIÇÃO & LOGÍSTICA", {
        x: m + 15,
        y: pH - m - 25,
        size: 14,
        font: fontBold,
        color: rgb(1, 1, 1),
      });

      page.drawText(`ITEM DA ROTA #${it.ordem || idx + 1} — PEDIDO #${it.numero_pedido}`, {
        x: m + 15,
        y: pH - m - 38,
        size: 10,
        font: fontBold,
        color: rgb(0.18, 0.83, 0.75),
      });

      // Caixa de Alerta de PDF Pendente
      page.drawRectangle({
        x: m,
        y: pH - m - 140,
        width: pW - m * 2,
        height: 80,
        color: rgb(0.99, 0.95, 0.88), // Amber 50
        borderColor: rgb(0.96, 0.75, 0.38), // Amber 400
        borderWidth: 1.5,
      });

      page.drawText("DOCUMENTO OFICIAL PENDENTE NO ODOO ERP", {
        x: m + 15,
        y: pH - m - 85,
        size: 12,
        font: fontBold,
        color: rgb(0.72, 0.35, 0.05), // Amber 800
      });

      page.drawText(
        "O arquivo PDF deste pedido ainda não foi transmitido via integração Odoo ou está aguardando emissão.",
        {
          x: m + 15,
          y: pH - m - 105,
          size: 9.5,
          font: fontNormal,
          color: rgb(0.45, 0.25, 0.05),
        }
      );

      page.drawText(
        "Utilize o botão 'Anexar PDF' na tabela de pedidos ou solicite a sincronização na Central PCP.",
        {
          x: m + 15,
          y: pH - m - 120,
          size: 9,
          font: fontNormal,
          color: rgb(0.45, 0.25, 0.05),
        }
      );

      // Dados do Pedido
      let curY = pH - m - 175;
      const drawCampo = (rotulo, valor) => {
        page.drawText(rotulo.toUpperCase() + ":", {
          x: m + 15,
          y: curY,
          size: 9.5,
          font: fontBold,
          color: rgb(0.2, 0.27, 0.38),
        });
        page.drawText(String(valor || "—"), {
          x: m + 140,
          y: curY,
          size: 9.5,
          font: fontNormal,
          color: rgb(0.06, 0.09, 0.16),
        });
        curY -= 22;
      };

      drawCampo("Cliente / Razão", it.cliente);
      drawCampo("Bairro / Destino", it.bairro);
      drawCampo("Vendedor", it.vendedor);
      drawCampo("Condição Pgto", it.pagamento);
      drawCampo("Barracão Responsável", it.barracao_sugerido || "PCP");
      drawCampo("Observações da Rota", it.observacao);
      if (it.valor) drawCampo("Valor Estimado", it.valor);

      // Rodapé da folha
      page.drawLine({
        start: { x: m, y: m + 30 },
        end: { x: pW - m, y: m + 30 },
        color: rgb(0.8, 0.85, 0.9),
        thickness: 1,
      });

      page.drawText(
        `Romaneio AJL • Rota: ${rota.titulo || "—"} • Emissão: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`,
        {
          x: m,
          y: m + 15,
          size: 8,
          font: fontNormal,
          color: rgb(0.45, 0.55, 0.65),
        }
      );
    }
  }

  // Gera os bytes finais do PDF
  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/**
 * Abre o Romaneio PDF diretamente no navegador (Aba de Leitura / Impressão Nativa)
 */
export async function imprimirRomaneioHtml(rota, options = {}) {
  const toastId = toast.loading("Gerando Romaneio PDF (Foto da Rota + PDFs dos Pedidos)...");
  try {
    const blob = await gerarRomaneioPdfCompleto(rota, options);
    const blobUrl = URL.createObjectURL(blob);

    toast.dismiss(toastId);
    toast.success("Romaneio PDF gerado com sucesso!");

    // Abre em nova aba nativa do navegador
    const win = window.open(blobUrl, "_blank");
    if (!win) {
      // Caso popups estejam bloqueados pelo navegador, dispara download automático
      const link = document.createElement("a");
      link.href = blobUrl;
      const nomeLimpo = (rota.titulo || "Romaneio").replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `Romaneio_${nomeLimpo}.pdf`;
      link.click();
    }
  } catch (error) {
    console.error("Erro ao gerar Romaneio PDF:", error);
    toast.dismiss(toastId);
    toast.error("Erro ao gerar Romaneio PDF: " + (error?.message || "Tente novamente."));
  }
}

/**
 * Dispara o download automático do Romaneio PDF unificado
 */
export async function baixarRomaneioPdf(rota, options = {}) {
  const toastId = toast.loading("Preparando download do Romaneio PDF unificado...");
  try {
    const blob = await gerarRomaneioPdfCompleto(rota, options);
    const blobUrl = URL.createObjectURL(blob);
    const nomeLimpo = (rota.titulo || "Romaneio").replace(/[^a-zA-Z0-9_-]/g, "_");

    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `Romaneio_${nomeLimpo}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    toast.dismiss(toastId);
    toast.success("Download do Romaneio PDF iniciado!");
  } catch (error) {
    console.error("Erro ao baixar Romaneio PDF:", error);
    toast.dismiss(toastId);
    toast.error("Erro ao baixar Romaneio PDF: " + (error?.message || "Tente novamente."));
  }
}
