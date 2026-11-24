import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Calculator,
  Weight,
  DollarSign,
  Layers,
  Clock,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Send,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  Package,
  Wrench,
  Percent,
  SlidersHorizontal,
  ChevronRight,
  Info
} from "lucide-react";
import { calcularCustoOrdem, formatarMoeda, prepararCustoParaOdoo } from "@/lib/custoPedidoHelper";
import { notificarStatus } from "@/lib/biNotificador";

export default function RaioXCustoPedidoModal({
  open,
  onOpenChange,
  ordem,
  bobinaMap = {},
  onAtualizado,
}) {
  const [sincronizandoOdoo, setSincronizandoOdoo] = useState(false);
  const [salvandoAjuste, setSalvandoAjuste] = useState(false);
  const [corrigindoPeso, setCorrigindoPeso] = useState(false);
  const [abaAtiva, setAbaAtiva] = useState("composicao"); // "composicao" | "odoo" | "ajustes"

  // Modo de ajuste manual
  const [custoKgInput, setCustoKgInput] = useState("");
  const [custoEpsInput, setCustoEpsInput] = useState("");

  if (!ordem) return null;

  const custo = calcularCustoOrdem(ordem, bobinaMap);
  const pecas = Number(ordem.quantidade || ordem.quantidade_telhas || 1);
  const custoPorPeca = pecas > 0 ? custo.custoTotal / pecas : custo.custoTotal;

  // Tempo de máquina formatado
  const tempoSegundos = Number(ordem.tempo_producao_segundos || 0);
  const tempoMinutos = Math.round(tempoSegundos / 60);

  // 1. Sincronização Imediata com o Odoo ERP
  const handleSincronizarOdoo = async () => {
    setSincronizandoOdoo(true);
    try {
      const payloadCusto = prepararCustoParaOdoo(ordem, bobinaMap);
      const res = await notificarStatus(ordem, "sincronizacao_custo", {
        ...payloadCusto,
        item_nome: ordem.produto || "Telha",
      });

      if (res && res.ok) {
        toast.success("Custos industriais sincronizados com sucesso no Odoo ERP!");
      } else {
        toast.warning("Enviado ao canal do Odoo. Verifique os lançamentos na OF.");
      }
    } catch (err) {
      console.error("Falha ao sincronizar custos com Odoo:", err);
      toast.error("Erro ao sincronizar com Odoo: " + (err.message || String(err)));
    } finally {
      setSincronizandoOdoo(false);
    }
  };

  // 2. Correção de Peso Físico Real com 1 clique (para ordens distorcidas no passado)
  const handleCorrigirPesoFisico = async () => {
    if (!custo.kgTeorico || custo.kgTeorico <= 0) return;
    setCorrigindoPeso(true);
    try {
      await base44.entities.Pedido.update(ordem.id, {
        peso_kg: custo.kgTeorico,
        kg_total: custo.kgTeorico,
        peso_confirmado_balanca: true,
      });
      toast.success(`Peso corrigido para ${custo.kgTeorico} kg com base na física do aço!`);
      if (onAtualizado) onAtualizado();
    } catch (err) {
      toast.error("Erro ao atualizar peso: " + err.message);
    } finally {
      setCorrigindoPeso(false);
    }
  };

  // 3. Salvar ajuste personalizado de custo
  const handleSalvarAjuste = async () => {
    setSalvandoAjuste(true);
    try {
      const payload = {};
      if (custoKgInput) payload.custo_kg_personalizado = parseFloat(custoKgInput.replace(",", "."));
      await base44.entities.Pedido.update(ordem.id, payload);
      toast.success("Parâmetros de custos atualizados para este pedido!");
      if (onAtualizado) onAtualizado();
    } catch (err) {
      toast.error("Erro ao salvar ajustes: " + err.message);
    } finally {
      setSalvandoAjuste(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 gap-0 border-border/80 shadow-2xl">
        {/* Cabeçalho Tecnológico */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sticky top-0 z-10 border-b border-white/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                  <Calculator className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 uppercase tracking-wider">
                      Raio-X de Custo Industrial
                    </span>
                    <Badge variant="outline" className="text-[10px] py-0 text-slate-300 border-white/20">
                      {ordem.maquina || "Perfiladeira"}
                    </Badge>
                  </div>
                  <DialogTitle className="text-lg font-black tracking-tight text-white mt-0.5">
                    {ordem.cliente || "Cliente Não Informado"} ·{" "}
                    <span className="text-emerald-400 font-mono">#{ordem.numero_pedido || "S/N"}</span>
                  </DialogTitle>
                </div>
              </div>
              <DialogDescription className="text-xs text-slate-400 mt-1">
                {ordem.produto} {ordem.modelo ? `(${ordem.modelo})` : ""} · {custo.metros.toFixed(1)}m lineares ({pecas} peças) · {ordem.unidade || "Matriz AJL"}
              </DialogDescription>
            </div>

            <Button
              size="sm"
              onClick={handleSincronizarOdoo}
              disabled={sincronizandoOdoo}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 gap-1.5 shadow-md shrink-0 cursor-pointer"
            >
              {sincronizandoOdoo ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sincronizando...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Enviar ao Odoo
                </>
              )}
            </Button>
          </div>

          {/* Abas Superiores */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setAbaAtiva("composicao")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                abaAtiva === "composicao"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Composição de Gastos (Raio-X)
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("odoo")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                abaAtiva === "odoo"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Espelho Odoo ERP (MRP)
            </button>
            <button
              type="button"
              onClick={() => setAbaAtiva("ajustes")}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                abaAtiva === "ajustes"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Ajuste de Parâmetros
            </button>
          </div>
        </div>

        {/* Corpo do Modal */}
        <div className="p-5 space-y-4">
          {/* 1. Alerta de Discrepância de Peso Histórica (se aplicável) */}
          {custo.discrepanciaPeso && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800/60 rounded-xl p-3.5 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                    Atenção: Discrepância Física no Peso Cadastrado
                  </p>
                  <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed">
                    Este pedido possui <strong>{custo.kgGravado.toLocaleString("pt-BR")} kg</strong> de aço registrados no cadastro, mas para {custo.metros.toFixed(1)}m (chapa {custo.espessura}mm / {custo.largMm}mm) a física industrial consome exatamente <strong>{custo.kgTeorico.toLocaleString("pt-BR")} kg</strong>. O custo foi protegido e calculado usando o consumo real de aço.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCorrigirPesoFisico}
                disabled={corrigindoPeso}
                className="bg-white dark:bg-slate-900 border-amber-300 text-amber-800 dark:text-amber-300 text-xs font-bold shrink-0 h-8 hover:bg-amber-100"
              >
                {corrigindoPeso ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Corrigir no Banco"}
              </Button>
            </div>
          )}

          {/* 2. Hero Cards: Resumo Executivo de Custos & Rentabilidade */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Custo Total */}
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase tracking-wider block">
                Custo de Fabricação
              </span>
              <p className="text-xl font-black text-emerald-700 dark:text-emerald-300 mt-0.5">
                {formatarMoeda(custo.custoTotal)}
              </p>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium block mt-0.5">
                Total de insumos + máquina
              </span>
            </div>

            {/* Custo por Metro */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Custo Unitário / Metro
              </span>
              <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                {formatarMoeda(custo.custoPorMetro)}
              </p>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {custo.metros.toFixed(1)} metros produzidos
              </span>
            </div>

            {/* Custo por Peça */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Custo Médio / Peça
              </span>
              <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                {formatarMoeda(custoPorPeca)}
              </p>
              <span className="text-[10px] text-muted-foreground block mt-0.5">
                {pecas} telha(s) conformada(s)
              </span>
            </div>

            {/* Preço Odoo & Lucro Bruto */}
            <div className="p-3.5 rounded-xl bg-card border border-border shadow-xs">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                {custo.precoVenda > 0 ? "Venda Odoo & Lucro" : "Custo Unitário / KG"}
              </span>
              {custo.precoVenda > 0 ? (
                <>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                    {formatarMoeda(custo.precoVenda)}
                  </p>
                  <span className={`text-[10px] font-bold block mt-0.5 ${custo.lucroBruto >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    Lucro: {formatarMoeda(custo.lucroBruto)} ({custo.margemBrutaPct}%)
                  </span>
                </>
              ) : (
                <>
                  <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                    {formatarMoeda(custo.custoPorKg)}
                  </p>
                  <span className="text-[10px] text-muted-foreground block mt-0.5">
                    Por kg de aço beneficiado
                  </span>
                </>
              )}
            </div>
          </div>

          {/* 3. ABA 1: Composição Detalhada de Gastos (O que, quanto e como gastou) */}
          {abaAtiva === "composicao" && (
            <div className="space-y-3">
              {/* Bloco 1: Aço / Bobina */}
              <div className="border border-border/80 rounded-xl p-4 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-orange-100 dark:bg-orange-950 text-orange-600 flex items-center justify-center">
                      <Weight className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-foreground">1. Matéria-Prima: Aço da Bobina</h4>
                        <Badge className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 text-[10px] font-bold py-0 px-1.5">
                          + 3,25% IPI Somado
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Chapa {custo.espessura}mm · Largura {custo.largMm}mm · Densidade 7,85 kg/m³
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-orange-600 dark:text-orange-400 block">
                      {formatarMoeda(custo.custoAco)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {custo.custoTotal > 0 ? `${Math.round((custo.custoAco / custo.custoTotal) * 100)}% do custo total` : ""}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Peso de Aço Consumido:</span>
                    <strong className="text-foreground">{custo.kgAco.toLocaleString("pt-BR")} kg</strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Custo Base da Bobina (s/ IPI):</span>
                    <span className="text-foreground font-semibold">{formatarMoeda(custo.custoKgBase)} / kg</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-200/60 text-[11px]">
                    <span className="font-semibold flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-emerald-500" /> IPI Somado ({custo.aliquotaIpi}%):
                    </span>
                    <span className="font-bold">+ {formatarMoeda(custo.valorIpiKg)} / kg</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground font-bold">
                    <span className="text-foreground">Custo Efetivo do Aço (c/ IPI):</span>
                    <strong className="text-orange-600 dark:text-orange-400">{formatarMoeda(custo.custoKgAco)} / kg</strong>
                  </div>
                  {custo.bobinaCodigo && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Bobina Vinculada:</span>
                      <strong className="text-amber-600 dark:text-amber-400">{custo.bobinaCodigo}</strong>
                    </div>
                  )}
                  <div className="flex justify-between text-muted-foreground pt-1 border-t border-border/60">
                    <span>Fórmula Industrial:</span>
                    <span className="text-slate-600 dark:text-slate-300">
                      {custo.metros.toFixed(1)}m × {(custo.largMm/1000).toFixed(2)}m × {custo.espessura}mm × 7,85 = {custo.kgAco.toFixed(1)} kg × {formatarMoeda(custo.custoKgAco)} ({formatarMoeda(custo.custoKgBase)} + 3,25% IPI)
                    </span>
                  </div>
                </div>
              </div>

              {/* Bloco 2: EPS / Isopor e Cola PU (se termoacústica) */}
              {custo.isTermoacustica && (
                <div className="border border-border/80 rounded-xl p-4 bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950 text-cyan-600 flex items-center justify-center">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">2. Insumos Térmicos: EPS & Cola PU</h4>
                        <p className="text-[11px] text-muted-foreground">
                          Recheio termoacústico para telha sanduíche
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-base font-black text-cyan-600 dark:text-cyan-400 block">
                        {formatarMoeda(custo.custoEps + custo.custoCola)}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {custo.custoTotal > 0 ? `${Math.round(((custo.custoEps + custo.custoCola) / custo.custoTotal) * 100)}% do total` : ""}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-cyan-50/50 dark:bg-cyan-950/30 p-2.5 rounded-lg border border-cyan-100 dark:border-cyan-900/40">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Placas de EPS:</span>
                        <strong className="text-cyan-800 dark:text-cyan-300">{formatarMoeda(custo.custoEps)}</strong>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {custo.metros.toFixed(1)}m × {formatarMoeda(custo.metros > 0 ? custo.custoEps / custo.metros : 0)}/m
                      </p>
                    </div>

                    <div className="bg-blue-50/50 dark:bg-blue-950/30 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cola PU Bi-componente:</span>
                        <strong className="text-blue-800 dark:text-blue-300">{formatarMoeda(custo.custoCola)}</strong>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {custo.metros.toFixed(1)}m × {formatarMoeda(custo.metros > 0 ? custo.custoCola / custo.metros : 0)}/m
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Bloco 3: Centro de Trabalho & Mão de Obra */}
              <div className="border border-border/80 rounded-xl p-4 bg-card space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 flex items-center justify-center">
                      <Wrench className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">3. Operação, Máquina & Mão de Obra</h4>
                      <p className="text-[11px] text-muted-foreground">
                        Perfiladeira {ordem.maquina} · Operador: {ordem.operador || ordem.operador_inicio || "Equipe Fábrica"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400 block">
                      {formatarMoeda(custo.custoOperacional)}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {custo.custoTotal > 0 ? `${Math.round((custo.custoOperacional / custo.custoTotal) * 100)}% do total` : ""}
                    </span>
                  </div>
                </div>

                <div className="bg-muted/40 rounded-lg p-3 text-xs space-y-1.5 font-mono">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tempo de Produção:</span>
                    <strong className="text-foreground">
                      {tempoMinutos > 0 ? `${tempoMinutos} min (${tempoSegundos}s)` : `${custo.metros.toFixed(1)}m conformados`}
                    </strong>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Taxa Horária da Máquina:</span>
                    <strong className="text-foreground">R$ 60,00 / hora (R$ 1,00 / min)</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. ABA 2: Espelho Odoo ERP (MRP & Contabilidade de Custos) */}
          {abaAtiva === "odoo" && (
            <div className="space-y-3">
              <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-200">
                      Padrão Odoo MRP: Ordens de Produção & Centros de Custos
                    </span>
                  </div>
                  <Badge className="bg-emerald-600 text-white text-[10px]">Pronto para Sincronizar</Badge>
                </div>
                <p className="text-[11px] text-blue-800 dark:text-blue-300 leading-relaxed">
                  Estes são os valores contábeis que serão apropriados na Ordem de Fabricação (OF) e nas linhas de consumo de matéria-prima no Odoo ERP.
                </p>
              </div>

              <div className="bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-xs overflow-x-auto space-y-1 border border-slate-800">
                <p className="text-slate-400">// Payload Contábil Odoo (mrp.production / stock.move)</p>
                <p>{JSON.stringify(prepararCustoParaOdoo(ordem, bobinaMap), null, 2)}</p>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSincronizarOdoo}
                  disabled={sincronizandoOdoo}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs gap-1.5"
                >
                  {sincronizandoOdoo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  Enviar Custos ao Odoo Agora
                </Button>
              </div>
            </div>
          )}

          {/* 5. ABA 3: Ajustes e Personalização de Parâmetros */}
          {abaAtiva === "ajustes" && (
            <div className="space-y-4">
              <div className="border border-border/80 rounded-xl p-4 bg-card space-y-3">
                <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-emerald-600" />
                  Personalizar Parâmetros Deste Pedido
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Caso o lote de matéria-prima tenha tido um custo de aquisição específico ou negociação especial, ajuste os valores abaixo para recalcular a apropriação:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Custo do Aço por KG (R$/kg):</label>
                    <Input
                      placeholder={custo.custoKgAco.toFixed(2)}
                      value={custoKgInput}
                      onChange={(e) => setCustoKgInput(e.target.value)}
                      className="text-xs h-8"
                    />
                    <span className="text-[10px] text-muted-foreground block">Atual: {formatarMoeda(custo.custoKgAco)}/kg</span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Bobina Utilizada:</label>
                    <Input
                      disabled
                      value={custo.bobinaCodigo || "Padrão de Fábrica"}
                      className="text-xs h-8 bg-muted"
                    />
                    <span className="text-[10px] text-muted-foreground block">Origem: Estoque de Bobinas</span>
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-border/60">
                  <Button
                    size="sm"
                    onClick={handleSalvarAjuste}
                    disabled={salvandoAjuste}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8 gap-1.5 cursor-pointer"
                  >
                    {salvandoAjuste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                    Salvar Ajustes
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
