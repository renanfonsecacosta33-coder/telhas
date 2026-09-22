import React, { useRef, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/button";
import {
  Printer,
  X,
  Copy,
  Check,
  FileCode,
  QrCode,
  Info,
  ChevronDown,
  ChevronUp,
  Settings,
  Sparkles,
  Maximize2,
  Download,
  AlertTriangle,
  RefreshCw,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

/**
 * Etiqueta BTW / Industrial para Bobinas
 * Otimizada para Impressoras Térmicas (Elgin L42PRO, Zebra, Argox)
 * Suporta impressão direta via Iframe, janela pop-up, download em PDF de alta resolução e exportação ZPL.
 */
export default function EtiquetaBTW({ bobina, onClose }) {
  const printRef = useRef(null);
  const [tamanho, setTamanho] = useState(() => {
    return localStorage.getItem("ajl_etiqueta_tamanho") || "100x150";
  });
  const [qrUrl, setQrUrl] = useState("");
  const [copiedZpl, setCopiedZpl] = useState(false);
  const [showGuiaElgin, setShowGuiaElgin] = useState(false);
  const [showDiagnostico, setShowDiagnostico] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const hoje = format(new Date(), "dd/MM/yyyy", { locale: ptBR });
  const horaAtual = format(new Date(), "HH:mm", { locale: ptBR });
  const dataExib = bobina?.data_recebimento
    ? format(new Date(bobina.data_recebimento), "dd/MM/yyyy", { locale: ptBR })
    : hoje;

  const dim = bobina?.largura_mm ? `${bobina.largura_mm} mm` : "—";

  const pesoAtual = bobina?.peso_kg != null
    ? `${Number(bobina.peso_kg).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} kg`
    : "—";

  const pesoBruto = bobina?.peso_inicial != null
    ? `${Number(bobina.peso_inicial).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 1 })} kg`
    : pesoAtual;

  const chapaReal = bobina?.chapa || "—";
  const corBobina = bobina?.cor || "—";
  const isCorteDobra = bobina?.setor === "corte_dobra";
  const chapaUtilizada = bobina?.espessura_utilizada || bobina?.chapa || "—";
  const fornecedor = (bobina?.fornecedor || "").trim() || "NÃO INFORMADO";
  const nfOrigem = bobina?.nf || "—";
  const qualidade = bobina?.qualidade || bobina?.espessura_real || "GV";
  const codigo = bobina?.codigo || "BOBINA";
  const subCod = bobina?.sub_cod || "—";
  const setorLabel = isCorteDobra ? "CORTE E DOBRA" : "TELHAS METÁLICAS";

  // Gerar QR Code apontando para o rastreio da bobina
  useEffect(() => {
    const baseUrl = window.location.origin;
    const trackingUrl = `${baseUrl}/bobina-qr/${bobina?.id || bobina?.codigo || "0"}`;
    QRCode.toDataURL(trackingUrl, {
      width: 280,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" }
    })
      .then(setQrUrl)
      .catch((err) => console.error("Erro ao gerar QR da bobina:", err));
  }, [bobina]);

  const handleMudarTamanho = (novoTamanho) => {
    setTamanho(novoTamanho);
    localStorage.setItem("ajl_etiqueta_tamanho", novoTamanho);
  };

  // Código ZPL nativo para impressoras térmicas (Elgin L42PRO / Zebra / Argox)
  const gerarZpl = () => {
    if (tamanho === "100x150") {
      return `^XA
^PW800
^LL1200
^FO30,30^GB740,1140,4^FS
^FO50,50^A0N,32,32^FDAJL FERRO E ACO^FS
^FO50,88^A0N,18,18^FDSISTEMA INDUSTRIAL - ${setorLabel}^FS
^FO520,50^A0N,20,20^FDRECEBIDO EM:^FS
^FO520,78^A0N,24,24^FD${dataExib}^FS
^FO50,120^GB700,3,3^FS
^FO50,140^GB700,120,120^FS
^FO70,165^A0N,75,75^FR^FD${codigo}^FS
^FO50,280^A0N,22,22^FDSUB-COD: ${subCod} | QUALIDADE: ${qualidade}^FS
^FO50,315^GB700,2,2^FS
^FO50,335^A0N,24,24^FDDIMENSOES / LARGURA:^FS
^FO350,330^A0N,34,34^FD${dim}^FS
^FO50,385^A0N,24,24^FDCHAPA REAL (ESPESSURA):^FS
^FO350,380^A0N,34,34^FD${chapaReal} mm^FS
^FO50,435^A0N,24,24^FD${isCorteDobra ? "CHAPA UTILIZADA:" : "COR DA BOBINA:"}^FS
^FO350,430^A0N,34,34^FD${isCorteDobra ? chapaUtilizada : corBobina}^FS
^FO50,485^A0N,24,24^FDFORNECEDOR / USINA:^FS
^FO350,485^A0N,26,26^FD${fornecedor.slice(0, 24)}^FS
^FO50,535^A0N,24,24^FDNOTA FISCAL ORIGEM:^FS
^FO350,530^A0N,34,34^FD${nfOrigem}^FS
^FO50,585^GB700,2,2^FS
^FO50,610^GB340,110,2^FS
^FO70,625^A0N,20,20^FDPESO BRUTO INICIAL^FS
^FO70,660^A0N,38,38^FD${pesoBruto}^FS
^FO410,610^GB340,110,3^FS
^FO430,625^A0N,20,20^FDPESO LIQUIDO ATUAL^FS
^FO430,660^A0N,44,44^FD${pesoAtual}^FS
^FO50,740^GB700,2,2^FS
^FO70,760^BQN,2,7^FDQA,https://fabricas.base44.app/bobina-qr/${bobina?.id || codigo}^FS
^FO320,770^A0N,26,26^FDRASTREABILIDADE DIGITAL^FS
^FO320,810^A0N,20,20^FDEscaneie com smartphone ou PDA^FS
^FO320,840^A0N,20,20^FDpara historico de consumo e OPs^FS
^FO320,880^A0N,22,22^FDLOTE INTERNO: ${codigo}^FS
^FO50,1050^GB700,2,2^FS
^FO50,1070^A0N,18,18^FDAJL FERRO E ACO - ETIQUETA TERMICA ELGIN L42PRO^FS
^FO50,1095^A0N,16,16^FDEmissao: ${hoje} as ${horaAtual}^FS
^XZ`;
    }

    return `^XA
^PW800
^LL600
^FO30,20^GB740,560,3^FS
^FO50,35^A0N,30,30^FDAJL FERRO E ACO - ${setorLabel}^FS
^FO50,75^A0N,55,55^FD${codigo}^FS
^FO50,140^GB700,2,2^FS
^FO50,155^A0N,22,22^FDDIMENSAO: ${dim} | CHAPA: ${chapaReal} mm^FS
^FO50,185^A0N,22,22^FD${isCorteDobra ? "CHAPA UTIL:" : "COR:"} ${isCorteDobra ? chapaUtilizada : corBobina} | QUAL: ${qualidade}^FS
^FO50,215^A0N,22,22^FDFORNECEDOR: ${fornecedor.slice(0, 26)}^FS
^FO50,245^A0N,24,24^FDNF: ${nfOrigem} | PESO ATUAL: ${pesoAtual}^FS
^FO50,285^GB700,2,2^FS
^FO50,305^BQN,2,6^FDQA,https://fabricas.base44.app/bobina-qr/${bobina?.id || codigo}^FS
^FO250,320^A0N,24,24^FDBOBINA RASTREADA POR QR^FS
^FO250,355^A0N,20,20^FDLote: ${codigo} | NF: ${nfOrigem}^FS
^FO250,390^A0N,20,20^FDEmissao: ${hoje}^FS
^FO50,520^GB700,2,2^FS
^FO50,535^A0N,16,16^FDAJL FERRO E ACO - ELGIN L42PRO^FS
^XZ`;
  };

  const handleCopyZpl = () => {
    const code = gerarZpl();
    navigator.clipboard.writeText(code);
    setCopiedZpl(true);
    toast.success("Código ZPL copiado! Compatível com Elgin L42PRO e Zebra.");
    setTimeout(() => setCopiedZpl(false), 2500);
  };

  const handleDownloadZpl = () => {
    const zpl = gerarZpl();
    const blob = new Blob([zpl], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Etiqueta_${codigo}_${tamanho}.zpl`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Arquivo .ZPL baixado para envio direto!");
  };

  // Gerar PDF direto (100% à prova de bloqueador de pop-ups e driver do navegador)
  const handleDownloadPdf = async () => {
    const el = printRef.current;
    if (!el) return;
    setDownloadingPdf(true);
    toast.info("Gerando PDF em alta definição para a Elgin...");

    try {
      const canvas = await html2canvas(el, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdfW = 100;
      const pdfH = tamanho === "100x150" ? 150 : tamanho === "100x75" ? 75 : 50;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [pdfW, pdfH]
      });

      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`Etiqueta_${codigo}_${tamanho}.pdf`);
      toast.success("PDF baixado! Você pode abrir e imprimir na Elgin.");
    } catch (err) {
      console.error("Erro ao gerar PDF da etiqueta:", err);
      toast.error("Erro ao gerar PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Impressão Robusta: Tenta via Iframe Invisível primeiro (zero bloqueador de popup), com fallback para Janela Nova
  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;

    const pageW = "100mm";
    const pageH = tamanho === "100x150" ? "150mm" : tamanho === "100x75" ? "75mm" : "50mm";
    const wrapperH = tamanho === "100x150" ? "144mm" : tamanho === "100x75" ? "71mm" : "46mm";

    const fullHtml = `
      <!DOCTYPE html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>Etiqueta ${codigo} - Elgin L42PRO</title>
          <style>
            @page {
              size: ${pageW} ${pageH};
              margin: 0mm !important;
            }
            * {
              box-sizing: border-box !important;
              margin: 0;
              padding: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body {
              width: ${pageW} !important;
              height: ${pageH} !important;
              margin: 0 !important;
              padding: 0 !important;
              background: #fff !important;
              color: #000 !important;
              font-family: Arial, Helvetica, sans-serif !important;
              display: flex !important;
              flex-direction: column !important;
              align-items: center !important;
              justify-content: flex-start !important;
            }
            .etq-print-wrapper {
              width: 96mm !important;
              height: ${wrapperH} !important;
              margin: 2mm auto 0 auto !important;
              box-sizing: border-box !important;
              display: flex !important;
              flex-direction: column !important;
            }
          </style>
        </head>
        <body>
          <div class="etq-print-wrapper">
            ${el.innerHTML}
          </div>
        </body>
      </html>
    `;

    toast.info("Enviando para a impressora...");

    // Tentativa 1: Iframe invisível (mais confiável em navegadores modernos)
    try {
      let iframe = document.getElementById("elgin-print-iframe");
      if (iframe) iframe.remove();

      iframe = document.createElement("iframe");
      iframe.id = "elgin-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.top = "-9999px";
      iframe.style.left = "-9999px";
      iframe.style.width = "100mm";
      iframe.style.height = pageH;
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(fullHtml);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (e) {
          console.warn("Iframe print blocked, falling back to window.open", e);
          fallbackWindowPrint(fullHtml);
        }
      }, 350);
    } catch (err) {
      console.warn("Erro ao criar iframe:", err);
      fallbackWindowPrint(fullHtml);
    }
  };

  const fallbackWindowPrint = (html) => {
    const janela = window.open("", "_blank", "width=850,height=750");
    if (!janela) {
      toast.error("O navegador bloqueou a janela. Baixe o PDF pelo botão ao lado!");
      return;
    }
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
    janela.focus();
    setTimeout(() => {
      try {
        janela.print();
      } catch (e) {
        console.error(e);
      }
    }, 450);
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[96vh] flex flex-col overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header Modal */}
        <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold">
              🏷️
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight flex items-center gap-2">
                Etiqueta Industrial da Bobina
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-mono font-bold">
                  {codigo}
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">
                Otimizada para Elgin L42PRO Full, Zebra e impressoras térmicas
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Barra de Seleção de Tamanho */}
        <div className="px-5 py-2.5 bg-muted/40 border-b border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
              <Maximize2 className="w-3.5 h-3.5" /> Rolo:
            </span>
            <div className="inline-flex rounded-lg border border-border bg-background p-0.5">
              <button
                type="button"
                onClick={() => handleMudarTamanho("100x150")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${
                  tamanho === "100x150"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                100 × 150 mm
                <span className="text-[10px] opacity-80 font-normal">(Sua Elgin)</span>
              </button>
              <button
                type="button"
                onClick={() => handleMudarTamanho("100x75")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  tamanho === "100x75"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                100 × 75 mm
              </button>
              <button
                type="button"
                onClick={() => handleMudarTamanho("100x50")}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                  tamanho === "100x50"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                100 × 50 mm
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowDiagnostico(!showDiagnostico)}
              className="h-7 text-xs gap-1.5 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              Não imprimiu? Diagnóstico
              {showDiagnostico ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowGuiaElgin(!showGuiaElgin)}
              className="h-7 text-xs gap-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40"
            >
              <Settings className="w-3.5 h-3.5" />
              Configurar Elgin
              {showGuiaElgin ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* Diagnóstico Rápido: Se a impressora não responder fisicamente */}
        {showDiagnostico && (
          <div className="px-5 py-3 bg-amber-50/90 dark:bg-amber-950/40 border-b border-amber-300 dark:border-amber-900 text-xs text-amber-950 dark:text-amber-100 space-y-2 shrink-0 animate-in fade-in-50">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-300">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Checklist de 1 minuto: O que fazer se a Elgin não puxar a etiqueta:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div className="bg-background p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 space-y-1">
                <strong className="text-amber-800 dark:text-amber-300 block">1. Fila de impressão travada:</strong>
                <p className="text-muted-foreground leading-relaxed">
                  Se a etiqueta anterior deu erro, ela fica presa na fila do Windows. Aperte <kbd className="bg-muted px-1 rounded">Win+R</kbd>, digite <code className="font-bold">control printers</code>, abra a <strong>ELGIN L42PRO</strong> e clique em <em>"Cancelar todos os documentos"</em>.
                </p>
              </div>
              <div className="bg-background p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 space-y-1">
                <strong className="text-amber-800 dark:text-amber-300 block">2. Luz do LED da Elgin:</strong>
                <p className="text-muted-foreground leading-relaxed">
                  Se o LED estiver <strong>Vermelho piscando</strong>, a impressora travou no sensor. Feche bem a tampa e <strong>segure o botão FEED por 3 segundos</strong> até ela calibrar o papel e a luz ficar <strong>Verde fixa</strong>.
                </p>
              </div>
              <div className="bg-background p-2.5 rounded-lg border border-amber-200 dark:border-amber-800 space-y-1">
                <strong className="text-amber-800 dark:text-amber-300 block">3. Baixar em PDF (Alternativa 100%):</strong>
                <p className="text-muted-foreground leading-relaxed">
                  Clique no botão <strong>"Baixar PDF"</strong> no rodapé. Você pode abrir o PDF no Adobe Acrobat ou Edge e mandar imprimir direto na Elgin sem depender de pop-up.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Guia Rápido Elgin (Acordeão) */}
        {showGuiaElgin && (
          <div className="px-5 py-3 bg-blue-50/80 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-900 text-xs text-blue-950 dark:text-blue-100 space-y-2 shrink-0 animate-in fade-in-50">
            <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
              <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Instruções para a etiqueta sair perfeita na ELGIN L42PRO:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="bg-background/80 p-2.5 rounded-lg border border-blue-200/60 dark:border-blue-800/40 space-y-1">
                <strong className="text-blue-700 dark:text-blue-300 block">1. Na janela de impressão do Chrome:</strong>
                <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                  <li>Destino: <strong>ELGIN L42PRO FULL</strong></li>
                  <li>Clique em <strong>Mais definições</strong></li>
                  <li>Margens: selecione <strong>Nenhuma</strong> <span className="text-red-600 dark:text-red-400 font-bold">(OBRIGATÓRIO)</span></li>
                  <li>Cabeçalhos e rodapés: <strong>DESMARCADO</strong></li>
                  <li>Escala: <strong>100%</strong> ou <strong>Ajustar à área imprimível</strong></li>
                </ul>
              </div>
              <div className="bg-background/80 p-2.5 rounded-lg border border-blue-200/60 dark:border-blue-800/40 space-y-1">
                <strong className="text-blue-700 dark:text-blue-300 block">2. No Driver da Elgin (Windows):</strong>
                <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                  <li>Painel de Controle → Impressoras → Elgin L42PRO</li>
                  <li>Preferências de Impressão → <strong>Configurar Página</strong></li>
                  <li>Defina Largura: <strong>100 mm</strong> / Altura: <strong>150 mm</strong></li>
                  <li>Aba Estoque / Mídia: <strong>Etiqueta com Espaçamento (Gap)</strong></li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Área Visual da Etiqueta (Preview) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex justify-center bg-slate-100/70 dark:bg-slate-900/50">
          <div
            ref={printRef}
            className="bg-white text-black shadow-xl rounded-sm transition-all duration-200 overflow-hidden"
            style={{
              width: "380px",
              height: tamanho === "100x150" ? "570px" : tamanho === "100x75" ? "285px" : "190px",
              border: "3px solid #000",
              display: "flex",
              flexDirection: "column",
              boxSizing: "border-box",
              fontFamily: "Arial, Helvetica, sans-serif"
            }}
          >
            {/* ============================================================ */}
            {/* FORMATO 100x150 mm (TAMANHO INDUSTRIAL - ROLO DA ELGIN) */}
            {/* ============================================================ */}
            {tamanho === "100x150" ? (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "6px" }}>
                {/* Cabeçalho */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{
                      width: "36px", height: "36px", background: "#000", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: "20px", borderRadius: "4px"
                    }}>
                      A
                    </div>
                    <div>
                      <div style={{ fontSize: "16px", fontWeight: 900, letterSpacing: "1px", lineHeight: 1.1 }}>
                        AJL FERRO &amp; AÇO
                      </div>
                      <div style={{ fontSize: "8.5px", fontWeight: 700, color: "#444", letterSpacing: "0.5px" }}>
                        SISTEMA DE RASTREABILIDADE
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "8px", color: "#666", fontWeight: 600 }}>ENTRADA EM</div>
                    <div style={{ fontSize: "11px", fontWeight: 800 }}>{dataExib}</div>
                  </div>
                </div>

                {/* Bloco Gigante do Código da Bobina */}
                <div style={{
                  margin: "8px 0 6px 0",
                  background: "#000",
                  color: "#fff",
                  padding: "8px 10px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between"
                }}>
                  <div>
                    <div style={{ fontSize: "9px", letterSpacing: "1px", opacity: 0.85, fontWeight: 700 }}>
                      CÓDIGO DA BOBINA
                    </div>
                    <div style={{ fontSize: "38px", fontWeight: 900, lineHeight: 1, letterSpacing: "-1px" }}>
                      {codigo}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", opacity: 0.85, fontWeight: 700 }}>SUB. CÓD.</div>
                    <div style={{ fontSize: "16px", fontWeight: 900 }}>{subCod}</div>
                    <div style={{ fontSize: "9px", fontWeight: 800, background: "#fff", color: "#000", padding: "1px 6px", borderRadius: "2px", marginTop: "2px" }}>
                      {qualidade}
                    </div>
                  </div>
                </div>

                {/* Grid Técnico Industrial */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", border: "1.5px solid #000", borderRadius: "3px", overflow: "hidden" }}>
                  {/* Linha 1: Dimensões + Chapa Real */}
                  <div style={{ display: "flex", borderBottom: "1.5px solid #000" }}>
                    <div style={{ flex: 1, padding: "5px 8px", borderRight: "1.5px solid #000" }}>
                      <div style={{ fontSize: "8.5px", fontWeight: 700, color: "#555" }}>DIMENSÕES / LARGURA</div>
                      <div style={{ fontSize: "17px", fontWeight: 900, color: "#000" }}>{dim}</div>
                    </div>
                    <div style={{ flex: 1, padding: "5px 8px" }}>
                      <div style={{ fontSize: "8.5px", fontWeight: 700, color: "#555" }}>CHAPA REAL (ESPESSURA)</div>
                      <div style={{ fontSize: "17px", fontWeight: 900, color: "#000" }}>{chapaReal} mm</div>
                    </div>
                  </div>

                  {/* Linha 2: Cor / Chapa Utilizada + Qualidade */}
                  <div style={{ display: "flex", borderBottom: "1.5px solid #000" }}>
                    <div style={{ flex: 1, padding: "5px 8px", borderRight: "1.5px solid #000" }}>
                      <div style={{ fontSize: "8.5px", fontWeight: 700, color: "#555" }}>
                        {isCorteDobra ? "CHAPA UTILIZADA" : "COR DA BOBINA"}
                      </div>
                      <div style={{ fontSize: "15px", fontWeight: 900, color: "#000" }}>
                        {isCorteDobra ? chapaUtilizada : corBobina}
                      </div>
                    </div>
                    <div style={{ flex: 1, padding: "5px 8px" }}>
                      <div style={{ fontSize: "8.5px", fontWeight: 700, color: "#555" }}>QUALIDADE / MATÉRIA-PRIMA</div>
                      <div style={{ fontSize: "15px", fontWeight: 900, color: "#000" }}>{qualidade}</div>
                    </div>
                  </div>

                  {/* Linha 3: Fornecedor + NF Origem */}
                  <div style={{ display: "flex", borderBottom: "1.5px solid #000" }}>
                    <div style={{ flex: 1.3, padding: "5px 8px", borderRight: "1.5px solid #000", overflow: "hidden" }}>
                      <div style={{ fontSize: "8.5px", fontWeight: 700, color: "#555" }}>FORNECEDOR / USINA</div>
                      <div style={{ fontSize: "13px", fontWeight: 900, color: "#000", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {fornecedor}
                      </div>
                    </div>
                    <div style={{ flex: 0.9, padding: "5px 8px" }}>
                      <div style={{ fontSize: "8.5px", fontWeight: 700, color: "#555" }}>NF DE ORIGEM</div>
                      <div style={{ fontSize: "15px", fontWeight: 900, color: "#000" }}>{nfOrigem}</div>
                    </div>
                  </div>

                  {/* Linha 4: Pesos (Destaque Principal de Chão de Fábrica) */}
                  <div style={{ display: "flex", background: "#f8f8f8" }}>
                    <div style={{ flex: 1, padding: "6px 8px", borderRight: "1.5px solid #000" }}>
                      <div style={{ fontSize: "8.5px", fontWeight: 700, color: "#555" }}>PESO BRUTO (INICIAL)</div>
                      <div style={{ fontSize: "16px", fontWeight: 900, color: "#000" }}>{pesoBruto}</div>
                    </div>
                    <div style={{ flex: 1.2, padding: "6px 8px", background: "#f0f0f0" }}>
                      <div style={{ fontSize: "8.5px", fontWeight: 800, color: "#000" }}>PESO LÍQUIDO (ESTOQUE)</div>
                      <div style={{ fontSize: "20px", fontWeight: 900, color: "#000" }}>{pesoAtual}</div>
                    </div>
                  </div>
                </div>

                {/* Bloco Inferior: QR Code de Rastreamento + Metadados */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px", padding: "6px", border: "1.5px solid #000", borderRadius: "3px" }}>
                  <div style={{ width: "90px", height: "90px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {qrUrl ? (
                      <img src={qrUrl} alt="QR Code" style={{ width: "86px", height: "86px", display: "block" }} />
                    ) : (
                      <div style={{ fontSize: "9px", textAlign: "center" }}>Carregando QR...</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "12px", fontWeight: 900, color: "#000" }}>
                      RASTREABILIDADE DIGITAL
                    </div>
                    <div style={{ fontSize: "8.5px", color: "#444", marginTop: "2px", lineHeight: 1.3 }}>
                      Bipe com a câmera do celular ou leitor 2D para consultar histórico, OPs vinculadas e consumo desta bobina.
                    </div>
                    <div style={{ marginTop: "4px", fontSize: "9px", fontWeight: 800, color: "#000" }}>
                      SETOR: {setorLabel}
                    </div>
                  </div>
                </div>

                {/* Rodapé da Etiqueta */}
                <div style={{ marginTop: "auto", paddingTop: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "8px", color: "#666", fontWeight: 600 }}>
                  <span>AJL FERRO &amp; AÇO — SISTEMA DE FÁBRICAS</span>
                  <span>Emissão: {hoje} {horaAtual}</span>
                </div>
              </div>
            ) : tamanho === "100x75" ? (
              /* ============================================================ */
              /* FORMATO 100x75 mm (COMPACTO MÉDIO) */
              /* ============================================================ */
              <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "5px" }}>
                {/* Header compacto */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1.5px solid #000", paddingBottom: "3px" }}>
                  <div style={{ fontSize: "28px", fontWeight: 900, color: "#000", lineHeight: 1 }}>
                    {codigo}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", fontWeight: 900 }}>AJL FERRO &amp; AÇO</div>
                    <div style={{ fontSize: "8px", color: "#555" }}>{qualidade} | {dataExib}</div>
                  </div>
                </div>

                {/* Grid 100x75 */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", marginTop: "4px", border: "1px solid #000" }}>
                  <div style={{ display: "flex", borderBottom: "1px solid #000", flex: 1 }}>
                    <div style={{ flex: 1, padding: "2px 5px", borderRight: "1px solid #000", background: "#f8f8f8" }}>
                      <span style={{ fontSize: "7.5px", fontWeight: 700, color: "#555" }}>DIMENSÕES: </span>
                      <strong style={{ fontSize: "12px" }}>{dim}</strong>
                    </div>
                    <div style={{ flex: 1, padding: "2px 5px" }}>
                      <span style={{ fontSize: "7.5px", fontWeight: 700, color: "#555" }}>CHAPA: </span>
                      <strong style={{ fontSize: "12px" }}>{chapaReal} mm</strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", borderBottom: "1px solid #000", flex: 1 }}>
                    <div style={{ flex: 1, padding: "2px 5px", borderRight: "1px solid #000" }}>
                      <span style={{ fontSize: "7.5px", fontWeight: 700, color: "#555" }}>COR/UTIL: </span>
                      <strong style={{ fontSize: "11px" }}>{isCorteDobra ? chapaUtilizada : corBobina}</strong>
                    </div>
                    <div style={{ flex: 1, padding: "2px 5px" }}>
                      <span style={{ fontSize: "7.5px", fontWeight: 700, color: "#555" }}>NF ORIGEM: </span>
                      <strong style={{ fontSize: "12px" }}>{nfOrigem}</strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", borderBottom: "1px solid #000", flex: 1 }}>
                    <div style={{ flex: 1, padding: "2px 5px" }}>
                      <span style={{ fontSize: "7.5px", fontWeight: 700, color: "#555" }}>FORNECEDOR: </span>
                      <strong style={{ fontSize: "11px" }}>{fornecedor}</strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", background: "#f0f0f0", flex: 1.2, alignItems: "center" }}>
                    <div style={{ flex: 1, padding: "3px 5px", borderRight: "1px solid #000" }}>
                      <span style={{ fontSize: "7.5px", fontWeight: 700 }}>PESO BRUTO: </span>
                      <strong style={{ fontSize: "12px" }}>{pesoBruto}</strong>
                    </div>
                    <div style={{ flex: 1, padding: "3px 5px" }}>
                      <span style={{ fontSize: "7.5px", fontWeight: 800 }}>PESO LÍQUIDO: </span>
                      <strong style={{ fontSize: "14px" }}>{pesoAtual}</strong>
                    </div>
                  </div>
                </div>

                {/* QR mini */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "4px" }}>
                  <div style={{ fontSize: "7.5px", color: "#555" }}>
                    Rastreabilidade Digital AJL — {setorLabel}
                  </div>
                  {qrUrl && <img src={qrUrl} alt="QR" style={{ width: "32px", height: "32px" }} />}
                </div>
              </div>
            ) : (
              /* ============================================================ */
              /* FORMATO 100x50 mm (ULTRA COMPACTO) */
              /* ============================================================ */
              <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1.5px solid #000" }}>
                  <div style={{ fontSize: "24px", fontWeight: 900 }}>{codigo}</div>
                  <div style={{ fontSize: "12px", fontWeight: 900 }}>AJL FERRO &amp; AÇO</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", fontSize: "9px", marginTop: "3px" }}>
                  <div>Largura: <strong>{dim}</strong></div>
                  <div>Chapa: <strong>{chapaReal} mm</strong></div>
                  <div>Cor: <strong>{isCorteDobra ? chapaUtilizada : corBobina}</strong></div>
                  <div>NF: <strong>{nfOrigem}</strong></div>
                </div>
                <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", background: "#000", color: "#fff", padding: "2px 6px", borderRadius: "2px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 700 }}>PESO ATUAL:</span>
                  <strong style={{ fontSize: "12px" }}>{pesoAtual}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé com Ações */}
        <div className="p-4 border-t border-border bg-card flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyZpl}
              className="gap-1.5 text-xs font-semibold"
              title="Copiar código ZPL para BarTender ou utilitário da Elgin"
            >
              {copiedZpl ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600 font-bold">ZPL Copiado!</span>
                </>
              ) : (
                <>
                  <FileCode className="w-3.5 h-3.5 text-amber-600" />
                  <span>Copiar ZPL</span>
                </>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownloadZpl}
              className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              title="Baixar arquivo .ZPL para envio direto à impressora"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar .ZPL</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="gap-1.5 text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
              title="Baixar em arquivo PDF (alternativa infalível)"
            >
              {downloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Gerando PDF...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  <span>Baixar PDF ({tamanho})</span>
                </>
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={onClose}>
              Fechar
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="gap-2 bg-primary text-primary-foreground font-bold hover:opacity-90 shadow-md"
            >
              <Printer className="w-4 h-4" />
              Imprimir na Elgin ({tamanho})
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}