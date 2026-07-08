import React, { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Loader2, Recycle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { parseEspessura } from "@/components/corte-dobra/CorChapaDot";

const DOBRADEIRAS = ["DOBRA 3M", "DOBRA FUNDO 6M", "DOBRA INICIO 6M"];

/**
 * Dialog pós-finalização da guilhotina:
 * 1) Pergunta se houve aproveitamento (SIM | NÃO)
 * 2) Se SIM → seleciona perfil + dobradeira (encarregado escolhe) + quantidade → cria OP de dobra
 * 3) Se NÃO → chama onConfirm() para seguir o fluxo normal (modificação de blank → finalizar)
 *
 * A espessura vem da bobina já selecionada na OP — não é escolhida aqui.
 */
export default function AproveitamentoDialog({ open, onClose, ordemGuilhotina, espessuraBobina, onConfirm }) {
  const [step, setStep] = useState("pergunta"); // pergunta | form | saving
  const [aproveitamentos, setAproveitamentos] = useState([]);
  const [loadingApr, setLoadingApr] = useState(false);

  const [perfilSel, setPerfilSel] = useState("");
  const [dobradeiraSel, setDobradeiraSel] = useState("");
  const [quantidade, setQuantidade] = useState("");

  // Filtra aproveitamentos pela espessura da bobina
  const aprFiltrados = useMemo(() => {
    const espNum = parseEspessura(espessuraBobina);
    if (espNum === null) return aproveitamentos;
    return aproveitamentos.filter(a => parseEspessura(a.espessura) === espNum);
  }, [aproveitamentos, espessuraBobina]);

  const perfisUnicos = useMemo(() => [...new Set(aprFiltrados.map(d => d.perfil))], [aprFiltrados]);

  const comprimento = useMemo(() => {
    if (!perfilSel) return null;
    const found = aprFiltrados.find(a => a.perfil === perfilSel);
    return found?.comprimento_desenvolvido_mm || null;
  }, [perfilSel, aprFiltrados]);

  const espessuraLabel = useMemo(() => {
    const espNum = parseEspessura(espessuraBobina);
    if (espNum === null) return "—";
    return String(espNum).replace(".", ",");
  }, [espessuraBobina]);

  useEffect(() => {
    if (!open) { setStep("pergunta"); setPerfilSel(""); setDobradeiraSel(""); setQuantidade(""); }
  }, [open]);

  useEffect(() => {
    if (step !== "form") return;
    setLoadingApr(true);
    base44.entities.AproveitamentoPerfil.filter({ ativo: true })
      .then(data => setAproveitamentos(data))
      .finally(() => setLoadingApr(false));
  }, [step]);

  const handleNao = () => {
    onClose();
    onConfirm();
  };

  const handleSim = () => setStep("form");

  const handleCriarOP = async () => {
    if (!perfilSel || !dobradeiraSel || !quantidade || Number(quantidade) <= 0) {
      toast.error("Preencha o perfil, a dobradeira e a quantidade.");
      return;
    }
    setStep("saving");
    const refPedido = ordemGuilhotina?.numero_pedido || ordemGuilhotina?.id?.slice(-6).toUpperCase();
    const obs = `APROVEITAMENTO GERADO A PARTIR DO PEDIDO ${refPedido || "—"}`;
    try {
      await base44.entities.OrdemMaquinaCD.create({
        unidade: ordemGuilhotina?.unidade || "Matriz AJL",
        data: format(new Date(), "yyyy-MM-dd"),
        maquina: dobradeiraSel,
        chapa_origem: "chaparia",
        tipo_peca: perfilSel,
        dimensoes_livres: `Esp ${espessuraLabel} | Dev ${comprimento}mm`,
        quantidade: Number(quantidade),
        status: "pendente",
        observacoes: obs,
        foto_pedido_url: ordemGuilhotina?.foto_pedido_url || null,
        foto_material_url: ordemGuilhotina?.foto_material_url || null,
        is_retrabalho: false,
        prioridade: false,
      });
      toast.success(`OP de aproveitamento criada para ${dobradeiraSel}!`);
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
                {/* Espessura da bobina (somente leitura) */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 flex items-center justify-between">
                  <span className="text-sm text-blue-800">Espessura da bobina</span>
                  <span className="text-sm font-bold text-blue-900">{espessuraLabel} mm</span>
                </div>

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
                  {perfisUnicos.length === 0 && (
                    <p className="text-xs text-red-500 mt-1">
                      Nenhum aproveitamento cadastrado para espessura {espessuraLabel}mm.
                    </p>
                  )}
                </div>

                {/* Dobradeira — encarregado escolhe */}
                <div>
                  <Label className="text-sm font-medium mb-1 block">Dobradeira de destino</Label>
                  <Select value={dobradeiraSel} onValueChange={setDobradeiraSel}>
                    <SelectTrigger>
                      <SelectValue placeholder="O encarregado deve escolher a dobradeira..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DOBRADEIRAS.map(d => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

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
                  Será criada uma OP para <strong>{dobradeiraSel || "a dobradeira escolhida"}</strong> sem número de pedido.
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setStep("pergunta")}>Voltar</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                onClick={handleCriarOP}
                disabled={!perfilSel || !dobradeiraSel || !quantidade}
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