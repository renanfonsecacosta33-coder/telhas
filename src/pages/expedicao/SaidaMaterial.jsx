import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowUpRight, ChevronLeft, Package, Building2, Truck,
  CheckCircle2, AlertTriangle, Loader2, Search, ArrowLeftRight
} from "lucide-react";

const FILIAIS = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];

// ── Utilitários de validade ──────────────────────────────────
function getDiasRestantes(dataValidade) {
  if (!dataValidade) return null;
  return Math.floor((new Date(dataValidade) - new Date()) / 86400000);
}

function getValidadeTag(dias) {
  if (dias === null) return null;
  if (dias < 0)   return { label: "VENCIDO",   color: "bg-gray-700 text-white" };
  if (dias < 15)  return { label: `${dias}d restantes`, color: "bg-red-100 text-red-700 border-red-300" };
  if (dias < 30)  return { label: `${dias}d restantes`, color: "bg-orange-100 text-orange-700 border-orange-300" };
  if (dias < 90)  return { label: `${dias}d restantes`, color: "bg-amber-100 text-amber-700 border-amber-300" };
  return           { label: `${dias}d restantes`, color: "bg-emerald-100 text-emerald-700 border-emerald-300" };
}

export default function SaidaMaterial() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tipo, setTipo] = useState("saida"); // "saida" | "transferencia"
  const [numeroPedido, setNumeroPedido] = useState("");
  const [selectedEntrada, setSelectedEntrada] = useState(null);
  const [qtdSaindo, setQtdSaindo] = useState("");
  const [pesoSaindo, setPesoSaindo] = useState("");
  const [filialDestino, setFilialDestino] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Buscar entradas ativas (com saldo)
  const { data: entradas = [], isLoading } = useQuery({
    queryKey: ["entradas-expedicao"],
    queryFn: () => base44.entities.EntradaMaterialExpedicao?.filter?.({}, "-created_date", 200) ?? [],
    retry: false,
  });

  // Somente com saldo disponível (não zeradas, não transferidas)
  const entradasAtivas = entradas.filter(e =>
    e.status !== "transferido" &&
    e.status !== "zerado" &&
    (e.quantidade_barras_saldo ?? e.quantidade_barras ?? 0) > 0
  );

  const filtradas = entradasAtivas.filter(e => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return e.numero_nf?.toLowerCase().includes(q) ||
           e.fornecedor?.toLowerCase().includes(q) ||
           e.produto?.toLowerCase().includes(q) ||
           e.local_armazenagem?.toLowerCase().includes(q);
  });

  // Auto-calcular peso saindo se o usuário mudar qtd
  const handleQtdChange = (v) => {
    setQtdSaindo(v);
    if (selectedEntrada && v) {
      const saldoBarras = selectedEntrada.quantidade_barras_saldo ?? selectedEntrada.quantidade_barras ?? 0;
      const saldoPeso   = selectedEntrada.peso_kg_saldo ?? selectedEntrada.peso_kg_balanca ?? 0;
      if (saldoBarras > 0) {
        const pesoPorBarra = saldoPeso / saldoBarras;
        setPesoSaindo((pesoPorBarra * Number(v)).toFixed(1));
      }
    }
  };

  const canSave = selectedEntrada && qtdSaindo && pesoSaindo && numeroPedido &&
    (tipo === "saida" || filialDestino);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saldoAtualBarras = selectedEntrada.quantidade_barras_saldo ?? selectedEntrada.quantidade_barras ?? 0;
      const saldoAtualPeso   = selectedEntrada.peso_kg_saldo ?? selectedEntrada.peso_kg_balanca ?? 0;
      const novoSaldoBarras  = Math.max(0, saldoAtualBarras - Number(qtdSaindo));
      const novoSaldoPeso    = Math.max(0, saldoAtualPeso - Number(pesoSaindo));

      if (Number(qtdSaindo) > saldoAtualBarras) {
        toast.error(`Saldo insuficiente! Disponível: ${saldoAtualBarras} barras.`);
        setSaving(false);
        return;
      }

      // Registrar saída/transferência
      await base44.entities.SaidaMaterialExpedicao?.create?.({
        entrada_id:        selectedEntrada.id,
        numero_nf_origem:  selectedEntrada.numero_nf,
        produto:           selectedEntrada.produto,
        tipo_operacao:     tipo,
        numero_pedido:     numeroPedido,
        filial_destino:    filialDestino || null,
        quantidade_barras: Number(qtdSaindo),
        peso_kg:           Number(pesoSaindo),
        observacoes,
        data_hora:         new Date().toISOString(),
        setor:             "expedicao",
      });

      // Atualizar saldo na entrada original
      const novoStatus = novoSaldoBarras === 0 ? (tipo === "transferido" ? "transferido" : "zerado") : selectedEntrada.status;
      await base44.entities.EntradaMaterialExpedicao?.update?.(selectedEntrada.id, {
        quantidade_barras_saldo: novoSaldoBarras,
        peso_kg_saldo:           novoSaldoPeso,
        status: novoStatus,
      });

      queryClient.invalidateQueries({ queryKey: ["entradas-expedicao"] });
      queryClient.invalidateQueries({ queryKey: ["saidas-expedicao"] });

      if (tipo === "transferencia") {
        toast.success(`✅ Transferência de ${qtdSaindo} barras para ${filialDestino} registrada! Pedido: ${numeroPedido}`);
      } else {
        toast.success(`✅ Saída de ${qtdSaindo} barras registrada! Pedido: ${numeroPedido}`);
      }
      navigate("/expedicao/historico");
    } catch (err) {
      toast.error("Erro ao registrar: " + (err?.message || "Erro"));
    } finally {
      setSaving(false);
    }
  };

  const saldoAtualBarras = selectedEntrada ? (selectedEntrada.quantidade_barras_saldo ?? selectedEntrada.quantidade_barras ?? 0) : 0;
  const saldoAtualPeso   = selectedEntrada ? (selectedEntrada.peso_kg_saldo ?? selectedEntrada.peso_kg_balanca ?? 0) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <button onClick={() => navigate("/expedicao")} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ChevronLeft className="w-4 h-4" /> Voltar
        </button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ArrowUpRight className="w-6 h-6 text-rose-600" /> Saída / Transferência de Material
        </h1>
        <p className="text-sm text-muted-foreground">Registre saída por pedido ou transferência entre filiais</p>
      </div>

      {/* Tipo de operação */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setTipo("saida")}
          className={`border-2 rounded-xl p-4 text-left transition-all ${tipo === "saida" ? "border-rose-500 bg-rose-50" : "border-muted hover:border-rose-300"}`}
        >
          <ArrowUpRight className={`w-5 h-5 mb-1 ${tipo === "saida" ? "text-rose-600" : "text-muted-foreground"}`} />
          <p className={`font-bold text-sm ${tipo === "saida" ? "text-rose-700" : ""}`}>Saída para Cliente</p>
          <p className="text-xs text-muted-foreground">Material sai para atender pedido</p>
        </button>
        <button
          onClick={() => setTipo("transferencia")}
          className={`border-2 rounded-xl p-4 text-left transition-all ${tipo === "transferencia" ? "border-blue-500 bg-blue-50" : "border-muted hover:border-blue-300"}`}
        >
          <Building2 className={`w-5 h-5 mb-1 ${tipo === "transferencia" ? "text-blue-600" : "text-muted-foreground"}`} />
          <p className={`font-bold text-sm ${tipo === "transferencia" ? "text-blue-700" : ""}`}>Transferência de Filial</p>
          <p className="text-xs text-muted-foreground">Envio para outra unidade AJL</p>
        </button>
      </div>

      {/* Número do Pedido */}
      <div className="space-y-1">
        <Label className="text-xs font-semibold flex items-center gap-1">
          {tipo === "transferencia" ? <Building2 className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
          {tipo === "transferencia" ? "Referência / Documento *" : "Número do Pedido *"}
        </Label>
        <Input
          value={numeroPedido}
          onChange={e => setNumeroPedido(e.target.value)}
          placeholder={tipo === "transferencia" ? "Ex: TRANSF-001, NF-OUT-12345" : "Ex: PED-2024-001, 45123"}
          className="font-mono"
        />
      </div>

      {/* Filial destino (somente transferência) */}
      {tipo === "transferencia" && (
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Filial de Destino *</Label>
          <select
            className="w-full border rounded-md px-3 py-2 text-sm bg-background"
            value={filialDestino}
            onChange={e => setFilialDestino(e.target.value)}
          >
            <option value="">Selecione a filial destino...</option>
            {FILIAIS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      )}

      {/* Selecionar material */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">Material a Sair *</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por NF, produto, local..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtradas.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground border rounded-xl">
            <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Nenhum material disponível em estoque</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {filtradas.map(e => {
              const saldo = e.quantidade_barras_saldo ?? e.quantidade_barras ?? 0;
              const saldoPeso = e.peso_kg_saldo ?? e.peso_kg_balanca ?? 0;
              const dias = getDiasRestantes(e.data_validade);
              const tag = getValidadeTag(dias);
              const isSelected = selectedEntrada?.id === e.id;

              return (
                <button
                  key={e.id}
                  onClick={() => { setSelectedEntrada(e); setQtdSaindo(""); setPesoSaindo(""); }}
                  className={`w-full border-2 rounded-xl p-3 text-left transition-all ${
                    isSelected ? "border-teal-500 bg-teal-50" : "border-muted hover:border-teal-300 hover:bg-muted/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-mono font-bold text-sm">NF {e.numero_nf}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-teal-600" />}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{e.produto}</p>
                      <div className="flex gap-3 text-xs mt-1 flex-wrap">
                        <span className="text-emerald-600 font-bold">{saldo} barras</span>
                        <span className="text-muted-foreground">{saldoPeso.toLocaleString("pt-BR")} kg</span>
                        {e.local_armazenagem && <span className="text-blue-600">📍 {e.local_armazenagem}</span>}
                      </div>
                    </div>
                    {tag && (
                      <Badge className={`text-[10px] border shrink-0 ${tag.color}`}>
                        {tag.label}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Quantidade saindo */}
      {selectedEntrada && (
        <div className="border-2 border-teal-400 rounded-xl p-4 bg-teal-50/40 space-y-3">
          <p className="font-bold text-sm text-teal-700 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Material selecionado: NF {selectedEntrada.numero_nf} — {selectedEntrada.produto}
          </p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-2">
            <div className="bg-white rounded-lg p-2 border">
              <p className="text-muted-foreground">Saldo</p>
              <p className="font-bold text-base">{saldoAtualBarras} barras</p>
            </div>
            <div className="bg-white rounded-lg p-2 border">
              <p className="text-muted-foreground">Peso</p>
              <p className="font-bold text-base">{saldoAtualPeso.toLocaleString("pt-BR")} kg</p>
            </div>
            <div className="bg-white rounded-lg p-2 border">
              <p className="text-muted-foreground">Local</p>
              <p className="font-bold text-sm">{selectedEntrada.local_armazenagem || "—"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Qtd Barras Saindo *</Label>
              <Input
                type="number"
                value={qtdSaindo}
                onChange={e => handleQtdChange(e.target.value)}
                placeholder="Ex: 10"
                max={saldoAtualBarras}
                className={Number(qtdSaindo) > saldoAtualBarras ? "border-red-400" : ""}
              />
              {Number(qtdSaindo) > saldoAtualBarras && (
                <p className="text-xs text-red-600">Saldo insuficiente!</p>
              )}
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Peso Saindo (kg) *</Label>
              <Input
                type="number"
                value={pesoSaindo}
                onChange={e => setPesoSaindo(e.target.value)}
                placeholder="Auto-calculado"
              />
              <p className="text-[10px] text-muted-foreground">Calculado automaticamente</p>
            </div>
          </div>

          {/* Preview do saldo restante */}
          {qtdSaindo && pesoSaindo && (
            <div className={`rounded-lg p-3 text-sm font-semibold text-center ${
              Number(qtdSaindo) === saldoAtualBarras
                ? "bg-red-50 border border-red-300 text-red-700"
                : "bg-blue-50 border border-blue-300 text-blue-700"
            }`}>
              {Number(qtdSaindo) === saldoAtualBarras ? (
                <span>⚠️ Estoque zerará após esta {tipo === "transferencia" ? "transferência" : "saída"}</span>
              ) : (
                <span>
                  Saldo restante: <strong>{saldoAtualBarras - Number(qtdSaindo)} barras</strong> / {(saldoAtualPeso - Number(pesoSaindo)).toFixed(0)} kg
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="space-y-1">
        <Label className="text-xs font-semibold">Observações</Label>
        <Textarea
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          placeholder="Motorista, destino final, responsável, etc."
          rows={2}
        />
      </div>

      <Button
        className={`w-full gap-2 ${tipo === "transferencia" ? "bg-blue-600 hover:bg-blue-700" : "bg-rose-600 hover:bg-rose-700"}`}
        disabled={!canSave || saving || Number(qtdSaindo) > saldoAtualBarras}
        onClick={handleSave}
      >
        {saving ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Registrando...</>
        ) : tipo === "transferencia" ? (
          <><Building2 className="w-4 h-4" /> Confirmar Transferência para {filialDestino || "..."}</>
        ) : (
          <><ArrowUpRight className="w-4 h-4" /> Confirmar Saída — Pedido {numeroPedido || "..."}</>
        )}
      </Button>
    </div>
  );
}
