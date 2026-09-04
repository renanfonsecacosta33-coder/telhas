import React, { useState, useEffect } from "react";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useMetasProducao } from "@/hooks/useMetasProducao";
import { Target, ShieldAlert, Sparkles, Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";

export default function MetasProducaoDialog({ open, onClose }) {
  const {
    metaGeral,
    salvarMetaGeral,
    modelosCadastrados,
    updateModeloMeta,
    obterMetaModelo
  } = useMetasProducao();

  const [geralForm, setGeralForm] = useState({
    min: 1000,
    max: 3500,
    travarMaximo: true
  });

  const [modelosForm, setModelosForm] = useState({});
  const [salvando, setSalvando] = useState(false);

  // Inicializa o formulário com os valores atuais ao abrir
  useEffect(() => {
    if (open) {
      setGeralForm({
        min: metaGeral.min || 1000,
        max: metaGeral.max || 3500,
        travarMaximo: metaGeral.travarMaximo !== undefined ? metaGeral.travarMaximo : true
      });

      const mapa = {};
      modelosCadastrados.forEach(m => {
        const metaAtual = obterMetaModelo(m.modelo);
        mapa[m.id] = {
          min: m.meta_min_metros || metaAtual?.min || "",
          max: m.meta_max_metros || metaAtual?.max || ""
        };
      });
      setModelosForm(mapa);
    }
  }, [open, metaGeral, modelosCadastrados, obterMetaModelo]);

  const handleSalvarTudo = async () => {
    setSalvando(true);
    try {
      // 1. Salva Meta Geral
      salvarMetaGeral(geralForm);

      // 2. Salva Metas por Modelo no banco
      const promises = Object.entries(modelosForm).map(([id, valores]) => {
        return updateModeloMeta({
          id,
          meta_min_metros: valores.min !== "" ? Number(valores.min) : undefined,
          meta_max_metros: valores.max !== "" ? Number(valores.max) : undefined
        });
      });

      await Promise.all(promises);
      toast.success("Metas e travas de produção diária salvas com sucesso!");
      onClose();
    } catch (e) {
      console.error("Erro ao salvar metas:", e);
      toast.error("Erro ao salvar algumas metas. Tente novamente.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Target className="w-6 h-6 text-orange-500" />
            Configurar Metas de Metragem Diária
          </DialogTitle>
          <DialogDescription>
            Defina o piso (meta mínima) e o teto (capacidade máxima / trava) para o agendamento de produção geral da fábrica e por modelo de telha.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ─── 1. META GERAL DA FÁBRICA ─────────────────── */}
          <div className="bg-slate-50 dark:bg-slate-900/60 border-2 border-orange-500/30 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-orange-500/10 text-orange-600 font-bold text-sm">
                  🏭 Geral da Fábrica
                </span>
                <span className="text-xs text-muted-foreground">Soma de todas as máquinas</span>
              </div>
              <Badge variant="outline" className="text-[11px] border-orange-300 text-orange-700 dark:text-orange-300">
                Padrão Diário
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Meta Mínima Diária (m)
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="ex: 1000"
                    value={geralForm.min}
                    onChange={e => setGeralForm(f => ({ ...f, min: e.target.value }))}
                    className="pr-10 font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-semibold">m</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Piso de produção diária para atingir o faturamento planejado.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-red-600 dark:text-red-400">
                  Meta Máxima / Capacidade Teto (m)
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="50"
                    placeholder="ex: 3500"
                    value={geralForm.max}
                    onChange={e => setGeralForm(f => ({ ...f, max: e.target.value }))}
                    className="pr-10 font-bold border-red-300 dark:border-red-800"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-red-600 font-semibold">m</span>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Limite máximo que a fábrica aguenta produzir no dia.
                </p>
              </div>
            </div>

            {/* Toggle Trava */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
              <div className="space-y-0.5 pr-4">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Travar agendamento ao atingir meta máxima
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  Emite aviso impeditivo no formulário de OP ao tentar agendar além da capacidade máxima do dia.
                </p>
              </div>
              <Switch
                checked={geralForm.travarMaximo}
                onCheckedChange={v => setGeralForm(f => ({ ...f, travarMaximo: v }))}
              />
            </div>
          </div>

          {/* ─── 2. METAS INDIVIDUAIS POR MODELO ───────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <span>📐 Metas por Modelo / Perfiladeira</span>
                </h4>
                <p className="text-xs text-muted-foreground">
                  Personalize o mínimo e a capacidade máxima diária para cada modelo.
                </p>
              </div>
            </div>

            <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
              {modelosCadastrados.map(m => {
                const val = modelosForm[m.id] || { min: "", max: "" };
                return (
                  <div key={m.id} className="p-3 bg-card hover:bg-muted/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{m.modelo}</span>
                        <Badge variant="outline" className="text-[10px]">{m.produto}</Badge>
                        {m.maquinas && (
                          <span className="text-[11px] text-muted-foreground">
                            Máquinas: <strong>{m.maquinas}</strong>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Label className="text-[11px] text-muted-foreground">Mín:</Label>
                        <div className="relative w-24">
                          <Input
                            type="number"
                            placeholder="Mín (m)"
                            value={val.min}
                            onChange={e => {
                              const v = e.target.value;
                              setModelosForm(prev => ({
                                ...prev,
                                [m.id]: { ...prev[m.id], min: v }
                              }));
                            }}
                            className="h-8 text-xs font-semibold pr-6"
                          />
                          <span className="absolute right-2 top-2 text-[10px] text-muted-foreground">m</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Label className="text-[11px] text-red-600 dark:text-red-400 font-semibold">Máx:</Label>
                        <div className="relative w-24">
                          <Input
                            type="number"
                            placeholder="Máx (m)"
                            value={val.max}
                            onChange={e => {
                              const v = e.target.value;
                              setModelosForm(prev => ({
                                ...prev,
                                [m.id]: { ...prev[m.id], max: v }
                              }));
                            }}
                            className="h-8 text-xs font-semibold border-red-300 dark:border-red-900 pr-6"
                          />
                          <span className="absolute right-2 top-2 text-[10px] text-red-600">m</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {modelosCadastrados.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhum modelo cadastrado. Cadastre modelos em Dados de Produção para ajustar metas individuais.
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={handleSalvarTudo} disabled={salvando} className="gap-1.5 font-bold">
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando Metas...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Salvar Configurações de Metas
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
