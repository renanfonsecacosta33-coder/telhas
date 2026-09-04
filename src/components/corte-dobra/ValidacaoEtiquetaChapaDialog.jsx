import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Camera, Loader2, CheckCircle2, XCircle, ScanLine, AlertTriangle,
  RefreshCw, FileText, Scissors, ShieldAlert
} from "lucide-react";
import UploadButton from "@/components/ui/UploadButton";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import ImageLink from "@/components/ui/ImageLink";
import { isPdfUrl } from "@/lib/imagemBase64";

export default function ValidacaoEtiquetaChapaDialog({ open, onClose, ordem, onAprovado, isGestor = false }) {
  const [fotoUrl, setFotoUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [validando, setValidando] = useState(false);
  const [resultado, setResultado] = useState(null); // { valido, motivo, codigo_lido, espessura_lida }
  const [chapaDetalhes, setChapaDetalhes] = useState(null);
  const fotoInputRef = useRef();
  const fotoScanRef = useRef();

  useEffect(() => {
    if (open) {
      setFotoUrl(null);
      setResultado(null);
      setValidando(false);
      setUploading(false);
      setChapaDetalhes(null);

      // Se houver vínculo com chapa_cd_id, carrega detalhes adicionais da ChapaCD
      if (ordem?.chapa_cd_id) {
        base44.entities.ChapaCD.get(ordem.chapa_cd_id)
          .then((chapa) => setChapaDetalhes(chapa))
          .catch(() => setChapaDetalhes(null));
      }
    }
  }, [open, ordem?.id, ordem?.chapa_cd_id]);

  const chapaCodigo = chapaDetalhes?.codigo || (ordem?.chapa_descricao?.match(/CH\d+/i)?.[0]) || "";
  const chapaDescricao = ordem?.chapa_descricao || chapaDetalhes?.bobina_descricao || ordem?.tipo_peca || "Chapa de Aço";
  const dimensoes = ordem?.dimensoes_livres || (chapaDetalhes?.comprimento_mm ? `${chapaDetalhes.comprimento_mm}mm × ${chapaDetalhes.largura_mm || ""}mm` : "");
  const espessura = ordem?.material_espessura || chapaDetalhes?.espessura_mm || "";
  const pedido = ordem?.numero_pedido ? `#${ordem.numero_pedido}` : "—";
  const cliente = ordem?.cliente || "—";
  const maquina = ordem?.maquina || "Guilhotina";

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
      const prompt = `Você é um inspetor de qualidade e validador de etiquetas de chapas de aço em uma guilhotina industrial de corte e dobra.
Analise a foto enviada da ETIQUETA DA CHAPA (ou do fardo/pacote de chapas) e verifique se ela corresponde à chapa esperada para ser cortada nesta ordem de produção da guilhotina.

DADOS DA CHAPA ESPERADA PARA O CORTE:
- Máquina: ${maquina}
- Código da Chapa (se houver): ${chapaCodigo || "Não especificado"}
- Descrição da Chapa / Material: ${chapaDescricao}
- Dimensões / Especificações: ${dimensoes || "Não informadas"}
- Espessura esperada: ${espessura || "Não informada"}
- Peça a produzir: ${ordem?.tipo_peca || "—"}
- Pedido: ${pedido}
- Cliente: ${cliente}

INSTRUÇÕES DE VALIDAÇÃO:
1. Procure e leia na etiqueta: código da chapa (ex: CH0001, CH0012, etc.), código da bobina de origem (ex: TE0001, CD0024, etc.), espessura em mm, tipo de aço (GV, Galvalume, FF, PP, FQ, Xadrez), dimensões ou pedido.
2. Compare a espessura e material da etiqueta com os dados da chapa esperada.
   - Pequenas variações de escrita de espessura (ex: "1,25", "1.25", "#18") são perfeitamente normais e devem ser aceitas.
   - Se o código da chapa bater ou se a descrição técnica (espessura + tipo de aço) for compatível com a ordem, considere VÁLIDO.
3. Se a foto comprovar que se trata da chapa/fardo correto para o trabalho, marque valido = true.
4. Se a etiqueta for de um material totalmente incompatível (ex: espessura ou material diferente do esperado), marque valido = false explicando o motivo.
5. Se a foto for ilegível, cortada, ou não contiver etiqueta, marque valido = false e oriente o operador a aproximar a câmera.

Responda em formato JSON com:
- valido: boolean
- motivo: resumo da validação (máx 120 caracteres)
- codigo_lido: código lido na etiqueta (se encontrado)
- espessura_lida: espessura lida na etiqueta (se encontrada)`;

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        file_urls: [url],
        response_json_schema: {
          type: "object",
          properties: {
            valido: { type: "boolean" },
            motivo: { type: "string" },
            codigo_lido: { type: "string" },
            espessura_lida: { type: "string" }
          },
          required: ["valido", "motivo"]
        }
      });

      setResultado(res);
      setValidando(false);

      if (res.valido) {
        toast.success("✅ Etiqueta da chapa validada com sucesso! Iniciando guilhotina...");
        setTimeout(() => {
          onAprovado(url, res.motivo || "Etiqueta da chapa validada via IA", "aprovado");
        }, 1100);
      } else {
        toast.error(
          `🚫 ETIQUETA NÃO VALIDADA: ${res.motivo || "Chapa divergente da ordem"}\nVerifique a chapa posicionada na guilhotina.`,
          { duration: 9000 }
        );
      }
    } catch (err) {
      setValidando(false);
      setResultado({
        valido: false,
        motivo: "Erro no processamento da imagem: " + (err.message || "Tente novamente")
      });
      toast.error("Falha ao analisar foto da etiqueta. Tente tirar uma foto mais nítida.", { duration: 8000 });
    }
  };

  const tentarNovamente = () => {
    setFotoUrl(null);
    setResultado(null);
  };

  const handleAprovarManualmente = () => {
    if (!fotoUrl) {
      toast.warning("Tire uma foto da etiqueta da chapa antes de aprovar.");
      return;
    }
    toast.success("Aprovado manualmente pelo Gestor!");
    onAprovado(fotoUrl, "Aprovado manualmente por gestor/supervisor", "aprovado_manual");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !validando) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-700 dark:text-indigo-400">
            <Scissors className="w-5 h-5 text-indigo-600" />
            Foto da Etiqueta da Chapa — {maquina}
          </DialogTitle>
          <DialogDescription>
            Para iniciar o corte na guilhotina, tire uma foto da etiqueta de identificação da chapa.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-1">
          {/* Card com informações da Chapa Esperada */}
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <ScanLine className="w-3.5 h-3.5 text-indigo-600" />
                Chapa esperada na guilhotina:
              </span>
              {chapaCodigo && (
                <span className="font-mono font-black text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded text-[11px]">
                  {chapaCodigo}
                </span>
              )}
            </div>

            <p className="font-semibold text-foreground text-sm leading-tight">
              {chapaDescricao}
            </p>

            <div className="grid grid-cols-2 gap-x-2 gap-y-1 pt-1 text-[11px] text-muted-foreground border-t border-indigo-200/50 dark:border-indigo-800/50">
              {dimensoes && <div>Medidas: <strong className="text-foreground">{dimensoes}</strong></div>}
              {espessura && <div>Espessura: <strong className="text-foreground">{espessura}mm</strong></div>}
              {ordem?.numero_pedido && <div>Pedido: <strong className="text-foreground">#{ordem.numero_pedido}</strong></div>}
              {ordem?.cliente && <div>Cliente: <strong className="text-foreground">{ordem.cliente}</strong></div>}
              {ordem?.quantidade > 0 && <div>Qtd a cortar: <strong className="text-foreground">{ordem.quantidade} pçs</strong></div>}
            </div>
          </div>

          {/* Área de Visualização da Foto ou Upload */}
          {fotoUrl ? (
            <div className="relative rounded-xl overflow-hidden border-2 border-indigo-300 dark:border-indigo-700 bg-black/5">
              <ImageLink url={fotoUrl} name="Etiqueta da Chapa" className="block">
                {isPdfUrl(fotoUrl) ? (
                  <div className="w-full max-h-48 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-900 py-6 gap-2">
                    <FileText className="w-12 h-12 text-indigo-500" />
                    <span className="text-xs text-muted-foreground">Documento PDF anexado</span>
                  </div>
                ) : (
                  <img src={fotoUrl} alt="Etiqueta da Chapa" className="w-full max-h-52 object-contain bg-slate-950" />
                )}
              </ImageLink>

              {!validando && resultado && (
                <div className="absolute top-2 right-2">
                  {resultado.valido ? (
                    <div className="bg-green-600 text-white rounded-full p-1.5 shadow-lg animate-bounce">
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
            <div className="bg-slate-50 dark:bg-slate-900/50 border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-xl p-5 text-center space-y-3">
              {uploading ? (
                <Loader2 className="w-10 h-10 mx-auto text-indigo-600 animate-spin" />
              ) : (
                <div className="w-12 h-12 mx-auto rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
                  <Camera className="w-6 h-6" />
                </div>
              )}

              <div>
                <p className="font-bold text-sm text-foreground">
                  {uploading ? "Enviando foto da etiqueta..." : "Fotografar Etiqueta da Chapa"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {uploading
                    ? "Aguarde o processamento da imagem..."
                    : "Aponte a câmera para a etiqueta colada na chapa ou fardo de chapas"}
                </p>
              </div>

              {!uploading && (
                <div className="flex justify-center">
                  <input
                    ref={fotoInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                  />
                  <input
                    ref={fotoScanRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={(e) => handleUpload(e.target.files?.[0])}
                  />
                  <UploadButton
                    label="Tirar Foto da Etiqueta"
                    icon={Camera}
                    cameraRef={fotoInputRef}
                    fileRef={fotoScanRef}
                    uploading={uploading}
                    size="default"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                  />
                </div>
              )}
            </div>
          )}

          {/* Indicador de validação com IA */}
          {validando && (
            <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg p-3 flex items-center gap-2.5 text-xs text-indigo-800 dark:text-indigo-300">
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin flex-shrink-0" />
              <span className="font-medium">Validando etiqueta da chapa com IA do sistema...</span>
            </div>
          )}

          {/* Resultado da validação */}
          {resultado && !validando && (
            <div
              className={`rounded-xl p-3 border text-xs ${
                resultado.valido
                  ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-800 text-green-900 dark:text-green-200"
                  : "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-900 dark:text-red-200"
              }`}
            >
              <div className="flex items-start gap-2">
                {resultado.valido ? (
                  <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm">
                    {resultado.valido ? "Etiqueta da Chapa Validada!" : "Etiqueta Divergente ou Ilegível"}
                  </p>
                  <p className="mt-0.5 opacity-90">{resultado.motivo || "Sem detalhes"}</p>
                  {resultado.codigo_lido && (
                    <p className="mt-1 font-mono text-[11px] opacity-80">
                      Código lido: <strong>{resultado.codigo_lido}</strong>
                    </p>
                  )}
                  {!resultado.valido && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-semibold">
                      ⚠️ O início do corte está bloqueado até a confirmação da etiqueta correta.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-1.5 sm:justify-between">
          <div>
            {!resultado?.valido && !validando && isGestor && fotoUrl && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleAprovarManualmente}
                className="text-xs gap-1 border border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 hover:bg-amber-100"
                title="Aprovação de gestor para etiqueta manchada ou ilegível"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                Aprovar Manualmente (Gestor)
              </Button>
            )}
          </div>

          <div className="flex items-center gap-1.5 justify-end">
            {!resultado?.valido && !validando && (
              <>
                {fotoUrl && (
                  <Button variant="outline" size="sm" onClick={tentarNovamente} className="gap-1 text-xs">
                    <RefreshCw className="w-3.5 h-3.5" /> Tirar outra foto
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
                  Cancelar
                </Button>
              </>
            )}

            {resultado?.valido && (
              <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 font-bold py-1">
                <Loader2 className="w-4 h-4 animate-spin" /> Iniciando guilhotina...
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
