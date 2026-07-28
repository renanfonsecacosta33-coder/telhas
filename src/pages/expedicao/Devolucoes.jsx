import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  RotateCcw, Plus, Camera, Upload, CheckCircle2, ChevronLeft,
  AlertTriangle, FileText, Package, Truck, User, Calendar,
  Search, Filter, Printer, Trash2, MapPin, Eye, Loader2, RefreshCw, X
} from "lucide-react";

// ── Motivos Padrão de Devolução ───────────────────────────────────────────
const MOTIVOS_DEVOLUCAO = [
  { id: "avaria_transporte", label: "🚚 Avaria no Transporte / Amassado", badge: "bg-red-500/10 text-red-700 border-red-200" },
  { id: "medida_incorreta", label: "📏 Medida / Cor / Perfil Incorreto", badge: "bg-amber-500/10 text-amber-700 border-amber-200" },
  { id: "recusa_cliente",   label: "🚫 Recusa de Recebimento pelo Cliente", badge: "bg-purple-500/10 text-purple-700 border-purple-200" },
  { id: "erro_carregamento", label: "📦 Erro de Carregamento / Troca", badge: "bg-blue-500/10 text-blue-700 border-blue-200" },
  { id: "sobra_obra",        label: "🏗️ Sobra de Obra / Devolução Comercial", badge: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  { id: "outro",             label: "💬 Outro Motivo (Especificar)", badge: "bg-slate-500/10 text-slate-700 border-slate-200" },
];

const CONDIÇÕES_MATERIAL = [
  { id: "proprio",     label: "🟢 Própria para Re-estocar", text: "Material intacto, pronto para uso" },
  { id: "avaria_leve", label: "🟡 Com Avaria Leve (Reparo / Quarentena)", text: "Necessita de inspeção ou retrabalho" },
  { id: "refugo",      label: "🔴 Irrecuperável (Refugo / Sucata)", text: "Danificado permanentemente" },
];

const LOCAIS_ARMAZENAGEM = [
  { id: "A1", label: "A1 — Rua A (Posição 1)" },
  { id: "B1", label: "B1 — Rua B (Posição 1)" },
  { id: "C1", label: "C1 — Rua C (Frisada / Bobinas)" },
  { id: "PATIO", label: "PÁTIO — Pátio Externo" },
  { id: "QUARENTENA", label: "⚠️ QUARENTENA — Área de Inspeção" },
  { id: "SUCATA", label: "🗑️ SUCATA — Área de Refugo" },
];

export default function Devolucoes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [busca, setBusca] = useState("");
  const [filtroMotivo, setFiltroMotivo] = useState("todos");
  const [dialogNova, setDialogNova] = useState(false);
  const [devolucaoSel, setDevolucaoSel] = useState(null);

  // Upload states
  const [uploadingField, setUploadingField] = useState(null);
  const nfCamRef = useRef(null);
  const nfFileRef = useRef(null);
  const matCamRef = useRef(null);
  const matFileRef = useRef(null);

  // Form State para Nova Devolução
  const [formDev, setFormDev] = useState({
    numero_pedido: "",
    numero_nf_devolucao: "",
    cliente: "",
    motorista: "",
    motivo: "avaria_transporte",
    observacao_motivo: "",
    foto_nf_url: "",
    foto_material_url: "",
    itens: [
      {
        id: "1",
        produto: "",
        quantidade_pecas: 1,
        comprimento_m: 6.0,
        peso_kg: 0,
        condicao: "proprio",
        local_destino: "A1"
      }
    ]
  });

  // Query das devoluções do banco
  const { data: devolucoes = [], isLoading } = useQuery({
    queryKey: ["devolucoes-expedicao"],
    queryFn: async () => {
      try {
        const res = await base44.entities.DevolucaoExpedicao?.filter?.({}, "-created_date", 100);
        return res || [];
      } catch {
        return [];
      }
    },
    retry: false,
  });

  // Upload de Imagens
  const handleFileUpload = async (field, file) => {
    if (!file) return;
    try {
      setUploadingField(field);
      const res = await base44.integrations.Core.UploadFile({ file });
      if (res?.file_url) {
        setFormDev(prev => ({ ...prev, [field]: res.file_url }));
        toast.success("Foto enviada com sucesso!");
      }
    } catch {
      toast.error("Erro ao enviar imagem.");
    } finally {
      setUploadingField(null);
    }
  };

  // Funções de manipulação da lista de itens devolvidos
  const handleAddItem = () => {
    setFormDev(prev => ({
      ...prev,
      itens: [
        ...prev.itens,
        {
          id: String(Date.now()),
          produto: "",
          quantidade_pecas: 1,
          comprimento_m: 6.0,
          peso_kg: 0,
          condicao: "proprio",
          local_destino: "A1"
        }
      ]
    }));
  };

  const handleRemoveItem = (id) => {
    if (formDev.itens.length === 1) {
      toast.error("Mantenha ao menos 1 item na devolução.");
      return;
    }
    setFormDev(prev => ({
      ...prev,
      itens: prev.itens.filter(i => i.id !== id)
    }));
  };

  const handleUpdateItem = (id, field, value) => {
    setFormDev(prev => ({
      ...prev,
      itens: prev.itens.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  // Salvar Devolução
  const handleSalvarDevolucao = async () => {
    if (!formDev.numero_pedido && !formDev.numero_nf_devolucao) {
      toast.error("Informe o Número do Pedido ou da NF de Devolução.");
      return;
    }
    if (!formDev.cliente) {
      toast.error("Informe o Nome do Cliente / Destinatário.");
      return;
    }
    if (formDev.itens.some(i => !i.produto || i.quantidade_pecas <= 0)) {
      toast.error("Preencha a descrição do produto e a quantidade de peças de todos os itens.");
      return;
    }

    try {
      const dataHoraAtual = new Date().toISOString();
      const totalPecas = formDev.itens.reduce((acc, i) => acc + Number(i.quantidade_pecas || 0), 0);
      const totalPesoKg = formDev.itens.reduce((acc, i) => acc + Number(i.peso_kg || 0), 0);

      const novaDev = {
        data_devolucao: dataHoraAtual,
        numero_pedido: formDev.numero_pedido,
        numero_nf_devolucao: formDev.numero_nf_devolucao,
        cliente: formDev.cliente,
        motorista: formDev.motorista,
        motivo: formDev.motivo,
        observacao_motivo: formDev.observacao_motivo,
        foto_nf_url: formDev.foto_nf_url,
        foto_material_url: formDev.foto_material_url,
        total_pecas: totalPecas,
        total_peso_kg: totalPesoKg,
        itens: formDev.itens,
        status: "concluido"
      };

      await base44.entities.DevolucaoExpedicao?.create?.(novaDev);
      queryClient.invalidateQueries({ queryKey: ["devolucoes-expedicao"] });

      toast.success("✅ Registro de Devolução salvo com sucesso!");
      setDialogNova(false);
      
      // Reset Form
      setFormDev({
        numero_pedido: "",
        numero_nf_devolucao: "",
        cliente: "",
        motorista: "",
        motivo: "avaria_transporte",
        observacao_motivo: "",
        foto_nf_url: "",
        foto_material_url: "",
        itens: [
          {
            id: "1",
            produto: "",
            quantidade_pecas: 1,
            comprimento_m: 6.0,
            peso_kg: 0,
            condicao: "proprio",
            local_destino: "A1"
          }
        ]
      });
    } catch {
      toast.error("Erro ao salvar devolução no sistema.");
    }
  };

  // KPIs
  const totalDevolucoesMes = devolucoes.length;
  const totalPecasDevolvidas = devolucoes.reduce((acc, d) => acc + (d.total_pecas || 0), 0);
  const totalPesoKgDevolvido = devolucoes.reduce((acc, d) => acc + (d.total_peso_kg || 0), 0);

  // Filtros de busca
  const devolucoesFiltradas = devolucoes.filter(d => {
    const matchBusca = (d.numero_pedido || "").toLowerCase().includes(busca.toLowerCase()) ||
                       (d.cliente || "").toLowerCase().includes(busca.toLowerCase()) ||
                       (d.numero_nf_devolucao || "").toLowerCase().includes(busca.toLowerCase());
    const matchMotivo = filtroMotivo === "todos" || d.motivo === filtroMotivo;
    return matchBusca && matchMotivo;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3 border-b pb-4">
        <div>
          <button onClick={() => navigate("/expedicao")} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1 font-medium">
            <ChevronLeft className="w-3.5 h-3.5" /> Voltar para Expedição
          </button>
          <h1 className="text-2xl font-extrabold flex items-center gap-2 text-slate-900 dark:text-white">
            <RotateCcw className="w-7 h-7 text-teal-600" /> Registro de Devoluções de Materiais
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Controle de avarias, recusas de cliente, contagem de peças e retorno ao estoque
          </p>
        </div>

        <Button
          onClick={() => setDialogNova(true)}
          className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm shadow-md"
        >
          <Plus className="w-4 h-4" /> Nova Devolução
        </Button>
      </div>

      {/* ── KPIs Dashboard Header ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border-2 border-teal-500/20 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center text-teal-600">
            <RotateCcw className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Devoluções Registradas</p>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">{totalDevolucoesMes}</h3>
            <p className="text-[10px] text-teal-600 font-medium">no período atual</p>
          </div>
        </div>

        <div className="bg-card border-2 border-amber-500/20 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Total de Peças Devolvidas</p>
            <h3 className="text-2xl font-black text-amber-700 dark:text-amber-400">{totalPecasDevolvidas} <span className="text-xs font-normal">peças</span></h3>
            <p className="text-[10px] text-muted-foreground">contagem verificada</p>
          </div>
        </div>

        <div className="bg-card border-2 border-blue-500/20 rounded-2xl p-4 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600">
            <Truck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-semibold">Peso Total Devolvido</p>
            <h3 className="text-2xl font-black text-blue-700 dark:text-blue-400">{(totalPesoKgDevolvido / 1000).toFixed(2)} <span className="text-xs font-normal">toneladas</span></h3>
            <p className="text-[10px] text-muted-foreground">{totalPesoKgDevolvido.toLocaleString("pt-BR")} kg</p>
          </div>
        </div>
      </div>

      {/* ── Filtros de Busca ── */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-card border p-3.5 rounded-2xl shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={busca}
            onChange={e => setBusca(e.target.value)}
            placeholder="Buscar por Pedido, NF ou Cliente..."
            className="pl-9 text-xs font-medium"
          />
        </div>

        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
          <Select value={filtroMotivo} onValueChange={setFiltroMotivo}>
            <SelectTrigger className="w-56 text-xs font-semibold">
              <Filter className="w-3.5 h-3.5 mr-2 text-teal-600" />
              <SelectValue placeholder="Filtrar por Motivo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os Motivos</SelectItem>
              {MOTIVOS_DEVOLUCAO.map(m => (
                <SelectItem key={m.id} value={m.id} className="text-xs">
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Lista de Registros de Devolução ── */}
      {devolucoesFiltradas.length === 0 ? (
        <div className="border-2 border-dashed rounded-2xl p-12 text-center space-y-3 bg-slate-50/50 dark:bg-slate-900/20">
          <RotateCcw className="w-12 h-12 mx-auto text-slate-400" />
          <h3 className="font-bold text-base text-slate-700 dark:text-slate-300">Nenhuma devolução encontrada</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Clique no botão <strong>"+ Nova Devolução"</strong> acima para registrar o retorno de pedidos, avarias de carga ou recusas de cliente.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {devolucoesFiltradas.map(dev => {
            const motivoObj = MOTIVOS_DEVOLUCAO.find(m => m.id === dev.motivo);
            const dataFormatada = dev.data_devolucao ? new Date(dev.data_devolucao).toLocaleString("pt-BR") : "Data n/d";

            return (
              <div key={dev.id} className="border-2 border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-card shadow-sm hover:border-teal-400 transition-all space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold font-mono">
                      #{dev.numero_pedido || dev.numero_nf_devolucao || "DEV"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-base text-slate-900 dark:text-white">
                          Pedido #{dev.numero_pedido || "Sem Nº"}
                        </span>
                        {dev.numero_nf_devolucao && (
                          <Badge variant="outline" className="font-mono text-xs">
                            NF-e {dev.numero_nf_devolucao}
                          </Badge>
                        )}
                        <Badge className={`text-xs border ${motivoObj?.badge || "bg-slate-100 text-slate-800"}`}>
                          {motivoObj?.label || dev.motivo}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-3 mt-1">
                        <span>👤 <strong>Cliente:</strong> {dev.cliente}</span>
                        <span>📅 {dataFormatada}</span>
                      </p>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDevolucaoSel(dev)}
                    className="gap-1.5 text-xs text-teal-700 border-teal-400 font-bold hover:bg-teal-50"
                  >
                    <Eye className="w-3.5 h-3.5" /> Detalhes & Fotos
                  </Button>
                </div>

                {/* Itens Devolvidos */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Itens Devolvidos ({dev.itens?.length || 0})</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {dev.itens?.map((item, idx) => (
                      <div key={idx} className="bg-slate-50 dark:bg-slate-900 border rounded-xl p-3 text-xs space-y-1">
                        <div className="font-bold text-slate-800 dark:text-slate-200 truncate">
                          {item.produto}
                        </div>
                        <div className="flex justify-between text-muted-foreground text-[11px]">
                          <span>{item.quantidade_pecas} peças ({item.comprimento_m}m)</span>
                          <span className="font-bold text-teal-600">📍 {item.local_destino || "A1"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fotos da Devolução (NF e Peças) */}
                {(dev.foto_nf_url || dev.foto_material_url) && (
                  <div className="flex items-center gap-3 pt-2 border-t text-xs">
                    <span className="text-muted-foreground font-semibold">Evidências Fotográficas:</span>
                    {dev.foto_nf_url && (
                      <a href={dev.foto_nf_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-teal-600 font-bold hover:underline">
                        <FileText className="w-3.5 h-3.5" /> Foto da NF
                      </a>
                    )}
                    {dev.foto_material_url && (
                      <a href={dev.foto_material_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-teal-600 font-bold hover:underline">
                        <Camera className="w-3.5 h-3.5" /> Foto do Material
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialog: Nova Devolução ── */}
      <Dialog open={dialogNova} onOpenChange={setDialogNova}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-teal-700">
              <RotateCcw className="w-5 h-5 text-teal-600" /> Registrar Nova Devolução de Material
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-3">
            {/* Seção 1: Dados do Pedido & Cliente */}
            <div className="border rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-teal-600 flex items-center gap-1.5">
                <FileText className="w-4 h-4" /> 1. Identificação do Pedido & Cliente
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nº do Pedido de Origem *</Label>
                  <Input
                    value={formDev.numero_pedido}
                    onChange={e => setFormDev(f => ({ ...f, numero_pedido: e.target.value }))}
                    placeholder="Ex: 0180517"
                    className="font-bold text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Nº NF de Devolução (se houver)</Label>
                  <Input
                    value={formDev.numero_nf_devolucao}
                    onChange={e => setFormDev(f => ({ ...f, numero_nf_devolucao: e.target.value }))}
                    placeholder="Ex: 45091"
                    className="font-bold text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Cliente / Destinatário *</Label>
                  <Input
                    value={formDev.cliente}
                    onChange={e => setFormDev(f => ({ ...f, cliente: e.target.value }))}
                    placeholder="Ex: AJL COM DE FERRAGENS"
                    className="font-bold text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Seção 2: Motivo do Retorno */}
            <div className="border rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> 2. Motivo da Devolução
              </h3>

              <div className="space-y-2">
                <Label className="text-xs font-semibold">Selecione o Motivo Principal *</Label>
                <Select value={formDev.motivo} onValueChange={v => setFormDev(f => ({ ...f, motivo: v }))}>
                  <SelectTrigger className="font-bold text-xs">
                    <SelectValue placeholder="Selecione o motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MOTIVOS_DEVOLUCAO.map(m => (
                      <SelectItem key={m.id} value={m.id} className="text-xs font-semibold">
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="space-y-1 pt-1">
                  <Label className="text-xs font-semibold">Observações do Ocorrido / Avaria</Label>
                  <Textarea
                    value={formDev.observacao_motivo}
                    onChange={e => setFormDev(f => ({ ...f, observacao_motivo: e.target.value }))}
                    placeholder="Descreva detalhes como ponta amassada, cor trocada ou recusa pelo cliente..."
                    className="text-xs h-16"
                  />
                </div>
              </div>
            </div>

            {/* Seção 3: Peças Retornadas & Contagem */}
            <div className="border rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-extrabold text-xs uppercase tracking-wider text-teal-600 flex items-center gap-1.5">
                  <Package className="w-4 h-4" /> 3. Contagem & Condição das Peças ({formDev.itens.length})
                </h3>
                <Button type="button" size="sm" variant="outline" onClick={handleAddItem} className="gap-1 text-xs text-teal-700 border-teal-400">
                  <Plus className="w-3.5 h-3.5" /> Adicionar Outro Produto
                </Button>
              </div>

              {formDev.itens.map((item, idx) => (
                <div key={item.id} className="border-2 border-slate-300 dark:border-slate-700 rounded-xl p-3.5 bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-teal-700">Item #{idx + 1} Devolvido</span>
                    <button type="button" onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                    <div className="sm:col-span-2 space-y-1">
                      <Label className="text-[11px] font-semibold">Descrição do Produto / Perfil *</Label>
                      <Input
                        value={item.produto}
                        onChange={e => handleUpdateItem(item.id, "produto", e.target.value)}
                        placeholder="Ex: TUBO RED 11/4 CH 1,25 GI"
                        className="font-bold text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Qtd Peças / Barras *</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantidade_pecas}
                        onChange={e => handleUpdateItem(item.id, "quantidade_pecas", Number(e.target.value))}
                        className="font-bold text-xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Comprimento (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={item.comprimento_m}
                        onChange={e => handleUpdateItem(item.id, "comprimento_m", Number(e.target.value))}
                        className="font-bold text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t pt-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold">Condição Física do Material</Label>
                      <Select value={item.condicao} onValueChange={v => handleUpdateItem(item.id, "condicao", v)}>
                        <SelectTrigger className="text-xs font-semibold h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CONDIÇÕES_MATERIAL.map(c => (
                            <SelectItem key={c.id} value={c.id} className="text-xs">
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-teal-600" /> Destino de Re-estocagem
                      </Label>
                      <Select value={item.local_destino} onValueChange={v => handleUpdateItem(item.id, "local_destino", v)}>
                        <SelectTrigger className="text-xs font-bold uppercase h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCAIS_ARMAZENAGEM.map(l => (
                            <SelectItem key={l.id} value={l.id} className="text-xs font-semibold">
                              📍 {l.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Seção 4: Evidências Fotográficas (Fotos da NF e do Material) */}
            <div className="border rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-teal-600 flex items-center gap-1.5">
                <Camera className="w-4 h-4" /> 4. Evidências Fotográficas Obrigatórias
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Foto da NF / Pedido */}
                <div className="space-y-1 border p-3 rounded-xl bg-card">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-teal-600" /> Foto da Nota de Devolução / Pedido *
                  </Label>
                  {uploadingField === "foto_nf_url" ? (
                    <div className="flex items-center gap-2 text-xs text-teal-600 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Enviando foto da NF...
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-teal-400 text-teal-700 flex-1 font-semibold"
                        onClick={() => nfCamRef.current?.click()}>
                        <Camera className="w-3.5 h-3.5 text-teal-600" /> Câmera
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-teal-400 text-teal-700 flex-1"
                        onClick={() => nfFileRef.current?.click()}>
                        <Upload className="w-3.5 h-3.5" /> Galeria / PDF
                      </Button>

                      <input ref={nfCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => handleFileUpload("foto_nf_url", e.target.files?.[0])} />
                      <input ref={nfFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                        onChange={e => handleFileUpload("foto_nf_url", e.target.files?.[0])} />
                    </div>
                  )}
                  {formDev.foto_nf_url && (
                    <img src={formDev.foto_nf_url} alt="Foto NF" className="mt-2 max-h-24 rounded border object-cover shadow-sm" />
                  )}
                </div>

                {/* Foto do Material Devolvido */}
                <div className="space-y-1 border p-3 rounded-xl bg-card">
                  <Label className="text-xs font-semibold flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-teal-600" /> Foto do Material / Peças Devolvidas *
                  </Label>
                  {uploadingField === "foto_material_url" ? (
                    <div className="flex items-center gap-2 text-xs text-teal-600 py-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Enviando foto do material...
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-teal-400 text-teal-700 flex-1 font-semibold"
                        onClick={() => matCamRef.current?.click()}>
                        <Camera className="w-3.5 h-3.5 text-teal-600" /> Câmera
                      </Button>
                      <Button type="button" variant="outline" size="sm" className="gap-1 text-xs border-teal-400 text-teal-700 flex-1"
                        onClick={() => matFileRef.current?.click()}>
                        <Upload className="w-3.5 h-3.5" /> Galeria / PDF
                      </Button>

                      <input ref={matCamRef} type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => handleFileUpload("foto_material_url", e.target.files?.[0])} />
                      <input ref={matFileRef} type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                        onChange={e => handleFileUpload("foto_material_url", e.target.files?.[0])} />
                    </div>
                  )}
                  {formDev.foto_material_url && (
                    <img src={formDev.foto_material_url} alt="Foto Material" className="mt-2 max-h-24 rounded border object-cover shadow-sm" />
                  )}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNova(false)}>Cancelar</Button>
            <Button onClick={handleSalvarDevolucao} className="bg-teal-600 hover:bg-teal-700 text-white font-bold gap-2">
              <CheckCircle2 className="w-4 h-4" /> Confirmar e Salvar Devolução
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
