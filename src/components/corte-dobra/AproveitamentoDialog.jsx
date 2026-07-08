import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Loader2, Recycle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

/**
 * Dialog pós-finalização da guilhotina:
 * 1) Pergunta se houve aproveitamento (SIM | NÃO)
 * 2) Se SIM → seleciona perfil + espessura da tabela e quantidade → cria OP de dobra
 * 3) Se NÃO → chama onConfirm() para seguir o fluxo normal
 */
export default function AproveitamentoDialog({ open, onClose, ordemGuilhotina, onConfirm }) {
  const [step, setStep] = useState("pergunta"); // pergunta | form | saving
  const [aproveitamentos, setAproveitamentos] = useState([]);
  const [loadingApr, setLoadingApr] = useState(false);
  const [perfisUnicos, setPerfisUnicos] = useState([]);
  const [espessurasFiltradas, setEspessurasFiltradas] = useState([]);

  const [perfilSel, setPerfilSel] = useState("");
  const [espessuraSel, setEspessuraSel] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [comprimento, setComprimento] = useState(null);

  // Maquina de dobra a partir da guilhotina de origem
  const maquinaDobra = ordemGuilhotina?.maquina === "CORTE 3M" ? "DOBRA 3M" : "DOBRA FUNDO 6M";

  useEffect(() => {
    if (!open) { setStep("pergunta"); setPerfilSel(""); setEspessuraSel(""); setQuantidade(""); setComprimento(null); }
  }, [open]);

  useEffect(() => {
    if (step !== "form") return;
    setLoadingApr(true);
    base44.entities.AproveitamentoPerfil.filter({ ativo: true })
      .then(data => {
        setAproveitamentos(data);
        const unicos = [...new Set(data.map(d => d.perfil))];
        setPerfisUnicos(unicos);
      })
      .finally(() => setLoadingApr(false));
  }, [step]);

  useEffect(() => {
    if (!perfilSel) { setEspessurasFiltradas([]); setEspessuraSel(""); setComprimento(null); return; }
    const filtered = aproveitamentos.filter(a => a.perfil === perfilSel);
    setEspessurasFiltradas(filtered);
    setEspessuraSel("");
    setComprimento(null);
  }, [perfilSel, aproveitamentos]);

  useEffect(() => {
    if (!espessuraSel) { setComprimento(null); return; }
    const found = aproveitamentos.find(a => a.perfil === perfilSel && a.espessura === espessuraSel);
    setComprimento(found?.comprimento_desenvolvido_mm || null);
  }, [espessuraSel, perfilSel, aproveitamentos]);

  const handleNao = () => {
    onClose();
    onConfirm();
  };

  const handleSim = () => setStep("form");

  const handleCriarOP = async () => {
    if (!perfilSel || !espessuraSel || !quantidade || Number(quantidade) <= 0) {
      toast.error("Preencha o perfil, espessura e quantidade.");
      return;
    }
    setStep("saving");
    const refPedido = ordemGuilhotina?.numero_pedido || ordemGuilhotina?.id?.slice(-6).toUpperCase();
    const obs = `APROVEITAMENTO GERADO A PARTIR DO PEDIDO ${refPedido || "—"}`;
    try {
      await base44.entities.OrdemMaquinaCD.create({
        unidade: ordemGuilhotina?.unidade || "Matriz AJL",
        data: format(new Date(), "yyyy-MM-dd"),
        maquina: maquinaDobra,
        chapa_origem: "chaparia",
        tipo_peca: perfilSel,
        dimensoes_livres: `Esp ${espessuraSel} | Dev ${comprimento}mm`,
        quantidade: Number(quantidade),
        status: "pendente",
        observacoes: obs,
        foto_pedido_url: ordemGuilhotina?.foto_pedido_url || null,
        foto_material_url: ordemGuilhotina?.foto_material_url || null,
        is_retrabalho: false,
        prioridade: false,
      });
      toast.success(`OP de aproveitamento criada para ${maquinaDobra}!`);
      onClose();
      onConfirm();
    } catch (e) {
      toast.error("Erro ao criar OP de aproveitamento.");
      setStep("form");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onInteractOutside={e => e.preventDefault()}>

        {/* ETAPA: PERGUNTA */}
        {step === "pergunta" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Recycle className="w-5 h-5 text-emerald-600" />
                Teve Aproveitamento?
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground text-center py-2">
              Houve sobra de chapa que pode ser aproveitada para uma nova peça?
            </p>
            <DialogFooter className="flex gap-3 sm:gap-3 mt-2">
              <Button
                variant="outline"
                className="flex-1 h-14 text-base gap-2 border-red-300 text-red-600 hover:bg-red-50"
                onClick={handleNao}
              >
                <XCircle className="w-5 h-5" /> NÃO
              </Button>
              <Button
                className="flex-1 h-14 text-base gap-2 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSim}
              >
                <CheckCircle2 className="w-5 h-5" /> SIM
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ETAPA: FORMULÁRIO */}
        {step === "form" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Recycle className="w-5 h-5 text-emerald-600" />
                Selecione o Aproveitamento
              </DialogTitle>
            </DialogHeader>

            {loadingApr ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 py-2">
                <div>
                  <Label className="text-sm font-medium mb-1 block">Perfil</Label>
                  <Select value={perfilSel} onValueChange={setPerfilSel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o perfil..." />
                    </SelectTrigger>
                    <SelectContent>
                      {perfisUnicos.map(p => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {perfilSel && (
                  <div>
                    <Label className="text-sm font-medium mb-1 block">Espessura</Label>
                    <Select value={espessuraSel} onValueChange={setEspessuraSel}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a espessura..." />
                      </SelectTrigger>
                      <SelectContent>
                        {espessurasFiltradas.map(a => (
                          <SelectItem key={a.espessura} value={a.espessura}>
                            Esp {a.espessura} — Dev {a.comprimento_desenvolvido_mm}mm
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {comprimento && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800">
                    Comprimento desenvolvido: <strong>{comprimento} mm</strong>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium mb-1 block">Quantidade de peças</Label>
                  <Input
                    type="number"
                    min="1"
                    value={quantidade}
                    onChange={e => setQuantidade(e.target.value)}
                    placeholder="Ex: 10"
                  />
                </div>

                <div className="bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                  Será criada uma OP para <strong>{maquinaDobra}</strong> sem número de pedido.
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("pergunta")}>Voltar</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                onClick={handleCriarOP}
                disabled={!perfilSel || !espessuraSel || !quantidade}
              >
                <CheckCircle2 className="w-4 h-4" /> Criar OP de Aproveitamento
              </Button>
            </DialogFooter>
          </>
        )}

        {/* ETAPA: SALVANDO */}
        {step === "saving" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
            <p className="text-sm text-muted-foreground">Criando OP de aproveitamento...</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}