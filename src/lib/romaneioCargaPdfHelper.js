import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { base44 } from "@/api/base44Client";
import { extrairAnexosLista } from "@/lib/croquiExtractor";
import { normalizarImagemBase64 } from "@/lib/imagemBase64";
import { parseItensPedido } from "@/lib/regrasFabrica";

/**
 * Helper de Impressão e Geração de PDF Oficial do Romaneio AJL
 *
 * Estrutura:
 * - PÁGINA 1 (DEITADA / LANDSCAPE): Foto original da folha de rota inserida manualmente.
 * - PÁGINAS SEGUINTES: Folha individual de cada pedido na ordem da rota (#1, #2, #3...)
 *   com o PDF oficial importado do Odoo/Central PCP, croquis/desenhos e tabela de medidas.
 * (A folha resumo duplicada foi removida a pedido do usuário).
 */

function formatarMoeda(val) {
  if (!val) return "R$ 0,00";
  if (typeof val === "string" && val.includes("R$")) return val;
  const num = Number(String(val).replace(/[^0-9,-]+/g, "").replace(",", "."));
  if (isNaN(num)) return String(val);
  return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatarMedida(val) {
  if (val === undefined || val === null || val === "") return "—";
  const num = Number(String(val).replace(",", "."));
  if (isNaN(num)) return String(val);
  if (num > 100) {
    return `${num.toLocaleString("pt-BR")} mm (${(num / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 3 })}m)`;
  }
  return `${num.toLocaleString("pt-BR")} m`;
}

/**
 * Extrai anexos gráficos (croquis, desenhos técnicos)
 */
function obterDocumentosPedido(it, info = {}, pedidoOdoo = null) {
  const anexos = [];
  const pOdoo = pedidoOdoo || info?.pedidoOdoo;

  if (pOdoo) {
    const daLista = extrairAnexosLista(pOdoo);
    daLista.forEach((a) => {
      const srcNorm = normalizarImagemBase64(a.src);
      if (srcNorm && !anexos.some((x) => x.src === srcNorm)) {
        anexos.push({ src: srcNorm, label: a.label || "Croqui / Desenho Técnico" });
      }
    });
  }

  // Anexos diretos de info
  if (Array.isArray(info?.anexos)) {
    info.anexos.forEach((url, i) => {
      const srcNorm = normalizarImagemBase64(url);
      if (srcNorm && !anexos.some((x) => x.src === srcNorm)) {
        anexos.push({ src: srcNorm, label: `Desenho ${i + 1}` });
      }
    });
  }

  // Foto do pedido direta
  if (info?.foto_pedido_url) {
    const srcNorm = normalizarImagemBase64(info.foto_pedido_url);
    if (srcNorm && !anexos.some((x) => x.src === srcNorm)) {
      anexos.push({ src: srcNorm, label: "Foto / Croqui do Pedido" });
    }
  }

  if (it?.foto_url) {
    const srcNorm = normalizarImagemBase64(it.foto_url);
    if (srcNorm && !anexos.some((x) => x.src === srcNorm)) {
      anexos.push({ src: srcNorm, label: "Foto da Ordem" });
    }
  }

  return anexos;
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
 * Abre a janela de visualização e impressão direta em alta definição
 */
export async function imprimirRomaneioHtml(rota, options = {}) {
  let itens = [];
  try {
    itens = typeof rota.itens_json === "string" ? JSON.parse(rota.itens_json || "[]") : rota.itens_json || [];
  } catch {
    itens = [];
  }

  const infoMap = options.infoPedidosMap || {};
  const filial = rota.unidade || options.filialAtiva || "Matriz AJL";
  const dataHoje = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const temFotoRota = Boolean(rota.rota_imagem_url);

  // Busca dados completos de PedidoOdoo para todos os pedidos da rota que ainda não estão em cache
  const pedidosOdooMap = {};
  await Promise.all(
    itens.map(async (it) => {
      const emInfo = infoMap[it.numero_pedido]?.pedidoOdoo;
      if (emInfo) {
        pedidosOdooMap[it.numero_pedido] = emInfo;
      } else {
        const achado = await buscarPedidoOdooBanco(it.numero_pedido);
        if (achado) pedidosOdooMap[it.numero_pedido] = achado;
      }
    })
  );

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Romaneio — ${rota.titulo || "Rota de Entrega"}</title>
      <style>
        /* Regra padrão: A4 Portrait */
        @page {
          size: A4 portrait;
          margin: 8mm 8mm 10mm 8mm;
        }

        /* Página 1 específica: A4 LANDSCAPE (DEITADA) */
        @page rota-landscape {
          size: A4 landscape;
          margin: 6mm;
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

        /* Página 1: Foto Original Deitada (Landscape) */
        .page-sheet-landscape {
          page: rota-landscape;
          width: 100%;
          min-height: 195mm;
          height: 100vh;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .page-foto-header {
          width: 100%;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 4px;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .foto-container-deitada {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 4px;
        }
        .foto-container-deitada img {
          max-width: 100%;
          max-height: 180mm;
          width: auto;
          height: auto;
          object-fit: contain;
          border-radius: 4px;
        }
        .page-foto-footer {
          width: 100%;
          margin-top: 4px;
          font-size: 9px;
          color: #64748b;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #e2e8f0;
          padding-top: 3px;
        }

        /* Páginas dos Pedidos (Retrato) */
        .page-sheet-portrait {
          position: relative;
          width: 100%;
          min-height: 275mm;
          page-break-after: always;
          display: flex;
          flex-direction: column;
          padding: 2mm 0;
        }
        .page-sheet-portrait:last-child {
          page-break-after: avoid;
        }

        .pedido-header {
          background: #0f172a;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .pedido-header-title {
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 0.3px;
        }
        .pedido-header-badge {
          background: #2dd4bf;
          color: #0f172a;
          font-weight: 800;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .pedido-info-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 6px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px 10px;
          margin-bottom: 8px;
          font-size: 10px;
        }
        .pedido-info-grid div {
          margin-bottom: 2px;
        }
        .pedido-info-grid strong {
          color: #0f172a;
        }

        /* Bloco do PDF do Odoo / Central PCP */
        .pdf-container-box {
          width: 100%;
          margin-bottom: 8px;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
          background: #fff;
        }
        .pdf-container-header {
          background: #f1f5f9;
          padding: 5px 8px;
          font-size: 9.5px;
          font-weight: 800;
          color: #334155;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid #e2e8f0;
        }
        .pdf-frame-view {
          width: 100%;
          height: 180mm;
          border: none;
          display: block;
        }

        /* Seção de Croquis / Desenhos Técnicos */
        .croqui-section {
          background: #fff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px;
          margin-bottom: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .croqui-title {
          width: 100%;
          font-size: 9px;
          font-weight: 800;
          color: #475569;
          text-transform: uppercase;
          margin-bottom: 4px;
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid #f1f5f9;
          padding-bottom: 2px;
        }
        .croqui-image-box {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #fafafa;
          border-radius: 4px;
          padding: 4px;
        }
        .croqui-image-box img {
          max-width: 100%;
          max-height: 120mm;
          object-fit: contain;
          border-radius: 3px;
        }

        /* Tabela de Medidas e Itens Produzidos */
        .table-itens {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
          font-size: 9.5px;
        }
        .table-itens th {
          background: #334155;
          color: #fff;
          padding: 4px 6px;
          text-align: left;
          font-size: 8.5px;
          font-weight: 700;
        }
        .table-itens td {
          padding: 4px 6px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .table-itens tr:nth-child(even) {
          background: #f8fafc;
        }

        .canhoto-entrega-pedido {
          margin-top: auto;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 10px;
          font-size: 9px;
        }
        .canhoto-title {
          font-weight: 800;
          color: #1e293b;
          margin-bottom: 4px;
          text-transform: uppercase;
          font-size: 8.5px;
        }
        .canhoto-campos {
          display: grid;
          grid-template-columns: 2fr 1fr 1fr;
          gap: 10px;
          margin-top: 8px;
          border-top: 1px dashed #94a3b8;
          padding-top: 4px;
        }

        .no-print {
          display: none;
        }
        @media screen {
          body {
            padding: 20px;
            background: #e2e8f0;
          }
          .page-sheet-landscape {
            background: #fff;
            max-width: 297mm;
            min-height: 210mm;
            margin: 0 auto 20px auto;
            padding: 8mm;
            box-shadow: 0 4px 15px rgba(0,0,0,0.12);
            border-radius: 4px;
          }
          .page-sheet-portrait {
            background: #fff;
            max-width: 210mm;
            margin: 0 auto 20px auto;
            padding: 10mm;
            box-shadow: 0 4px 15px rgba(0,0,0,0.12);
            border-radius: 4px;
          }
          .action-bar {
            max-width: 297mm;
            margin: 0 auto 12px auto;
            display: flex;
            justify-content: space-between;
            align-items: center;
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
        <span style="font-size: 12px; color: #475569; font-weight: 600;">
          Dica: No diálogo de impressão, escolha "Salvar como PDF" ou a impressora da expedição.
        </span>
      </div>

      <!-- PÁGINA 1: FOTO ORIGINAL DA ROTA — DEITADA (LANDSCAPE) -->
      ${temFotoRota ? `
        <div class="page-sheet-landscape">
          <div class="page-foto-header">
            <div>
              <div style="font-size: 16px; font-weight: 800; color: #0f172a;">AJL FERRO & AÇO — EXPEDIÇÃO & LOGÍSTICA</div>
              <div style="font-size: 11px; font-weight: 700; color: #0d9488;">FOLHA ORIGINAL DA ROTA / CARGA PROGRAMADA</div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #475569;">
              <div>Rota: <strong>${rota.titulo || "Rota de Entrega"}</strong></div>
              <div>Motorista: <strong>${rota.motorista_nome || "—"}</strong> (${rota.placa || "S/ Placa"}) · Data: <strong>${rota.entrega_date || "—"}</strong></div>
            </div>
          </div>

          <div class="foto-container-deitada">
            <img src="${rota.rota_imagem_url}" alt="Folha Original da Rota (Deitada)" />
          </div>

          <div class="page-foto-footer">
            <span>Página 1 — Manifesto Fotográfico da Rota (A4 Deitada)</span>
            <span>Emissão: ${dataHoje} · Filial: ${filial}</span>
          </div>
        </div>
      ` : ""}

      <!-- PÁGINAS SEGUINTES: FOLHAS DOS PEDIDOS COM PDF/CROQUIS DA CENTRAL PCP -->
      ${itens.map((it, idx) => {
        const info = infoMap[it.numero_pedido] || {};
        const pOdoo = pedidosOdooMap[it.numero_pedido] || info.pedidoOdoo;
        const documentos = obterDocumentosPedido(it, info, pOdoo);
        const pdfOdooUrl = pOdoo?.pdf_pedido_url || pOdoo?.pdf_url || info.pdf_pedido_url || null;
        const itensPcp = pOdoo?.itens_json ? parseItensPedido(pOdoo.itens_json) : (Array.isArray(it.itens) ? it.itens : []);
        const paradaNum = it.ordem || idx + 1;
        const bLabel = it.barracao_sugerido === "telhas" ? "🏠 Telhas" : it.barracao_sugerido === "corte_dobra" ? "🏗️ Corte & Dobra" : it.barracao_sugerido === "ambos" ? "📦 Ambos" : "⏳ Expedição";

        return `
          <div class="page-sheet-portrait">
            <!-- Cabeçalho Oficial do Pedido -->
            <div class="pedido-header">
              <div>
                <div class="pedido-header-title">
                  PEDIDO (ODOO) #${it.numero_pedido}
                </div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 1px;">
                  Rota: <strong>${rota.titulo || "Rota de Entrega"}</strong> · Motorista: <strong>${rota.motorista_nome || "—"}</strong>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="pedido-header-badge">PARADA #${paradaNum} DE ${itens.length}</span>
              </div>
            </div>

            <!-- Dados do Cliente, Entrega e Observação -->
            <div class="pedido-info-grid">
              <div>
                <div>Cliente: <strong>${it.cliente || pOdoo?.cliente_nome || "—"}</strong></div>
                <div>Destino / Bairro / Cidade: <strong>${it.bairro || "—"}</strong></div>
                ${it.observacao ? `<div>Obs. Rota: <strong style="color: #b45309; background: #fef3c7; padding: 1px 4px; border-radius: 2px;">📌 ${it.observacao}</strong></div>` : ""}
              </div>
              <div>
                <div>Barracão: <strong>${bLabel}</strong></div>
                <div>Vendedor: <strong>${it.vendedor || pOdoo?.vendedor_nome || "—"}</strong></div>
                <div>Valor: <strong>${it.valor || "—"}</strong> ${it.pagamento ? `(${it.pagamento})` : ""}</div>
              </div>
            </div>

            <!-- PDF Oficial do Pedido vindo do Odoo / Central PCP (se houver) -->
            ${pdfOdooUrl ? `
              <div class="pdf-container-box">
                <div class="pdf-container-header">
                  <span>📄 Documento PDF Oficial do Pedido (Odoo ERP / Central PCP)</span>
                  <a href="${pdfOdooUrl}" target="_blank" rel="noopener noreferrer" style="color: #0284c7; text-decoration: none; font-weight: 700;">
                    Abrir em Tela Cheia ↗
                  </a>
                </div>
                <iframe src="${pdfOdooUrl}#toolbar=0" class="pdf-frame-view" title="PDF Pedido #${it.numero_pedido}"></iframe>
              </div>
            ` : ""}

            <!-- Croquis e Desenhos Técnicos do PCP -->
            ${documentos.length > 0 ? `
              <div class="croqui-section">
                <div class="croqui-title">
                  <span>📐 Desenho Técnico / Croqui (Central PCP)</span>
                  <span>${documentos.length} anexo(s)</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                  ${documentos.map((doc, dIdx) => `
                    <div class="croqui-image-box">
                      <img src="${doc.src}" alt="${doc.label || `Desenho ${dIdx + 1}`}" />
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : (!pdfOdooUrl ? `
              <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px; padding: 10px; margin-bottom: 8px; text-align: center; color: #64748b; font-size: 9.5px;">
                📋 Pedido sem PDF ou croqui anexado na Central PCP — Seguir especificações da tabela de medidas abaixo.
              </div>
            ` : "")}

            <!-- Tabela de Itens e Medidas Produzidos -->
            <div style="margin-bottom: 6px;">
              <div style="font-size: 9px; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 3px;">
                📦 Itens, Medidas e Acabamentos Produzidos
              </div>
              ${itensPcp.length > 0 ? `
                <table class="table-itens">
                  <thead>
                    <tr>
                      <th style="width: 25px; text-align: center;">#</th>
                      <th>Produto / Perfil</th>
                      <th style="width: 60px; text-align: center;">Qtd</th>
                      <th style="width: 110px;">Medida / Comp.</th>
                      <th style="width: 80px;">Espessura</th>
                      <th style="width: 80px;">Cor / Acab.</th>
                      <th>Obs. do Item</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${itensPcp.map((pItem, pIdx) => `
                      <tr>
                        <td style="text-align: center; font-weight: 700; color: #64748b;">${pIdx + 1}</td>
                        <td><strong>${pItem.produto || pItem.descricao || pItem.name || "Item sem descrição"}</strong></td>
                        <td style="text-align: center; font-weight: 700;">${pItem.quantidade || pItem.qtd || 1}</td>
                        <td><strong>${formatarMedida(pItem.comprimento || pItem.medida || pItem.comprimento_mm || pItem.tamanho)}</strong></td>
                        <td>${pItem.espessura ? `${pItem.espessura}mm` : "—"}</td>
                        <td>${pItem.cor || pItem.pintura || "Natural"}</td>
                        <td style="font-size: 8.5px; color: #64748b;">${pItem.observacao || pItem.obs || "—"}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              ` : `
                <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 6px 10px; font-size: 9px; color: #475569;">
                  Item da carga: <strong>${it.cliente}</strong> · Observações: <em>${it.observacao || "Conferir detalhes no Odoo ERP"}</em>
                </div>
              `}
            </div>

            <!-- Canhoto de Entrega no Rodapé do Pedido -->
            <div class="canhoto-entrega-pedido">
              <div class="canhoto-title">Comprovante de Recebimento do Cliente</div>
              <div style="font-size: 8.5px; color: #475569;">
                Declaro ter conferido e recebido os produtos e medidas listados acima em perfeito estado.
              </div>
              <div class="canhoto-campos">
                <div>Assinatura do Recebedor: ______________________________</div>
                <div>Data: ___/___/______</div>
                <div>RG / CPF: _________________</div>
              </div>
            </div>
          </div>
        `;
      }).join("")}

      <script>
        window.onload = function() {
          var imgs = Array.from(document.images);
          var promises = imgs.map(function(img) {
            if (img.complete) return Promise.resolve();
            return new Promise(function(resolve) {
              img.onload = resolve;
              img.onerror = resolve;
            });
          });

          Promise.all(promises).then(function() {
            setTimeout(function() {
              window.print();
            }, 400);
          });
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
    baixarRomaneioPdf(rota, options);
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
