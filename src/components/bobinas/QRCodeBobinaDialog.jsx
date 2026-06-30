import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Download } from "lucide-react";

export default function QRCodeBobinaDialog({ bobina, ordens = [], onClose }) {
  const [qrUrl, setQrUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const gerarQR = async () => {
      const linhas = [
        `BOBINA: ${bobina.codigo || "—"}`,
        `COR: ${bobina.cor || "—"}`,
        `QUALIDADE: ${bobina.qualidade || "—"}`,
        `CHAPA: ${bobina.chapa || "—"}`,
        `ESP. UTILIZADA: ${bobina.espessura_utilizada || "—"}`,
        `LARGURA: ${bobina.largura_mm || "—"} mm`,
        `PESO ATUAL: ${bobina.peso_kg?.toLocaleString("pt-BR") || "—"} kg`,
        `PESO INICIAL: ${bobina.peso_inicial?.toLocaleString("pt-BR") || "—"} kg`,
        `FORNECEDOR: ${bobina.fornecedor || "—"}`,
        `NF: ${bobina.nf || "—"}`,
        `DATA RECEBIMENTO: ${bobina.data_recebimento || "—"}`,
        ``,
        `=== PEDIDOS (${ordens.length}) ===`,
        ...ordens.map((o, i) =>
          `${i + 1}. [${o.data || "—"}] ${o._tipo || "—"} | ${o._label || "—"} | ${o._qtd || 0} pçs | ${o._kg || 0} kg | ${o.status} | ${o.cliente || ""} ${o.numero_pedido ? "Ped:" + o.numero_pedido : ""}`
        ),
      ];
      const conteudo = linhas.join("\n");
      try {
        const url = await QRCode.toDataURL(conteudo, { width: 400, margin: 2, errorCorrectionLevel: "M" });
        setQrUrl(url);
      } catch (e) {
        console.error("Erro ao gerar QR:", e);
      } finally {
        setLoading(false);
      }
    };
    gerarQR();
  }, [bobina, ordens]);

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="font-mono">{bobina.codigo || bobina.cor}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-3 py-2">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
              <Loader2 className="w-5 h-5 animate-spin" /> Gerando QR Code...
            </div>
          ) : qrUrl ? (
            <>
              <img src={qrUrl} alt="QR Code" className="w-56 h-56 border border-border rounded-lg" />
              <p className="text-xs text-muted-foreground text-center">
                Escaneie para ver todas as informações da bobina e seus {ordens.length} pedido(s).
              </p>
            </>
          ) : (
            <p className="text-sm text-destructive">Erro ao gerar QR Code.</p>
          )}
        </div>

        <DialogFooter>
          {qrUrl && (
            <a href={qrUrl} download={`QR_${bobina.codigo || "bobina"}.png`}>
              <Button variant="outline" className="gap-1.5">
                <Download className="w-4 h-4" /> Baixar PNG
              </Button>
            </a>
          )}
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}