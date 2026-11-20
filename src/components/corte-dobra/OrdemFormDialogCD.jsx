import React, { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Factory,
  Calendar,
  Layers,
  Scale,
  Package,
  AlertTriangle,
  AlertCircle,
  Search,
  ArrowRightLeft,
  Sparkles,
  CheckCircle2,
  FileText,
  User,
  Hash,
  Scissors,
} from "lucide-react";
import { useFilial } from "@/contexts/FilialContext";
import { usePreBaixaBobinas } from "@/hooks/usePreBaixaBobinas";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";

/**
 * Extrai número limpo de espessura de bobina (ex: "1,25" -> 1.25)
 */
function getEspessuraNumeroBobina(b) {
  if (!b) return 0;
  const str = String(
    b.espessura_utilizada || b.chapa || b.espessura_real || b.espessura_mm || ""
  )
    .replace(",", ".")
    .replace(/[^\d.]/g, "");
  return parseFloat(str) || 0;
}

/**
 * Formata descrição da bobina para o seletor conforme especificação:
 * [Código da Bobina] - Espessura (mm) - Largura (mm) - Cor - Saldo disponível (kg)
 */
function formatarOpcaoBobina(b, saldoKg) {
  const codigo = b.codigo ? `[${b.codigo}]` : "[Sem Código]";
  const espNum = getEspessuraNumeroBobina(b);
  const espFmt = espNum > 0 ? `${espNum.toFixed(2).replace(".", ",")} mm` : "Esp. N/D";
  const largFmt = b.largura_mm ? `${b.largura_mm} mm` : "Larg. N/D";
  const corOuQualidade =
    b.cor ||
    (b.qualidade === "GV"
      ? "Galvanizado"
      : b.qualidade === "GL (IMP)"
      ? "Galvalume Imp."
      : b.qualidade || "Galvanizado");
  const saldoFmt = `${Number(saldoKg || 0).toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
  })} kg disp.`;

  return `${codigo} - ${espFmt} - ${largFmt} - ${corOuQualidade} - ${saldoFmt}`;
}

export default function OrdemFormDialogCD({
  open,
  onClose,
  onSave,
  editItem,
  defaultDate,
  isGestor,
  defaultMaquina = "DESBOBINADEIRA 01",
}) {
  const { filialAtiva } = useFilial();

  // Estados dos Campos Obrigatórios do Novo Modal
  const [dataProducao, setDataProducao] = useState(format(new Date(), "yyyy-MM-dd"));
  const [maquina, setMaquina] = useState(defaultMaquina || "DESBOBINADEIRA 01");
  const [bobinaId, setBobinaId] = useState("");
  const [buscaBobina, setBuscaBobina] = useState("");
  const [comprimentoMm, setComprimentoMm] = useState("");
  const [quantidadeChapas, setQuantidadeChapas] = useState("");
  const [pesoTotalKg, setPesoTotalKg] = useState("");

  // Campos Opcionais de Identificação
  const [numeroPedido, setNumeroPedido] = useState("");
  const [cliente, setCliente] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Rastreia qual campo do conversor bidirecional foi modificado por último
  const [ultimoEditado, setUltimoEditado] = useState(null); // 'qtd' | 'peso'

  // Consulta de bobinas ativas do setor Corte & Dobra na filial
  const { data: bobinas = [], isLoading: isLoadingBobinas } = useQuery({
    queryKey: ["bobinas-cd-ativas-modal-simplificado", filialAtiva],
    queryFn: async () => {
      const filtro = { setor: "corte_dobra", arquivada: false };
      if (filialAtiva && filialAtiva !== "todas") {
        filtro.unidade = filialAtiva;
      }
      return base44.entities.Bobina.filter(filtro);
    },
    enabled: open,
  });

  // Cálculo de pré-baixa / reservas em tempo real
  const filiaisHook = filialAtiva === "todas" ? null : [filialAtiva];
  const { preBaixaMap } = usePreBaixaBobinas("corte_dobra", filiaisHook);

  // Inicialização e preenchimento ao abrir ou editar
  useEffect(() => {
    if (!open) return;

    if (editItem && editItem.id) {
      setDataProducao(editItem.data || format(new Date(), "yyyy-MM-dd"));
      setMaquina(editItem.maquina || defaultMaquina || "DESBOBINADEIRA 01");
      setBobinaId(editItem.bobina_id || "");
      setComprimentoMm(editItem.comprimento_mm ? String(editItem.comprimento_mm) : "");
      setQuantidadeChapas(editItem.quantidade ? String(editItem.quantidade) : "");
      setPesoTotalKg(
        editItem.peso_kg || editItem.kg_estimado
          ? String(editItem.peso_kg || editItem.kg_estimado)
          : ""
      );
      setNumeroPedido(editItem.numero_pedido || "");
      setCliente(editItem.cliente || "");
      setObservacoes(editItem.observacoes || "");
    } else {
      setDataProducao(defaultDate || format(new Date(), "yyyy-MM-dd"));
      setMaquina(defaultMaquina || "DESBOBINADEIRA 01");
      setBobinaId("");
      setBuscaBobina("");
      setComprimentoMm("");
      setQuantidadeChapas("");
      setPesoTotalKg("");
      setNumeroPedido("");
      setCliente("");
      setObservacoes("");
    }
    setUltimoEditado(null);
  }, [open, editItem, defaultDate, defaultMaquina]);

  // Limites de espessura por máquina
  const isDesb02 = maquina === "DESBOBINADEIRA 02";
  const limiteEspessuraMax = isDesb02 ? 4.75 : 3.0;
  const limiteEspessuraMin = isDesb02 ? 0.8 : 0.0;

  // Filtro de bobinas compatíveis com a máquina selecionada
  const bobinasFiltradas = useMemo(() => {
    return bobinas.filter((b) => {
      const esp = getEspessuraNumeroBobina(b);
      if (esp > limiteEspessuraMax + 0.005) return false;
      return true;
    });
  }, [bobinas, limiteEspessuraMax]);

  // Bobina atualmente selecionada
  const bobinaSelecionada = useMemo(() => {
    return bobinas.find((b) => b.id === bobinaId) || null;
  }, [bobinas, bobinaId]);

  // Saldo real e disponível da bobina selecionada
  const { pesoBrutoBobina, saldoDisponivelBobina } = useMemo(() => {
    if (!bobinaSelecionada) return { pesoBrutoBobina: 0, saldoDisponivelBobina: 0 };
    const bruto =
      Number(
        bobinaSelecionada.peso_restante ??
          bobinaSelecionada.peso_kg ??
          bobinaSelecionada.peso_atual ??
          0
      ) || 0;
    const preBaixa = preBaixaMap?.[bobinaSelecionada.id] || 0;
    const disp = Math.max(0, bruto - preBaixa);
    return { pesoBrutoBobina: bruto, saldoDisponivelBobina: disp };
  }, [bobinaSelecionada, preBaixaMap]);

  // Parâmetros técnicos da bobina para o cálculo de peso
  const espessuraBobinaMm = useMemo(() => {
    return getEspessuraNumeroBobina(bobinaSelecionada);
  }, [bobinaSelecionada]);

  const larguraBobinaMm = useMemo(() => {
    return Number(bobinaSelecionada?.largura_mm) || 0;
  }, [bobinaSelecionada]);

  // Comprimento em milímetros e em metros
  const compMmNum = Number(comprimentoMm) || 0;
  const compMetrosFmt = compMmNum > 0 ? (compMmNum / 1000).toFixed(2).replace(".", ",") : "0,00";

  /**
   * ⚡ FÓRMULA DE PESO UNITÁRIO DA CHAPA:
   * Peso_Unitario (kg) = (Comprimento_mm / 1000) * (Largura_mm / 1000) * Espessura_mm * 7,85
   */
  const pesoUnitarioChapa = useMemo(() => {
    if (compMmNum <= 0 || larguraBobinaMm <= 0 || espessuraBobinaMm <= 0) return 0;
    const peso = (compMmNum / 1000) * (larguraBobinaMm / 1000) * espessuraBobinaMm * 7.85;
    return peso > 0 ? peso : 0;
  }, [compMmNum, larguraBobinaMm, espessuraBobinaMm]);

  /**
   * 🔄 CONVERSOR BIDIRECIONAL EM TEMPO REAL:
   * - Quando o usuário altera a Quantidade de Chapas:
   *   Peso_KG = Qtd * Peso_Unitario
   * - Quando o usuário altera o Peso Total (KG):
   *   Qtd = Math.round(Peso_KG / Peso_Unitario)
   */
  const handleQuantidadeChange = (valStr) => {
    setQuantidadeChapas(valStr);
    setUltimoEditado("qtd");
    const qtdNum = Number(valStr);
    if (pesoUnitarioChapa > 0 && qtdNum > 0) {
      const calcPeso = qtdNum * pesoUnitarioChapa;
      setPesoTotalKg(calcPeso.toFixed(2));
    } else if (!valStr || qtdNum <= 0) {
      setPesoTotalKg("");
    }
  };

  const handlePesoTotalChange = (valStr) => {
    setPesoTotalKg(valStr);
    setUltimoEditado("peso");
    const pesoNum = parseFloat(String(valStr).replace(",", "."));
    if (pesoUnitarioChapa > 0 && pesoNum > 0) {
      const calcQtd = Math.round(pesoNum / pesoUnitarioChapa);
      setQuantidadeChapas(calcQtd > 0 ? String(calcQtd) : "1");
    } else if (!valStr || pesoNum <= 0) {
      setQuantidadeChapas("");
    }
  };

  // Re-sincroniza conversão se o comprimento ou a bobina mudarem
  useEffect(() => {
    if (pesoUnitarioChapa <= 0) return;

    if (ultimoEditado === "qtd" && quantidadeChapas) {
      const qtdNum = Number(quantidadeChapas);
      if (qtdNum > 0) {
        setPesoTotalKg((qtdNum * pesoUnitarioChapa).toFixed(2));
      }
    } else if (ultimoEditado === "peso" && pesoTotalKg) {
      const pesoNum = parseFloat(String(pesoTotalKg).replace(",", "."));
      if (pesoNum > 0) {
        const calcQtd = Math.round(pesoNum / pesoUnitarioChapa);
        setQuantidadeChapas(calcQtd > 0 ? String(calcQtd) : "1");
      }
    }
  }, [pesoUnitarioChapa]);

  // Validação de Estoque
  const pesoTotalNum = parseFloat(String(pesoTotalKg).replace(",", ".")) || 0;
  const isEstoqueInsuficiente =
    bobinaSelecionada &&
    pesoTotalNum > 0 &&
    saldoDisponivelBobina > 0 &&
    pesoTotalNum > saldoDisponivelBobina + 0.1;

  // Validação de Campos Obrigatórios para Habilitar Confirmação
  const isFormValido =
    Boolean(dataProducao) &&
    Boolean(maquina) &&
    Boolean(bobinaId) &&
    compMmNum > 0 &&
    Number(quantidadeChapas) > 0 &&
    pesoTotalNum > 0 &&
    !isEstoqueInsuficiente;

  // Submissão da Ordem
  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!isFormValido) return;

    const UNIDADES_VALIDAS = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];
    let filialValida =
      filialAtiva && filialAtiva !== "todas" ? filialAtiva : "Matriz AJL";
    if (!UNIDADES_VALIDAS.includes(filialValida)) filialValida = "Matriz AJL";

    const corOuQualidade =
      bobinaSelecionada?.cor ||
      (bobinaSelecionada?.qualidade === "GV"
        ? "Galvanizado"
        : bobinaSelecionada?.qualidade || "Galvanizado");

    const descBobinaFmt = bobinaSelecionada
      ? `[${bobinaSelecionada.codigo || "CD"}] ${espessuraBobinaMm.toFixed(2).replace(".", ",")}mm · ${larguraBobinaMm}mm · ${corOuQualidade}`
      : "Bobina Aço CD";

    const descPeca = `Chapa ${espessuraBobinaMm.toFixed(2).replace(".", ",")}mm x ${larguraBobinaMm}mm x ${compMmNum}mm`;

    const payload = {
      data: dataProducao,
      maquina: maquina,
      maquina_inicial: maquina,
      unidade: filialValida,
      bobina_id: bobinaSelecionada?.id || bobinaId,
      bobina_descricao: descBobinaFmt,
      espessura_utilizada: String(espessuraBobinaMm),
      largura_mm: larguraBobinaMm,
      comprimento_mm: compMmNum,
      quantidade: Number(quantidadeChapas),
      peso_kg: Math.round(pesoTotalNum * 100) / 100,
      kg_estimado: Math.round(pesoTotalNum * 100) / 100,
      cliente: cliente.trim() || "Corte Interno / Estoque",
      numero_pedido: numeroPedido.trim().replace(/^#/, ""),
      observacoes: observacoes.trim(),
      tipo_peca: "Chapa Lisa / Blank",
      produto: descPeca,
      descricao: descPeca,
      instrucao: observacoes.trim() || descPeca,
      status: "pendente",
      destino: "estoque",
      chapa_origem: "bobina",
    };

    onSave(payload);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto p-0 gap-0 rounded-2xl border shadow-2xl">
        {/* Cabeçalho do Modal */}
        <DialogHeader className="p-5 pb-4 bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border-b border-border/80">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500 text-white flex items-center justify-center shadow-sm">
                <Scissors className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
                  {editItem?.id ? "Revisar Ordem de Corte" : "Nova Ordem de Corte"}
                  <Badge className="bg-orange-500 text-white font-mono text-xs font-bold uppercase tracking-wide">
                    {maquina}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Desbobinamento e corte de chapas a partir do estoque de bobinas
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Formulário Principal */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 1. SELEÇÃO DE DATA E MÁQUINA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-3.5 rounded-xl bg-muted/40 border border-border/70">
            {/* Campo 1: Data de Produção */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                Data de Produção *
              </Label>
              <Input
                type="date"
                value={dataProducao}
                onChange={(e) => setDataProducao(e.target.value)}
                className="h-10 text-sm font-semibold bg-background"
                required
              />
            </div>

            {/* Campo 2: Máquina */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Factory className="w-3.5 h-3.5 text-orange-500" />
                Máquina da Unidade *
              </Label>
              <Select value={maquina} onValueChange={(val) => setMaquina(val)}>
                <SelectTrigger className="h-10 text-sm font-semibold bg-background">
                  <SelectValue placeholder="Selecione a máquina..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DESBOBINADEIRA 01">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">Desbobinadeira 01</span>
                      <span className="text-xs text-muted-foreground">(até 3,00 mm)</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="DESBOBINADEIRA 02">
                    <div className="flex items-center gap-2">
                      <span className="font-bold">Desbobinadeira 02</span>
                      <span className="text-xs text-muted-foreground">(0,80 a 4,75 mm)</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 2. SELEÇÃO DE BOBINA DO ESTOQUE */}
          <div className="space-y-2 p-3.5 rounded-xl bg-muted/40 border border-border/70">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Layers className="w-3.5 h-3.5 text-blue-500" />
                Selecionar Bobina do Estoque *
              </Label>
              <span className="text-[11px] font-mono text-muted-foreground">
                {bobinasFiltradas.length} bobina(s) compatível(is)
              </span>
            </div>

            {/* Busca textual de bobina */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
              <Input
                type="text"
                placeholder="Filtrar por código (ex: CD0346), espessura ou cor..."
                value={buscaBobina}
                onChange={(e) => setBuscaBobina(e.target.value)}
                className="h-8 pl-8 text-xs bg-background mb-1.5"
              />
            </div>

            {/* Dropdown de Bobinas */}
            <Select value={bobinaId} onValueChange={(val) => setBobinaId(val)}>
              <SelectTrigger className="h-11 text-sm bg-background border-border">
                <SelectValue placeholder="Escolha a bobina aberta/ativa no estoque..." />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {bobinasFiltradas
                  .filter((b) => {
                    if (!buscaBobina.trim()) return true;
                    const q = buscaBobina.toLowerCase();
                    const cod = (b.codigo || "").toLowerCase();
                    const esp = String(b.espessura_utilizada || b.chapa || "").toLowerCase();
                    const cor = (b.cor || b.qualidade || "").toLowerCase();
                    return cod.includes(q) || esp.includes(q) || cor.includes(q);
                  })
                  .map((b) => {
                    const bruto =
                      Number(b.peso_restante ?? b.peso_kg ?? b.peso_atual ?? 0) || 0;
                    const pb = preBaixaMap?.[b.id] || 0;
                    const disp = Math.max(0, bruto - pb);

                    return (
                      <SelectItem key={b.id} value={b.id} className="py-2 cursor-pointer">
                        <span className="font-mono text-xs font-semibold">
                          {formatarOpcaoBobina(b, disp)}
                        </span>
                      </SelectItem>
                    );
                  })}
              </SelectContent>
            </Select>

            {/* Ficha Técnica Rápida da Bobina Selecionada */}
            {bobinaSelecionada && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                <div className="p-2 rounded-lg bg-background border border-border/80">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase">
                    Espessura
                  </span>
                  <span className="font-mono font-black text-foreground">
                    {espessuraBobinaMm.toFixed(2).replace(".", ",")} mm
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border/80">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase">
                    Largura
                  </span>
                  <span className="font-mono font-black text-foreground">
                    {larguraBobinaMm} mm
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-background border border-border/80">
                  <span className="text-[10px] text-muted-foreground block font-bold uppercase">
                    Cor / Qualidade
                  </span>
                  <span className="font-bold text-foreground truncate block">
                    {bobinaSelecionada.cor || bobinaSelecionada.qualidade || "Galvanizado"}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-950 dark:text-emerald-200">
                  <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-bold uppercase">
                    Saldo Disponível
                  </span>
                  <span className="font-mono font-black text-sm">
                    {saldoDisponivelBobina.toLocaleString("pt-BR", {
                      maximumFractionDigits: 1,
                    })}{" "}
                    kg
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 3. COMPRIMENTO & CONVERSOR BIDIRECIONAL (KG ⇄ QUANTIDADE) */}
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-transparent border border-orange-300 dark:border-orange-800 space-y-3.5">
            {/* Campo 4: Comprimento da Chapa */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <Scissors className="w-3.5 h-3.5 text-orange-500" />
                  Comprimento da Chapa (mm) *
                </Label>
                {compMmNum > 0 && (
                  <Badge className="bg-orange-500/15 text-orange-800 dark:text-orange-200 border border-orange-400 font-mono text-xs font-black">
                    📐 {compMetrosFmt} metros
                  </Badge>
                )}
              </div>
              <Input
                type="number"
                placeholder="Ex: 2000 ou 3000 (em milímetros)"
                value={comprimentoMm}
                onChange={(e) => setComprimentoMm(e.target.value)}
                className="h-10 text-sm font-semibold bg-background"
                min="100"
                step="1"
                required
              />
            </div>

            {/* Destaque do Peso Unitário Calculado */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-orange-500/10 border border-orange-400/50 text-xs font-bold text-orange-950 dark:text-orange-100">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                Peso Unitário por Chapa:
              </span>
              <span className="font-mono text-sm font-black text-orange-600 dark:text-orange-400">
                {pesoUnitarioChapa > 0
                  ? `${pesoUnitarioChapa.toFixed(3).replace(".", ",")} kg / chapa`
                  : "Preencha a bobina e o comprimento"}
              </span>
            </div>

            {/* Inputs Reativos Bidirecionais: Quantidade de Chapas ⇄ Peso Total (KG) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Campo: Quantidade de Chapas */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <Package className="w-3.5 h-3.5 text-blue-500" />
                  Quantidade de Chapas (un) *
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 50"
                  value={quantidadeChapas}
                  onChange={(e) => handleQuantidadeChange(e.target.value)}
                  className="h-10 text-sm font-bold bg-background"
                  min="1"
                  step="1"
                  required
                />
                <span className="text-[10px] text-muted-foreground block">
                  Digitar calcula o Peso Total automaticamente
                </span>
              </div>

              {/* Campo: Peso Total (KG) */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                  <Scale className="w-3.5 h-3.5 text-emerald-500" />
                  Peso Total (KG) *
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 1500"
                  value={pesoTotalKg}
                  onChange={(e) => handlePesoTotalChange(e.target.value)}
                  className="h-10 text-sm font-bold bg-background"
                  min="0.1"
                  step="any"
                  required
                />
                <span className="text-[10px] text-muted-foreground block">
                  Digitar calcula a Quantidade de Chapas
                </span>
              </div>
            </div>

            {/* 6. VALIDAÇÃO DE ESTOQUE: AVISO EM VERMELHO SE EXCEDER */}
            {isEstoqueInsuficiente && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border-2 border-red-500 text-red-700 dark:text-red-300 text-xs font-bold animate-pulse">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-black text-sm">
                    ⚠️ Peso solicitado excede o saldo da bobina!
                  </p>
                  <p className="text-xs mt-0.5 font-medium">
                    Solicitado:{" "}
                    <strong>
                      {pesoTotalNum.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg
                    </strong>{" "}
                    | Saldo Disponível:{" "}
                    <strong>
                      {saldoDisponivelBobina.toLocaleString("pt-BR", {
                        maximumFractionDigits: 1,
                      })}{" "}
                      kg
                    </strong>
                    . Ajuste o peso ou a quantidade antes de gerar a ordem.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 7. CAMPOS OPCIONAIS DE IDENTIFICAÇÃO (CLIENTE / PEDIDO) */}
          <div className="p-3.5 rounded-xl bg-muted/30 border border-border/60 space-y-3">
            <span className="text-xs font-bold text-muted-foreground block uppercase tracking-wider">
              Identificação & Destino (Opcional)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  Nº Pedido / OC
                </Label>
                <Input
                  type="text"
                  placeholder="Ex: #S01081 (opcional)"
                  value={numeroPedido}
                  onChange={(e) => setNumeroPedido(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Cliente
                </Label>
                <Input
                  type="text"
                  placeholder="Corte Interno / Estoque"
                  value={cliente}
                  onChange={(e) => setCliente(e.target.value)}
                  className="h-8 text-xs bg-background"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Observações Técnicas da Ordem
              </Label>
              <Input
                type="text"
                placeholder="Instruções adicionais para o operador (opcional)..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="h-8 text-xs bg-background"
              />
            </div>
          </div>

          {/* Rodapé e Botão de Confirmação */}
          <DialogFooter className="pt-2 sm:justify-between gap-2 border-t border-border/80">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 px-4 text-xs font-bold"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!isFormValido}
              className="h-10 px-6 font-bold text-sm bg-orange-500 hover:bg-orange-600 text-white shadow-md disabled:opacity-50 disabled:cursor-not-allowed gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {editItem?.id ? "Salvar Alterações da Ordem" : "Gerar Ordem de Produção"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}