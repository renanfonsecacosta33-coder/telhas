import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Helper de Impressão e Geração de PDF Oficial do Romaneio/Manifesto de Carga AJL
 */

function formatarMoeda(val) {
  if (!val) return "R$ 0,00";
  if (typeof val === "string" && val.includes("R$")) return val;
  const num = Number(String(val).replace(/[^0-9,-]+/g, "").replace(",", "."));
  if (isNaN(num)) return String(val);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Gera e baixa o arquivo PDF nativo do Romaneio via jsPDF
 */
export function baixarRomaneioPdf(rota, options = {}) {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margem = 12;
  const areaWidth = pageWidth - margem * 2;

  let itens = [];
  try {
    itens = typeof rota.itens_json === "string" ? JSON.parse(rota.itens_json || "[]") : rota.itens_json || [];
  } catch {
    itens = [];
  }

  const dataHoje = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });
  const filial = rota.unidade || options.filialAtiva || "Matriz AJL";

  // Barra de topo corporativa AJL
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 5, "F");

  // Cabeçalho
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text("AJL FERRO & AÇO — LOGÍSTICA E EXPEDIÇÃO", margem, 14);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(13, 148, 136); // teal-600
  doc.text("MANIFESTO & ROMANEIO DE CARGA / ROTA DE ENTREGA", margem, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Emissão: ${dataHoje} | Unidade: ${filial}`, pageWidth - margem, 14, { align: "right" });
  doc.text(`ID Rota: #${String(rota.id || "").slice(-8)}`, pageWidth - margem, 19, { align: "right" });

  // Linha divisória
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(margem, 23, pageWidth - margem, 23);

  // Box de Dados do Veículo e Rota
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margem, 25, areaWidth, 26, 2, 2, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margem, 25, areaWidth, 26, 2, 2, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(rota.titulo || "Rota de Entrega", margem + 4, 31);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(51, 65, 85);

  const col1 = margem + 4;
  const col2 = margem + 55;
  const col3 = margem + 115;

  doc.text(`Motorista: `, col1, 37);
  doc.setFont("helvetica", "bold");
  doc.text(`${rota.motorista_nome || "—"}`, col1 + 16, 37);
  doc.setFont("helvetica", "normal");

  doc.text(`Placa Veículo: `, col1, 43);
  doc.setFont("helvetica", "bold");
  doc.text(`${rota.placa || "—"}`, col1 + 20, 43);
  doc.setFont("helvetica", "normal");

  doc.text(`Data Embarque: `, col2, 37);
  doc.setFont("helvetica", "bold");
  doc.text(`${rota.embarque_date || "—"}`, col2 + 23, 37);
  doc.setFont("helvetica", "normal");

  doc.text(`Data Entrega: `, col2, 43);
  doc.setFont("helvetica", "bold");
  doc.text(`${rota.entrega_date || "—"}`, col2 + 21, 43);
  doc.setFont("helvetica", "normal");

  doc.text(`Total de Pedidos: `, col3, 37);
  doc.setFont("helvetica", "bold");
  doc.text(`${itens.length} pedidos`, col3 + 25, 37);
  doc.setFont("helvetica", "normal");

  doc.text(`Valor Total Carga: `, col3, 43);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(16, 149, 93);
  doc.text(`${formatarMoeda(rota.total_valor)}`, col3 + 26, 43);
  doc.setTextColor(51, 65, 85);
  doc.setFont("helvetica", "normal");

  // Barra de título da Tabela
  let y = 56;
  doc.setFillColor(15, 23, 42);
  doc.rect(margem, y, areaWidth, 6.5, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  doc.text("#", margem + 2, y + 4.5);
  doc.text("PEDIDO", margem + 8, y + 4.5);
  doc.text("Nº ODOO", margem + 23, y + 4.5);
  doc.text("CLIENTE / DESTINATÁRIO", margem + 42, y + 4.5);
  doc.text("BARRACÃO", margem + 105, y + 4.5);
  doc.text("OBSERVAÇÃO / INSTRUÇÃO", margem + 128, y + 4.5);
  doc.text("VALOR", margem + 164, y + 4.5);
  doc.text("CONF.", margem + 178, y + 4.5);

  y += 6.5;

  // Itens da Rota
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);

  itens.forEach((it, idx) => {
    // Quebra de página se necessário
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 15;
      // Reaplica cabeçalho de tabela na nova página
      doc.setFillColor(15, 23, 42);
      doc.rect(margem, y, areaWidth, 6.5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text("#", margem + 2, y + 4.5);
      doc.text("PEDIDO", margem + 8, y + 4.5);
      doc.text("Nº ODOO", margem + 23, y + 4.5);
      doc.text("CLIENTE / DESTINATÁRIO", margem + 42, y + 4.5);
      doc.text("BARRACÃO", margem + 105, y + 4.5);
      doc.text("OBSERVAÇÃO / INSTRUÇÃO", margem + 128, y + 4.5);
      doc.text("VALOR", margem + 164, y + 4.5);
      doc.text("CONF.", margem + 178, y + 4.5);
      y += 6.5;
    }

    const linhaBg = idx % 2 === 0 ? 255 : 248;
    doc.setFillColor(linhaBg, linhaBg, linhaBg);
    doc.rect(margem, y, areaWidth, 8.5, "F");

    doc.setDrawColor(226, 232, 240);
    doc.line(margem, y + 8.5, margem + areaWidth, y + 8.5);

    doc.setTextColor(51, 65, 85);
    doc.setFont("helvetica", "bold");
    doc.text(String(it.ordem || idx + 1), margem + 2, y + 5.5);
    doc.text(`#${it.numero_pedido}`, margem + 8, y + 5.5);

    doc.setFont("helvetica", "normal");
    doc.text(it.numero_odoo ? (it.numero_odoo.toUpperCase() === "NT" ? "NT" : `#${it.numero_odoo}`) : "—", margem + 23, y + 5.5);

    // Cliente e Cidade/Bairro
    const clienteTxt = (it.cliente || "—").slice(0, 32);
    const subCliente = [it.bairro, it.vendedor && `Vend: ${it.vendedor}`].filter(Boolean).join(" · ").slice(0, 36);
    doc.setFont("helvetica", "bold");
    doc.text(clienteTxt, margem + 42, y + 3.8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(subCliente, margem + 42, y + 7.2);
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);

    // Barracão
    const bNome = it.barracao_sugerido === "telhas" ? "Telhas" : it.barracao_sugerido === "corte_dobra" ? "Corte & Dobra" : it.barracao_sugerido === "ambos" ? "Ambos" : "Aguardando";
    doc.text(bNome, margem + 105, y + 5.5);

    // Obs
    const obsTxt = (it.observacao || "—").slice(0, 22);
    doc.text(obsTxt, margem + 128, y + 5.5);

    // Valor
    doc.text(it.valor || "—", margem + 164, y + 5.5);

    // Checkbox visto conferência
    doc.setDrawColor(148, 163, 184);
    doc.rect(margem + 179, y + 2, 4.5, 4.5, "S");

    y += 8.5;
  });

  // Nota geral ou Instruções da carga
  if (rota.nota_geral || rota.observacao) {
    if (y > pageHeight - 32) {
      doc.addPage();
      y = 15;
    } else {
      y += 3;
    }
    doc.setFillColor(254, 243, 199); // amber-100
    doc.roundedRect(margem, y, areaWidth, 10, 1, 1, "F");
    doc.setDrawColor(251, 191, 36);
    doc.roundedRect(margem, y, areaWidth, 10, 1, 1, "S");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(146, 64, 14);
    const notaTexto = `INSTRUÇÕES GERAIS / OBSERVAÇÕES: ${[rota.nota_geral, rota.observacao].filter(Boolean).join(" | ")}`;
    doc.text(doc.splitTextToSize(notaTexto, areaWidth - 6), margem + 3, y + 4.5);
    y += 12;
  }

  // Bloco de Assinaturas e Canhoto no final da folha
  const espacoAssinaturaY = Math.max(y + 8, pageHeight - 26);
  if (espacoAssinaturaY > pageHeight - 15) {
    doc.addPage();
  }

  const assinaY = pageHeight - 22;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);

  // Linha 1: Conferente
  doc.line(margem + 10, assinaY, margem + 75, assinaY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("CONFERENTE / EXPEDIÇÃO (VISTO E CARREGAMENTO)", margem + 12, assinaY + 4);

  // Linha 2: Motorista
  doc.line(margem + 105, assinaY, margem + 170, assinaY);
  doc.text(`MOTORISTA: ${rota.motorista_nome || "Assinatura do Condutor"}`, margem + 107, assinaY + 4);

  // Salva o PDF
  const nomeLimpo = (rota.titulo || "Rota_Entrega").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Romaneio_${nomeLimpo}.pdf`);
}

/**
 * Abre a janela de visualização e impressão direta em alta definição (estilo A4 da folha oficial)
 */
export function imprimirRomaneioHtml(rota, options = {}) {
  let itens = [];
  try {
    itens = typeof rota.itens_json === "string" ? JSON.parse(rota.itens_json || "[]") : rota.itens_json || [];
  } catch {
    itens = [];
  }

  const filial = rota.unidade || options.filialAtiva || "Matriz AJL";
  const dataHoje = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const totalFormatado = formatarMoeda(rota.total_valor);

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Romaneio de Carga — ${rota.titulo || "Rota de Entrega"}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 10mm 12mm 10mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          color: #0f172a;
          background: #fff;
          font-size: 11px;
          line-height: 1.3;
        }
        .header-bar {
          background-color: #0f172a;
          color: white;
          padding: 10px 14px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .header-title {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .header-sub {
          font-size: 11px;
          color: #2dd4bf;
          font-weight: 700;
          margin-top: 2px;
        }
        .header-meta {
          text-align: right;
          font-size: 10px;
          color: #94a3b8;
        }
        .header-meta strong {
          color: #fff;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          margin-bottom: 14px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 10px;
        }
        .kpi-card .label {
          font-size: 9px;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 3px;
        }
        .kpi-card .val {
          font-size: 13px;
          font-weight: 800;
          color: #0f172a;
        }
        .kpi-card .val.green {
          color: #059669;
        }
        .table-manifesto {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 14px;
          font-size: 10px;
        }
        .table-manifesto th {
          background: #1e293b;
          color: #fff;
          font-weight: 700;
          text-align: left;
          padding: 6px 8px;
          font-size: 9px;
          letter-spacing: 0.3px;
        }
        .table-manifesto td {
          padding: 6px 8px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .table-manifesto tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .badge-barracao {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
        }
        .badge-telhas { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
        .badge-cd { background: #ffedd5; color: #9a3412; border: 1px solid #fed7aa; }
        .badge-ambos { background: #f3e8ff; color: #6b21a8; border: 1px solid #e9d5ff; }
        .badge-aguardando { background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1; }
        .badge-odoo {
          font-family: monospace;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          padding: 1px 4px;
          border-radius: 3px;
          font-weight: 700;
        }
        .obs-box {
          background: #fef3c7;
          border: 1px solid #fde68a;
          color: #92400e;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 9px;
          font-weight: 700;
          display: inline-block;
        }
        .box-check {
          width: 14px;
          height: 14px;
          border: 1.5px solid #64748b;
          border-radius: 2px;
          margin: 0 auto;
        }
        .obs-geral {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          border-left: 4px solid #f59e0b;
          padding: 8px 12px;
          border-radius: 4px;
          margin-bottom: 16px;
          font-size: 10px;
          color: #92400e;
        }
        .assinaturas-container {
          margin-top: 24px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          padding-top: 10px;
        }
        .assinatura-box {
          text-align: center;
        }
        .assinatura-linha {
          border-top: 1px solid #475569;
          margin-bottom: 6px;
        }
        .assinatura-cargo {
          font-size: 9px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
        }
        .no-print {
          display: none;
        }
        @media screen {
          body {
            padding: 20px;
            background: #e2e8f0;
          }
          .page-sheet {
            background: #fff;
            max-width: 210mm;
            margin: 0 auto;
            padding: 15mm;
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
            border-radius: 4px;
          }
          .action-bar {
            max-width: 210mm;
            margin: 0 auto 12px auto;
            display: flex;
            gap: 10px;
          }
          .btn-print {
            background: #0f172a;
            color: #fff;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            font-weight: 700;
            cursor: pointer;
            font-size: 13px;
          }
        }
      </style>
    </head>
    <body>
      <div class="action-bar no-print">
        <button class="btn-print" onclick="window.print()">🖨️ Imprimir / Salvar PDF</button>
      </div>

      <div class="page-sheet">
        <div class="header-bar">
          <div>
            <div class="header-title">AJL FERRO & AÇO</div>
            <div class="header-sub">MANIFESTO & ROMANEIO DE CARGA — EXPEDIÇÃO</div>
          </div>
          <div class="header-meta">
            <div>Unidade: <strong>${filial}</strong></div>
            <div>Emissão: <strong>${dataHoje}</strong></div>
            <div>Status: <strong>DISTRIBUÍDO</strong></div>
          </div>
        </div>

        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="label">Manifesto / Rota</div>
            <div class="val" style="font-size: 11px;">${rota.titulo || "Rota de Entrega"}</div>
          </div>
          <div class="kpi-card">
            <div class="label">Motorista & Veículo</div>
            <div class="val" style="font-size: 11px;">${rota.motorista_nome || "—"} (${rota.placa || "S/ Placa"})</div>
          </div>
          <div class="kpi-card">
            <div class="label">Datas (Embarque / Entrega)</div>
            <div class="val" style="font-size: 11px;">${rota.embarque_date || "—"} ➔ ${rota.entrega_date || "—"}</div>
          </div>
          <div class="kpi-card">
            <div class="label">Total da Carga</div>
            <div class="val green">${totalFormatado} (${itens.length} pedidos)</div>
          </div>
        </div>

        ${(rota.nota_geral || rota.observacao) ? `
          <div class="obs-geral">
            <strong>Instruções de Carga & Observações:</strong>
            ${[rota.nota_geral, rota.observacao].filter(Boolean).join(" | ")}
          </div>
        ` : ""}

        <table class="table-manifesto">
          <thead>
            <tr>
              <th style="width: 25px; text-align: center;">#</th>
              <th style="width: 65px;">Pedido</th>
              <th style="width: 75px;">Nº Odoo</th>
              <th>Cliente / Destinatário</th>
              <th style="width: 95px;">Barracão</th>
              <th>Observação da Folha</th>
              <th style="width: 85px; text-align: right;">Valor</th>
              <th style="width: 45px; text-align: center;">Visto</th>
            </tr>
          </thead>
          <tbody>
            ${itens.map((it, idx) => {
              const bCls = it.barracao_sugerido === "telhas" ? "badge-telhas" : it.barracao_sugerido === "corte_dobra" ? "badge-cd" : it.barracao_sugerido === "ambos" ? "badge-ambos" : "badge-aguardando";
              const bLabel = it.barracao_sugerido === "telhas" ? "🏠 Telhas" : it.barracao_sugerido === "corte_dobra" ? "🏗️ C&D" : it.barracao_sugerido === "ambos" ? "📦 Ambos" : "⏳ Aguardando";
              return `
                <tr>
                  <td style="text-align: center; font-weight: 700; color: #64748b;">${it.ordem || idx + 1}</td>
                  <td><strong>#${it.numero_pedido}</strong></td>
                  <td>${it.numero_odoo ? `<span class="badge-odoo">#${it.numero_odoo}</span>` : "—"}</td>
                  <td>
                    <strong>${it.cliente || "—"}</strong>
                    ${(it.bairro || it.vendedor) ? `<div style="font-size: 8.5px; color: #64748b;">${[it.bairro, it.vendedor && `Vend: ${it.vendedor}`].filter(Boolean).join(" · ")}</div>` : ""}
                  </td>
                  <td><span class="badge-barracao ${bCls}">${bLabel}</span></td>
                  <td>${it.observacao ? `<span class="obs-box">📌 ${it.observacao}</span>` : "—"}</td>
                  <td style="text-align: right; font-weight: 700;">${it.valor || "—"}</td>
                  <td><div class="box-check"></div></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>

        <div class="assinaturas-container">
          <div class="assinatura-box">
            <div class="assinatura-linha"></div>
            <div class="assinatura-cargo">Conferente / Responsável pelo Carregamento</div>
            <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Assinatura e Visto de Liberação</div>
          </div>
          <div class="assinatura-box">
            <div class="assinatura-linha"></div>
            <div class="assinatura-cargo">Motorista: ${rota.motorista_nome || "Assinatura do Condutor"}</div>
            <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Declaro ter conferido e recebido a carga descrita</div>
          </div>
        </div>
      </div>

      <script>
        window.onload = function() {
          // Permite impressão automática se solicitado
          setTimeout(function() {
            window.print();
          }, 350);
        };
      </script>
    </body>
    </html>
  `;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  } else {
    // Se pop-up for bloqueado, baixa diretamente em PDF nativo
    baixarRomaneioPdf(rota, options);
  }
}
