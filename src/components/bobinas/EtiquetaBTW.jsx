import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Etiqueta para bobinas — layout atualizado com Chapa Real / Chapa Utilizada.
 */
export default function EtiquetaBTW({ bobina, onClose }) {
  const printRef = useRef(null);

  const hoje = format(new Date(), "dd/MM", { locale: ptBR });
  const dataExib = bobina.data_recebimento
    ? bobina.data_recebimento.slice(5).replace("-", "/")
    : hoje;

  const dim = bobina.largura_mm ? String(bobina.largura_mm) : "—";

  const pesoAtual = bobina.peso_kg != null
    ? bobina.peso_kg.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
    : "—";

  const pesoBruto = bobina.peso_inicial != null
    ? bobina.peso_inicial.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
    : pesoAtual;

  const chapaReal = bobina.chapa || "—";
  const corBobina = bobina.cor || "—";
  const isCorteDobra = bobina.setor === "corte_dobra";
  const chapaUtilizada = bobina.espessura_utilizada || bobina.chapa || "—";

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
            @page { size: 101.6mm 76.2mm; margin: 0; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: Arial, sans-serif; background: white;
              width: 101.6mm; height: 76.2mm;
              display: flex; align-items: center; justify-content: center;
            }
            .etq {
              width: 96mm; height: 70mm;
              border: 2pt solid #000;
              display: flex; flex-direction: column;
              background: white; overflow: hidden;
            }
            .hdr {
              display: flex; align-items: center; justify-content: space-between;
              padding: 3pt 5pt; border-bottom: 1.5pt solid #000; gap: 4pt;
            }
            .cod { font-size: 24pt; font-weight: 900; color: #000; line-height: 1; letter-spacing: -0.5pt; }
            .logo { display: flex; flex-direction: column; align-items: center; justify-content: center; }
            .logo-s { font-size: 14pt; font-weight: 900; color: #000; line-height: 1; }
            .logo-m { font-size: 10pt; font-weight: 900; color: #000; line-height: 1; letter-spacing: 1pt; }
            .logo-sub { font-size: 5pt; color: #000; letter-spacing: 0.3pt; text-transform: uppercase; }
            .sub-row {
              display: flex; align-items: center;
              border-bottom: 0.75pt solid #000; padding: 2pt 5pt; gap: 4pt;
            }
            .sub-lbl { font-size: 7pt; font-weight: 600; color: #000; }
            .sub-val { font-size: 7.5pt; font-weight: 700; color: #000; }
            .grid { flex: 1; display: flex; flex-direction: column; }
            .row { display: flex; border-bottom: 0.75pt solid #000; flex: 1; min-height: 0; }
            .row:last-child { border-bottom: none; }
            .cell {
              display: flex; align-items: center; padding: 2pt 5pt;
              font-size: 8pt; color: #000; white-space: nowrap;
            }
            .cell-lbl {
              background: #f5f5f5; min-width: 22mm; font-weight: 700;
              border-right: 0.75pt solid #000; font-size: 7.5pt;
            }
            .cell-val { flex: 1; font-weight: 700; font-size: 9.5pt; }
            .cell-peso {
              border-left: 0.75pt solid #000; flex-direction: column;
              align-items: flex-start; min-width: 24mm; font-size: 6.5pt; font-weight: 600;
            }
            .cell-peso span { font-size: 10pt; font-weight: 900; }
            .ftr {
              display: flex; border-top: 1.5pt solid #000; padding: 3pt 5pt;
              align-items: center; justify-content: space-between; gap: 4pt;
            }
            .ftr-item { font-size: 7.5pt; color: #000; }
            .ftr-item strong { font-size: 10pt; font-weight: 900; }
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
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">Etiqueta</h3>
            <p className="text-xs text-muted-foreground">Prévia da etiqueta para impressão</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="flex justify-center">
          <div ref={printRef} style={{ fontFamily: "Arial, sans-serif" }}>
            <div style={{
              width: "384px", height: "280px", border: "2px solid #000",
              display: "flex", flexDirection: "column", background: "white", overflow: "hidden"
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 8px", borderBottom: "1.5px solid #000" }}>
                <div style={{ fontSize: "38px", fontWeight: 900, color: "#000", lineHeight: 1, letterSpacing: "-1px" }}>
                  {bobina.codigo || "—"}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: "22px", fontWeight: 900, color: "#000", lineHeight: 1 }}>🛡</div>
                  <div style={{ fontSize: "14px", fontWeight: 900, color: "#000", lineHeight: 1, letterSpacing: "2px" }}>AJL</div>
                  <div style={{ fontSize: "7px", color: "#000", letterSpacing: "0.5px", textTransform: "uppercase" }}>Ferro e Aço</div>
                </div>
              </div>

              {/* Sub. Cód. row */}
              <div style={{ display: "flex", alignItems: "center", borderBottom: "0.75px solid #000", padding: "2px 8px", gap: "6px" }}>
                <span style={{ fontSize: "10px", fontWeight: 600 }}>Sub. Cód.:</span>
                <span style={{ fontSize: "11px", fontWeight: 700 }}>{bobina.sub_cod || "—"}</span>
                <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: 600 }}>
                  Qualidade: {bobina.espessura_real || bobina.qualidade || "—"}
                </span>
                <span style={{ fontSize: "10px", fontWeight: 700, marginLeft: "8px" }}>{dataExib}</span>
              </div>

              {/* Grid principal */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                {/* Dimensões + Peso atual */}
                <div style={{ display: "flex", borderBottom: "0.75px solid #000", flex: 1 }}>
                  <div style={{ padding: "3px 8px", fontSize: "12px", background: "#f5f5f5", minWidth: "80px", display: "flex", alignItems: "center", borderRight: "0.75px solid #000", fontWeight: 700 }}>
                    Dimensões
                  </div>
                  <div style={{ padding: "3px 8px", fontSize: "16px", fontWeight: 900, color: "#000", flex: 1, display: "flex", alignItems: "center" }}>
                    {dim}
                  </div>
                  <div style={{ padding: "3px 8px", fontSize: "10px", borderLeft: "0.75px solid #000", minWidth: "90px", display: "flex", flexDirection: "column", justifyContent: "center", fontWeight: 600 }}>
                    Peso atual:
                    <span style={{ fontSize: "14px", fontWeight: 900 }}>{pesoAtual}</span>
                  </div>
                </div>

                {/* Chapa Real */}
                <div style={{ display: "flex", borderBottom: "0.75px solid #000", flex: 1 }}>
                  <div style={{ padding: "3px 8px", fontSize: "12px", background: "#f5f5f5", minWidth: "80px", display: "flex", alignItems: "center", borderRight: "0.75px solid #000", fontWeight: 700 }}>
                    Chapa Real
                  </div>
                  <div style={{ padding: "3px 8px", fontSize: "16px", fontWeight: 900, color: "#000", flex: 1, display: "flex", alignItems: "center" }}>
                    {chapaReal}
                  </div>
                </div>

                {/* COR (Telhas) / CHAPA UTILIZADA (Corte e Dobra) */}
                <div style={{ display: "flex", borderBottom: "0.75px solid #000", flex: 1 }}>
                  <div style={{ padding: "3px 8px", fontSize: "12px", background: "#f5f5f5", minWidth: "80px", display: "flex", alignItems: "center", borderRight: "0.75px solid #000", fontWeight: 700 }}>
                    {isCorteDobra ? "CHAPA UTIL." : "COR"}
                  </div>
                  <div style={{ padding: "3px 8px", fontSize: "16px", fontWeight: 900, color: "#000", flex: 1, display: "flex", alignItems: "center" }}>
                    {isCorteDobra ? chapaUtilizada : corBobina}
                  </div>
                </div>

                {/* NF Origem */}
                <div style={{ display: "flex", flex: 1 }}>
                  <div style={{ padding: "3px 8px", fontSize: "12px", background: "#f5f5f5", minWidth: "80px", display: "flex", alignItems: "center", borderRight: "0.75px solid #000", fontWeight: 700 }}>
                    NF ORIGEM
                  </div>
                  <div style={{ padding: "3px 8px", fontSize: "16px", fontWeight: 900, color: "#000", flex: 1, display: "flex", alignItems: "center" }}>
                    {bobina.nf || "—"}
                  </div>
                </div>
              </div>

              {/* Rodapé */}
              <div style={{ display: "flex", borderTop: "1.5px solid #000", padding: "4px 8px", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: "11px", color: "#000" }}>
                  Peso Bruto: <strong style={{ fontSize: "14px", fontWeight: 900 }}>{pesoBruto}</strong>
                </div>
                <div style={{ fontSize: "11px", color: "#000" }}>
                  Peso Líquido: <strong style={{ fontSize: "14px", fontWeight: 900 }}>{pesoAtual}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
          <Button className="gap-2 bg-black hover:bg-gray-800" onClick={handlePrint}>
            <Printer className="w-4 h-4" /> Imprimir / Baixar
          </Button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Tamanho de impressão: 101,6 × 76,2 mm (4" × 3")
        </p>
      </div>
    </div>
  );
}