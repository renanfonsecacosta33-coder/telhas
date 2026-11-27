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
 * - Sem tabelas duplicadas, sem canhotos genéricos de assinatura.
 *
 * Arquitetura:
 * 1. Tenta gerar via Base44 Function de backend (gerarRomaneioPdf) usando Deno + pdf-lib.
 * 2. Caso ocorra qualquer indisponibilidade da function, usa gerador client-side dinâmico
 *    carregando pdf-lib via CDN sob demanda (evitando falha de bundle no Vite Sandbox).
 */

/**
 * Carrega a biblioteca pdf-lib dinamicamente no navegador (sem quebrar o Vite no Sandbox)
 */
async function carregarPdfLibDinamico() {
  if (typeof window !== "undefined" && window.PDFLib) {
    return window.PDFLib;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js";
    script.async = true;
    script.onload = () => {
      if (window.PDFLib) {
        resolve(window.PDFLib);
      } else {
        reject(new Error("pdf-lib carregado mas objeto window.PDFLib não encontrado"));
      }
    };
    script.onerror = () => reject(new Error("Não foi possível carregar a biblioteca de PDF no navegador."));
    document.head.appendChild(script);
  });
}

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

async function embedImageSafely(pdfDoc, imageBytes) {
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
 * Fallback client-side para gerar o PDF diretamente no browser
 */
async function gerarRomaneioPdfClientSide(rota) {
  const PDFLib = await carregarPdfLibDinamico();
  const { PDFDocument, rgb, StandardFonts } = PDFLib;

  let itens = [];
  try {
    itens = typeof rota.itens_json === "string" ? JSON.parse(rota.itens_json || "[]") : rota.itens_json || [];
  } catch {
    itens = [];
  }

  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontNormal = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // 1. PÁGINA 1: FOTO ORIGINAL DA ROTA
  const rotaFotoUrl = rota.rota_imagem_url || rota.foto_folha_url || rota.imagem_folha_url;
  if (rotaFotoUrl) {
    try {
      const imgBytes = await fetchBinaryData(rotaFotoUrl);
      if (imgBytes) {
        const embeddedImg = await embedImageSafely(pdfDoc, imgBytes);
        if (embeddedImg) {
          const a4Width = 841.89; // Landscape A4
          const a4Height = 595.28;
          const page = pdfDoc.addPage([a4Width, a4Height]);

          const scale = Math.min(
            (a4Width - 40) / embeddedImg.width,
            (a4Height - 40) / embeddedImg.height
          );
          const scaledW = embeddedImg.width * scale;
          const scaledH = embeddedImg.height * scale;
          const posX = (a4Width - scaledW) / 2;
          const posY = (a4Height - scaledH) / 2;

          page.drawImage(embeddedImg, {
            x: posX,
            y: posY,
            width: scaledW,
            height: scaledH,
          });
        }
      }
    } catch (e) {
      console.warn("Falha ao incorporar foto da rota no client:", e);
    }
  }

  // 2. PÁGINAS SEGUINTES: PDFS DOS PEDIDOS
  for (const it of itens) {
    let pdfUrl = it.pdf_url;
    let pdfAdicionado = false;

    if (pdfUrl) {
      try {
        const pdfBytes = await fetchBinaryData(pdfUrl);
        if (pdfBytes) {
          const donorDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
          const copiedPages = await pdfDoc.copyPages(donorDoc, donorDoc.getPageIndices());
          copiedPages.forEach((cp) => pdfDoc.addPage(cp));
          pdfAdicionado = true;
        }
      } catch (err) {
        console.warn(`Erro ao mesclar PDF do pedido ${it.numero_pedido}:`, err);
      }
    }

    if (!pdfAdicionado) {
      // Cria folha A4 com aviso
      const pW = 595.28;
      const pH = 841.89;
      const page = pdfDoc.addPage([pW, pH]);
      page.drawText(`PEDIDO #${it.numero_pedido || "—"}`, {
        x: 40,
        y: pH - 60,
        size: 16,
        font: fontBold,
        color: rgb(0.1, 0.15, 0.25),
      });
      page.drawText(`Cliente: ${it.cliente || "—"}`, {
        x: 40,
        y: pH - 90,
        size: 11,
        font: fontNormal,
        color: rgb(0.3, 0.35, 0.45),
      });
      page.drawText("(PDF oficial deste pedido ainda não foi transmitido pelo Odoo)", {
        x: 40,
        y: pH - 120,
        size: 10,
        font: fontNormal,
        color: rgb(0.6, 0.2, 0.2),
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: "application/pdf" });
}

/**
 * Abre o Romaneio PDF diretamente no navegador (Aba de Leitura / Impressão Nativa)
 */
export async function imprimirRomaneioHtml(rota) {
  const toastId = toast.loading("Gerando Romaneio PDF (Foto da Rota + PDFs dos Pedidos)...");
  
  // Abre janela prévia para não ser bloqueada pelo popup blocker
  const win = window.open("", "_blank");

  try {
    // 1. Tenta gerar via Backend Function do Base44 (Deno)
    let fileUrl = null;
    try {
      const res = await base44.functions.invoke("gerarRomaneioPdf", { rota_id: rota.id });
      if (res?.data?.success && res?.data?.file_url) {
        fileUrl = res.data.file_url;
      }
    } catch (fnErr) {
      console.warn("Base44 function gerarRomaneioPdf falhou, tentando fallback client:", fnErr);
    }

    // 2. Se a function retornou a URL, navega para ela
    if (fileUrl) {
      toast.dismiss(toastId);
      toast.success("Romaneio PDF gerado com sucesso!");
      if (win) {
        win.location.href = fileUrl;
      } else {
        window.open(fileUrl, "_blank");
      }
      return;
    }

    // 3. Fallback client-side usando CDN dinâmico
    const blob = await gerarRomaneioPdfClientSide(rota);
    const blobUrl = URL.createObjectURL(blob);
    toast.dismiss(toastId);
    toast.success("Romaneio PDF gerado com sucesso!");

    if (win) {
      win.location.href = blobUrl;
    } else {
      const link = document.createElement("a");
      link.href = blobUrl;
      const nomeLimpo = (rota.titulo || "Romaneio").replace(/[^a-zA-Z0-9_-]/g, "_");
      link.download = `Romaneio_${nomeLimpo}.pdf`;
      link.click();
    }
  } catch (error) {
    if (win) win.close();
    console.error("Erro ao gerar Romaneio PDF:", error);
    toast.dismiss(toastId);
    toast.error("Erro ao gerar Romaneio PDF: " + (error?.message || "Tente novamente."));
  }
}

/**
 * Dispara o download automático do Romaneio PDF unificado
 */
export async function baixarRomaneioPdf(rota) {
  const toastId = toast.loading("Preparando download do Romaneio PDF unificado...");
  try {
    let fileUrl = null;
    try {
      const res = await base44.functions.invoke("gerarRomaneioPdf", { rota_id: rota.id });
      if (res?.data?.success && res?.data?.file_url) {
        fileUrl = res.data.file_url;
      }
    } catch {}

    const nomeLimpo = (rota.titulo || "Romaneio").replace(/[^a-zA-Z0-9_-]/g, "_");

    if (fileUrl) {
      const link = document.createElement("a");
      link.href = fileUrl;
      link.target = "_blank";
      link.download = `Romaneio_${nomeLimpo}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.dismiss(toastId);
      toast.success("Download do Romaneio PDF iniciado!");
      return;
    }

    const blob = await gerarRomaneioPdfClientSide(rota);
    const blobUrl = URL.createObjectURL(blob);
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
