import React, { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, Upload, Loader2, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { registrarAuditoria } from "@/lib/auditHelper";

export const ETAPAS_CARREGAMENTO = [
  { id: "1_veiculo_vazio", label: "1. Veículo Vazio / Forração", desc: "Vistoria do assoalho limpo, sem farpas e forração de proteção" },
  { id: "2_camada_inferior", label: "2. Base Pesada / Perfis & Chapas", desc: "Corte e dobra, perfis estruturais e materiais pesados no piso" },
  { id: "3_telhas_amarrados", label: "3. Telhas / Painéis / Amarrados", desc: "Fardos de telhas empilhados, alinhados com espaçadores" },
  { id: "4_cintas_amarracao", label: "4. Amarração de Cintas & Catracas", desc: "Cintas com catraca tensionadas e cantoneiras de proteção nos cantos" },
  { id: "5_lona_placa", label: "5. Lona, Placa & Liberação de Portaria", desc: "Carga 100% lonada, amarrada externamente e placa do veículo legível" },
];

export default function RegistrarEtapaCarregamentoModal({
  open,
  onOpenChange,
  rotaId,
  cargaId = null,
  placaVeiculo = "",
  motoristaNome = "",
  unidade = "Matriz AJL",
  etapaSugerida = "1_veiculo_vazio",
  user = null,
  onSuccess
}) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [etapa, setEtapa] = useState(etapaSugerida);
  const [fotoUrl, setFotoUrl] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [conformidade, setConformidade] = useState("conforme");
  const [uploading, setUploading] = useState(false);
  const [salvando, setSalvando] = useState(false);

  // Atualizar etapa sugerida ao abrir
  React.useEffect(() => {
    if (open) {
      setEtapa(etapaSugerida || "1_veiculo_vazio");
      setFotoUrl("");
      setObservacoes("");
      setConformidade("conforme");
    }
  }, [open, etapaSugerida]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res?.file_url) {
        setFotoUrl(res.file_url);
        toast.success("Foto carregada com sucesso!");
      } else {
        toast.error("Erro ao obter URL da foto enviada.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar imagem: " + (err?.message || "Tente novamente"));
    } finally {
      setUploading(false);
    }
  };

  const handleSalvar = async () => {
    if (!fotoUrl) {
      toast.error("A foto desta etapa de carregamento é obrigatória!");
      return;
    }

    const etapaObj = ETAPAS_CARREGAMENTO.find(e => e.id === etapa);

    setSalvando(true);
    try {
      const operadorNome = user?.full_name || user?.email || "Operador de Pátio";

      const novoRegistro = await base44.entities.TimelineCarregamento.create({
        rota_id: rotaId || "",
        carga_id: cargaId || "",
        unidade: unidade || "Matriz AJL",
        placa_veiculo: placaVeiculo || "",
        motorista_nome: motoristaNome || "",
        operador_patio: operadorNome,
        etapa: etapa,
        etapa_label: etapaObj?.label || etapa,
        foto_url: fotoUrl,
        observacoes: observacoes.trim(),
        status_conformidade: conformidade,
        data_registro: new Date().toISOString()
      });

      // Registra no AuditLog
      registrarAuditoria({
        usuario: user,
        acao: "status",
        entidade: "RotaEntrega",
        registroId: rotaId,
        registroIdentificador: placaVeiculo ? `Placa ${placaVeiculo}` : `Rota ${rotaId}`,
        detalhes: `Registrou foto da etapa [${etapaObj?.label}] no carregamento do caminhão (Motorista: ${motoristaNome || "—"})`,
        unidade
      });

      toast.success("Etapa de carregamento registrada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["timeline-carregamento", rotaId] });
      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      queryClient.invalidateQueries({ queryKey: ["cargas"] });

      if (onSuccess) onSuccess(novoRegistro);
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar etapa: " + (err?.message || "Tente novamente"));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg font-sans">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Registrar Etapa de Carregamento
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {placaVeiculo ? `Veículo ${placaVeiculo}` : "Inspeção fotográfica"} · Motorista: {motoristaNome || "Não informado"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Seleção da Etapa */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Selecione a Etapa *</Label>
            <Select value={etapa} onValueChange={setEtapa}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Selecione a etapa..." />
              </SelectTrigger>
              <SelectContent>
                {ETAPAS_CARREGAMENTO.map((et) => (
                  <SelectItem key={et.id} value={et.id} className="text-xs">
                    {et.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {ETAPAS_CARREGAMENTO.find(e => e.id === etapa)?.desc}
            </p>
          </div>

          {/* Upload / Captura de Foto */}
          <div className="space-y-2">
            <Label className="text-xs font-bold">Foto da Etapa *</Label>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileChange}
            />

            {fotoUrl ? (
              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-500/50 bg-black/5">
                <img
                  src={fotoUrl}
                  alt="Foto do carregamento"
                  className="w-full h-48 object-cover"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-2 right-2 text-xs bg-white/90 text-slate-800 hover:bg-white shadow-md gap-1.5"
                >
                  <Camera className="w-3.5 h-3.5" /> Trocar Foto
                </Button>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-primary rounded-xl p-6 text-center cursor-pointer bg-slate-50 dark:bg-slate-900/40 transition-colors"
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    <span className="text-xs font-medium text-muted-foreground">Enviando foto da vistoria...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">Tirar Foto com a Câmera ou Selecionar Arquivo</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Capture o estado exato da amarração e do veículo</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status de Conformidade */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Avaliação de Conformidade</Label>
            <Select value={conformidade} onValueChange={setConformidade}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Conformidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="conforme" className="text-xs">
                  🟢 Conforme (Amarração e empilhamento 100% seguros)
                </SelectItem>
                <SelectItem value="ressalva" className="text-xs">
                  🟡 Com Ressalva (Observações registradas)
                </SelectItem>
                <SelectItem value="corrigido" className="text-xs">
                  🔵 Corrigido no Pátio (Reajustado com operador)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold">Observações / Detalhes (Opcional)</Label>
            <Textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Utilizadas 6 cintas catraca; cantoneiras de borracha em todas as telhas; carga bem distribuída."
              className="text-xs min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={salvando}
            className="text-xs"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSalvar}
            disabled={salvando || uploading || !fotoUrl}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-sm"
          >
            {salvando ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Salvando Vistoria...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmar Etapa
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
