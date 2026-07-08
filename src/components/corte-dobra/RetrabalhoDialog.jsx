import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, Loader2, Camera, X, AlertCircle, Package } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import ImageLink from "@/components/ui/ImageLink";

const ETAPA_CORES = [
  { border: "border-l-red-500", bg: "bg-red-50/40", badge: "bg-red-500", text: "text-red-700", label: "Etapa 1" },
  { border: "border-l-orange-500", bg: "bg-orange-50/40", badge: "bg-orange-500", text: "text-orange-700", label: "Etapa 2" },
  { border: "border-l-amber-500", bg: "bg-amber-50/40", badge: "bg-amber-500", text: "text-amber-700", label: "Etapa 3" },
  { border: "border-l-yellow-500", bg: "bg-yellow-50/40", badge: "bg-yellow-500", text: "text-yellow-700", label: "Etapa 4" },
  { border: "border-l-pink-500", bg: "bg-pink-50/40", badge: "bg-pink-500", text: "text-pink-700", label: "Etapa 5+" },
];

export function getEtapaColor(etapa) {
  const idx = Math.min((etapa || 1) - 1, ETAPA_CORES.length - 1);
  return ETAPA_CORES[idx];
}

export default function RetrabalhoDialog({ open, onClose, ordemOrigem, onCreate }) {
  const [motivo, setMotivo] = useState("");
  const [quantidadeRetrabalho, setQuantidadeRetrabalho] = useState(0);
  const [foto1, setFoto1] = useState(null);
  const [foto2, setFoto2] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bobinaOriginal, setBobinaOriginal] = useState(null);
  const [bobinaSubSel, setBobinaSubSel] = useState("");
  const [bobinasDisponiveis, setBobinasDisponiveis] = useState([]);
  const [loadingBobinas, setLoadingBobinas] = useState(false);

  const quantMax = ordemOrigem?.quantidade || 0;
  const bobinaZerada = bobinaOriginal && (bobinaOriginal.peso_kg || 0) <= 0;
  const isDesb = ordemOrigem && (!ordemOrigem.maquina || ordemOrigem._desb);
  const etapaAtual = (ordemOrigem?.retrabalho_etapa || 0) + 1;
  const etapaCor = getEtapaColor(etapaAtual);

  useEffect(() => {
    if (open && ordemOrigem) {
      setQuantidadeRetrabalho(ordemOrigem.quantidade || 0);
      setMotivo("");
      setFoto1(null);
      setFoto2(null);
      setBobinaSubSel("");
      setBobinaOriginal(null);

      // Verifica se a bobina original está zerada
      const bobinaId = ordemOrigem.bobina_id;
      if (bobinaId) {
        base44.entities.Bobina.get(bobinaId).then(b => {
          setBobinaOriginal(b);
          if ((b.peso_kg || 0) <= 0) {
            loadBobinasDisponiveis();
          }
        }).catch(() => {});
      }
    }
  }, [open, ordemOrigem]);

  const loadBobinasDisponiveis = async () => {
    if (!ordemOrigem) return;
    setLoadingBobinas(true);
    try {
      const todas = await base44.entities.Bobina.filter({
        setor: "corte_dobra",
        arquivada: false,
        unidade: ordemOrigem.unidade
      }, "-created_date", 200);
      // Filtra apenas bobinas com peso e mesma espessura se possível
      const disp = todas.filter(b => (b.peso_kg || 0) > 0);
      setBobinasDisponiveis(disp);
    } catch (e) {
      // silent
    } finally {
      setLoadingBobinas(false);
    }
  };

  const reset = () => {
    setMotivo("");
    setQuantidadeRetrabalho(0);
    setFoto1(null);
    setFoto2(null);
    setUploading(false);
    setSaving(false);
    setBobinaSubSel("");
    setBobinaOriginal(null);
    setBobinasDisponiveis([]);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file, slot) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (slot === 1) setFoto1(file_url);
      else setFoto2(file_url);
    } catch (err) {
      toast.error("Erro ao enviar imagem: " + (err.message || "tente novamente"));
    } finally {
      setUploading(false);
    }
  };

  const handleQuantidadeChange = (val) => {
    const n = parseInt(val, 10);
    if (isNaN(n) || n < 0) {
      setQuantidadeRetrabalho(0);
      return;
    }
    if (n > quantMax) {
      toast.error(`Quantidade não pode exceder ${quantMax} peças (quantidade original)`);
      setQuantidadeRetrabalho(quantMax);
      return;
    }
    setQuantidadeRetrabalho(n);
  };

  const handleSave = async () => {
    if (!motivo.trim()) {
      toast.error("Informe o motivo do retrabalho");
      return;
    }
    if (quantidadeRetrabalho <= 0) {
      toast.error("Informe a quantidade de peças a reproduzir");
      return;
    }
    if (bobinaZerada && !bobinaSubSel) {
      toast.error("A bobina original está zerada. Selecione uma bobina substituta.");
      return;
    }
    if (!ordemOrigem) return;

    setSaving(true);
    try {
      const today = format(new Date(), "yyyy-MM-dd");

      // Resolve bobina substituta
      let bobinaFinalId = ordemOrigem.bobina_id;
      let bobinaFinalDesc = ordemOrigem.bobina_descricao;
      let bobinaSubDesc = null;

      if (bobinaZerada && bobinaSubSel) {
        const bSub = bobinasDisponiveis.find(b => b.id === bobinaSubSel);
        if (bSub) {
          bobinaSubDesc = `${bSub.codigo || ""} — ${bSub.cor || ""} ${bSub.chapa || ""}mm`.trim();
          bobinaFinalId = bSub.id;
          bobinaFinalDesc = bobinaSubDesc;
        }
      }

      const copia = {
        data: today,
        status: "pendente",
        is_retrabalho: true,
        retrabalho_motivo: motivo.trim(),
        retrabalho_foto_1_url: foto1 || null,
        retrabalho_foto_2_url: foto2 || null,
        retrabalho_origem_id: ordemOrigem.id,
        retrabalho_quantidade: quantidadeRetrabalho,
        retrabalho_etapa: etapaAtual,
        numero_pedido: ordemOrigem.numero_pedido || null,
        cliente: ordemOrigem.cliente || null,
        quantidade: quantidadeRetrabalho,
        observacoes: `RETRABALHO (Etapa ${etapaAtual}) — Motivo: ${motivo.trim()}`,
        unidade: ordemOrigem.unidade,
      };

      if (bobinaSubDesc) {
        copia.retrabalho_bobina_sub_id = bobinaSubSel;
        copia.retrabalho_bobina_sub_descricao = bobinaSubDesc;
      }

      if (isDesb) {
        Object.assign(copia, {
          bobina_id: bobinaFinalId,
          bobina_descricao: bobinaFinalDesc,
          espessura_utilizada: ordemOrigem.espessura_utilizada,
          comprimento_mm: ordemOrigem.comprimento_mm,
          kg_estimado: ordemOrigem.kg_estimado ? (ordemOrigem.kg_estimado * quantidadeRetrabalho / (ordemOrigem.quantidade || 1)) : null,
          destino: ordemOrigem.destino || "estoque",
          guilhotina: ordemOrigem.guilhotina,
          tamanho_corte_guilhotina: ordemOrigem.tamanho_corte_guilhotina,
          foto_pedido_url: ordemOrigem.foto_pedido_url,
        });
        await base44.entities.OrdemDesbobinadeira.create(copia);
      } else {
        Object.assign(copia, {
          maquina: ordemOrigem.maquina,
          chapa_cd_id: ordemOrigem.chapa_cd_id,
          chapa_descricao: ordemOrigem.chapa_descricao,
          chapa_origem: ordemOrigem.chapa_origem || "chaparia",
          bobina_id: bobinaFinalId,
          bobina_descricao: bobinaFinalDesc,
          desenvolvimento_id: ordemOrigem.desenvolvimento_id,
          desenvolvimento_descricao: ordemOrigem.desenvolvimento_descricao,
          tipo_peca: ordemOrigem.tipo_peca,
          dimensoes_livres: ordemOrigem.dimensoes_livres,
          peso_kg: ordemOrigem.peso_kg ? (ordemOrigem.peso_kg * quantidadeRetrabalho / (ordemOrigem.quantidade || 1)) : null,
          foto_pedido_url: ordemOrigem.foto_pedido_url,
          ordem_dobra_maquina: ordemOrigem.ordem_dobra_maquina,
        });
        const novaOrdem = await base44.entities.OrdemMaquinaCD.create(copia);

        // Se for ordem de corte com dobra vinculada, cria OP de dobra em aguardando_corte
        if (ordemOrigem.ordem_dobra_maquina && novaOrdem?.id) {
          await base44.entities.OrdemMaquinaCD.create({
            data: today,
            maquina: ordemOrigem.ordem_dobra_maquina,
            chapa_origem: "direto",
            bobina_id: bobinaFinalId,
            bobina_descricao: bobinaFinalDesc,
            desenvolvimento_id: ordemOrigem.desenvolvimento_id,
            desenvolvimento_descricao: ordemOrigem.desenvolvimento_descricao,
            tipo_peca: ordemOrigem.tipo_peca,
            dimensoes_livres: ordemOrigem.dimensoes_livres,
            ordem_corte_id: novaOrdem.id,
            numero_pedido: ordemOrigem.numero_pedido || null,
            cliente: ordemOrigem.cliente || null,
            quantidade: quantidadeRetrabalho,
            peso_kg: ordemOrigem.peso_kg ? (ordemOrigem.peso_kg * quantidadeRetrabalho / (ordemOrigem.quantidade || 1)) : null,
            status: "aguardando_corte",
            foto_pedido_url: ordemOrigem.foto_pedido_url || null,
            observacoes: `RETRABALHO (Etapa ${etapaAtual}) — Dobra vinculada ao corte`,
            unidade: ordemOrigem.unidade,
            is_retrabalho: true,
            retrabalho_motivo: motivo.trim(),
            retrabalho_etapa: etapaAtual,
            retrabalho_origem_id: ordemOrigem.id,
          });
          toast.success(`Retrabalho gerado + OP de dobra vinculada (${ordemOrigem.ordem_dobra_maquina})`);
        }
      }

      toast.success("Retrabalho gerado com sucesso!");
      if (onCreate) onCreate();
      handleClose();
    } catch (err) {
      toast.error("Erro ao gerar retrabalho: " + (err.message || "tente novamente"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-5 h-5" />
            Gerar Retrabalho
            <span className={`ml-1 px-2 py-0.5 rounded text-xs font-bold text-white ${etapaCor.badge}`}>
              {etapaCor.label}
            </span>
          </DialogTitle>
          <DialogDescription>
            Crie uma nova ordem de retrabalho a partir da OP{" "}
            <strong className="text-foreground">
              {ordemOrigem?.tipo_peca || ordemOrigem?.bobina_descricao || "—"}
            </strong>
            {ordemOrigem?.numero_pedido && ` (Pedido: ${ordemOrigem.numero_pedido})`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quantidade a reproduzir */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Package className="w-3.5 h-3.5 text-red-500" />
              Quantidade de peças a reproduzir <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min={1}
              max={quantMax}
              value={quantidadeRetrabalho}
              onChange={(e) => handleQuantidadeChange(e.target.value)}
              className="border-red-200 focus-visible:ring-red-400"
            />
            <p className="text-xs text-muted-foreground">
              Quantidade original: <strong>{quantMax}</strong> peças · Máximo permitido: <strong>{quantMax}</strong>
            </p>
          </div>

          {/* Alerta de bobina zerada */}
          {bobinaZerada && (
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-red-50 border border-red-300 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-red-700">⚠️ Bobina original zerada!</p>
                  <p className="text-red-600 mt-0.5">
                    A bobina <strong>{bobinaOriginal?.codigo || ordemOrigem?.bobina_descricao}</strong> está sem peso disponível ({bobinaOriginal?.peso_kg || 0}kg).
                    Selecione uma bobina substituta para o operador utilizar.
                  </p>
                </div>
              </div>
              {loadingBobinas ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Carregando bobinas disponíveis...
                </div>
              ) : bobinasDisponiveis.length === 0 ? (
                <p className="text-xs text-red-600">Nenhuma bobina disponível em estoque.</p>
              ) : (
                <Select value={bobinaSubSel} onValueChange={setBobinaSubSel}>
                  <SelectTrigger className="border-red-200">
                    <SelectValue placeholder="Selecione a bobina substituta..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bobinasDisponiveis.map(b => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.codigo || "—"} · {b.cor || ""} · {b.chapa || ""}mm · {b.peso_kg?.toFixed(0)}kg
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* Motivo */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              Motivo do retrabalho <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo pelo qual este retrabalho precisa ser feito..."
              rows={4}
              className="resize-none"
            />
          </div>

          {/* Fotos */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1">
              <Camera className="w-3.5 h-3.5" />
              Fotos do retrabalho (até 2)
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {/* Foto 1 */}
              <div>
                {foto1 ? (
                  <div className="relative group">
                    <ImageLink url={foto1} name="Foto 1" className="block">
                      <img src={foto1} alt="Foto 1" className="w-full h-28 object-cover rounded-lg border-2 border-red-300" />
                    </ImageLink>
                    <button onClick={() => setFoto1(null)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-red-300 rounded-lg cursor-pointer hover:bg-red-50 transition-colors">
                    {uploading ? <Loader2 className="w-5 h-5 text-red-500 animate-spin" /> : <Camera className="w-5 h-5 text-red-400" />}
                    <span className="text-xs text-red-500 font-medium mt-1">Foto 1</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0], 1)} />
                  </label>
                )}
              </div>
              {/* Foto 2 */}
              <div>
                {foto2 ? (
                  <div className="relative group">
                    <ImageLink url={foto2} name="Foto 2" className="block">
                      <img src={foto2} alt="Foto 2" className="w-full h-28 object-cover rounded-lg border-2 border-red-300" />
                    </ImageLink>
                    <button onClick={() => setFoto2(null)}
                      className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 hover:bg-red-700 transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-red-300 rounded-lg cursor-pointer hover:bg-red-50 transition-colors">
                    {uploading ? <Loader2 className="w-5 h-5 text-red-500 animate-spin" /> : <Camera className="w-5 h-5 text-red-400" />}
                    <span className="text-xs text-red-500 font-medium mt-1">Foto 2</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0], 2)} />
                  </label>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving || uploading || !motivo.trim() || quantidadeRetrabalho <= 0 || (bobinaZerada && !bobinaSubSel)}
            className="bg-red-600 hover:bg-red-700 gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertTriangle className="w-4 h-4" />}
            Gerar Retrabalho
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}