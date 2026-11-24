import jsPDF from "jspdf";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { extrairAnexosLista } from "@/lib/croquiExtractor";
import { normalizarImagemBase64 } from "@/lib/imagemBase64";
import { parseItensPedido } from "@/lib/regrasFabrica";

/**
 * Helper de Impressão e Geração de PDF Oficial do Romaneio/Manifesto de Carga AJL
 * 
 * Estrutura das Páginas:
 * - PÁGINA 1: Foto original da folha de rota inserida manualmente
 * - PÁGINA 2: Manifesto Geral de Carga (resumo da rota, tabela de pedidos e canhotos)
 * - PÁGINAS SEGUINTES: Folha individual de cada pedido na ordem da rota (#1, #2, #3...)
 *   com cabeçalho, croqui/desenho técnico do PCP, tabela de medidas e canhoto de entrega.
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
 * Extrai anexos, croquis e desenhos do pedido cruzado com a Central PCP
 */
function obterDocumentosPedido(it, info = {}) {
  const anexos = [];
  const pedidoOdoo = info?.pedidoOdoo;

  if (pedidoOdoo) {
    const daLista = extrairAnexosLista(pedidoOdoo);
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

  // Se o item da rota tiver foto específica
  if (it?.foto_url) {
    const srcNorm = normalizarImagemBase64(it.foto_url);
    if (srcNorm && !anexos.some((x) => x.src === srcNorm)) {
      anexos.push({ src: srcNorm, label: "Foto da Ordem" });
    }
  }

  return anexos;
}

/**
 * Extrai os itens e medidas produzidas no PCP para aquele pedido
 */
function obterItensMedidasPedido(it, info = {}) {
  const pedidoOdoo = info?.pedidoOdoo;
  if (pedidoOdoo?.itens_json) {
    const itens = parseItensPedido(pedidoOdoo.itens_json);
    if (itens.length > 0) return itens;
  }
  if (Array.isArray(it.itens) && it.itens.length > 0) {
    return it.itens;
  }
  return [];
}

/**
 * Abre a janela de visualização e impressão direta em alta definição
 */
export function imprimirRomaneioHtml(rota, options = {}) {
  let itens = [];
  try {
    itens = typeof rota.itens_json === "string" ? JSON.parse(rota.itens_json || "[]") : rota.itens_json || [];
  } catch {
    itens = [];
  }

  const infoMap = options.infoPedidosMap || {};
  const filial = rota.unidade || options.filialAtiva || "Matriz AJL";
  const dataHoje = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  const totalFormatado = formatarMoeda(rota.total_valor);
  const temFotoRota = Boolean(rota.rota_imagem_url);

  const html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Romaneio de Carga — ${rota.titulo || "Rota de Entrega"}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 8mm 10mm 8mm;
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
        .page-sheet {
          position: relative;
          width: 100%;
          min-height: 275mm;
          page-break-after: always;
          display: flex;
          flex-direction: column;
        }
        .page-sheet:last-child {
          page-break-after: avoid;
        }

        /* Página 1: Foto Original da Rota */
        .page-foto-rota {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          height: 275mm;
          padding: 4mm;
        }
        .page-foto-header {
          width: 100%;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 6px;
          margin-bottom: 8px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        .foto-container {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px;
        }
        .foto-container img {
          max-width: 100%;
          max-height: 240mm;
          object-fit: contain;
          border-radius: 4px;
        }
        .page-foto-footer {
          width: 100%;
          margin-top: 6px;
          font-size: 9px;
          color: #64748b;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid #e2e8f0;
          padding-top: 4px;
        }

        /* Header Geral */
        .header-bar {
          background-color: #0f172a;
          color: white;
          padding: 8px 12px;
          border-radius: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }
        .header-title {
          font-size: 15px;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .header-sub {
          font-size: 10px;
          color: #2dd4bf;
          font-weight: 700;
          margin-top: 1px;
        }
        .header-meta {
          text-align: right;
          font-size: 9.5px;
          color: #94a3b8;
        }
        .header-meta strong {
          color: #fff;
        }

        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 6px;
          margin-bottom: 10px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
          padding: 6px 8px;
        }
        .kpi-card .label {
          font-size: 8.5px;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
          margin-bottom: 2px;
        }
        .kpi-card .val {
          font-size: 12px;
          font-weight: 800;
          color: #0f172a;
        }
        .kpi-card .val.green {
          color: #059669;
        }

        .table-manifesto {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 10px;
          font-size: 9.5px;
        }
        .table-manifesto th {
          background: #1e293b;
          color: #fff;
          font-weight: 700;
          text-align: left;
          padding: 5px 6px;
          font-size: 8.5px;
          letter-spacing: 0.3px;
        }
        .table-manifesto td {
          padding: 5px 6px;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        .table-manifesto tr:nth-child(even) {
          background-color: #f8fafc;
        }
        .badge-barracao {
          display: inline-block;
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 8.5px;
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
          padding: 1px 3px;
          border-radius: 3px;
          font-weight: 700;
        }
        .obs-box {
          background: #fef3c7;
          border: 1px solid #fde68a;
          color: #92400e;
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 8.5px;
          font-weight: 700;
          display: inline-block;
        }
        .box-check {
          width: 12px;
          height: 12px;
          border: 1.5px solid #64748b;
          border-radius: 2px;
          margin: 0 auto;
        }
        .obs-geral {
          background: #fffbeb;
          border: 1px solid #fef3c7;
          border-left: 3px solid #f59e0b;
          padding: 6px 10px;
          border-radius: 4px;
          margin-bottom: 12px;
          font-size: 9.5px;
          color: #92400e;
        }
        .assinaturas-container {
          margin-top: auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
          padding-top: 15px;
          border-top: 1px solid #cbd5e1;
        }
        .assinatura-box {
          text-align: center;
        }
        .assinatura-linha {
          border-top: 1px solid #475569;
          margin-bottom: 4px;
        }
        .assinatura-cargo {
          font-size: 8.5px;
          font-weight: 700;
          color: #334155;
          text-transform: uppercase;
        }

        /* Folha Individual do Pedido (Páginas dos Pedidos) */
        .pedido-sheet {
          padding: 2mm 0;
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

        /* Seção do Croqui / Desenho Técnico */
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
          max-height: 110mm;
          object-fit: contain;
          border-radius: 3px;
        }
        .croqui-vazio {
          padding: 12px;
          text-align: center;
          color: #64748b;
          font-size: 9.5px;
          font-style: italic;
          background: #f8fafc;
          width: 100%;
          border-radius: 4px;
        }

        /* Tabela de Itens e Medidas do Pedido */
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

        /* Canhoto de Entrega no Rodapé do Pedido */
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
          margin-top: 10px;
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
          .page-sheet {
            background: #fff;
            max-width: 210mm;
            margin: 0 auto 20px auto;
            padding: 12mm;
            box-shadow: 0 4px 15px rgba(0,0,0,0.12);
            border-radius: 4px;
          }
          .action-bar {
            max-width: 210mm;
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
        <button class="btn-print" onclick="window.print()">🖨️ Imprimir Todo o Romaneio e Folhas</button>
        <span style="font-size: 12px; color: #475569; font-weight: 600;">
          Dica: No diálogo de impressão, escolha "Salvar como PDF" ou sua impressora.
        </span>
      </div>

      <!-- PÁGINA 1: FOTO ORIGINAL DA ROTA (INSERIDA MANUALMENTE) -->
      ${temFotoRota ? `
        <div class="page-sheet page-foto-rota">
          <div class="page-foto-header">
            <div>
              <div style="font-size: 15px; font-weight: 800; color: #0f172a;">AJL FERRO & AÇO — EXPEDIÇÃO</div>
              <div style="font-size: 11px; font-weight: 700; color: #0d9488;">FOLHA ORIGINAL DA ROTA / CARGA PROGRAMADA</div>
            </div>
            <div style="text-align: right; font-size: 10px; color: #475569;">
              <div>Rota: <strong>${rota.titulo || "Rota de Entrega"}</strong></div>
              <div>Motorista: <strong>${rota.motorista_nome || "—"}</strong> (${rota.placa || "S/ Placa"})</div>
            </div>
          </div>

          <div class="foto-container">
            <img src="${rota.rota_imagem_url}" alt="Folha Original da Rota" />
          </div>

          <div class="page-foto-footer">
            <span>Página 1 — Documento Fotográfico Original da Rota</span>
            <span>Emissão: ${dataHoje} · Unidade: ${filial}</span>
          </div>
        </div>
      ` : ""}

      <!-- PÁGINA 2: MANIFESTO GERAL DA CARGA (ROMANEIO CORPORATIVO) -->
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
            <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Assinatura e Visto de Liberação da Carga</div>
          </div>
          <div class="assinatura-box">
            <div class="assinatura-linha"></div>
            <div class="assinatura-cargo">Motorista: ${rota.motorista_nome || "Assinatura do Condutor"}</div>
            <div style="font-size: 8px; color: #64748b; margin-top: 2px;">Declaro ter conferido e recebido os pedidos descritos</div>
          </div>
        </div>
      </div>

      <!-- PÁGINAS SEGUINTES: FOLHA INDIVIDUAL DE CADA PEDIDO NA ORDEM DA ROTA -->
      ${itens.map((it, idx) => {
        const info = infoMap[it.numero_pedido] || {};
        const documentos = obterDocumentosPedido(it, info);
        const itensPcp = obterItensMedidasPedido(it, info);
        const paradaNum = it.ordem || idx + 1;
        const bLabel = it.barracao_sugerido === "telhas" ? "🏠 Fábrica de Telhas" : it.barracao_sugerido === "corte_dobra" ? "🏗️ Corte & Dobra" : it.barracao_sugerido === "ambos" ? "📦 Ambos os Barracões" : "⏳ Logística / Expedição";

        return `
          <div class="page-sheet pedido-sheet">
            <!-- Cabeçalho do Pedido -->
            <div class="pedido-header">
              <div>
                <div class="pedido-header-title">
                  PEDIDO #${it.numero_pedido}
                  ${it.numero_odoo && it.numero_odoo.toUpperCase() !== "NT" ? `<span style="font-size: 12px; color: #cbd5e1; margin-left: 6px;">(Odoo: #${it.numero_odoo})</span>` : ""}
                </div>
                <div style="font-size: 10px; color: #94a3b8; margin-top: 2px;">
                  Rota: <strong>${rota.titulo || "Rota de Entrega"}</strong> · Motorista: <strong>${rota.motorista_nome || "—"}</strong>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="pedido-header-badge">PARADA #${paradaNum} DE ${itens.length}</span>
              </div>
            </div>

            <!-- Dados do Cliente, Entrega e Observações -->
            <div class="pedido-info-grid">
              <div>
                <div>Cliente: <strong>${it.cliente || "—"}</strong></div>
                <div>Destino / Bairro / Cidade: <strong>${it.bairro || "—"}</strong></div>
                ${it.observacao ? `<div>Obs. Rota: <strong style="color: #b45309; background: #fef3c7; padding: 1px 4px; border-radius: 2px;">📌 ${it.observacao}</strong></div>` : ""}
              </div>
              <div>
                <div>Barracão: <strong>${bLabel}</strong></div>
                <div>Vendedor: <strong>${it.vendedor || info?.vendedor || "—"}</strong></div>
                <div>Valor: <strong>${it.valor || "—"}</strong> ${it.pagamento ? `(${it.pagamento})` : ""}</div>
              </div>
            </div>

            <!-- Croqui / Desenho Técnico vindo do PCP -->
            <div class="croqui-section">
              <div class="croqui-title">
                <span>📐 Documento / Desenho Técnico / Croqui (Central PCP)</span>
                <span>${documentos.length > 0 ? `${documentos.length} documento(s)` : "Sem anexo gráfico"}</span>
              </div>
              ${documentos.length > 0 ? `
                <div style="display: flex; flex-direction: column; gap: 8px; width: 100%;">
                  ${documentos.map((doc, dIdx) => `
                    <div class="croqui-image-box">
                      <img src="${doc.src}" alt="${doc.label || `Desenho ${dIdx + 1}`}" />
                    </div>
                  `).join("")}
                </div>
              ` : `
                <div class="croqui-vazio">
                  📋 Nenhum croqui gráfico anexado no PCP para este pedido. Conferir as medidas e produtos na tabela abaixo.
                </div>
              `}
            </div>

            <!-- Tabela de Itens e Medidas do PCP -->
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
                <div style="background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 4px; padding: 8px; font-size: 9.5px; color: #475569;">
                  Item cadastrado pela rota: <strong>${it.cliente}</strong> · Observações: <em>${it.observacao || "Conferir detalhes no Odoo ERP"}</em>
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
          // Aguarda todas as imagens carregarem antes de acionar a impressão
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
    // Se o pop-up estiver bloqueado pelo navegador, gera e baixa PDF nativo
    baixarRomaneioPdf(rota, options);
  }
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
    if (y > pageHeight - 35) {
      doc.addPage();
      y = 15;
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

    const bNome = it.barracao_sugerido === "telhas" ? "Telhas" : it.barracao_sugerido === "corte_dobra" ? "Corte & Dobra" : it.barracao_sugerido === "ambos" ? "Ambos" : "Aguardando";
    doc.text(bNome, margem + 105, y + 5.5);

    const obsTxt = (it.observacao || "—").slice(0, 22);
    doc.text(obsTxt, margem + 128, y + 5.5);
    doc.text(it.valor || "—", margem + 164, y + 5.5);

    doc.setDrawColor(148, 163, 184);
    doc.rect(margem + 179, y + 2, 4.5, 4.5, "S");

    y += 8.5;
  });

  // Assinaturas
  const assinaY = pageHeight - 22;
  doc.setDrawColor(100, 116, 139);
  doc.setLineWidth(0.4);
  doc.line(margem + 10, assinaY, margem + 75, assinaY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text("CONFERENTE / EXPEDIÇÃO (VISTO E CARREGAMENTO)", margem + 12, assinaY + 4);

  doc.line(margem + 105, assinaY, margem + 170, assinaY);
  doc.text(`MOTORISTA: ${rota.motorista_nome || "Assinatura do Condutor"}`, margem + 107, assinaY + 4);

  const nomeLimpo = (rota.titulo || "Rota_Entrega").replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`Romaneio_${nomeLimpo}.pdf`);
}
