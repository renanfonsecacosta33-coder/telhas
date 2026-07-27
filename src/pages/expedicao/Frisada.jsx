import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Wrench, Plus, ChevronLeft, Play, CheckCircle2,
  Package, Weight, Camera, Upload, Loader2, Clock
} from "lucide-react";

export default function Frisada() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    bobina_id: "", operador: "", quantidade_produzida: "", peso_kg_consumido: "",
    observacoes: "", foto_producao_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const fotoRef = React.useRef();
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Bobinas disponíveis para frisada
  const { data: bobinas = [] } = useQuery({
    queryKey: ["bobinas-expedicao"],
    queryFn: () => base44.entities.Bobina?.filter?.({ setor: "expedicao" }, "-created_date", 200) ?? [],
    retry: false,
  });

  // Histórico de produções de frisada
  const { data: producoes = [], isLoading } = useQuery({
    queryKey: ["producao-frisada"],
    queryFn: () => base44.entities.ProducaoFrisada?.filter?.({}, "-created_date", 100) ?? [],
    retry: false,
  });

  const bobinasSel = bobinas.filter(b => !b.arquivada && (b.peso_kg || 0) > 0);

  const bobinaAtual = bobinasSel.find(b => b.id === form.bobina_id);

  const handleFotoProducao = async (file) => {
    if (!file) return;
    setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set("foto_producao_url", file_url);
      toast.success("Foto da produção registrada!");
    } catch { toast.error("Erro ao enviar foto."); }
    finally { setUploadingFoto(false); }
  };

  const handleSave = async () => {
    if (!form.bobina_id || !form.quantidade_produzida || !form.peso_kg_consumido) {
      toast.error("Preencha bobina, quantidade e peso consumido.");
      return;
    }
    setSaving(true);
    try {
      // Registra produção
      await base44.entities.ProducaoFrisada?.create?.({
        ...form,
        quantidade_produzida: Number(form.quantidade_produzida),
        peso_kg_consumido:    Number(form.peso_kg_consumido),
        data_hora:            new Date().toISOString(),
        setor:                "expedicao",
      });

      // Dá baixa na bobina
      if (bobinaAtual) {
        const novoSaldo = Math.max(0, (bobinaAtual.peso_kg || 0) - Number(form.peso_kg_consumido));
        await base44.entities.Bobina.update(form.bobina_id, { peso_kg: novoSaldo });
      }

      queryClient.invalidateQueries({ queryKey: ["producao-frisada"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-expedicao"] });
      toast.success(`✅ Produção de ${form.quantidade_produzida} frisada(s) registrada!`);
      setDialogOpen(false);
      setForm({ bobina_id: "", operador: "", quantidade_produzida: "", peso_kg_consumido: "", observacoes: "", foto_producao_url: "" });
    } catch (err) {
      toast.error("Erro ao registrar: " + (err?.message || "Erro"));
    } finally {
      setSaving(false);
    }
  };

  const hoje = new Date().toISOString().slice(0, 10);
  const prodHoje = producoes.filter(p => p.data_hora?.startsWith(hoje));
  const totalProdHoje = prodHoje.reduce((s, p) => s + (p.quantidade_produzida || 0), 0);
  const totalConsumoHoje = prodHoje.reduce((s, p) => s + (p.peso_kg_consumido || 0), 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button onClick={() => navigate("/expedicao")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="w-6 h-6 text-purple-600" /> Máquina Frisada
          </h1>
          <p className="text-sm text-muted-foreground">Registre produções e consumo de bobinas na frisada</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-purple-600 hover:bg-purple-700 gap-2">
          <Play className="w-4 h-4" /> Registrar Produção
        </Button>
      </div>

      {/* Stats do dia */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
          <Wrench className="w-5 h-5 text-purple-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-purple-700">{totalProdHoje}</p>
          <p className="text-xs text-muted-foreground">Frisadas Hoje</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
          <Weight className="w-5 h-5 text-orange-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-orange-700">{(totalConsumoHoje / 1000).toFixed(2)}t</p>
          <p className="text-xs text-muted-foreground">Bobina Consumida Hoje</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <Package className="w-5 h-5 text-blue-500 mx-auto mb-1" />
          <p className="text-2xl font-bold text-blue-700">{bobinasSel.length}</p>
          <p className="text-xs text-muted-foreground">Bobinas Disponíveis</p>
        </div>
      </div>

      {/* Estoque rápido de bobinas */}
      {bobinasSel.length === 0 ? (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-4 text-center">
          <Package className="w-8 h-8 text-amber-400 mx-auto mb-2" />
          <p className="font-semibold text-amber-700">Sem bobinas disponíveis para frisada</p>
          <p className="text-xs text-amber-600 mt-1">Adicione bobinas no Estoque de Expedição</p>
          <Button variant="outline" size="sm" className="mt-3 border-amber-400 text-amber-700"
            onClick={() => navigate("/expedicao/estoque")}>
            Ir para Estoque
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl p-4 bg-card">
          <p className="font-semibold text-sm mb-3 flex items-center gap-2">
            <Package className="w-4 h-4 text-blue-500" /> Bobinas disponíveis
          </p>
          <div className="space-y-2">
            {bobinasSel.slice(0, 5).map(b => (
              <div key={b.id} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                <div className="flex gap-2 items-center">
                  <span className="font-mono font-bold text-xs text-primary">{b.codigo}</span>
                  {b.chapa && <span className="text-xs text-muted-foreground">{b.chapa}mm</span>}
                  {b.cor && <span className="text-xs text-blue-600">{b.cor}</span>}
                </div>
                <span className="text-emerald-600 font-bold text-xs">
                  {(b.peso_kg || 0).toLocaleString("pt-BR")} kg
                </span>
              </div>
            ))}
            {bobinasSel.length > 5 && (
              <p className="text-xs text-muted-foreground text-center">
                +{bobinasSel.length - 5} bobinas. <button className="text-blue-500 underline" onClick={() => navigate("/expedicao/estoque")}>Ver todas</button>
              </p>
            )}
          </div>
        </div>
      )}

      {/* Histórico de produções */}
      <div>
        <h2 className="font-bold text-base mb-3">Produções Registradas</h2>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-4 border-muted border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : producoes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhuma produção registrada ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {producoes.map(p => (
              <div key={p.id} className="border rounded-xl px-4 py-3 bg-card flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-bold text-purple-700">{p.quantidade_produzida} frisada(s)</span>
                    <span className="text-xs text-muted-foreground">
                      {p.peso_kg_consumido?.toLocaleString("pt-BR")} kg consumido
                    </span>
                    {p.operador && <span className="text-xs text-muted-foreground">— {p.operador}</span>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Clock className="w-3 h-3" />
                    {p.data_hora ? new Date(p.data_hora).toLocaleString("pt-BR") : "—"}
                  </div>
                </div>
                <Badge className="bg-purple-100 text-purple-700 border-transparent">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> OK
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog: Registrar produção */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="w-5 h-5 text-purple-600" /> Registrar Produção — Frisada
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Bobina Utilizada *</Label>
              <Select value={form.bobina_id} onValueChange={v => set("bobina_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a bobina..." />
                </SelectTrigger>
                <SelectContent>
                  {bobinasSel.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      <span className="font-mono font-bold">{b.codigo}</span>
                      {b.chapa && <span className="ml-2 text-muted-foreground text-xs">{b.chapa}mm</span>}
                      <span className="ml-2 text-emerald-600 text-xs font-bold">{(b.peso_kg||0).toLocaleString("pt-BR")}kg</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {bobinaAtual && (
                <p className="text-[10px] text-muted-foreground">
                  Saldo atual: <strong>{(bobinaAtual.peso_kg||0).toLocaleString("pt-BR")} kg</strong>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Qtd. Produzida (peças) *</Label>
                <Input type="number" value={form.quantidade_produzida} onChange={e => set("quantidade_produzida", e.target.value)} placeholder="Ex: 50" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Bobina Consumida (kg) *</Label>
                <Input type="number" value={form.peso_kg_consumido} onChange={e => set("peso_kg_consumido", e.target.value)} placeholder="Ex: 120" />
              </div>
            </div>

            {form.peso_kg_consumido && bobinaAtual && (
              <div className={`border rounded-lg p-2 text-xs ${Number(form.peso_kg_consumido) > (bobinaAtual.peso_kg||0) ? "border-red-400 bg-red-50 text-red-700" : "border-emerald-400 bg-emerald-50 text-emerald-700"}`}>
                Saldo após consumo: <strong>{Math.max(0, (bobinaAtual.peso_kg||0) - Number(form.peso_kg_consumido)).toLocaleString("pt-BR")} kg</strong>
                {Number(form.peso_kg_consumido) > (bobinaAtual.peso_kg||0) && " ⚠️ Insuficiente!"}
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Operador</Label>
              <Input value={form.operador} onChange={e => set("operador", e.target.value)} placeholder="Nome do operador" />
            </div>

            {/* Foto da produção */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Foto da Produção</Label>
              <div className="border-2 border-dashed border-purple-300 rounded-lg p-3 text-center">
                {uploadingFoto ? (
                  <div className="flex items-center justify-center gap-2 text-purple-600 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando...
                  </div>
                ) : form.foto_producao_url ? (
                  <div className="space-y-2">
                    <img src={form.foto_producao_url} alt="Produção" className="max-h-24 mx-auto rounded-lg object-cover" />
                    <p className="text-xs text-emerald-600 font-semibold flex items-center justify-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Foto registrada
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2 justify-center">
                    <Button variant="outline" size="sm" className="gap-1 text-xs border-purple-300 text-purple-700"
                      onClick={() => { fotoRef.current.capture = "environment"; fotoRef.current.click(); }}>
                      <Camera className="w-3.5 h-3.5" /> Câmera
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 text-xs border-purple-300 text-purple-700"
                      onClick={() => { fotoRef.current.removeAttribute("capture"); fotoRef.current.click(); }}>
                      <Upload className="w-3.5 h-3.5" /> Galeria
                    </Button>
                    <input ref={fotoRef} type="file" accept="image/*" className="hidden"
                      onChange={e => handleFotoProducao(e.target.files?.[0])} />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Observações</Label>
              <Textarea value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} placeholder="Obs sobre a produção..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.bobina_id || !form.quantidade_produzida || !form.peso_kg_consumido}
              className="bg-purple-600 hover:bg-purple-700 gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</> : <><CheckCircle2 className="w-4 h-4" /> Registrar</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
