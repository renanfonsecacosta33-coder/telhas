import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { parseRotaImage } from "@/lib/rotaParser";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Truck,
  Loader2,
  ScanLine,
  Eye,
  Factory,
  Layers,
  PackageCheck,
  Save,
  Calendar,
  User,
  DollarSign,
  FileText,
  MapPin,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import UploadButton from "@/components/ui/UploadButton";
import ImageViewer from "@/components/ui/ImageViewer";

export default function NovaCargaDialog({ open, onClose, filialAtiva }) {
  const [rotaImagemUrl, setRotaImagemUrl] = useState("");
  const [rotaImagemNome, setRotaImagemNome] = useState("");
  const [uploadingRota, setUploadingRota] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);

  const [obs, setObs] = useState("");
  const [motorista, setMotorista] = useState("");
  const [placa, setPlaca] = useState("");

  const [saving, setSaving] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");

  const cameraRotaRef = useRef(null);
  const fileRotaRef = useRef(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setRotaImagemUrl("");
        setRotaImagemNome("");
        setParsed(null);
        setObs("");
        setMotorista("");
        setPlaca("");
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  const handleRotaFile = async (file) => {
    if (!file) return;
    setUploadingRota(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setRotaImagemUrl(file_url);
      setRotaImagemNome(file.name);
      await parseRota(file_url);
    } catch (e) {
      toast.error("Erro ao enviar imagem: " + (e?.message || ""));
    } finally {
      setUploadingRota(false);
    }
  };

  const parseRota = async (imageUrl) => {
    setParsing(true);
    setParsed(null);
    try {
      const parsedData = await parseRotaImage(imageUrl, filialAtiva);
      setParsed(parsedData);
      if (parsedData.motorista_nome) setMotorista(parsedData.motorista_nome);
      if (parsedData.placa) setPlaca(parsedData.placa.toUpperCase());
      if (parsedData.nota_geral && !obs) setObs(parsedData.nota_geral);
      toast.success(`${parsedData.itens?.length || 0} pedidos lidos da imagem pela IA!`);
    } catch (e) {
      toast.error("Erro ao ler imagem com IA: " + (e?.message || ""));
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!rotaImagemUrl) {
      toast.error("Anexe a imagem da rota de entrega.");
      return;
    }
    if (!parsed) {
      toast.error("Aguarde a leitura da imagem pela IA.");
      return;
    }
    setSaving(true);
    try {
      const unidade = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"].includes(filialAtiva)
        ? filialAtiva
        : "Matriz AJL";

      await base44.entities.RotaEntrega.create({
        titulo: parsed.titulo || "Rota de Entrega",
        rota_imagem_url: rotaImagemUrl,
        rota_imagem_nome: rotaImagemNome,
        entrega_date: parsed.entrega_date || "",
        embarque_date: parsed.embarque_date || "",
        total_valor: parsed.total_valor || "",
        nota_geral: parsed.nota_geral || "",
        itens_json: JSON.stringify(parsed.itens || []),
        observacao: obs,
        motorista_nome: motorista,
        placa: placa,
        status: "distribuido",
        unidade,
        data_criacao: format(new Date(), "yyyy-MM-dd"),
      });

      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      toast.success("Rota distribuída para todos os barracões!");

      base44.functions
        .invoke("notificarNovaRota", {
          titulo: parsed.titulo || "Rota de Entrega",
          unidade,
          motorista: motorista,
          placa: placa,
          itens_count: parsed.itens?.length || 0,
          entrega_date: parsed.entrega_date || "",
        })
        .catch(() => {});

      onClose();
    } catch (e) {
      toast.error("Erro ao salvar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const totalPedidos = parsed?.itens?.length || 0;
  const countTelhas = parsed?.itens?.filter((i) => i.barracao_sugerido === "telhas").length || 0;
  const countCorteDobra = parsed?.itens?.filter((i) => i.barracao_sugerido === "corte_dobra").length || 0;
  const countAmbos = parsed?.itens?.filter((i) => i.barracao_sugerido === "ambos").length || 0;
  const countAguardando = parsed?.itens?.filter((i) => !i.barracao_sugerido || i.barracao_sugerido === "aguardando").length || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl w-[96vw] lg:w-[92vw] max-h-[94vh] flex flex-col p-6 overflow-hidden sm:rounded-2xl shadow-2xl border-border bg-background">
        <DialogHeader className="pb-3 border-b border-border flex-none">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                  Nova Carga — Rota de Entrega
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Importação inteligente do manifesto de rota via IA para distribuição automática aos barracões.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs py-1 px-2.5 bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-800 font-medium text-slate-700 dark:text-slate-300">
                Unidade: <span className="font-bold ml-1 text-primary">{filialAtiva || "Matriz AJL"}</span>
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Área de rolagem principal com respiro */}
        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* Seção 1: Upload / Arquivo Anexado */}
          <div className="rounded-xl border border-border bg-slate-50/70 dark:bg-slate-900/40 p-4 transition-all">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <ScanLine className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    1. Imagem do Manifesto da Rota de Entrega
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Tire uma foto ou anexe o documento. A inteligência artificial identificará cada pedido, cliente e barracão.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <UploadButton
                  label={rotaImagemUrl ? "Trocar Imagem" : "Anexar Imagem da Rota"}
                  cameraRef={cameraRotaRef}
                  fileRef={fileRotaRef}
                  uploading={uploadingRota}
                  className="shadow-sm font-medium"
                />

                {rotaImagemUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-10 gap-1.5 font-medium border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    onClick={() => {
                      setViewerUrl(rotaImagemUrl);
                      setViewerName(rotaImagemNome || "Manifesto de Rota");
                    }}
                  >
                    <Eye className="w-4 h-4 text-primary" /> Visualizar Imagem
                  </Button>
                )}
              </div>
            </div>

            {rotaImagemUrl && !parsing && (
              <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Arquivo carregado: <strong className="font-semibold text-foreground">{rotaImagemNome || "manifesto.jpg"}</strong>
                </span>
                <span className="text-muted-foreground font-normal">Pronto para conferência</span>
              </div>
            )}
          </div>

          {/* Loading IA */}
          {parsing && (
            <div className="flex items-center gap-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 rounded-xl p-5 shadow-xs animate-pulse">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
                <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-blue-500" /> IA Processando e Lendo Manifesto...
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400">
                  Identificando automaticamente a rota, motorista, placa, pedidos, bairros e distribuindo por barracão.
                </p>
              </div>
            </div>
          )}

          {/* Resultado do parsing */}
          {parsed && !parsing && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-xs">
              {/* Cabeçalho da Rota com KPIs */}
              <div className="space-y-3 pb-4 border-b border-border">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      Manifesto Identificado
                    </span>
                    <h3 className="text-lg font-bold text-foreground">
                      {parsed.titulo || "Rota de Entrega"}
                    </h3>
                  </div>

                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1 shadow-xs">
                    {totalPedidos} {totalPedidos === 1 ? "Pedido Identificado" : "Pedidos Identificados"}
                  </Badge>
                </div>

                {/* Grid de KPIs da Rota */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-border/80">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-blue-500" /> Data de Entrega
                    </span>
                    <p className="text-sm font-bold text-foreground">
                      {parsed.entrega_date || "—"}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-border/80">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" /> Embarque
                    </span>
                    <p className="text-sm font-bold text-foreground">
                      {parsed.embarque_date || "—"}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-border/80">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-500" /> Valor Total
                    </span>
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                      {parsed.total_valor || "—"}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-border/80">
                    <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 mb-1">
                      <User className="w-3.5 h-3.5 text-purple-500" /> Motorista
                    </span>
                    <p className="text-sm font-bold text-foreground truncate" title={motorista || parsed.motorista_nome || "—"}>
                      {motorista || parsed.motorista_nome || "—"}
                    </p>
                  </div>
                </div>

                {/* Badges de Investigação nos Barracões */}
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <span className="text-xs font-semibold text-muted-foreground mr-1">
                    Destino nos Barracões:
                  </span>
                  <Badge className="text-xs py-1 px-2.5 bg-blue-100 hover:bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-200 font-semibold gap-1.5">
                    <Factory className="w-3.5 h-3.5 text-blue-600" /> Telhas: {countTelhas}
                  </Badge>
                  <Badge className="text-xs py-1 px-2.5 bg-orange-100 hover:bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200 border-orange-200 font-semibold gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-orange-600" /> Corte & Dobra: {countCorteDobra}
                  </Badge>
                  <Badge className="text-xs py-1 px-2.5 bg-purple-100 hover:bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border-purple-200 font-semibold gap-1.5">
                    <PackageCheck className="w-3.5 h-3.5 text-purple-600" /> Ambos os Barracões: {countAmbos}
                  </Badge>
                  {countAguardando > 0 && (
                    <Badge variant="outline" className="text-xs py-1 px-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 font-semibold gap-1.5">
                      ⏳ Aguardando Entrada: {countAguardando}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Tabela Ampla e Confortável de Pedidos */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground px-1">
                  <span>Itens e Pedidos Identificados na Rota ({totalPedidos}):</span>
                  <span className="text-[11px] font-normal text-muted-foreground">Rolagem vertical disponível</span>
                </div>

                <div className="rounded-xl border border-border overflow-hidden bg-background shadow-xs max-h-[380px] lg:max-h-[440px] overflow-y-auto overflow-x-auto">
                  <table className="w-full text-xs min-w-[850px] border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-900/90 text-slate-700 dark:text-slate-300 sticky top-0 z-10 border-b border-border shadow-xs">
                      <tr>
                        <th className="text-center p-2.5 font-bold w-12">#</th>
                        <th className="text-left p-2.5 font-bold w-36">Pedido (Odoo)</th>
                        <th className="text-left p-2.5 font-bold min-w-[200px]">Cliente / Vendedor</th>
                        <th className="text-left p-2.5 font-bold w-36">Barracão</th>
                        <th className="text-left p-2.5 font-bold min-w-[240px]">Observações da Rota</th>
                        <th className="text-left p-2.5 font-bold w-32">Bairro</th>
                        <th className="text-right p-2.5 font-bold w-28 pr-4">Valor</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {parsed.itens?.map((it, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
                        >
                          <td className="p-2.5 text-center font-bold text-muted-foreground">
                            <span className="inline-block w-6 h-6 leading-6 text-center rounded-full bg-slate-100 dark:bg-slate-800 text-[11px]">
                              {it.ordem || idx + 1}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <Badge className="text-xs bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 font-mono font-bold px-2.5 py-1">
                              #{it.numero_pedido}
                            </Badge>
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-foreground text-xs leading-snug">
                              {it.cliente}
                            </div>
                            {(it.vendedor || it.pagamento) && (
                              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {it.vendedor && <span>Vend: <strong className="font-medium text-slate-600 dark:text-slate-300">{it.vendedor}</strong></span>}
                                {it.vendedor && it.pagamento && <span>•</span>}
                                {it.pagamento && <span>Pg: <strong className="font-medium text-slate-600 dark:text-slate-300">{it.pagamento}</strong></span>}
                              </div>
                            )}
                          </td>
                          <td className="p-2.5">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border shadow-2xs ${
                                it.barracao_sugerido === "telhas"
                                  ? "bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950 dark:text-blue-200"
                                  : it.barracao_sugerido === "corte_dobra"
                                  ? "bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-950 dark:text-orange-200"
                                  : it.barracao_sugerido === "ambos"
                                  ? "bg-purple-100 text-purple-900 border-purple-300 dark:bg-purple-950 dark:text-purple-200"
                                  : "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                              }`}
                            >
                              {it.barracao_sugerido === "telhas" && "🏠 Telhas"}
                              {it.barracao_sugerido === "corte_dobra" && "🏗️ Corte & Dobra"}
                              {it.barracao_sugerido === "ambos" && "📦 Ambos"}
                              {(!it.barracao_sugerido || it.barracao_sugerido === "aguardando") && "⏳ Aguardando"}
                            </span>
                          </td>
                          <td className="p-2.5">
                            {it.observacao ? (
                              <div className="inline-flex items-start gap-1.5 font-semibold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md p-1.5 text-[11px] leading-tight">
                                <span className="flex-none">📌</span>
                                <span>{it.observacao}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-foreground text-xs">
                            <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                              <MapPin className="w-3 h-3 text-muted-foreground flex-none" />
                              {it.bairro || "—"}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-foreground text-xs pr-4 tabular-nums">
                            {it.valor || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {parsed.nota_geral && (
                <div className="flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/80 rounded-xl p-3 shadow-2xs">
                  <span className="text-base leading-none">📝</span>
                  <div>
                    <strong className="font-bold">Nota Geral do Manifesto:</strong> {parsed.nota_geral}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dados Finais: Motorista, Placa e Observações em Grid Amplo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div className="space-y-3 md:col-span-1 rounded-xl border border-border bg-slate-50/60 dark:bg-slate-900/40 p-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-primary" /> Transporte & Veículo
              </h5>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Motorista</Label>
                <Input
                  placeholder="Nome do Motorista"
                  value={motorista}
                  onChange={(e) => setMotorista(e.target.value)}
                  className="bg-background h-10 font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Placa do Veículo</Label>
                <Input
                  placeholder="Ex: ABC-1234"
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value.toUpperCase())}
                  className="bg-background h-10 font-mono font-bold tracking-wider"
                />
              </div>
            </div>

            <div className="space-y-1.5 md:col-span-2 rounded-xl border border-border bg-slate-50/60 dark:bg-slate-900/40 p-4 flex flex-col justify-between">
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-2">
                  <FileText className="w-4 h-4 text-primary" /> Instruções & Observações Gerais
                </h5>
                <Textarea
                  placeholder="Instruções de carregamento, horários, prioridades de entrega ou detalhes para a expedição..."
                  value={obs}
                  onChange={(e) => setObs(e.target.value)}
                  rows={4}
                  className="bg-background resize-none text-xs font-medium"
                />
              </div>
              <p className="text-[11px] text-muted-foreground pt-1">
                Essas observações serão visíveis para os encarregados da Fábrica de Telhas, Corte & Dobra e Expedição.
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé Fixo */}
        <DialogFooter className="pt-3 border-t border-border flex items-center justify-between gap-3 flex-none">
          <Button variant="outline" onClick={onClose} disabled={saving} className="px-5 font-medium">
            Cancelar
          </Button>

          <Button
            onClick={handleSave}
            disabled={saving || !parsed || parsing}
            className="gap-2 px-6 font-bold bg-green-600 hover:bg-green-700 text-white shadow-md cursor-pointer"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Distribuindo Carga...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Distribuir para os Barracões
                <ArrowRight className="w-4 h-4 ml-1 opacity-70" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>

      <input
        ref={cameraRotaRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleRotaFile(e.target.files?.[0])}
      />
      <input
        ref={fileRotaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleRotaFile(e.target.files?.[0])}
      />
      <ImageViewer
        url={viewerUrl}
        name={viewerName}
        open={!!viewerUrl}
        onClose={() => setViewerUrl(null)}
      />
    </Dialog>
  );
}
