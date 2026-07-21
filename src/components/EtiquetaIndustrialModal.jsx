import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Printer, QrCode, Download, Copy, Check, Tag, Factory, Scissors, Package, FileCode } from "lucide-react";
import { toast } from "sonner";

export default function EtiquetaIndustrialModal({ open, onOpenChange, data }) {
  const [copiedZpl, setCopiedZpl] = useState(false);
  const printRef = useRef();

  if (!data) return null;

  // Tipos de etiqueta: "amarrado_telha", "bobina_master", "fita_slitter", "retalho_cd"
  const tipo = data.tipo || "amarrado_telha";
  const cliente = data.cliente || "CLIENTE PADRÃO";
  const opNumero = data.opNumero || "#1042";
  const modelo = data.modelo || "TP-40 GALVALUME 0.43mm";
  const dimensao = data.dimensao || "6.00 metros";
  const quantidade = data.quantidade || "20 Peças";
  const pesoTotal = data.pesoTotal || "243.0 kg";
  const usina = data.usina || "CSN SIDERÚRGICA";
  const codigoEtiqueta = data.codigoEtiqueta || `AJL-${Math.floor(100000 + Math.random() * 900000)}`;
  const dataEmissao = new Date().toLocaleDateString("pt-BR") + " " + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Código ZPL (Zebra Programming Language) para Impressoras Térmicas de Chão de Fábrica (Argox / Zebra / Datamax)
  const zplCode = `^XA
^FO50,30^GB700,400,3^FS
^FO70,50^A0N,35,35^FDAJL FERRO E ACO - ETIQUETA INDUSTRIAL^FS
^FO70,95^A0N,25,25^FDCLIENTE: ${cliente}^FS
^FO70,130^A0N,25,25^FDOP / LOTE: ${opNumero} | ETIQUETA: ${codigoEtiqueta}^FS
^FO70,165^A0N,25,25^FDMATERIAL: ${modelo}^FS
^FO70,200^A0N,25,25^FDDIMENSAO: ${dimensao} | QTD: ${quantidade}^FS
^FO70,235^A0N,30,30^FDPESO BRUTO: ${pesoTotal}^FS
^FO70,275^A0N,20,20^FDUSINA: ${usina} | EMISSAO: ${dataEmissao}^FS
^FO520,100^BQN,2,6^FDQA,https://ajl.base44.app/valida/${codigoEtiqueta}^FS
^XZ`;

  const handleCopyZpl = () => {
    navigator.clipboard.writeText(zplCode);
    setCopiedZpl(true);
    toast.success("Código ZPL copiado para a área de transferência!");
    setTimeout(() => setCopiedZpl(false), 2000);
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Impressão de Etiqueta Industrial AJL - ${codigoEtiqueta}</title>
          <style>
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; background: white; color: black; }
            .label-box { width: 100mm; height: 75mm; border: 3px solid black; padding: 12px; box-sizing: border-box; position: relative; border-radius: 6px; }
            .header { font-size: 16px; font-weight: bold; text-align: center; border-bottom: 2px solid black; padding-bottom: 6px; margin-bottom: 8px; text-transform: uppercase; }
            .field { font-size: 12px; margin-bottom: 4px; }
            .field-title { font-size: 10px; color: #555; text-transform: uppercase; font-weight: bold; }
            .field-value { font-size: 13px; font-weight: bold; }
            .grid-2 { display: flex; justify-content: space-between; gap: 10px; }
            .footer { position: absolute; bottom: 8px; left: 12px; right: 12px; font-size: 9px; color: #444; border-top: 1px dashed black; pt: 4px; display: flex; justify-content: space-between; }
            .qr-placeholder { position: absolute; top: 50px; right: 15px; width: 70px; height: 70px; background: #eee; border: 1px solid #000; display: flex; align-items: center; justify-content: center; font-size: 9px; text-align: center; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="label-box">
            <div class="header">AJL FERRO & AÇO — RASTREABILIDADE</div>
            <div class="qr-placeholder">QR CODE<br/>${codigoEtiqueta}</div>
            
            <div class="field">
              <div class="field-title">Cliente / Destinatário</div>
              <div class="field-value">${cliente}</div>
            </div>

            <div class="grid-2">
              <div class="field">
                <div class="field-title">Nº OP / Lote</div>
                <div class="field-value">${opNumero}</div>
              </div>
              <div class="field">
                <div class="field-title">Cód. Etiqueta</div>
                <div class="field-value">${codigoEtiqueta}</div>
              </div>
            </div>

            <div class="field">
              <div class="field-title">Especificação do Produto</div>
              <div class="field-value">${modelo}</div>
            </div>

            <div class="grid-2">
              <div class="field">
                <div class="field-title">Medida / Dimensão</div>
                <div class="field-value">${dimensao}</div>
              </div>
              <div class="field">
                <div class="field-title">Quantidade</div>
                <div class="field-value">${quantidade}</div>
              </div>
            </div>

            <div class="field" style="margin-top: 4px;">
              <div class="field-title">Peso Bruto Verificado em Balança</div>
              <div class="field-value" style="font-size: 16px; color: #000;">${pesoTotal}</div>
            </div>

            <div class="footer">
              <span>Usina: ${usina}</span>
              <span>Emissão: ${dataEmissao}</span>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg bg-slate-950 text-slate-100 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-white">
            <Tag className="w-5 h-5 text-amber-400" />
            <span>Gerador de Etiqueta Industrial Siderúrgica</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-400">
            Etiqueta com código QR para rastro de lote em impressoras térmicas (Zebra ZPL / Argox)
          </DialogDescription>
        </DialogHeader>

        {/* Visualização da Etiqueta Industrial */}
        <div 
          ref={printRef}
          className="bg-white text-black p-5 rounded-2xl border-4 border-slate-900 shadow-2xl relative space-y-3 font-sans select-none"
        >
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-black text-white rounded-lg flex items-center justify-center font-bold text-xs">
                AJL
              </div>
              <span className="font-black text-sm tracking-wider uppercase">AJL FERRO & AÇO — MES</span>
            </div>
            <Badge className="bg-black text-white text-[10px] font-mono">{codigoEtiqueta}</Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 items-start">
            <div className="col-span-2 space-y-2">
              <div>
                <span className="text-[10px] font-bold text-slate-600 block uppercase">Cliente</span>
                <span className="text-sm font-black text-slate-950">{cliente}</span>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block uppercase">Nº OP / Lote</span>
                  <span className="text-xs font-black text-slate-950">{opNumero}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-600 block uppercase">Usina Materia-Prima</span>
                  <span className="text-xs font-bold text-slate-800">{usina}</span>
                </div>
              </div>
            </div>

            {/* QR Code Simulado com Borda */}
            <div className="flex flex-col items-center justify-center p-2 bg-slate-100 border border-slate-300 rounded-xl">
              <QrCode className="w-12 h-12 text-slate-950" />
              <span className="text-[9px] font-mono font-bold mt-1 text-slate-700">ESCANEIE</span>
            </div>
          </div>

          <div className="bg-slate-100 p-2.5 rounded-xl border border-slate-300 space-y-1">
            <span className="text-[10px] font-bold text-slate-600 block uppercase">Especificação do Material</span>
            <span className="text-xs font-black text-slate-950 block">{modelo}</span>
            <div className="flex justify-between items-center text-xs font-bold text-slate-800 pt-1">
              <span>Medida: {dimensao}</span>
              <span>Qtd: {quantidade}</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div>
              <span className="text-[10px] font-bold text-slate-600 block uppercase">Peso Verificado Balança</span>
              <span className="text-lg font-black text-slate-950">{pesoTotal}</span>
            </div>
            <div className="text-right">
              <span className="text-[9px] text-slate-500 block">Data de Emissão</span>
              <span className="text-[10px] font-bold text-slate-700">{dataEmissao}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2">
          <Button 
            variant="outline" 
            onClick={handleCopyZpl} 
            className="border-slate-800 hover:bg-slate-900 text-slate-300 gap-2 text-xs"
          >
            {copiedZpl ? <Check className="w-4 h-4 text-emerald-400" /> : <FileCode className="w-4 h-4 text-amber-400" />}
            <span>{copiedZpl ? "ZPL Copiado!" : "Copiar Código ZPL"}</span>
          </Button>

          <Button 
            onClick={handlePrint} 
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-2 text-xs shadow-md"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Etiqueta Térmica</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
