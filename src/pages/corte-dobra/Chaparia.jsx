import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Layers, ShoppingCart, Warehouse, Search,
  CheckCircle2, RefreshCw, X, Plus, Paperclip, Loader2,
  FileCheck, ShieldCheck, Camera, Lock, ScanLine
} from "lucide-react";
import { abrirAdobeScan } from "@/lib/adobeScan";
import ChapaFormDialog from "@/components/corte-dobra/ChapaFormDialog";
import ChapaCard from "@/components/corte-dobra/ChapaCard";
import { useFilial } from "@/contexts/FilialContext";

function EditarQuantDialog({ chapa, open, onClose, onSave }) {
  const [qtd, setQtd] = useState(chapa?.quantidade_disponivel || 0);
  const [status, setStatus] = useState(chapa?.status || "disponivel");
  const [material, setMaterial] = useState(chapa?.material || "");
  const [qualidade, setQualidade] = useState(chapa?.qualidade || "");
  const [espessura, setEspessura] = useState(chapa?.espessura_mm || "");
  const [comprimento, setComprimento] = useState(chapa?.comprimento_mm || "");
  const [largura, setLargura] = useState(chapa?.largura_mm || "");
  const [pesoKg, setPesoKg] = useState(chapa?.peso_kg || "");
  const [destino, setDestino] = useState(chapa?.destino || "estoque");
  const [cliente, setCliente] = useState(chapa?.cliente || "");
  const [numeroPedido, setNumeroPedido] = useState(chapa?.numero_pedido || "");
  const [nf, setNf] = useState(chapa?.nf || "");
  const [observacoes, setObservacoes] = useState(chapa?.observacoes || "");
  const [motivo, setMotivo] = useState("");
  const [anexoUrl, setAnexoUrl] = useState("");
  const [anexoNome, setAnexoNome] = useState("");
  const [anexoNfUrl, setAnexoNfUrl] = useState(chapa?.anexo_nf_url || "");
  const [anexoNfNome, setAnexoNfNome] = useState(chapa?.anexo_nf_nome || "");
  const [anexoCfUrl, setAnexoCfUrl] = useState(chapa?.anexo_cf_url || "");
  const [anexoCfNome, setAnexoCfNome] = useState(chapa?.anexo_cf_nome || "");
  const [uploading, setUploading] = useState(false);
  const [uploadingNF, setUploadingNF] = useState(false);
  const [uploadingCF, setUploadingCF] = useState(false);
  const fileRef = useRef();
  const fileScanRef = useRef();
  const nfFileRef = useRef();
  const nfCameraRef = useRef();
  const cfFileRef = useRef();
  const cfCameraRef = useRef();

  React.useEffect(() => {
    if (open && chapa) {
      setQtd(chapa.quantidade_disponivel ?? 0);
      setStatus(chapa.status || "disponivel");
      setMaterial(chapa.material || "");
      setQualidade(chapa.qualidade || "");
      setEspessura(chapa.espessura_mm || "");
      setComprimento(chapa.comprimento_mm || "");
      setLargura(chapa.largura_mm || "");
      setPesoKg(chapa.peso_kg || "");
      setDestino(chapa.destino || "estoque");
      setCliente(chapa.cliente || "");
      setNumeroPedido(chapa.numero_pedido || "");
      setNf(chapa.nf || "");
      setObservacoes(chapa.observacoes || "");
      setMotivo("");
      setAnexoUrl("");
      setAnexoNome("");
      setAnexoNfUrl(chapa.anexo_nf_url || "");
      setAnexoNfNome(chapa.anexo_nf_nome || "");
      setAnexoCfUrl(chapa.anexo_cf_url || "");
      setAnexoCfNome(chapa.anexo_cf_nome || "");
    }
  }, [open, chapa]);

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAnexoUrl(file_url);
    setAnexoNome(file.name);
    setUploading(false);
  };

  const handleUploadNF = async (file) => {
    if (!file) return;
    setUploadingNF(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAnexoNfUrl(file_url);
    setAnexoNfNome(file.name);
    setUploadingNF(false);
  };

  const handleUploadCF = async (file) => {
    if (!file) return;
    setUploadingCF(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setAnexoCfUrl(file_url);
    setAnexoCfNome(file.name);
    setUploadingCF(false);
  };

  const algoMudou = qtd !== (chapa?.quantidade_disponivel ?? 0)
    || status !== (chapa?.status || "disponivel")
    || material !== (chapa?.material || "")
    || qualidade !== (chapa?.qualidade || "")
    || String(espessura) !== String(chapa?.espessura_mm || "")
    || String(comprimento) !== String(chapa?.comprimento_mm || "")
    || String(largura) !== String(chapa?.largura_mm || "")
    || String(pesoKg) !== String(chapa?.peso_kg || "")
    || destino !== (chapa?.destino || "estoque")
    || cliente !== (chapa?.cliente || "")
    || numeroPedido !== (chapa?.numero_pedido || "")
    || nf !== (chapa?.nf || "")
    || observacoes !== (chapa?.observacoes || "")
    || anexoNfUrl !== (chapa?.anexo_nf_url || "")
    || anexoCfUrl !== (chapa?.anexo_cf_url || "");
  const canSave = (motivo.trim() && algoMudou) || (motivo.trim() && anexoUrl);

  const handleSave = () => {
    const historicoAntigo = chapa?.historico_movimentacoes;
    let historico = [];
    try { if (historicoAntigo) historico = JSON.parse(historicoAntigo); } catch {}
    historico.push({
      data: new Date().toISOString(),
      motivo: motivo.trim(),
      qtd_antes: chapa?.quantidade_disponivel ?? 0,
      qtd_depois: qtd,
      status_antes: chapa?.status || "disponivel",
      status_depois: status,
      anexo_url: anexoUrl || null,
      anexo_nome: anexoNome || null,
    });
    onSave({
      quantidade_disponivel: qtd,
      status,
      material: material || null,
      qualidade: qualidade || null,
      espessura_mm: espessura ? Number(espessura) : null,
      comprimento_mm: comprimento ? Number(comprimento) : null,
      largura_mm: largura ? Number(largura) : null,
      peso_kg: pesoKg ? Number(pesoKg) : null,
      destino,
      cliente: destino === "pedido_direto" ? (cliente || null) : null,
      numero_pedido: destino === "pedido_direto" ? (numeroPedido || null) : null,
      nf: nf || null,
      anexo_nf_url: anexoNfUrl || null,
      anexo_nf_nome: anexoNfNome || null,
      anexo_cf_url: anexoCfUrl || null,
      anexo_cf_nome: anexoCfNome || null,
      observacoes: observacoes || null,
      historico_movimentacoes: JSON.stringify(historico),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Atualizar Chapa</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Quantidade Disponível</Label>
              <Input type="number" value={qtd} onChange={e => setQtd(Number(e.target.value))} min={0} max={chapa?.quantidade_total} />
              <p className="text-xs text-muted-foreground">Total original: {chapa?.quantidade_total} pcs</p>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="parcial">Parcial</SelectItem>
                  <SelectItem value="consumido">Consumido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Material</Label>
              <Select value={material || ""} onValueChange={v => setMaterial(v || "")}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Chapa xadrez">Chapa xadrez</SelectItem>
                  <SelectItem value="Chapa lisa">Chapa lisa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Qualidade</Label>
              <Select value={qualidade} onValueChange={setQualidade}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="GV">GV</SelectItem>
                  <SelectItem value="FF">FF</SelectItem>
                  <SelectItem value="PP">PP</SelectItem>
                  <SelectItem value="FQ">FQ</SelectItem>
                  <SelectItem value="GL (IMP)">GL (IMP)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label>Espessura (mm)</Label>
              <Input type="number" step="0.01" placeholder="0.95" value={espessura} onChange={e => setEspessura(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Comprimento (mm)</Label>
              <Input type="number" placeholder="6000" value={comprimento} onChange={e => setComprimento(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Largura (mm)</Label>
              <Input type="number" placeholder="1200" value={largura} onChange={e => setLargura(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Peso (kg)</Label>
              <Input type="number" step="0.01" placeholder="Ex: 150,5" value={pesoKg} onChange={e => setPesoKg(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Destino</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="estoque">Estoque</SelectItem>
                  <SelectItem value="pedido_direto">Pedido Direto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {destino === "pedido_direto" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Nº Pedido</Label>
                <Input placeholder="Ex: PED-123" value={numeroPedido} onChange={e => setNumeroPedido(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Cliente</Label>
                <Input placeholder="Nome do cliente" value={cliente} onChange={e => setCliente(e.target.value)} />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label>NF (Nota Fiscal)</Label>
            <Input placeholder="Ex: 123456" value={nf} onChange={e => setNf(e.target.value)} />
          </div>

          {/* Anexos NF + CF */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">Anexos</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* NF */}
              <div className="space-y-1.5">
                <input ref={nfFileRef} type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => handleUploadNF(e.target.files[0])} />
                <input ref={nfCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => handleUploadNF(e.target.files[0])} />
                {anexoNfUrl ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <FileCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <a href={anexoNfUrl} target="_blank" rel="noopener noreferrer"
                      className="truncate flex-1 underline underline-offset-2 font-medium" title={anexoNfNome}>
                      {anexoNfNome || "NF anexada"}
                    </a>
                    <button onClick={() => { setAnexoNfUrl(""); setAnexoNfNome(""); }}
                      className="text-emerald-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="flex-1 border-dashed border-2 h-10 text-xs gap-1.5"
                      onClick={() => nfFileRef.current.click()} disabled={uploadingNF}>
                      {uploadingNF ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                      {uploadingNF ? "Enviando..." : "Anexar NF"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="border-dashed border-2 h-10 px-3"
                      onClick={() => nfCameraRef.current.click()} disabled={uploadingNF} title="Câmera">
                      <Camera className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="border-dashed border-2 h-10 px-3"
                      onClick={() => abrirAdobeScan(nfFileRef)} disabled={uploadingNF} title="Adobe Scan">
                      <ScanLine className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* CF */}
              <div className="space-y-1.5">
                <input ref={cfFileRef} type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => handleUploadCF(e.target.files[0])} />
                <input ref={cfCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => handleUploadCF(e.target.files[0])} />
                {anexoCfUrl ? (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                    <a href={anexoCfUrl} target="_blank" rel="noopener noreferrer"
                      className="truncate flex-1 underline underline-offset-2 font-medium" title={anexoCfNome}>
                      {anexoCfNome || "CF anexado"}
                    </a>
                    <button onClick={() => { setAnexoCfUrl(""); setAnexoCfNome(""); }}
                      className="text-blue-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <div className="flex gap-1.5">
                    <Button type="button" variant="outline" size="sm" className="flex-1 border-dashed border-2 h-10 text-xs gap-1.5"
                      onClick={() => cfFileRef.current.click()} disabled={uploadingCF}>
                      {uploadingCF ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                      {uploadingCF ? "Enviando..." : "Anexar CF"}
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="border-dashed border-2 h-10 px-3"
                      onClick={() => cfCameraRef.current.click()} disabled={uploadingCF} title="Câmera">
                      <Camera className="w-4 h-4" />
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="border-dashed border-2 h-10 px-3"
                      onClick={() => abrirAdobeScan(cfFileRef)} disabled={uploadingCF} title="Adobe Scan">
                      <ScanLine className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observações</Label>
            <Input placeholder="Observações gerais..." value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Motivo da alteração *</Label>
            <Input placeholder="Ex: consumo em produção, perda..." value={motivo} onChange={e => setMotivo(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Anexar imagem (opcional)</Label>
            <input ref={fileRef} type="file" className="hidden" accept="image/*" capture="environment"
              onChange={e => handleUpload(e.target.files[0])} />
            <input ref={fileScanRef} type="file" className="hidden" accept="image/*"
              onChange={e => handleUpload(e.target.files[0])} />
            {anexoUrl ? (
              <div className="flex items-center gap-2 rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs">
                <img src={anexoUrl} alt="Anexo" className="w-10 h-10 object-cover rounded" />
                <span className="truncate flex-1 text-emerald-800 font-medium">{anexoNome}</span>
                <button onClick={() => { setAnexoUrl(""); setAnexoNome(""); }} className="text-emerald-600 hover:text-red-500"><X className="w-3 h-3" /></button>
              </div>
            ) : (
              <div className="flex gap-1.5">
                <Button type="button" variant="outline" className="flex-1 border-dashed border-2 h-10 text-sm gap-2"
                  onClick={() => fileRef.current.click()} disabled={uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  {uploading ? "Enviando..." : "Anexar imagem"}
                </Button>
                <Button type="button" variant="outline" className="border-dashed border-2 h-10 px-3" title="Adobe Scan"
                  onClick={() => abrirAdobeScan(fileScanRef)} disabled={uploading}>
                  <ScanLine className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Chaparia() {
  const qc = useQueryClient();
  const { filialAtiva } = useFilial();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroDestino, setFiltroDestino] = useState("todos");
  const [filtroQualidade, setFiltroQualidade] = useState("todos");
  const [filtroOrigem, setFiltroOrigem] = useState("todos");
  const [filtroMaterial, setFiltroMaterial] = useState("");
  const [editChapa, setEditChapa] = useState(null);
  const [fotoViewer, setFotoViewer] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);
  const isAdmin = user?.role === "admin";

  const { data: chapas = [], isLoading } = useQuery({
    queryKey: ["chapas-cd", filialAtiva],
    queryFn: () => base44.entities.ChapaCD.filter({ unidade: filialAtiva }, "-created_date", 200),
  });

  const { data: chapasGlobais = [] } = useQuery({
    queryKey: ["chapas-cd-global-codigos"],
    queryFn: () => base44.entities.ChapaCD.list("-created_date", 1000),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ChapaCD.update(id, data),
    onSuccess: () => { qc.invalidateQueries(["chapas-cd"]); setEditChapa(null); },
  });

  const deleteMut = useMutation({
    mutationFn: (id) => base44.entities.ChapaCD.delete(id),
    onSuccess: () => qc.invalidateQueries(["chapas-cd"]),
  });

  const createMut = useMutation({
    mutationFn: (data) => base44.entities.ChapaCD.create(data),
    onSuccess: () => { qc.invalidateQueries(["chapas-cd"]); setShowForm(false); },
  });

  // Próximo código CHxxxx
  const proximoCodigo = (() => {
    let maxN = 0;
    chapasGlobais.forEach(c => {
      const m = c.codigo?.match(/^CH(\d+)$/);
      if (m) { const n = parseInt(m[1], 10); if (n > maxN) maxN = n; }
    });
    return `CH${String(maxN + 1).padStart(4, "0")}`;
  })();

  const filtradas = chapas.filter(c => {
    const matchBusca = !busca || [c.codigo, c.bobina_descricao, c.numero_pedido, c.cliente, c.material, c.qualidade].some(v => v?.toLowerCase().includes(busca.toLowerCase()));
    const matchStatus = filtroStatus === "todos" || c.status === filtroStatus || (filtroStatus === "disponivel" && !c.status);
    const matchDestino = filtroDestino === "todos" || c.destino === filtroDestino;
    const matchQualidade = filtroQualidade === "todos" || c.qualidade === filtroQualidade;
    const matchOrigem = filtroOrigem === "todos" || c.origem === filtroOrigem;
    const matchMaterial = !filtroMaterial || (c.material || "").toLowerCase().includes(filtroMaterial.toLowerCase());
    return matchBusca && matchStatus && matchDestino && matchQualidade && matchOrigem && matchMaterial;
  });

  const temFiltrosAtivos = filtroStatus !== "todos" || filtroDestino !== "todos" || filtroQualidade !== "todos" || filtroOrigem !== "todos" || !!filtroMaterial;
  const limparFiltros = () => {
    setBusca("");
    setFiltroStatus("todos");
    setFiltroDestino("todos");
    setFiltroQualidade("todos");
    setFiltroOrigem("todos");
    setFiltroMaterial("");
  };

  const totalDisponiveis = chapas.filter(c => (c.status === "disponivel" || !c.status) && c.destino === "estoque").reduce((s, c) => s + (c.quantidade_disponivel || 0), 0);
  const totalPedido = chapas.filter(c => (c.status === "disponivel" || !c.status) && c.destino === "pedido_direto").reduce((s, c) => s + (c.quantidade_disponivel || 0), 0);
  const totalConsumido = chapas.filter(c => c.status === "consumido").reduce((s, c) => s + (c.quantidade_total || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chaparia</h1>
          <p className="text-sm text-muted-foreground">Estoque de chapas — Desbobinadeira e entrada manual</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries(["chapas-cd"])} className="gap-1">
            <RefreshCw className="w-4 h-4" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Nova Chapa
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
          <Warehouse className="w-6 h-6 mx-auto mb-1 text-emerald-600" />
          <p className="text-2xl font-black text-emerald-700">{totalDisponiveis}</p>
          <p className="text-xs text-emerald-600 font-semibold">Chapas em Estoque</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
          <ShoppingCart className="w-6 h-6 mx-auto mb-1 text-blue-600" />
          <p className="text-2xl font-black text-blue-700">{totalPedido}</p>
          <p className="text-xs text-blue-600 font-semibold">Reservadas para Pedido</p>
        </div>
        <div className="bg-slate-50 border border-border rounded-xl p-4 text-center">
          <CheckCircle2 className="w-6 h-6 mx-auto mb-1 text-slate-500" />
          <p className="text-2xl font-black text-slate-600">{totalConsumido}</p>
          <p className="text-xs text-slate-500 font-semibold">Consumidas</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código, material, qualidade, cliente..."
              className="pl-9"
              value={busca}
              onChange={e => setBusca(e.target.value)}
            />
          </div>
          {temFiltrosAtivos && (
            <Button variant="ghost" size="sm" onClick={limparFiltros} className="text-muted-foreground hover:text-foreground shrink-0">
              <X className="w-3 h-3 mr-1" /> Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos status</SelectItem>
              <SelectItem value="disponivel">Disponível</SelectItem>
              <SelectItem value="parcial">Parcial</SelectItem>
              <SelectItem value="consumido">Consumido</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroDestino} onValueChange={setFiltroDestino}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Destino" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos destinos</SelectItem>
              <SelectItem value="estoque">Estoque</SelectItem>
              <SelectItem value="pedido_direto">Pedido Direto</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroQualidade} onValueChange={setFiltroQualidade}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue placeholder="Qualidade" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="GV">GV</SelectItem>
              <SelectItem value="FF">FF</SelectItem>
              <SelectItem value="PP">PP</SelectItem>
              <SelectItem value="FQ">FQ</SelectItem>
              <SelectItem value="GL (IMP)">GL (IMP)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Origem" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas origens</SelectItem>
              <SelectItem value="desbobinadeira">Desbobinadeira</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-40">
            <Input
              placeholder="Filtrar material..."
              className="h-8 text-xs pl-2"
              value={filtroMaterial}
              onChange={e => setFiltroMaterial(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground self-center ml-auto">
            {filtradas.length} de {chapas.length} chapas
          </p>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground text-sm">Carregando...</div>
      ) : filtradas.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">Nenhuma chapa encontrada</p>
          <p className="text-xs mt-1">As chapas aparecem aqui ao finalizar ordens da Desbobinadeira</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtradas.map(c => {
            const isConsumed = c.status === "consumido" || c.status === "cancelado";
            return (
              <ChapaCard
                key={c.id}
                chapa={c}
                isAdmin={isAdmin}
                isConsumed={isConsumed}
                onEdit={(chapa) => setEditChapa(chapa)}
                onDelete={(id) => deleteMut.mutate(id)}
                onViewFoto={(url) => setFotoViewer(url)}
              />
            );
          })}
        </div>
      )}

      {/* Dialog editar */}
      <EditarQuantDialog
        chapa={editChapa}
        open={!!editChapa}
        onClose={() => setEditChapa(null)}
        onSave={(data) => updateMut.mutate({ id: editChapa.id, data })}
      />

      {/* Form nova chapa manual */}
      <ChapaFormDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onSave={(data) => createMut.mutate({ ...data, unidade: filialAtiva })}
        proximoCodigo={proximoCodigo}
      />

      {/* Viewer foto */}
      {fotoViewer && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setFotoViewer(null)}>
          <div className="relative max-w-2xl w-full">
            <button className="absolute -top-10 right-0 text-white hover:text-slate-300" onClick={() => setFotoViewer(null)}>
              <X className="w-7 h-7" />
            </button>
            <img src={fotoViewer} alt="Foto de finalização" className="w-full rounded-xl shadow-2xl object-contain max-h-[80vh]" />
          </div>
        </div>
      )}
    </div>
  );
}