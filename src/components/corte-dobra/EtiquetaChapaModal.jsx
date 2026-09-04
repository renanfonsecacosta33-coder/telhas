import React, { useRef, useState, useEffect } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Copy, Check, FileCode, QrCode, Tag, X, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

export default function EtiquetaChapaModal({ open, onClose, chapa, bobina }) {
  const printRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copiedZpl, setCopiedZpl] = useState(false);

  useEffect(() => {
    if (chapa && open) {
      const qrPayload = JSON.stringify({
        tipo: "CHAPA_CD",
        codigo: chapa.codigo || "",
        mat: chapa.material || "",
        esp: chapa.espessura_mm || "",
        qual: chapa.qualidade || "",
        dim: `${chapa.comprimento_mm || 0}x${chapa.largura_mm || 0}`,
        qtd: chapa.quantidade_disponivel ?? chapa.quantidade_total ?? 0,
        ped: chapa.numero_pedido || "",
        cli: chapa.cliente || "",
        id: chapa.id || ""
      });

      QRCode.toDataURL(qrPayload, {
        width: 180,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#000000", light: "#ffffff" }
      })
        .then(setQrDataUrl)
        .catch((err) => console.error("Erro ao gerar QR da chapa:", err));
    }
  }, [chapa, open]);

  if (!chapa) return null;

  const dataFormatada = format(new Date(chapa.data_corte || chapa.created_date || Date.now()), "dd/MM/yyyy", { locale: ptBR });
  const horaEmissao = format(new Date(), "HH:mm", { locale: ptBR });

  const materialNome = chapa.material || (chapa.bobina_descricao && !chapa.bobina_descricao.includes("mm") ? chapa.bobina_descricao : "Chapa de Aço");
  const espessuraTexto = chapa.espessura_mm ? `${chapa.espessura_mm} mm` : "—";
  const qualidadeTexto = chapa.qualidade || bobina?.qualidade || "FQ";
  const dimensoesTexto = chapa.comprimento_mm > 0 ? `${chapa.comprimento_mm} × ${chapa.largura_mm || 1200} mm` : "—";
  const qtdTexto = `${chapa.quantidade_disponivel ?? chapa.quantidade_total ?? 0} pçs`;
  const pesoTexto = chapa.peso_kg ? `${Number(chapa.peso_kg).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg` : "—";

  const destinoTexto = chapa.destino === "pedido_direto"
    ? `Pedido #${chapa.numero_pedido || ""}${chapa.cliente ? ` · ${chapa.cliente}` : ""}`
    : "Estoque Geral";

  const origemTexto = chapa.origem === "desbobinadeira"
    ? `Desbobinadeira ${chapa.bobina_descricao ? `(${chapa.bobina_descricao})` : ""}`
    : "Entrada Manual";

  // Código ZPL para impressoras industriais térmicas (Zebra / Argox / Datamax)
  const zplCode = `^XA
^PW800
^LL600
^FO40,30^GB720,540,3^FS
^FO60,50^A0N,42,42^FD${chapa.codigo || "CHAPA"}^FS
^FO320,55^A0N,22,22^FDAJL FERRO E ACO - CORTE E DOBRA^FS
^FO60,105^GB680,2,2^FS
^FO60,120^A0N,20,20^FDMATERIAL: ${materialNome} | QUAL: ${qualidadeTexto}^FS
^FO60,150^A0N,28,28^FDESPESSURA: ${espessuraTexto}^FS
^FO60,185^A0N,22,22^FDDIMENSOES: ${dimensoesTexto}^FS
^FO60,215^A0N,22,22^FDQUANTIDADE: ${qtdTexto} | PESO: ${pesoTexto}^FS
^FO60,245^A0N,20,20^FDDESTINO: ${destinoTexto}^FS
^FO60,275^A0N,18,18^FDORIGEM: ${origemTexto}^FS
^FO60,305^A0N,18,18^FDDATA: ${dataFormatada} ${horaEmissao} | UNIDADE: ${chapa.unidade || "Matriz AJL"}^FS
^FO550,130^BQN,2,5^FDQA,CHAPA:${chapa.codigo || ""}|ESP:${chapa.espessura_mm || ""}|QTD:${chapa.quantidade_disponivel || 0}^FS
^FO60,490^GB680,2,2^FS
^FO60,510^A0N,18,18^FDVALIDACAO POR IA NA GUILHOTINA - AJL FERRO E ACO^FS
^XZ`;

  const handleCopyZpl = () => {
    navigator.clipboard.writeText(zplCode);
    setCopiedZpl(true);
    toast.success("Código ZPL copiado para a área de transferência!");
    setTimeout(() => setCopiedZpl(false), 2000);
  };

  const handlePrint = () => {
    const conteudo = printRef.current?.innerHTML;
    const janela = window.open("", "_blank", "width=800,height=600");
    if (!janela) {
      toast.error("O bloqueador de pop-ups impediu a impressão. Permita pop-ups para este site.");
      return;
    }
    janela.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Etiqueta Chapa ${chapa.codigo || ""}</title>
          <style>
            @page {
              size: 101.6mm 76.2mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: 'Arial', sans-serif;
              background: white;
              color: black;
              width: 101.6mm;
              height: 76.2mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .etq-container {
              width: 98mm;
              height: 72mm;
              border: 2.5pt solid #000;
              display: flex;
              flex-direction: column;
              background: white;
              overflow: hidden;
              padding: 3pt;
            }
            @media print {
              body {
                width: 101.6mm;
                height: 76.2mm;
              }
              .etq-container {
                border: 2.5pt solid #000 !important;
              }
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
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader className="pb-2 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">Etiqueta Exclusiva de Chapa</DialogTitle>
                <p className="text-xs text-muted-foreground">Identificação oficial para leitura e validação por IA nas Guilhotinas</p>
              </div>
            </div>
            <span className="font-mono font-black text-xl px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-300 dark:border-slate-700">
              {chapa.codigo}
            </span>
          </div>
        </DialogHeader>

        {/* Pré-visualização da Etiqueta Industrial */}
        <div className="flex justify-center py-4 bg-slate-100/70 dark:bg-slate-950/60 rounded-xl p-4 border border-slate-200 dark:border-slate-800 overflow-x-auto">
          <div
            ref={printRef}
            style={{
              fontFamily: "Arial, sans-serif",
              color: "#000",
              background: "#fff",
              width: "384px",
              height: "288px",
              boxSizing: "border-box",
              padding: "8px",
              border: "2.5px solid #000",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              borderRadius: "4px",
              position: "relative"
            }}
          >
            {/* Cabeçalho */}
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "4px" }}>
                <div>
                  <div style={{ fontSize: "28px", fontWeight: 900, lineHeight: 1, letterSpacing: "-1px", fontFamily: "monospace" }}>
                    {chapa.codigo || "CH0000"}
                  </div>
                  <div style={{ fontSize: "7px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#333" }}>
                    Chapa de Corte &amp; Dobra
                  </div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", fontWeight: 900, lineHeight: 1, letterSpacing: "0.5px" }}>
                    AJL FERRO &amp; AÇO
                  </div>
                  <div style={{ fontSize: "7px", fontWeight: 600, color: "#444", textTransform: "uppercase" }}>
                    Rastreabilidade Industrial
                  </div>
                </div>
              </div>

              {/* Sub-faixa com Data e Origem */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8px", fontWeight: 700, padding: "3px 0", borderBottom: "1px solid #000", background: "#f8f8f8" }}>
                <span>DATA: {dataFormatada} {horaEmissao}</span>
                <span>ORIGEM: {origemTexto.toUpperCase()}</span>
                <span>{chapa.unidade || "MATRIZ"}</span>
              </div>
            </div>

            {/* Corpo com especificações + QR Code */}
            <div style={{ display: "flex", gap: "8px", flex: 1, padding: "6px 0", alignItems: "center" }}>
              {/* Coluna de dados */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "3px", fontSize: "9px" }}>
                <div style={{ display: "flex", borderBottom: "1px dashed #ccc", paddingBottom: "2px" }}>
                  <span style={{ width: "70px", fontWeight: 700, color: "#444" }}>MATERIAL:</span>
                  <strong style={{ fontSize: "10.5px", textTransform: "uppercase" }}>{materialNome}</strong>
                </div>

                <div style={{ display: "flex", alignItems: "center", borderBottom: "1px solid #000", padding: "2px 0", background: "#fafafa" }}>
                  <span style={{ width: "70px", fontWeight: 700, color: "#000" }}>ESPESSURA:</span>
                  <strong style={{ fontSize: "15px", fontWeight: 900, color: "#000" }}>{espessuraTexto}</strong>
                  <span style={{ marginLeft: "auto", fontSize: "8.5px", fontWeight: 700, padding: "1px 4px", border: "1px solid #000", borderRadius: "2px" }}>
                    {qualidadeTexto}
                  </span>
                </div>

                <div style={{ display: "flex", borderBottom: "1px dashed #ccc", paddingBottom: "2px" }}>
                  <span style={{ width: "70px", fontWeight: 700, color: "#444" }}>DIMENSÕES:</span>
                  <strong style={{ fontSize: "10px" }}>{dimensoesTexto}</strong>
                </div>

                <div style={{ display: "flex", borderBottom: "1px dashed #ccc", paddingBottom: "2px" }}>
                  <span style={{ width: "70px", fontWeight: 700, color: "#444" }}>QUANTIDADE:</span>
                  <strong style={{ fontSize: "11px" }}>{qtdTexto}</strong>
                  {pesoTexto !== "—" && <span style={{ marginLeft: "auto", fontSize: "9px", color: "#444" }}>Peso: <strong>{pesoTexto}</strong></span>}
                </div>

                <div style={{ display: "flex", paddingTop: "1px" }}>
                  <span style={{ width: "70px", fontWeight: 700, color: "#444" }}>DESTINO:</span>
                  <strong style={{ fontSize: "9px", textTransform: "uppercase", color: chapa.destino === "pedido_direto" ? "#0033cc" : "#000" }}>
                    {destinoTexto}
                  </strong>
                </div>
              </div>

              {/* QR Code */}
              <div style={{ width: "95px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderLeft: "1px solid #000", paddingLeft: "6px" }}>
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="QR Code da Chapa" style={{ width: "84px", height: "84px", display: "block" }} />
                ) : (
                  <div style={{ width: "84px", height: "84px", background: "#eee", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "8px" }}>
                    QR Code
                  </div>
                )}
                <div style={{ fontSize: "6.5px", fontWeight: 800, textTransform: "uppercase", textAlign: "center", marginTop: "2px", letterSpacing: "0.2px" }}>
                  LEITURA POR IA
                </div>
              </div>
            </div>

            {/* Rodapé industrial */}
            <div style={{ borderTop: "1.5px solid #000", paddingTop: "3px", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "7px", fontWeight: 700, textTransform: "uppercase", color: "#333" }}>
              <span>VALIDAÇÃO OBRIGATÓRIA DA ETIQUETA AO INICIAR GUILHOTINA</span>
              <span>AJL INDÚSTRIA</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Padrão industrial: <strong>101,6 × 76,2 mm (4" × 3")</strong>. O operador deve colar esta etiqueta no fardo/pacote de chapas para leitura fotográfica na Guilhotina.
        </p>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={handleCopyZpl} className="gap-1.5 text-xs">
            {copiedZpl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <FileCode className="w-3.5 h-3.5" />}
            {copiedZpl ? "ZPL Copiado!" : "Copiar ZPL (Térmica)"}
          </Button>

          <div className="flex items-center gap-2 sm:ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>
              Fechar
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-1.5 bg-black hover:bg-slate-800 text-white font-bold">
              <Printer className="w-4 h-4" />
              Imprimir Etiqueta
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
