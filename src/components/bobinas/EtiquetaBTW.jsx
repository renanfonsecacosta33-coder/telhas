import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Etiqueta no padrão BTW (BarTender) para bobinas.
 * Suporta setor "corte_dobra" e "telhas" com campos específicos.
 */
export default function EtiquetaBTW({ bobina, onClose }) {
  const printRef = useRef(null);

  const hoje = format(new Date(), "dd/MM", { locale: ptBR });

  // Campos dinâmicos por setor
  const isCD = bobina.setor === "corte_dobra";

  const descricao = isCD
    ? `CH ${bobina.chapa}`
    : `${bobina.chapa} mm`;

  const dimensoes = bobina.largura_mm
    ? `${bobina.largura_mm}`
    : "—";

  const pesoAtual = bobina.peso_kg
    ? bobina.peso_kg.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : "—";

  const pesoBruto = bobina.peso_inicial
    ? bobina.peso_inicial.toLocaleString("pt-BR", { minimumFractionDigits: 3, maximumFractionDigits: 3 })
    : pesoAtual;

  const handlePrint = () => {
    const conteudo = printRef.current.innerHTML;
    const janela = window.open("", "_blank", "width=700,height=500");
    janela.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Etiqueta ${bobina.codigo || ""}</title>
          <style>
            @page {
              size: 101.6mm 76.2mm;
              margin: 0;
            }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: Arial, sans-serif;
              background: white;
              width: 101.6mm;
              height: 76.2mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .etiqueta {
              width: 96mm;
              height: 70mm;
              border: 2.5pt solid #4a90d9;
              border-radius: 4pt;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              background: white;
            }
            .header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 4pt 6pt 3pt 6pt;
              border-bottom: 1.5pt solid #4a90d9;
              gap: 4pt;
            }
            .codigo {
              font-size: 30pt;
              font-weight: 900;
              letter-spacing: -1pt;
              color: #111;
              line-height: 1;
            }
            .logo-area {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              border: 1.5pt solid #4a90d9;
              border-radius: 3pt;
              padding: 3pt 6pt;
              min-width: 28mm;
            }
            .logo-shield {
              font-size: 16pt;
              color: #4a90d9;
              font-weight: 900;
              line-height: 1;
            }
            .logo-text-main {
              font-size: 11pt;
              font-weight: 900;
              color: #111;
              letter-spacing: 2pt;
              line-height: 1;
            }
            .logo-text-sub {
              font-size: 5pt;
              color: #666;
              letter-spacing: 0.5pt;
              text-transform: uppercase;
            }
            .tabela {
              flex: 1;
              display: flex;
              flex-direction: column;
            }
            .linha {
              display: flex;
              border-bottom: 0.75pt solid #ccc;
              flex: 1;
              min-height: 0;
            }
            .linha:last-child { border-bottom: none; }
            .celula {
              display: flex;
              align-items: center;
              padding: 2pt 5pt;
              font-size: 7.5pt;
              color: #333;
              white-space: nowrap;
            }
            .celula-label {
              background: #f0f4fa;
              min-width: 24mm;
              font-weight: 600;
              border-right: 0.75pt solid #ccc;
              color: #444;
            }
            .celula-valor {
              flex: 1;
              font-weight: 700;
              font-size: 9pt;
              color: #111;
            }
            .celula-peso-atual {
              border-left: 0.75pt solid #ccc;
              flex-direction: column;
              align-items: flex-start;
              min-width: 25mm;
              font-size: 6.5pt;
              color: #555;
              font-weight: 600;
            }
            .celula-peso-atual span {
              font-size: 10pt;
              font-weight: 900;
              color: #111;
            }
            .linha-datas {
              flex: none;
              height: 10pt;
              display: flex;
              align-items: center;
            }
            .rodape {
              display: flex;
              border-top: 1.5pt solid #4a90d9;
              padding: 3pt 5pt;
              align-items: center;
              justify-content: space-between;
              gap: 4pt;
              background: #f8faff;
            }
            .rodape-item {
              font-size: 7.5pt;
              color: #333;
            }
            .rodape-item strong {
              font-size: 11pt;
              font-weight: 900;
              color: #111;
            }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          ${conteudo}
        </body>
      </html>
    `);
    janela.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-5">
        {/* Topo modal */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Etiqueta BTW</h3>
            <p className="text-xs text-muted-foreground">Prévia da etiqueta para impressão</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        {/* Prévia da etiqueta */}
        <div className="flex justify-center">
          <div ref={printRef} style={{ fontFamily: "Arial, sans-serif" }}>
            <div className="etiqueta" style={{
              width: "384px",
              height: "280px",
              border: "2.5px solid #4a90d9",
              borderRadius: "6px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              background: "white",
            }}>
              {/* Header: Código + Logo */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px 6px 12px", borderBottom: "1.5px solid #4a90d9", gap: "8px" }}>
                <div style={{ fontSize: "46px", fontWeight: "900", letterSpacing: "-1px", color: "#111", lineHeight: 1 }}>
                  {bobina.codigo || "—"}
                </div>
                <div style={{ border: "1.5px solid #4a90d9", borderRadius: "5px", padding: "6px 12px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: "90px" }}>
                  <div style={{ fontSize: "22px", color: "#4a90d9", fontWeight: "900", lineHeight: 1 }}>🛡</div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#111", letterSpacing: "3px", lineHeight: 1 }}>AJL</div>
                  <div style={{ fontSize: "7px", color: "#666", letterSpacing: "0.5px", textTransform: "uppercase" }}>Ferro e Aço</div>
                </div>
              </div>

              {/* Tabela de dados */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Linha data / COD / Peso atual */}
                <div style={{ display: "flex", borderBottom: "0.75px solid #ccc", alignItems: "stretch" }}>
                  <div style={{ padding: "4px 10px", fontSize: "13px", color: "#333", borderRight: "0.75px solid #ccc", minWidth: "70px", display: "flex", alignItems: "center", fontWeight: 600 }}>
                    {bobina.data_recebimento
                      ? bobina.data_recebimento.slice(5).replace("-", "/")
                      : hoje}
                  </div>
                  <div style={{ padding: "4px 10px", fontSize: "12px", color: "#333", flex: 1, display: "flex", alignItems: "center", borderRight: "0.75px solid #ccc", fontWeight: 600 }}>
                    COD {bobina.nf || bobina.codigo || "—"}
                  </div>
                  <div style={{ padding: "4px 10px", fontSize: "11px", color: "#555", minWidth: "100px", display: "flex", flexDirection: "column", justifyContent: "center", fontWeight: 600 }}>
                    Peso atual:
                    <span style={{ fontSize: "14px", fontWeight: "900", color: "#111" }}>{pesoAtual}</span>
                  </div>
                </div>

                {/* Dimensões */}
                <div style={{ display: "flex", borderBottom: "0.75px solid #ccc", alignItems: "stretch" }}>
                  <div style={{ padding: "3px 10px", fontSize: "12px", background: "#f0f4fa", minWidth: "100px", display: "flex", alignItems: "center", borderRight: "0.75px solid #ccc", fontWeight: 600, color: "#444" }}>
                    Dimensões
                  </div>
                  <div style={{ padding: "3px 10px", fontSize: "15px", fontWeight: "900", color: "#111", flex: 1, display: "flex", alignItems: "center" }}>
                    {dimensoes}
                  </div>
                </div>

                {/* Descrição */}
                <div style={{ display: "flex", borderBottom: "0.75px solid #ccc", alignItems: "stretch" }}>
                  <div style={{ padding: "3px 10px", fontSize: "12px", background: "#f0f4fa", minWidth: "100px", display: "flex", alignItems: "center", borderRight: "0.75px solid #ccc", fontWeight: 600, color: "#444" }}>
                    Descrição
                  </div>
                  <div style={{ padding: "3px 10px", fontSize: "15px", fontWeight: "900", color: "#111", flex: 1, display: "flex", alignItems: "center" }}>
                    {descricao}
                  </div>
                </div>

                {/* Qualidade */}
                <div style={{ display: "flex", borderBottom: "0.75px solid #ccc", alignItems: "stretch" }}>
                  <div style={{ padding: "3px 10px", fontSize: "12px", background: "#f0f4fa", minWidth: "100px", display: "flex", alignItems: "center", borderRight: "0.75px solid #ccc", fontWeight: 600, color: "#444" }}>
                    Qualidade
                  </div>
                  <div style={{ padding: "3px 10px", fontSize: "15px", fontWeight: "900", color: "#111", flex: 1, display: "flex", alignItems: "center" }}>
                    {bobina.qualidade || "—"}
                  </div>
                </div>

                {/* NF Origem */}
                <div style={{ display: "flex", alignItems: "stretch" }}>
                  <div style={{ padding: "3px 10px", fontSize: "12px", background: "#f0f4fa", minWidth: "100px", display: "flex", alignItems: "center", borderRight: "0.75px solid #ccc", fontWeight: 600, color: "#444" }}>
                    NF ORIGEM
                  </div>
                  <div style={{ padding: "3px 10px", fontSize: "15px", fontWeight: "900", color: "#111", flex: 1, display: "flex", alignItems: "center" }}>
                    {bobina.nf || "—"}
                  </div>
                </div>
              </div>

              {/* Rodapé: Peso Bruto / Peso Líquido */}
              <div style={{ display: "flex", borderTop: "1.5px solid #4a90d9", padding: "5px 12px", alignItems: "center", justifyContent: "space-between", background: "#f8faff" }}>
                <div style={{ fontSize: "12px", color: "#333" }}>
                  Peso Bruto: <strong style={{ fontSize: "16px", fontWeight: "900", color: "#111" }}>{pesoBruto}</strong>
                </div>
                <div style={{ fontSize: "12px", color: "#333" }}>
                  Peso Líquido: <strong style={{ fontSize: "16px", fontWeight: "900", color: "#111" }}>{pesoAtual}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button className="gap-2 bg-blue-600 hover:bg-blue-700" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Imprimir / Baixar
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Tamanho de impressão: 101,6 × 76,2 mm (4" × 3") — padrão BTW
        </p>
      </div>
    </div>
  );
}