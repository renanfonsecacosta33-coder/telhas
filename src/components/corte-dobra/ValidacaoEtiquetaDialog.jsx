import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, CheckCircle2, XCircle, ScanLine, AlertTriangle, RefreshCw, FileText } from "lucide-react";
import UploadButton from "@/components/ui/UploadButton";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ImageLink from "@/components/ui/ImageLink";

export default function ValidacaoEtiquetaDialog({ open, onClose, ordem, onAprovado }) {
  const [fotoUrl, setFotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState(null); // { valido, motivo, codigo_lido }
  const fotoInputRef = useRef();
  const fotoScanRef = useRef();

  useEffect(() => {
    if (open) {
      setFotoUrl(null);
      setResultado(null);
      setValidando(false);
      setUploading(false);
    }
  }, [open, ordem?.id]);

  const bobinaInfo = ordem
    ? `Descrição: ${ordem.bobina_descricao || "—"}\nEspessura(s) utilizável(is): ${ordem.espessura_utilizada || "—"}\nComprimento de corte: ${ordem.comprimento_mm || "—"}mm`
    : "";

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    setResultado(null);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoUrl(file_url);
      setUploading(false);
      await validarEtiqueta(file_url);
    } catch (err) {
      setUploading(false);
      toast.error("Erro ao enviar foto: " + (err.message || "tente novamente"));
    }
  };

  const validarEtiqueta = async (url) => {
    setValidando(true);
    try {
      const prompt = `Você é um validador de etiquetas de bobinas de aço em uma fábrica de corte e dobra.
Analise a foto enviada da etiqueta/QR code da bobina e verifique se ela corresponde à bobina esperada para esta ordem de produção.

BOBINA ESPERADA:
${bobinaInfo}

IMPORTANTE SOBRE ESPESSURA:
O campo "Espessura(s) utilizável(is)" pode conter MÚLTIPLAS espessuras separadas por barra (ex: "2,70 / 3,00").
Isso significa que a bobina fisicamente tem uma espessura (ex: 3,00mm) mas PODE SER UTILIZADA para produção de peças que exigem 2,70mm.
Portanto, se a espessura lida na etiqueta for QUALQUER UMA das espessuras utilizáveis listadas, considere VÁLIDO.
NÃO rejeite apenas porque a espessura lida (ex: 3,00) é diferente da esperada (ex: 2,70) — verifique se a espessura lida está entre as utilizáveis.

Instruções:
1. Tente ler o código da bobina na etiqueta (ex: TE0001, CD0026, etc.)
2. Leia a espessura visível na etiqueta e verifique se ela está entre as espessuras utilizáveis listadas
3. Se a espessura lida for uma das utilizáveis (mesmo que não seja a primeira), considere VÁLIDO
4. Verifique se a cor/RVM visível corresponde (se houver essa informação na etiqueta)
5. Se não conseguir ler nada, considere rejeitado
6. Só rejeite se a espessura lida NÃO estiver entre as utilizáveis, ou se o código for claramente diferente

Responda em JSON com:
- valido: true se a etiqueta corresponde à bobina esperada, false caso contrário
- motivo: explicação breve do que encontrou (máx 120 caracteres)
- codigo_lido: o código da bobina lido na etiqueta (se houver)`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [url],
        response_json_schema: {
          type: "object",
          properties: {
            valido: { type: "boolean" },
            motivo: { type: "string" },
            codigo_lido: { type: "string" }
          }
        }
      });

      setResultado(res);
      setValidando(false);

      if (res.valido) {
        toast.success("✅ Etiqueta validada! Iniciando produção...");
        setTimeout(() => {
          onAprovado(url, res.motivo || "");
        }, 1200);
      } else {
        toast.error(
          `🚫 ETIQUETA REJEITADA — Bobina incorreta!\nMotivo: ${res.motivo || "Não correspondente"}\nOperador: verifique a bobina na máquina.`,
          { duration: 10000 }
        );
      }
    } catch (err) {
      setValidando(false);
      setResultado({ valido: false, motivo: "Erro na validação: " + (err.message || "falha de conexão") });
      toast.error("Erro ao validar etiqueta. Tente novamente.", { duration: 8000 });
    }
  };

  const tentarNovamente = () => {
    setFotoUrl(null);
    setResultado(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !validando) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-orange-500" />
            Validação de Etiqueta da Bobina
          </DialogTitle>
          <DialogDescription>
            Tire uma foto da etiqueta da bobina para validar antes de iniciar a produção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info da bobina esperada */}
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs space-y-0.5">
            <p className="font-bold text-orange-800 mb-1">Bobina esperada:</p>
            <p className="text-orange-700 font-mono">{ordem?.bobina_descricao || "—"}</p>
            <p className="text-orange-600">Espessura: <strong>{ordem?.espessura_utilizada || "—"}mm</strong> · Corte: <strong>{ordem?.comprimento_mm || "—"}mm</strong></p>
          </div>

          {/* Foto enviada */}
          {fotoUrl ? (
            <div className="relative rounded-lg overflow-hidden border-2 border-orange-300">
              <ImageLink url={fotoUrl} name="Etiqueta da Bobina" className="block">
                {fotoUrl.toLowerCase().endsWith(".pdf") ? (
                  <div className="w-full max-h-48 flex flex-col items-center justify-center bg-slate-100 py-6 gap-2">
                    <FileText className="w-12 h-12 text-orange-500" />
                    <span className="text-xs text-muted-foreground">Documento PDF</span>
                  </div>
                ) : (
                  <img src={fotoUrl} alt="Etiqueta da bobina" className="w-full max-h-48 object-cover" />
                )}
              </ImageLink>
              {!validando && resultado && (
                <div className="absolute top-2 right-2">
                  {resultado.valido ? (
                    <div className="bg-green-600 text-white rounded-full p-1.5 shadow-lg">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="bg-red-600 text-white rounded-full p-1.5 shadow-lg">
                      <XCircle className="w-5 h-5" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-dashed border-border rounded-xl p-6 text-center space-y-3">
              {uploading ? (
                <Loader2 className="w-10 h-10 mx-auto text-orange-500 animate-spin" />
              ) : (
                <ScanLine className="w-10 h-10 mx-auto text-slate-400" />
              )}
              <div>
                <p className="font-semibold text-sm">{uploading ? "Enviando foto..." : "Foto da Etiqueta"}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {uploading ? "Aguarde..." : "Aponte para a etiqueta da bobina e tire a foto"}
                </p>
              </div>
              {!uploading && (
                <>
                  <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => handleUpload(e.target.files?.[0])} />
                  <input ref={fotoScanRef} type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={e => handleUpload(e.target.files?.[0])} />
                  <UploadButton label="Tirar / Selecionar Foto" icon={Camera} cameraRef={fotoInputRef} fileRef={fotoScanRef} uploading={uploading} size="default" />
                </>
              )}
            </div>
          )}

          {/* Validando */}
          {validando && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 text-sm">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
              <span className="text-blue-700 font-medium">Validando etiqueta com IA...</span>
            </div>
          )}

          {/* Resultado */}
          {resultado && !validando && (
            <div className={`rounded-lg p-3 border ${
              resultado.valido
                ? "bg-green-50 border-green-300"
                : "bg-red-50 border-red-300"
            }`}>
              <div className="flex items-start gap-2">
                {resultado.valido
                  ? <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  : <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                }
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${resultado.valido ? "text-green-800" : "text-red-800"}`}>
                    {resultado.valido ? "Etiqueta Validada!" : "Etiqueta Rejeitada!"}
                  </p>
                  <p className={`text-xs mt-0.5 ${resultado.valido ? "text-green-700" : "text-red-700"}`}>
                    {resultado.motivo || "Sem detalhes"}
                  </p>
                  {resultado.codigo_lido && (
                    <p className="text-[10px] text-muted-foreground mt-1">Código lido: <strong className="font-mono">{resultado.codigo_lido}</strong></p>
                  )}
                  {!resultado.valido && (
                    <p className="text-[11px] text-red-600 mt-1.5 font-medium">
                      ⚠️ A produção não pode ser iniciada. O encarregado foi notificado.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!resultado?.valido && !validando && (
            <>
              {fotoUrl && (
                <Button variant="outline" onClick={tentarNovamente} className="gap-1">
                  <RefreshCw className="w-3.5 h-3.5" /> Tirar outra foto
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            </>
          )}
          {resultado?.valido && (
            <div className="flex items-center gap-2 text-sm text-green-700 font-medium">
              <Loader2 className="w-4 h-4 animate-spin" /> Iniciando produção...
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}