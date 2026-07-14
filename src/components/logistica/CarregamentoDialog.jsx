import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Camera, Truck, Loader2, CheckCircle2, X, AlertCircle } from "lucide-react";
import UploadButton from "@/components/ui/UploadButton";

export default function CarregamentoDialog({ open, onClose, item, tipo, motoristaNome, cargaId, onConcluido }) {
  const [fotoUrl, setFotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const fotoInputRef = useRef();
  const fotoScanRef = useRef();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) {
      setFotoUrl("");
      setUploading(false);
    }
  }, [open]);

  const entityName = tipo === "pedido" ? "Pedido" : tipo === "ordem_maquina" ? "OrdemMaquinaCD" : "OrdemDesbobinadeira";

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setFotoUrl(file_url);
    } catch (e) {
      alert("Erro ao enviar foto: " + (e.message || e));
    }
    setUploading(false);
  };

  const registrarMutation = useMutation({
    mutationFn: async () => {
      if (!item || !fotoUrl) throw new Error("Foto é obrigatória");
      const agora = new Date().toISOString();

      // Buscar histórico existente
      const histExp = item.historico_expedicao ? JSON.parse(item.historico_expedicao) : [];

      // Buscar usuário atual
      let usuario = "Operador de Pátio";
      try {
        const user = await base44.auth.me();
        if (user?.full_name) usuario = user.full_name;
      } catch {}

      const novoRegistro = {
        data: agora,
        usuario,
        acao: "Carregado no Caminhão",
        detalhes: `Foto registrada${motoristaNome ? ` · Motorista: ${motoristaNome}` : ""}`,
      };

      const updateData = {
        foto_carregamento_url: fotoUrl,
        status_expedicao: "em_transito",
        motorista_nome: motoristaNome || item.motorista_nome || "",
        carga_id: cargaId || item.carga_id || "",
        historico_expedicao: JSON.stringify([...histExp, novoRegistro]),
      };

      await base44.entities[entityName].update(item.id, updateData);
      return updateData;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
      queryClient.invalidateQueries({ queryKey: ["cargas"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["logistica-cd"] });
      if (onConcluido) onConcluido();
      onClose();
    },
    onError: (e) => {
      alert("Erro ao registrar carregamento: " + (e.message || e));
    },
  });

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-500" />
            Registrar Carregamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info do pedido */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-bold">{item.numero_pedido || "—"}</span>
              {item.cliente && <span className="text-muted-foreground">· {item.cliente}</span>}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {item.produto && <Badge className="text-xs bg-primary/10 text-primary border-primary/20">{item.produto}</Badge>}
              {item.tipo_peca && <Badge className="text-xs bg-primary/10 text-primary border-primary/20">{item.tipo_peca}</Badge>}
              {item.quantidade != null && <Badge variant="secondary" className="text-xs">{item.quantidade} pç</Badge>}
              {motoristaNome && <Badge className="text-xs bg-blue-100 text-blue-700 border-blue-200">🚚 {motoristaNome}</Badge>}
            </div>
          </div>

          {/* Foto do carregamento */}
          <div className="space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1">
              <Camera className="w-4 h-4 text-blue-500" /> Foto da Peça no Caminhão *
            </p>
            <input ref={fotoInputRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleUpload(e.target.files[0])} />
            <input ref={fotoScanRef} type="file" accept="image/*" className="hidden"
              onChange={e => handleUpload(e.target.files[0])} />
            {fotoUrl ? (
              <div className="relative rounded-lg overflow-hidden border-2 border-blue-300">
                <img src={fotoUrl} alt="Foto do carregamento" className="w-full max-h-64 object-cover" />
                <button type="button" onClick={() => setFotoUrl("")}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600">
                  <X className="w-4 h-4" />
                </button>
                <div className="absolute bottom-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Foto capturada
                </div>
              </div>
            ) : (
              <UploadButton label="Tirar foto do carregamento" icon={Camera} cameraRef={fotoInputRef} fileRef={fotoScanRef} uploading={uploading} size="default" />
            )}
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-lg p-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>O status só muda para "carregado" após o envio da foto.</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button
            onClick={() => registrarMutation.mutate()}
            disabled={!fotoUrl || uploading || registrarMutation.isPending}
            className="bg-blue-500 hover:bg-blue-600 gap-1"
          >
            {registrarMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Confirmar Carregamento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}