import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { base44 } from "@/api/base44Client";

/**
 * Helper de Impressão e Geração de PDF Oficial do Romaneio AJL
 *
 * Impressão: um único arquivo com a foto original da rota na primeira página
 * e, em seguida, uma página para cada PDF oficial recebido do Odoo.
 */

/**
 * Monta o arquivo (foto + PDFs, uma página cada) e abre para impressão.
 */
export async function imprimirRomaneioHtml(rota) {
  // Abre a aba no clique para não ser bloqueada pelo navegador.
  const janela = window.open("", "_blank");
  try {
    const { data } = await base44.functions.invoke("gerarRomaneioPdf", { rota_id: rota.id });
    if (!data?.success || !data?.file_url) {
      throw new Error(data?.message || data?.error || "Não foi possível montar o arquivo.");
    }

    if (janela) {
      janela.location.href = data.file_url;
    } else {
      window.open(data.file_url, "_blank");
    }

    if (data.sem_pdf?.length) {
      toast.warning(`Sem PDF recebido do Odoo: ${data.sem_pdf.join(", ")}`);
    }
    if (data.falhas?.length) {
      toast.warning(`Não foi possível incluir: ${data.falhas.map(f => f.documento).join(", ")}`);
    }
  } catch (erro) {
    if (janela) janela.close();
    toast.error("Erro ao montar o romaneio: " + (erro?.message || ""));
  }
}

/**
 * Gera e baixa o arquivo PDF nativo do Romaneio via jsPDF
 */
export function baixarRomaneioPdf(rota, options = {}) {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margem = 10;
  const areaWidth = pageWidth - margem * 2;

  let itens = [];
  try {
    itens = typeof rota.itens_json === "string" ? JSON.parse(rota.itens_json || "[]") : rota.itens_json || [];
  } catch {
    itens = [];
  }

  const dataHoje = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const filial = rota.unidade || options.filialAtiva || "Matriz AJL";

  // Cabeçalho Landscape
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(15, 23, 42);
  doc.text("AJL FERRO & AÇO — EXPEDIÇÃO & LOGÍSTICA", margem, 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(13, 148, 136);
  doc.text(`MANIFESTO DE CARGA — ${rota.titulo || "Rota de Entrega"}`, margem, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Emissão: ${dataHoje} | Unidade: ${filial}`, pageWidth - margem, 14, { align: "right" });
  doc.text(`Motorista: ${rota.motorista_nome || "—"} (${rota.placa || "S/ Placa"})`, pageWidth - margem, 19, { align: "right" });

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margem, 23, pageWidth - margem, 23);

  let y = 30;
  doc.setFillColor(15, 23, 42);
  doc.rect(margem, y, areaWidth, 6.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);

  doc.text("#", margem + 2, y + 4.5);
  doc.text("PEDIDO (ODOO)", margem + 10, y + 4.5);
  doc.text("CLIENTE / DESTINATÁRIO", margem + 42, y + 4.5);
  doc.text("BARRACÃO", margem + 120, y + 4.5);
  doc.text("OBSERVAÇÃO DA ROTA", margem + 155, y + 4.5);
  doc.text("BAIRRO / CIDADE", margem + 215, y + 4.5);
  doc.text("VALOR", margem + 250, y + 4.5);
  doc.text("CONF.", margem + 270, y + 4.5);

  y += 6.5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  itens.forEach((it, idx) => {
    if (y > pageHeight - 25) {
      doc.addPage();
      y = 15;
      doc.setFillColor(15, 23, 42);
      doc.rect(margem, y, areaWidth, 6.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("#", margem + 2, y + 4.5);
      doc.text("PEDIDO (ODOO)", margem + 10, y + 4.5);
      doc.text("CLIENTE / DESTINATÁRIO", margem + 42, y + 4.5);
      doc.text("BARRACÃO", margem + 120, y + 4.5);
      doc.text("OBSERVAÇÃO DA ROTA", margem + 155, y + 4.5);
      doc.text("BAIRRO / CIDADE", margem + 215, y + 4.5);
      doc.text("VALOR", margem + 250, y + 4.5);
      doc.text("CONF.", margem + 270, y + 4.5);
      y += 6.5;
    }

    const linhaBg = idx % 2 === 0 ? 255 : 248;
    doc.setFillColor(linhaBg, linhaBg, linhaBg);
    doc.rect(margem, y, areaWidth, 8, "F");

    doc.setDrawColor(226, 232, 240);
    doc.line(margem, y + 8, margem + areaWidth, y + 8);

    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.text(String(it.ordem || idx + 1), margem + 2, y + 5.5);
    doc.text(`#${it.numero_pedido}`, margem + 10, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.text((it.cliente || "—").slice(0, 38), margem + 42, y + 5.5);

    const bNome = it.barracao_sugerido === "telhas" ? "Telhas" : it.barracao_sugerido === "corte_dobra" ? "Corte & Dobra" : it.barracao_sugerido === "ambos" ? "Ambos" : "Aguardando";
    doc.text(bNome, margem + 120, y + 5.5);
    doc.text((it.observacao || "—").slice(0, 30), margem + 155, y + 5.5);
    doc.text((it.bairro || "—").slice(0, 20), margem + 215, y + 5.5);
    doc.text(it.valor || "—", margem + 250, y + 5.5);

    doc.setDrawColor(148, 163, 184);
    doc.rect(margem + 271, y + 1.5, 4.5, 4.5, "S");

    y += 8;
  });

  const assinaY = pageHeight - 16;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line(margem + 20, assinaY, margem + 110, assinaY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("CONFERENTE / EXPEDIÇÃO (VISTO E CARREGAMENTO)", margem + 25, assinaY + 4);

  doc.line(margem + 160, assinaY, margem + 260, assinaY);
  doc.text(`MOTORISTA: ${rota.motorista_nome || "Assinatura do Condutor"}`, margem + 165, assinaY + 4);

  const nomeLimpo = (rota.titulo || "Rota_Entrega").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Romaneio_${nomeLimpo}.pdf`);
}