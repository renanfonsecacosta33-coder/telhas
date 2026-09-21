import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Paperclip, FileCheck, X, Loader2, ShieldCheck, Layers, Camera, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReservaPanel from "@/components/bobinas/ReservaPanel";
import UploadButton from "@/components/ui/UploadButton";
import ImageViewer from "@/components/ui/ImageViewer";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";
import { useAuth } from "@/lib/AuthContext";
import { auditarModificacaoBobina } from "@/lib/auditHelper";
import BobinaModeloCombobox from "@/components/bobinas/BobinaModeloCombobox";
import { lerNotaFiscalBobina } from "@/lib/nfReader";

const STATUS_OPTIONS = [
  "Aberta", "Fechada", "Finalizada", "Na TP40", "Na BOBININHA",
  "Matriz AJL", "Pinhais", "Ivaiporã", "Matriz - Frisada", "RESERVADA"
];

const QUALIDADE_OPTIONS = ["GV", "PP", "FF", "FQ", "GL (IMP)"];

export default function BobinaFormDialog({ open, onClose, editItem }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();
  const [form, setForm] = useState({
    cor: "", chapa: "", qualidade: "", origem: "Nacional", sub_cod: "", largura_mm: "", peso_kg: "", peso_inicial: "",
    metragem: "", codigo: "", nf: "", custo: "", status: "", fornecedor: "",
    data_recebimento: "", observacoes: "", tipo: "Telha",
    anexo_nf_url: "", anexo_nf_nome: "", anexo_cert_url: "", anexo_cert_nome: "",
    foto_cor_url: "", foto_cor_nome: "",
    estoque_minimo_kg: "", consumo_diario_kg: "",
  });

  const [saving, setSaving] = useState(false);
  const [uploadingNF, setUploadingNF] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingFotoCor, setUploadingFotoCor] = useState(false);
  const [semCertAssinatura, setSemCertAssinatura] = useState("");
  const [confirmarSemCert, setConfirmarSemCert] = useState(false);
  const [erros, setErros] = useState({});
  const [viewer, setViewer] = useState({ open: false, url: "", name: "" });
  const [bobinaModeloId, setBobinaModeloId] = useState("");
  const formTopRef = useRef();
  const nfInputRef = useRef();
  const nfCameraRef = useRef();
  const certInputRef = useRef();
  const certCameraRef = useRef();
  const fotoCorInputRef = useRef();
  const fotoCorCameraRef = useRef();

  // Busca todas as bobinas da fábrica para servir como modelo e sugestões
  const { data: todasBobinas = [] } = useQuery({
    queryKey: ["todas-bobinas-modelo"],
    queryFn: () => base44.entities.Bobina.list("-created_date", 2000),
    enabled: open,
    staleTime: 60000,
  });

  // Extrai listas únicas ordenadas de cores, chapas e fornecedores
  const listaCores = useMemo(() => {
    const s = new Set();
    todasBobinas.forEach(b => { if (b?.cor?.trim()) s.add(b.cor.trim()); });
    return Array.from(s).sort();
  }, [todasBobinas]);

  const listaChapas = useMemo(() => {
    const s = new Set();
    todasBobinas.forEach(b => {
      if (b?.chapa !== undefined && b?.chapa !== null && String(b.chapa).trim()) {
        s.add(String(b.chapa).trim());
      }
    });
    return Array.from(s).sort();
  }, [todasBobinas]);

  const listaFornecedores = useMemo(() => {
    const s = new Set();
    todasBobinas.forEach(b => { if (b?.fornecedor?.trim()) s.add(b.fornecedor.trim()); });
    return Array.from(s).sort();
  }, [todasBobinas]);

  useEffect(() => {
    setErros({});
    if (editItem) {
      setBobinaModeloId(editItem.id || editItem.codigo || "");
      setForm({
        cor: editItem.cor || "",
        chapa: editItem.chapa || "",
        qualidade: editItem.qualidade || "",
        origem: editItem.origem || "Nacional",
        sub_cod: editItem.sub_cod || "",
        largura_mm: editItem.largura_mm || "",
        peso_kg: editItem.peso_kg || "",
        peso_inicial: editItem.peso_inicial || "",
        metragem: editItem.metragem || "",
        codigo: editItem.codigo || "",
        nf: editItem.nf || "",
        custo: editItem.custo || "",
        status: editItem.status || "",
        fornecedor: editItem.fornecedor || "",
        data_recebimento: editItem.data_recebimento || "",
        observacoes: editItem.observacoes || "",
        tipo: "Telha",
        anexo_nf_url: editItem.anexo_nf_url || "",
        anexo_nf_nome: editItem.anexo_nf_nome || "",
        anexo_cert_url: editItem.anexo_cert_url || "",
        anexo_cert_nome: editItem.anexo_cert_nome || "",
        foto_cor_url: editItem.foto_cor_url || "",
        foto_cor_nome: editItem.foto_cor_nome || "",
        estoque_minimo_kg: editItem.estoque_minimo_kg || "",
        consumo_diario_kg: editItem.consumo_diario_kg || "",
        reservada: editItem.reservada || false,
        reserva_tipo: editItem.reserva_tipo || "",
        reserva_kg: editItem.reserva_kg || "",
        reserva_numero_pedido: editItem.reserva_numero_pedido || "",
        reserva_motivo: editItem.reserva_motivo || "",
        reserva_autorizado_por: editItem.reserva_autorizado_por || "",
        reserva_data: editItem.reserva_data || "",
      });
    } else {
      setBobinaModeloId("");
      setForm({
        cor: "", chapa: "", qualidade: "", origem: "Nacional", sub_cod: "", largura_mm: "", peso_kg: "", peso_inicial: "",
        metragem: "", codigo: "Gerando...", nf: "", custo: "", status: "", fornecedor: "",
        data_recebimento: new Date().toISOString().slice(0, 10), observacoes: "", tipo: "Telha",
        anexo_nf_url: "", anexo_nf_nome: "", anexo_cert_url: "", anexo_cert_nome: "",
        foto_cor_url: "", foto_cor_nome: "",
        estoque_minimo_kg: "500", consumo_diario_kg: "",
        reservada: false, reserva_tipo: "", reserva_kg: "", reserva_numero_pedido: "",
        reserva_motivo: "", reserva_autorizado_por: "", reserva_data: "",
      });
      setSemCertAssinatura("");
      setConfirmarSemCert(false);
      gerarProximoCodigo().then(codigo => set("codigo", codigo)).catch(() => {});
    }
  }, [editItem, open]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const calcMetragem = (peso, largura, chapa) => {
    const p = Number(peso);
    const l = Number(largura) / 1000;
    const esp = parseFloat(String(chapa).replace(",", ".")) / 1000;
    if (p > 0 && l > 0 && esp > 0) return Math.round(p / (l * esp * 7850));
    return "";
  };

  const handleSelecionarModelo = (bobina) => {
    if (!bobina) return;
    setBobinaModeloId(bobina.id || bobina.codigo || "");

    const novaLargura = bobina.largura_mm !== undefined && bobina.largura_mm !== null ? String(bobina.largura_mm) : form.largura_mm;
    const novaChapa = bobina.chapa !== undefined && bobina.chapa !== null ? String(bobina.chapa) : form.chapa;
    const novaMetragem = calcMetragem(form.peso_kg, novaLargura, novaChapa);

    setForm(f => ({
      ...f,
      cor: bobina.cor || f.cor,
      chapa: novaChapa,
      qualidade: bobina.qualidade || f.qualidade,
      origem: bobina.origem || f.origem || "Nacional",
      sub_cod: bobina.sub_cod || f.sub_cod,
      largura_mm: novaLargura,
      metragem: novaMetragem || f.metragem,
      custo: bobina.custo !== undefined && bobina.custo !== null ? String(bobina.custo) : f.custo,
      fornecedor: bobina.fornecedor || f.fornecedor,
      estoque_minimo_kg: bobina.estoque_minimo_kg !== undefined && bobina.estoque_minimo_kg !== null ? String(bobina.estoque_minimo_kg) : f.estoque_minimo_kg,
      consumo_diario_kg: bobina.consumo_diario_kg !== undefined && bobina.consumo_diario_kg !== null ? String(bobina.consumo_diario_kg) : f.consumo_diario_kg,
    }));

    toast.success(`Especificações da bobina ${bobina.codigo || ""} copiadas com sucesso!`);
  };

  const handleLimparModelo = () => {
    setBobinaModeloId("");
  };

  const handlePesoChange = (val) => {
    const metragem = calcMetragem(val, form.largura_mm, form.chapa);
    setForm(f => ({ ...f, peso_kg: val, metragem }));
  };

  const handleLarguraChange = (val) => {
    const metragem = calcMetragem(form.peso_kg, val, form.chapa);
    setForm(f => ({ ...f, largura_mm: val, metragem }));
  };

  const handleChapaChange = (val) => {
    const metragem = calcMetragem(form.peso_kg, form.largura_mm, val);
    setForm(f => ({ ...f, chapa: val, metragem }));
  };

  const gerarProximoCodigo = async () => {
    // Busca TODAS as bobinas de telhas (incluindo arquivadas) para garantir código único
    const bobinas = await base44.entities.Bobina.filter({ setor: "telhas" }, "codigo", 2000);
    const numeros = bobinas
      .map(b => b.codigo)
      .filter(c => c && /^TE\d{4}$/i.test(c))
      .map(c => parseInt(c.slice(2)));
    const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
    return `TE${String(proximo).padStart(4, "0")}`;
  };

  const [lendoNF, setLendoNF] = useState(false);

  const handleProcessarNF = async (file) => {
    if (!file) return;
    setLendoNF(true);
    setUploadingNF(true);
    try {
      toast.info("Processando imagem da Nota Fiscal com IA...", { duration: 3500 });
      const { file_url, file_name, dados } = await lerNotaFiscalBobina(file);

      const novaLargura = dados.largura_mm ? String(dados.largura_mm) : form.largura_mm;
      const novaChapa = dados.chapa ? String(dados.chapa) : form.chapa;
      const novoPeso = dados.peso_liquido_kg
        ? String(dados.peso_liquido_kg)
        : (dados.peso_bruto_kg ? String(dados.peso_bruto_kg) : form.peso_kg);
      const novoPesoInicial = dados.peso_bruto_kg
        ? String(dados.peso_bruto_kg)
        : (dados.peso_liquido_kg ? String(dados.peso_liquido_kg) : form.peso_inicial);
      const novaMetragem = calcMetragem(novoPeso, novaLargura, novaChapa);

      setForm(f => ({
        ...f,
        anexo_nf_url: file_url,
        anexo_nf_nome: file_name,
        nf: dados.numero_nf ? String(dados.numero_nf) : f.nf,
        fornecedor: dados.fornecedor || f.fornecedor,
        data_recebimento: dados.data_emissao || f.data_recebimento,
        chapa: novaChapa || f.chapa,
        largura_mm: novaLargura || f.largura_mm,
        cor: dados.cor || f.cor,
        qualidade: dados.qualidade || f.qualidade,
        origem: dados.origem || f.origem,
        peso_kg: novoPeso || f.peso_kg,
        peso_inicial: novoPesoInicial || f.peso_inicial,
        metragem: novaMetragem || f.metragem,
        custo: dados.custo_kg !== undefined && dados.custo_kg !== null ? String(dados.custo_kg) : f.custo,
        sub_cod: dados.sub_cod || f.sub_cod,
      }));

      toast.success(
        `Nota Fiscal ${dados.numero_nf || ""} lida com sucesso! Dados preenchidos pela IA.`,
        { duration: 6000 }
      );
    } catch (err) {
      console.error("Erro ao processar NF com IA:", err);
      // Fallback: se a IA falhar na extração, ao menos envia o anexo normalmente
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        setForm(f => ({ ...f, anexo_nf_url: file_url, anexo_nf_nome: file.name }));
      } catch {}
      toast.warning("Arquivo da NF anexado, mas não foi possível extrair todos os dados automaticamente. Complete os campos se necessário.");
    } finally {
      setLendoNF(false);
      setUploadingNF(false);
    }
  };

  const handleUpload = async (file, tipo) => {
    if (!file) return;
    if (tipo === "nf") {
      return handleProcessarNF(file);
    }
    if (tipo === "cert") setUploadingCert(true);
    else if (tipo === "foto_cor") setUploadingFotoCor(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (tipo === "cert") {
        setForm(f => ({ ...f, anexo_cert_url: file_url, anexo_cert_nome: file.name }));
      } else if (tipo === "foto_cor") {
        setForm(f => ({ ...f, foto_cor_url: file_url, foto_cor_nome: file.name }));
      }
    } catch (e) {
      toast.error("Erro ao enviar arquivo");
    } finally {
      if (tipo === "cert") setUploadingCert(false);
      else if (tipo === "foto_cor") setUploadingFotoCor(false);
    }
  };

  const buildPayload = () => {
    const p = {
      ...form,
      setor: "telhas",
      // 🔒 Garante que a unidade seja sempre salva com a filial ativa
      // (preserva a unidade original ao editar, evitando bobinas "sumirem" da filial)
      unidade: editItem?.unidade || filialAtiva,
      reservada: form.reservada || false,
    };

    // Números — só inclui se preenchido
    if (form.largura_mm) p.largura_mm = Number(form.largura_mm);
    if (form.peso_kg) p.peso_kg = Number(form.peso_kg);
    if (form.peso_inicial) p.peso_inicial = Number(form.peso_inicial);
    if (form.metragem) p.metragem = Number(form.metragem);
    if (form.custo) p.custo = Number(form.custo);
    if (form.estoque_minimo_kg) p.estoque_minimo_kg = Number(form.estoque_minimo_kg);
    if (form.consumo_diario_kg) p.consumo_diario_kg = Number(form.consumo_diario_kg);

    // Anexos e certificado
    if (!form.anexo_cert_url && confirmarSemCert && semCertAssinatura.trim()) {
      p.anexo_cert_ausencia = semCertAssinatura.trim();
    }
    // Reservas — só inclui se reservada=true
    if (form.reservada) {
      p.reserva_tipo = form.reserva_tipo || undefined;
      p.reserva_numero_pedido = form.reserva_numero_pedido || undefined;
      p.reserva_motivo = form.reserva_motivo || undefined;
      p.reserva_autorizado_por = form.reserva_autorizado_por || undefined;
      p.reserva_data = form.reserva_data || new Date().toISOString().split("T")[0];
      p.reserva_data_hora = editItem?.reserva_data_hora || new Date().toISOString();
      p.reserva_usuario = editItem?.reserva_usuario || user?.full_name || user?.email || "Usuário";
      if (form.reserva_tipo === "parcial" && form.reserva_kg) {
        p.reserva_kg = Number(form.reserva_kg);
      }
    }

    // Remove campos undefined/null/vazios que não deveriam ir
    Object.keys(p).forEach(k => {
      if (p[k] === "" || p[k] === undefined || p[k] === null) delete p[k];
    });

    // Remove campos de reserva se não está reservada
    if (!p.reservada) {
      delete p.reserva_tipo;
      delete p.reserva_kg;
      delete p.reserva_numero_pedido;
      delete p.reserva_motivo;
      delete p.reserva_autorizado_por;
      delete p.reserva_data;
      delete p.reserva_data_hora;
      delete p.reserva_usuario;
    }

    return p;
  };

  const handleSave = async () => {
    const novosErros = {};
    if (!form.chapa) novosErros.chapa = "Informe a chapa (ex: 0,43)";
    setErros(novosErros);

    if (Object.keys(novosErros).length > 0) {
      toast.error("Preencha os campos obrigatórios.");
      formTopRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    setSaving(true);
    try {
      const payload = buildPayload();

      // Timeout de 20 segundos para evitar travamento infinito
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Tempo limite excedido ao salvar. Verifique sua conexão.")), 20000)
      );

      if (editItem) {
        await Promise.race([base44.entities.Bobina.update(editItem.id, payload), timeoutPromise]);
        auditarModificacaoBobina({
          usuario: user,
          bobinaAnterior: editItem,
          bobinaNova: { ...editItem, ...payload },
          acaoTipo: "edicao"
        });
        toast.success("Bobina atualizada!");
      } else {
        // 🔒 TRAVA ANTI-DUPLICATA: verifica códigos existentes antes de criar
        const listaAtualizada = await base44.entities.Bobina.filter({ setor: "telhas" }, "codigo", 2000);
        const codigoExiste = listaAtualizada.some(
          b => b.codigo && b.codigo.toUpperCase() === (payload.codigo || "").toUpperCase()
        );
        if (codigoExiste) {
          const numeros = listaAtualizada
            .map(b => b.codigo)
            .filter(c => c && /^TE\d{4}$/i.test(c))
            .map(c => parseInt(c.slice(2)));
          const proximo = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
          payload.codigo = `TE${String(proximo).padStart(4, "0")}`;
          toast.warning(`Código duplicado detectado. Código corrigido para ${payload.codigo} automaticamente.`);
        }
        const result = await Promise.race([base44.entities.Bobina.create(payload), timeoutPromise]);
        if (!result || !result.id) {
          throw new Error("Resposta inválida do servidor — a bobina pode não ter sido criada.");
        }
        auditarModificacaoBobina({
          usuario: user,
          bobinaNova: result,
          acaoTipo: "criacao"
        });
        toast.success("Bobina adicionada!");
      }
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      onClose();
    } catch (err) {
      console.error("BobinaFormDialog save error:", err);
      let msg = "Erro ao salvar bobina";
      if (err && typeof err === "object") {
        msg = err.response?.data?.detail || err.response?.data?.message
          || err.detail || err.message || String(err);
      } else {
        msg = String(err || "Erro desconhecido");
      }
      toast.error(String(msg).substring(0, 300));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{editItem ? "Editar Bobina" : "Nova Bobina"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2" ref={formTopRef}>
          {/* Card de Leitura de Nota Fiscal por IA */}
          {!editItem && (
            <div className="rounded-xl border-2 border-dashed border-emerald-500/40 bg-emerald-500/5 p-4 space-y-3 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                      Preencher Automático por Foto da NF (IA)
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Tire a foto ou anexe o DANFE para a inteligência artificial preencher as características, medidas, pesos e fornecedor.
                    </p>
                  </div>
                </div>
              </div>

              {lendoNF ? (
                <div className="flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-lg bg-emerald-100/60 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 text-xs font-semibold animate-pulse">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600 shrink-0" />
                  <span>Lendo Nota Fiscal e preenchendo campos com IA...</span>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-0.5">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => nfCameraRef.current?.click()}
                    className="w-full sm:w-1/2 bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs h-10 gap-2 font-medium"
                  >
                    <Camera className="w-4 h-4 text-emerald-600" />
                    Tirar Foto da NF (Câmera)
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => nfInputRef.current?.click()}
                    className="w-full sm:w-1/2 bg-background hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs h-10 gap-2 font-medium"
                  >
                    <Paperclip className="w-4 h-4 text-emerald-600" />
                    Anexar Arquivo ou PDF da NF
                  </Button>
                </div>
              )}

              {form.anexo_nf_url && !lendoNF && (
                <div className="flex items-center gap-2 rounded-md bg-emerald-100/70 dark:bg-emerald-950/60 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
                  <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="truncate flex-1 font-medium">{form.anexo_nf_nome || "NF carregada"}</span>
                  <button
                    type="button"
                    onClick={() => setViewer({ open: true, url: form.anexo_nf_url, name: form.anexo_nf_nome })}
                    className="underline text-xs text-emerald-700 hover:text-emerald-900 font-medium shrink-0"
                  >
                    Visualizar NF
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Seletor de Bobina Existente como Modelo para preenchimento rápido */}
          {!editItem && (
            <div className="space-y-1.5 p-3.5 rounded-xl border border-primary/30 bg-primary/5 shadow-xs">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  Preencher com base em bobina existente (Modelo)
                </Label>
                <span className="text-[11px] text-muted-foreground">Opcional</span>
              </div>
              <BobinaModeloCombobox
                bobinas={todasBobinas}
                selectedId={bobinaModeloId}
                onSelect={handleSelecionarModelo}
                onClear={handleLimparModelo}
              />
              <p className="text-[11px] text-muted-foreground">
                Selecione uma bobina existente para copiar especificações (cor, chapa, qualidade, medidas e fornecedor) mantendo o novo código.
              </p>
            </div>
          )}

          {/* Seção 1: Características e Classificação */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Características & Classificação</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <Label>Cor / RVM</Label>
                <Input
                  list="lista-cores-telhas"
                  placeholder="Ex: Galvanizado, Branco..."
                  value={form.cor}
                  onChange={e => set("cor", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className={erros.chapa ? "text-destructive" : ""}>Chapa *</Label>
                <Input
                  list="lista-chapas-telhas"
                  placeholder="Ex: 0,43"
                  value={form.chapa}
                  onChange={e => { handleChapaChange(e.target.value); setErros(e => ({...e, chapa: undefined})); }}
                  className={erros.chapa ? "border-destructive ring-destructive" : ""}
                />
                {erros.chapa && <p className="text-xs text-destructive">{erros.chapa}</p>}
              </div>
              <div className="space-y-1">
                <Label>Qualidade</Label>
                <Select value={form.qualidade} onValueChange={(v) => set("qualidade", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{QUALIDADE_OPTIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Origem do Aço (Trava Odoo)</Label>
                <Select value={form.origem} onValueChange={(v) => set("origem", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Nacional">Nacional</SelectItem>
                    <SelectItem value="Importado">Importado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>SUB. COD (Substituto)</Label>
                <Input placeholder="Opcional" value={form.sub_cod} onChange={e => set("sub_cod", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Seção 2: Pesos e Medidas */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Medidas, Metragem & Pesos</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="space-y-1">
                <Label>Peso Líquido (kg)</Label>
                <Input type="number" placeholder="0" value={form.peso_kg} onChange={e => handlePesoChange(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Peso Inicial (kg)</Label>
                <Input type="number" placeholder="0" value={form.peso_inicial} onChange={e => set("peso_inicial", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Largura (mm)</Label>
                <Input type="number" placeholder="1200" value={form.largura_mm} onChange={e => handleLarguraChange(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Metragem (m) <span className="text-[10px] text-muted-foreground font-normal">(calculada)</span></Label>
                <Input type="number" placeholder="Auto" value={form.metragem} onChange={e => set("metragem", e.target.value)} className="bg-muted/40 font-mono font-medium" />
              </div>
            </div>
          </div>

          {/* Seção 3: Dados Fiscais, Fornecedor e Custos */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Identificação, NF & Fornecedor</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="space-y-1">
                <Label>Código (auto)</Label>
                <Input placeholder="Auto" value={form.codigo} onChange={e => set("codigo", e.target.value)} className="font-mono bg-muted/40 font-bold text-primary" />
              </div>
              <div className="space-y-1">
                <Label>Número da NF</Label>
                <Input placeholder="Número da NF" value={form.nf} onChange={e => set("nf", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Input
                  list="lista-fornecedores-telhas"
                  placeholder="Ex: ArcelorMittal, CSN..."
                  value={form.fornecedor}
                  onChange={e => set("fornecedor", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Custo (R$/kg)</Label>
                <Input type="number" placeholder="0.00" value={form.custo} onChange={e => set("custo", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Seção 4: Recebimento, Gestão de Estoque e Observações */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Estoque & Recebimento</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <Label>Data de Recebimento</Label>
                <Input type="date" value={form.data_recebimento} onChange={e => set("data_recebimento", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Estoque Mínimo (kg)</Label>
                <Input type="number" placeholder="500" value={form.estoque_minimo_kg} onChange={e => set("estoque_minimo_kg", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Alerta quando abaixo deste valor</p>
              </div>
              <div className="space-y-1">
                <Label>Consumo Diário Estimado (kg)</Label>
                <Input type="number" placeholder="Ex: 120" value={form.consumo_diario_kg} onChange={e => set("consumo_diario_kg", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Previsão de término do estoque</p>
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label>Observações</Label>
                <Textarea placeholder="Anotações gerais..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
              </div>
            </div>
          </div>

          {/* Foto da cor — apenas quando qualidade = PP */}
          {form.qualidade === "PP" && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">Foto da Cor da Bobina <span className="text-xs text-muted-foreground font-normal">(PP)</span></Label>
              <input ref={fotoCorInputRef} type="file" className="hidden" accept="image/*"
                onChange={e => handleUpload(e.target.files[0], "foto_cor")} />
              <input ref={fotoCorCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                onChange={e => handleUpload(e.target.files[0], "foto_cor")} />
              {form.foto_cor_url ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <FileCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <button onClick={() => setViewer({ open: true, url: form.foto_cor_url, name: form.foto_cor_nome })}
                      className="truncate flex-1 underline underline-offset-2 font-medium text-left" title={form.foto_cor_nome}>
                      {form.foto_cor_nome || "Foto da cor"}
                    </button>
                    <button onClick={() => setForm(f => ({ ...f, foto_cor_url: "", foto_cor_nome: "" }))}
                      className="ml-auto text-emerald-600 hover:text-red-500 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <img src={form.foto_cor_url} alt="Foto da cor" onClick={() => setViewer({ open: true, url: form.foto_cor_url, name: form.foto_cor_nome })}
                    className="w-full max-h-32 object-cover rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity" />
                </div>
              ) : (
                <UploadButton label="Anexar Foto" icon={Paperclip} cameraRef={fotoCorCameraRef} fileRef={fotoCorInputRef} uploading={uploadingFotoCor} />
              )}
            </div>
          )}

          {/* Anexos */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">Anexos</Label>
            <div className="grid grid-cols-2 gap-3">
              {/* NF */}
              <div className="space-y-1.5">
                <input ref={nfInputRef} type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => handleUpload(e.target.files[0], "nf")} />
                <input ref={nfCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => handleUpload(e.target.files[0], "nf")} />
                {form.anexo_nf_url ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                      <FileCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                      <button onClick={() => setViewer({ open: true, url: form.anexo_nf_url, name: form.anexo_nf_nome })}
                        className="truncate flex-1 underline underline-offset-2 font-medium text-left" title={form.anexo_nf_nome}>
                        {form.anexo_nf_nome || "NF anexada"}
                      </button>
                      <button onClick={() => setForm(f => ({ ...f, anexo_nf_url: "", anexo_nf_nome: "" }))}
                        className="ml-auto text-emerald-600 hover:text-red-500 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <img src={form.anexo_nf_url} alt="NF" onClick={() => setViewer({ open: true, url: form.anexo_nf_url, name: form.anexo_nf_nome })}
                      className="w-full max-h-24 object-cover rounded-lg border border-emerald-200 cursor-pointer hover:opacity-80 transition-opacity" />
                  </div>
                ) : (
                  <UploadButton label="Anexar NF" icon={Paperclip} cameraRef={nfCameraRef} fileRef={nfInputRef} uploading={uploadingNF} />
                )}
              </div>

              {/* Certificado Digital */}
              <div className="space-y-1.5">
                <input ref={certInputRef} type="file" className="hidden" accept="image/*,.pdf,.p7b,.cer,.crt"
                  onChange={e => { handleUpload(e.target.files[0], "cert"); setConfirmarSemCert(false); setSemCertAssinatura(""); }} />
                <input ref={certCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => { handleUpload(e.target.files[0], "cert"); setConfirmarSemCert(false); setSemCertAssinatura(""); }} />
                {form.anexo_cert_url ? (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                      <button onClick={() => setViewer({ open: true, url: form.anexo_cert_url, name: form.anexo_cert_nome })}
                        className="truncate flex-1 underline underline-offset-2 font-medium text-left" title={form.anexo_cert_nome}>
                        {form.anexo_cert_nome || "Certificado"}
                      </button>
                      <button onClick={() => setForm(f => ({ ...f, anexo_cert_url: "", anexo_cert_nome: "" }))}
                        className="ml-auto text-blue-600 hover:text-red-500 shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <img src={form.anexo_cert_url} alt="Certificado" onClick={() => setViewer({ open: true, url: form.anexo_cert_url, name: form.anexo_cert_nome })}
                      className="w-full max-h-24 object-cover rounded-lg border border-blue-200 cursor-pointer hover:opacity-80 transition-opacity" />
                  </div>
                ) : (
                  <UploadButton label="Certificado" icon={ShieldCheck} cameraRef={certCameraRef} fileRef={certInputRef} uploading={uploadingCert} />
                )}
              </div>
            </div>

            {!form.anexo_cert_url && (
              <div className="mt-2">
                {!confirmarSemCert ? (
                  <button
                    type="button"
                    onClick={() => setConfirmarSemCert(true)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                    Não tenho o certificado digital
                  </button>
                ) : (
                  <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 space-y-2">
                    <p className="text-xs text-orange-800 font-medium">
                      ⚠ Declare seu nome completo confirmando que o certificado não foi fornecido:
                    </p>
                    <Input
                      placeholder="Nome completo do responsável"
                      value={semCertAssinatura}
                      onChange={e => setSemCertAssinatura(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => { setConfirmarSemCert(false); setSemCertAssinatura(""); }}
                      className="text-xs text-orange-600 underline underline-offset-2">
                      Cancelar — vou anexar o certificado
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Reserva */}
          <ReservaPanel form={form} onChange={setForm} />

          {/* Datalists com sugestões automáticas baseadas em todas as bobinas */}
          <datalist id="lista-cores-telhas">
            {listaCores.map(c => <option key={c} value={c} />)}
          </datalist>
          <datalist id="lista-chapas-telhas">
            {listaChapas.map(c => <option key={c} value={c} />)}
          </datalist>
          <datalist id="lista-fornecedores-telhas">
            {listaFornecedores.map(f => <option key={f} value={f} />)}
          </datalist>

        </div>

        <ImageViewer
          open={viewer.open}
          onClose={() => setViewer({ open: false, url: "", name: "" })}
          url={viewer.url}
          name={viewer.name}
        />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-1" /> Salvando...</> : (editItem ? "Salvar" : "Adicionar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}