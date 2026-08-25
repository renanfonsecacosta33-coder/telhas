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
import { Truck, Loader2, ScanLine, Eye, Factory, Layers, PackageCheck, Save } from "lucide-react";
import { toast } from "sonner";
import UploadButton from "@/components/ui/UploadButton";
import ImageViewer from "@/components/ui/ImageViewer";

const DEP_LABEL = { telhas: "Telhas", corte_dobra: "Corte e Dobra", expedicao: "Expedição" };
const DEP_COLOR = {
  telhas: "bg-blue-100 text-blue-700 border-blue-200",
  corte_dobra: "bg-orange-100 text-orange-700 border-orange-200",
  expedicao: "bg-purple-100 text-purple-700 border-purple-200",
};

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
        setRotaImagemUrl(""); setRotaImagemNome(""); setParsed(null); setObs("");
        setMotorista(""); setPlaca("");
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
      const parsed = await parseRotaImage(imageUrl);
      setParsed(parsed);
      if (parsed.motorista_nome) setMotorista(parsed.motorista_nome);
      if (parsed.placa) setPlaca(parsed.placa.toUpperCase());
      toast.success(`${parsed.itens?.length || 0} pedidos lidos da imagem pela IA!`);
    } catch (e) {
      toast.error("Erro ao ler imagem com IA: " + (e?.message || ""));
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    if (!rotaImagemUrl) { toast.error("Anexe a imagem da rota de entrega."); return; }
    if (!parsed) { toast.error("Aguarde a leitura da imagem pela IA."); return; }
    setSaving(true);
    try {
      const unidade = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"].includes(filialAtiva)
        ? filialAtiva : "Matriz AJL";
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
      onClose();
    } catch (e) {
      toast.error("Erro ao salvar: " + (e?.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const depCount = (dep) => (parsed?.itens || []).filter((i) => (i.departamentos || []).includes(dep)).length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-primary" /> Nova Carga — Rota de Entrega
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Passo 1: Anexar imagem da rota */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <ScanLine className="w-4 h-4 text-primary" /> 1. Anexar imagem da Rota de Entrega
            </Label>
            <p className="text-xs text-muted-foreground">
              Anexe a foto do manifesto de rota. A IA vai ler todos os pedidos automaticamente.
            </p>
            <div className="flex gap-2">
              <UploadButton
                label={rotaImagemUrl ? "Trocar imagem" : "Anexar imagem da rota"}
                cameraRef={cameraRotaRef}
                fileRef={fileRotaRef}
                uploading={uploadingRota}
                className="flex-none"
              />
              {rotaImagemUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 gap-1.5"
                  onClick={() => { setViewerUrl(rotaImagemUrl); setViewerName(rotaImagemNome); }}
                >
                  <Eye className="w-4 h-4" /> Ver imagem
                </Button>
              )}
            </div>
            {rotaImagemUrl && !parsing && (
              <p className="text-xs text-emerald-600 font-medium">✓ Imagem anexada: {rotaImagemNome}</p>
            )}
          </div>

          {/* Loading IA */}
          {parsing && (
            <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
              <div>
                <p className="text-sm font-semibold text-blue-700">IA lendo a imagem...</p>
                <p className="text-xs text-blue-600">Extraindo pedidos, clientes e valores da rota de entrega.</p>
              </div>
            </div>
          )}

          {/* Resultado do parsing */}
          {parsed && !parsing && (
            <div className="space-y-3 border border-border rounded-lg p-4 bg-muted/30">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <p className="font-bold text-sm">{parsed.titulo || "Rota de Entrega"}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    {parsed.entrega_date && <span>📅 Entrega: <b>{parsed.entrega_date}</b></span>}
                    {parsed.embarque_date && <span>🚚 Embarque: <b>{parsed.embarque_date}</b></span>}
                    {parsed.total_valor && <span>💰 Total: <b>{parsed.total_valor}</b></span>}
                  </div>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                  {parsed.itens?.length || 0} pedidos
                </Badge>
              </div>

              {/* Separação por departamento */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-muted-foreground">Separado por:</span>
                {["telhas", "corte_dobra", "expedicao"].map((d) => (
                  <Badge key={d} className={`text-[10px] ${DEP_COLOR[d]}`}>
                    {d === "telhas" && <Factory className="w-3 h-3 mr-0.5" />}
                    {d === "corte_dobra" && <Layers className="w-3 h-3 mr-0.5" />}
                    {d === "expedicao" && <PackageCheck className="w-3 h-3 mr-0.5" />}
                    {DEP_LABEL[d]}: {depCount(d)}
                  </Badge>
                ))}
              </div>

              {/* Tabela de pedidos */}
              <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="text-left p-1.5 font-semibold">#</th>
                      <th className="text-left p-1.5 font-semibold">Pedido</th>
                      <th className="text-left p-1.5 font-semibold">Cliente</th>
                      <th className="text-left p-1.5 font-semibold">Bairro</th>
                      <th className="text-left p-1.5 font-semibold">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.itens?.map((it, idx) => (
                      <tr key={idx} className="border-t border-border">
                        <td className="p-1.5 text-muted-foreground">{it.ordem}</td>
                        <td className="p-1.5 font-semibold">{it.numero_pedido}</td>
                        <td className="p-1.5 truncate max-w-[120px]">{it.cliente}</td>
                        <td className="p-1.5 truncate max-w-[90px]">{it.bairro}</td>
                        <td className="p-1.5 font-medium">{it.valor}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsed.nota_geral && (
                <p className="text-xs text-muted-foreground italic">📝 {parsed.nota_geral}</p>
              )}
            </div>
          )}

          {/* OBS */}
          <div className="space-y-1">
            <Label className="text-sm font-semibold">OBS — Observações</Label>
            <Textarea
              placeholder="Observações gerais da carga, rota, prioridades..."
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={2}
            />
          </div>

          {/* Motorista / Placa */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Motorista <span className="text-muted-foreground font-normal">(auto da imagem)</span></Label>
              <Input placeholder="Nome" value={motorista} onChange={(e) => setMotorista(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Placa <span className="text-muted-foreground font-normal">(auto da imagem)</span></Label>
              <Input placeholder="ABC-1234" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} />
            </div>
          </div>

        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || !parsed || parsing} className="gap-1.5">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Distribuir para os Barracões
          </Button>
        </DialogFooter>
      </DialogContent>

      <input ref={cameraRotaRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={(e) => handleRotaFile(e.target.files?.[0])} />
      <input ref={fileRotaRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => handleRotaFile(e.target.files?.[0])} />
      <ImageViewer url={viewerUrl} name={viewerName} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
    </Dialog>
  );
}