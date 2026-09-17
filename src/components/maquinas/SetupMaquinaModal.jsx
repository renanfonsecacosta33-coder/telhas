import React, { useState } from "react";
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
import {
  RefreshCw,
  Sliders,
  Wrench,
  Sparkles,
  Truck,
  Play,
  CheckCircle2,
  AlertCircle,
  Package
} from "lucide-react";
import { toast } from "sonner";

const TIPOS_SETUP = [
  {
    id: "troca_bobina",
    titulo: "Troca / Colocação de Bobina",
    descricao: "Subir bobina no desbobinador, enfileirar e ajustar na fita",
    icon: RefreshCw,
    color: "text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800",
    metaMinutos: 15
  },
  {
    id: "ajuste_ferramenta",
    titulo: "Ajuste de Ferramenta / Medida",
    descricao: "Regulagem de espessura, batentes, troca de facas ou matrizes",
    icon: Sliders,
    color: "text-purple-600 bg-purple-50 border-purple-200 dark:bg-purple-950/40 dark:border-purple-800",
    metaMinutos: 10
  },
  {
    id: "limpeza_5s",
    titulo: "Limpeza & 5S da Máquina",
    descricao: "Recolhimento de retalhos, raspagem e limpeza da bancada",
    icon: Sparkles,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800",
    metaMinutos: 10
  },
  {
    id: "manutencao_ajuste",
    titulo: "Manutenção / Ajuste Mecânico",
    descricao: "Lubrificação, aperto, troca de correia ou intervenção preventiva",
    icon: Wrench,
    color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:border-amber-800",
    metaMinutos: 20
  },
  {
    id: "aguardando_logistica",
    titulo: "Aguardando Empilhadeira / Material",
    descricao: "Aguardando movimentação de bobina pelo pátio",
    icon: Truck,
    color: "text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800",
    metaMinutos: 15
  }
];

export default function SetupMaquinaModal({
  open,
  onOpenChange,
  maquinaNome,
  operadorNome,
  onIniciarSetup
}) {
  const [tipoSelecionado, setTipoSelecionado] = useState("troca_bobina");
  const [bobinaCodigo, setBobinaCodigo] = useState("");
  const [observacao, setObservacao] = useState("");

  const handleConfirmar = () => {
    const tipoObj = TIPOS_SETUP.find(t => t.id === tipoSelecionado) || TIPOS_SETUP[0];
    const setupData = {
      tipoId: tipoSelecionado,
      tipoTitulo: tipoObj.titulo,
      metaMinutos: tipoObj.metaMinutos,
      bobinaCodigo: bobinaCodigo.trim() || null,
      observacao: observacao.trim() || null,
      inicioTs: new Date().toISOString(),
      operador: operadorNome || "Operador",
      maquina: maquinaNome
    };

    onIniciarSetup(setupData);
    toast.success(`Setup "${tipoObj.titulo}" iniciado na máquina ${maquinaNome}!`);
    setBobinaCodigo("");
    setObservacao("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin-slow" />
            Iniciar Setup / Preparação da Máquina
          </DialogTitle>
          <DialogDescription>
            A máquina <strong>{maquinaNome}</strong> deve estar sempre ativa. Selecione a atividade que está realizando para registrar o tempo e suspender o alarme de ociosidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Opções de Tipo de Setup */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Qual atividade será realizada?
            </Label>
            <div className="grid grid-cols-1 gap-2">
              {TIPOS_SETUP.map(tipo => {
                const Icon = tipo.icon;
                const isSelected = tipoSelecionado === tipo.id;
                return (
                  <button
                    key={tipo.id}
                    type="button"
                    onClick={() => setTipoSelecionado(tipo.id)}
                    className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/60 dark:bg-indigo-950/40"
                        : "border-border hover:border-slate-400 bg-card"
                    }`}
                  >
                    <div className={`p-2 rounded-lg border shrink-0 ${tipo.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-sm text-foreground">{tipo.titulo}</span>
                        <span className="text-[11px] font-semibold text-muted-foreground">
                          Meta: ~{tipo.metaMinutos}m
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {tipo.descricao}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Se for troca de bobina, campo opcional para código da bobina */}
          {tipoSelecionado === "troca_bobina" && (
            <div className="space-y-1.5 bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-200 dark:border-blue-900">
              <Label className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-blue-600" />
                Código da Bobina que está entrando (Opcional)
              </Label>
              <Input
                placeholder="Ex: BOB-043-AZUL ou número da etiqueta"
                value={bobinaCodigo}
                onChange={e => setBobinaCodigo(e.target.value)}
                className="bg-white dark:bg-slate-900 text-sm"
              />
            </div>
          )}

          {/* Observação Livre */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground">
              Observações adicionais (opcional):
            </Label>
            <Input
              placeholder="Ex: Troca de fita para chapa 0.50, limpeza dos roletes..."
              value={observacao}
              onChange={e => setObservacao(e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirmar}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-sm"
          >
            <Play className="w-4 h-4 fill-white" />
            Iniciar Cronômetro de Setup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
