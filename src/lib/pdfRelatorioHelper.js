import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Cria a base com cabeçalho oficial e rodapé corporativo da AJL
 */
function aplicarCabecalhoERodape(doc, tituloRelatorio, filial, usuarioNome = "Administração") {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Barra de topo corporativa AJL (Teal escuro)
  doc.setFillColor(13, 148, 136); // #0d9488
  doc.rect(0, 0, pageWidth, 5, "F");

  // Nome da Empresa
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text("AJL PERFILADOS & TELHAS METÁLICAS", 14, 16);

  // Subtítulo
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text("SISTEMA INTEGRADO DE GESTÃO INDUSTRIAL (ERP) — RELATÓRIO EXECUTIVO", 14, 21);

  // Linha separadora
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.setLineWidth(0.5);
  doc.line(14, 25, pageWidth - 14, 25);

  // Título do Relatório
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(13, 148, 136);
  doc.text(tituloRelatorio.toUpperCase(), 14, 32);

  // Metadados à direita
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const dataHoje = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  doc.text(`Emissão: ${dataHoje}`, pageWidth - 14, 16, { align: "right" });
  doc.text(`Unidade: ${filial || "Geral (Todas as Filiais)"}`, pageWidth - 14, 20, { align: "right" });
  doc.text(`Emitido por: ${usuarioNome}`, pageWidth - 14, 24, { align: "right" });

  // Rodapé em todas as páginas
  const totalPaginas = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPaginas; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);

    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("AJL Ferro e Aço — Documento Interno e Confidencial de Controle Fabril", 14, pageHeight - 7);
    doc.text(`Página ${i} de ${totalPaginas}`, pageWidth - 14, pageHeight - 7, { align: "right" });
  }
}

/**
 * 1. Relatório Executivo de Produção
 */
export function exportarPdfProducao({ itens, filial, periodo, usuarioNome }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Resumo Executivo
  const totalOps = itens.length;
  const finalizadas = itens.filter(i => i.status === "finalizado").length;
  const metrosTelhas = itens
    .filter(i => i._setor === "Telhas")
    .reduce((s, i) => s + Number(i.metros || i.quantidade_telhas || 0), 0);
  const pecasCD = itens
    .filter(i => i._setor === "Corte e Dobra")
    .reduce((s, i) => s + Number(i.quantidade || 0), 0);

  // Cards de Totais
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 37, pageWidth - 28, 18, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("RESUMO DE PRODUÇÃO:", 18, 43);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`• Total de OPs: ${totalOps} (${finalizadas} concluídas)`, 18, 49);
  doc.text(`• Telhas Produzidas: ${metrosTelhas.toLocaleString("pt-BR")} m`, 85, 49);
  doc.text(`• Corte & Dobra: ${pecasCD.toLocaleString("pt-BR")} peças`, 145, 49);

  // Tabela
  let y = 62;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y - 4, pageWidth - 28, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("PEDIDO", 16, y);
  doc.text("CLIENTE", 40, y);
  doc.text("PRODUTO / PEÇA", 95, y);
  doc.text("MÁQUINA", 138, y);
  doc.text("STATUS", 168, y);
  doc.text("QTD / METROS", pageWidth - 16, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "normal");

  itens.slice(0, 35).forEach((item, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 3.5, pageWidth - 28, 5.5, "F");
    }

    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(String(item.numero_pedido || item.id?.slice(-5) || "—"), 16, y);

    const cliente = String(item.cliente || "Consumidor").slice(0, 30);
    doc.text(cliente, 40, y);

    const prod = String(item.produto || item.tipo_peca || "Peça").slice(0, 24);
    doc.text(prod, 95, y);

    const maq = String(item.maquina || item.maquina_inicial || "—").slice(0, 16);
    doc.text(maq, 138, y);

    const st = String(item.status || "pendente").toUpperCase();
    doc.text(st, 168, y);

    const qtd = item._setor === "Telhas" ? `${item.metros || 0} m` : `${item.quantidade || 0} un`;
    doc.text(qtd, pageWidth - 16, y, { align: "right" });

    y += 5.5;
  });

  aplicarCabecalhoERodape(doc, `Relatório Gerencial de Produção — ${periodo || "Geral"}`, filial, usuarioNome);
  doc.save(`AJL_Relatorio_Producao_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

/**
 * 2. Relatório de Estoque de Bobinas e Matéria-Prima
 */
export function exportarPdfEstoque({ bobinas, filial, usuarioNome }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const totalBobinas = bobinas.length;
  const pesoTotalKg = bobinas.reduce((s, b) => s + Number(b.peso_liquido || b.peso_atual_kg || 0), 0);
  const abaixoMinimo = bobinas.filter(b => Number(b.peso_liquido || b.peso_atual_kg || 0) < 500).length;

  // Resumo
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 37, pageWidth - 28, 18, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("RESUMO DE ESTOQUE:", 18, 43);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`• Total de Bobinas: ${totalBobinas}`, 18, 49);
  doc.text(`• Saldo em Estoque: ${(pesoTotalKg / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ton (${Math.round(pesoTotalKg).toLocaleString("pt-BR")} kg)`, 75, 49);
  doc.text(`• Bobinas Críticas (<500kg): ${abaixoMinimo}`, 145, 49);

  let y = 62;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y - 4, pageWidth - 28, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("CÓDIGO", 16, y);
  doc.text("COR / ACABAMENTO", 45, y);
  doc.text("ESPESSURA", 88, y);
  doc.text("LARGURA", 112, y);
  doc.text("FORNECEDOR", 135, y);
  doc.text("PESO ATUAL (KG)", pageWidth - 16, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "normal");

  bobinas.slice(0, 36).forEach((b, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 3.5, pageWidth - 28, 5.5, "F");
    }

    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(String(b.codigo_bobina || b.codigo || "—"), 16, y);

    const cor = String(b.cor || "Natural").slice(0, 22);
    doc.text(cor, 45, y);

    doc.text(`${b.espessura || "0.43"} mm`, 88, y);
    doc.text(`${b.largura || "1200"} mm`, 112, y);

    const forn = String(b.fornecedor || "CSN / Arcelor").slice(0, 18);
    doc.text(forn, 135, y);

    const peso = `${Math.round(Number(b.peso_liquido || b.peso_atual_kg || 0)).toLocaleString("pt-BR")} kg`;
    doc.text(peso, pageWidth - 16, y, { align: "right" });

    y += 5.5;
  });

  aplicarCabecalhoERodape(doc, "Relatório Gerencial de Estoque de Bobinas & Aço", filial, usuarioNome);
  doc.save(`AJL_Relatorio_Estoque_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}

/**
 * 3. Relatório de Logística e Cargas
 */
export function exportarPdfLogistica({ rotas, filial, usuarioNome }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const totalRotas = rotas.length;
  const concluidas = rotas.filter(r => r.status === "entregue" || r.status === "finalizado").length;
  const pesoTotalKg = rotas.reduce((s, r) => s + Number(r.peso_total_kg || 0), 0);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, 37, pageWidth - 28, 18, 2, 2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text("RESUMO DE EXPEDIÇÃO & LOGÍSTICA:", 18, 43);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);
  doc.text(`• Total de Rotas: ${totalRotas} (${concluidas} entregues)`, 18, 49);
  doc.text(`• Peso Total Transportado: ${Math.round(pesoTotalKg).toLocaleString("pt-BR")} kg`, 95, 49);

  let y = 62;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y - 4, pageWidth - 28, 7, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text("POLO / DESTINO", 16, y);
  doc.text("MOTORISTA", 65, y);
  doc.text("VEÍCULO", 110, y);
  doc.text("DATA ENTREGA", 145, y);
  doc.text("PESO (KG)", pageWidth - 16, y, { align: "right" });

  y += 6;
  doc.setFont("helvetica", "normal");

  rotas.slice(0, 36).forEach((r, idx) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }

    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252);
      doc.rect(14, y - 3.5, pageWidth - 28, 5.5, "F");
    }

    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(String(r.cidade_polo || r.nome || "Rota").slice(0, 30), 16, y);
    doc.text(String(r.motorista || "Não alocado").slice(0, 24), 65, y);
    doc.text(String(r.veiculo || "Caminhão").slice(0, 18), 110, y);
    doc.text(String(r.entrega_date || "—"), 145, y);

    const peso = `${Math.round(Number(r.peso_total_kg || 0)).toLocaleString("pt-BR")} kg`;
    doc.text(peso, pageWidth - 16, y, { align: "right" });

    y += 5.5;
  });

  aplicarCabecalhoERodape(doc, "Relatório Gerencial de Logística & Expedição", filial, usuarioNome);
  doc.save(`AJL_Relatorio_Logistica_${format(new Date(), "yyyyMMdd_HHmm")}.pdf`);
}
