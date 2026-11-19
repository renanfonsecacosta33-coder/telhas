import React, { useState, useRef, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  ExternalLink,
  Download,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  X,
  FileUp
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'react-hot-toast';

export default function VisualizadorPdfModal({
  open,
  onOpenChange,
  pedido,
  pdfUrl: pdfUrlProp,
  numeroPedido: numeroPedidoProp,
  onPdfUploaded
}) {
  const [uploading, setUploading] = useState(false);
  const [urlAtual, setUrlAtual] = useState(null);
  const fileInputRef = useRef(null);

  // Determina número do pedido e cliente
  const numeroPedido = numeroPedidoProp || pedido?.numero_pedido || pedido?.numero || '';
  const clienteNome = pedido?.cliente_nome || pedido?.cliente || '';
  const ofsList = useMemo(() => {
    if (Array.isArray(pedido?.ofs)) return pedido.ofs;
    if (pedido?.id) return [pedido];
    return [];
  }, [pedido]);

  // Busca a URL do PDF (prop explícita > pedido > alguma OF do grupo > anexo em pdf)
  const pdfUrl = useMemo(() => {
    if (urlAtual) return urlAtual;
    if (pdfUrlProp) return pdfUrlProp;
    if (pedido?.pdf_pedido_url) return pedido.pdf_pedido_url;
    if (pedido?.pdf_url) return pedido.pdf_url;
    
    // Procura em OFs filhas caso seja um grupo
    const ofComPdf = ofsList.find(o => o?.pdf_pedido_url || o?.pdf_url);
    if (ofComPdf?.pdf_pedido_url) return ofComPdf.pdf_pedido_url;
    if (ofComPdf?.pdf_url) return ofComPdf.pdf_url;

    // Checa anexos que sejam explicitamente PDF
    const ehPdf = (u) => typeof u === 'string' && (u.toLowerCase().includes('.pdf') || u.toLowerCase().startsWith('data:application/pdf'));
    for (let i = 1; i <= 10; i++) {
      const anexo = pedido?.[`anexo_${i}_url`];
      if (ehPdf(anexo)) return anexo;
    }

    return '';
  }, [urlAtual, pdfUrlProp, pedido, ofsList]);

  const nomeArquivo = useMemo(() => {
    if (pedido?.pdf_pedido_nome) return pedido.pdf_pedido_nome;
    return numeroPedido ? `Pedido_${numeroPedido}.pdf` : 'Pedido.pdf';
  }, [pedido, numeroPedido]);

  // Handler de upload manual de PDF (caso o pedido tenha vindo sem PDF do Odoo)
  const handleSelecionarArquivo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Por favor selecione um arquivo no formato PDF.');
      return;
    }

    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (!res?.file_url) throw new Error('Falha ao obter URL do arquivo.');

      setUrlAtual(res.file_url);

      // Atualiza os registros de PedidoOdoo vinculados a este número de pedido
      if (numeroPedido) {
        try {
          const registros = await base44.entities.PedidoOdoo.filter({ numero_pedido: numeroPedido });
          for (const reg of registros) {
            await base44.entities.PedidoOdoo.update(reg.id, {
              pdf_pedido_url: res.file_url,
              pdf_pedido_nome: file.name
            });
          }
        } catch (dbErr) {
          console.warn('[VisualizadorPdfModal] Erro ao salvar pdf_pedido_url no PedidoOdoo:', dbErr);
        }
      }

      toast.success('PDF do pedido anexado com sucesso!');
      onPdfUploaded?.(res.file_url, file.name);
    } catch (err) {
      console.error('[VisualizadorPdfModal] Erro no upload:', err);
      toast.error('Erro ao enviar PDF: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[96vw] sm:max-w-5xl h-[92vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl">
        {/* Cabeçalho */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/90 dark:bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950/60 border border-red-200 dark:border-red-900 flex items-center justify-center shrink-0 text-red-600 dark:text-red-400 shadow-xs">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2 truncate">
                <span>PDF do Pedido #{numeroPedido || '—'}</span>
                {pdfUrl ? (
                  <Badge variant="outline" className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800 text-[10px] font-bold">
                    Disponível
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800 text-[10px] font-bold">
                    Pendente
                  </Badge>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {clienteNome ? `Cliente: ${clienteNome}` : 'Visualização da ordem oficial do Odoo ERP'}
                {ofsList.length > 0 && ` · ${ofsList.length} OF(s)`}
              </DialogDescription>
            </div>
          </div>

          {/* Ações do Topo */}
          <div className="flex items-center gap-1.5 shrink-0">
            {pdfUrl && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Abrir PDF em tela cheia numa nova aba"
                >
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="hidden sm:inline">Nova Aba</span>
                  </a>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  title="Baixar arquivo PDF para o computador"
                >
                  <a href={pdfUrl} download={nomeArquivo}>
                    <Download className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span className="hidden sm:inline">Baixar</span>
                  </a>
                </Button>
              </>
            )}

            {/* Input escondido para upload manual */}
            <input
              type="file"
              ref={fileInputRef}
              accept="application/pdf"
              className="hidden"
              onChange={handleSelecionarArquivo}
            />

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="h-8 gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              title={pdfUrl ? "Substituir PDF manualmente" : "Enviar PDF manualmente"}
            >
              {uploading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-orange-600" />
              ) : (
                <Upload className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
              )}
              <span className="hidden md:inline">{pdfUrl ? "Substituir" : "Anexar PDF"}</span>
            </Button>
          </div>
        </div>

        {/* Corpo do Modal: Visualizador ou Estado Vazio */}
        <div className="flex-1 min-h-0 bg-slate-100 dark:bg-slate-950 flex flex-col relative overflow-hidden">
          {pdfUrl ? (
            <div className="w-full h-full flex flex-col">
              <iframe
                src={`${pdfUrl}#toolbar=1&navpanes=0`}
                className="w-full flex-1 border-0"
                title={`PDF do Pedido #${numeroPedido}`}
              />
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="truncate">
                  📄 {nomeArquivo}
                </span>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 font-semibold hover:underline shrink-0 ml-2"
                >
                  Abrir diretamente caso não renderize no seu navegador
                </a>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-200 dark:border-amber-900 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-inner">
                <FileText className="w-10 h-10 stroke-[1.5]" />
              </div>
              <h4 className="text-lg font-extrabold text-slate-900 dark:text-slate-100 mb-1">
                Nenhum PDF disponível para o Pedido #{numeroPedido || '—'}
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
                O arquivo PDF ainda não foi enviado pelo Odoo ERP para este pedido. Você pode reenviar pelo botão de envio no Odoo ou fazer o upload do documento manualmente abaixo.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-bold gap-2 shadow-sm"
                >
                  {uploading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Enviando PDF...
                    </>
                  ) : (
                    <>
                      <FileUp className="w-4 h-4" />
                      Fazer Upload Manual do PDF
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
