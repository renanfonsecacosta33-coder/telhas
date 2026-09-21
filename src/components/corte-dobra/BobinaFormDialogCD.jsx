import React, { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { Paperclip, FileCheck, X, Loader2, ShieldCheck, Camera, Layers, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReservaPanel from "@/components/bobinas/ReservaPanel";
import UploadButton from "@/components/ui/UploadButton";
import ImageLink from "@/components/ui/ImageLink";
import { useAuth } from "@/lib/AuthContext";
import { registrarAuditoria } from "@/lib/auditHelper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFilial } from "@/contexts/FilialContext";
import BobinaModeloCombobox from "@/components/bobinas/BobinaModeloCombobox";
import { lerNotaFiscalBobina } from "@/lib/nfReader";
import MultiplasBobinasNFCard from "@/components/bobinas/MultiplasBobinasNFCard";

const QUALIDADE_OPTIONS = ["GV", "PP", "FF", "FQ", "GL (IMP)"];

const BLANK_FORM = (codigoCD) => ({
  cor: "", chapa: "", qualidade: "", sub_cod: "", espessura_real: "", espessura_utilizada: "",
  largura_mm: "", peso_kg: "", peso_inicial: "",
  codigo: codigoCD, nf: "", custo: "", fornecedor: "",
  data_recebimento: new Date().toISOString().slice(0, 10),
  observacoes: "",
  estoque_minimo_kg: "", consumo_diario_kg: "",
  anexo_nf_url: "", anexo_nf_nome: "", anexo_cert_url: "", anexo_cert_nome: "",
  foto_adicional_url: "", foto_adicional_nome: "",
  reservada: false, reserva_tipo: "", reserva_kg: "", reserva_numero_pedido: "",
  reserva_motivo: "", reserva_autorizado_por: "", reserva_data: "",
});

export default function BobinaFormDialogCD({ open, onClose, onSave, editItem, proximoNumero, saving }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();
  const [form, setForm] = useState(BLANK_FORM("CD0001"));
  const [bobinaModeloId, setBobinaModeloId] = useState("");
  const [uploadingNF, setUploadingNF] = useState(false);
  const [uploadingCert, setUploadingCert] = useState(false);
  const [uploadingFoto, setUploadingFoto] = useState(false);
  const [semCertAssinatura, setSemCertAssinatura] = useState("");
  const [confirmarSemCert, setConfirmarSemCert] = useState(false);
  const [erros, setErros] = useState({});
  const [dadosMultiplasBobinas, setDadosMultiplasBobinas] = useState(null);
  const [salvandoLote, setSalvandoLote] = useState(false);
  const formTopRef = useRef();
  const nfInputRef = useRef();
  const nfCameraRef = useRef();
  const certInputRef = useRef();
  const certCameraRef = useRef();
  const fotoInputRef = useRef();
  const fotoCameraRef = useRef();

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
    if (!open) return;
    setErros({});
    setDadosMultiplasBobinas(null);
    if (editItem) {
      setBobinaModeloId(editItem.id || editItem.codigo || "");
      setForm({
        cor: editItem.cor || "",
        chapa: editItem.chapa || "",
        qualidade: editItem.qualidade || "",
        espessura_real: editItem.espessura_real || "",
        espessura_utilizada: editItem.espessura_utilizada || "",
        sub_cod: editItem.sub_cod || "",
        largura_mm: editItem.largura_mm || "",
        peso_kg: editItem.peso_kg || "",
        peso_inicial: editItem.peso_inicial || "",
        codigo: editItem.codigo || "",
        nf: editItem.nf || "",
        custo: editItem.custo || "",
        fornecedor: editItem.fornecedor || "",
        data_recebimento: editItem.data_recebimento || "",
        observacoes: editItem.observacoes || "",
        estoque_minimo_kg: editItem.estoque_minimo_kg || "",
        consumo_diario_kg: editItem.consumo_diario_kg || "",
        anexo_nf_url: editItem.anexo_nf_url || "",
        anexo_nf_nome: editItem.anexo_nf_nome || "",
        anexo_cert_url: editItem.anexo_cert_url || "",
        anexo_cert_nome: editItem.anexo_cert_nome || "",
        foto_adicional_url: editItem.foto_adicional_url || "",
        foto_adicional_nome: editItem.foto_adicional_nome || "",
        reservada: editItem.reservada || false,
        reserva_tipo: editItem.reserva_tipo || "",
        reserva_kg: editItem.reserva_kg || "",
        reserva_numero_pedido: editItem.reserva_numero_pedido || "",
        reserva_motivo: editItem.reserva_motivo || "",
        reserva_autorizado_por: editItem.reserva_autorizado_por || "",
        reserva_data: editItem.reserva_data || "",
      });
      setSemCertAssinatura("");
      setConfirmarSemCert(false);
    } else {
      setBobinaModeloId("");
      const num = String(proximoNumero || 1).padStart(4, "0");
      setForm(BLANK_FORM(`CD${num}`));
      setSemCertAssinatura("");
      setConfirmarSemCert(false);
    }
  }, [editItem, open, proximoNumero]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSelecionarModelo = (bobina) => {
    if (!bobina) return;
    setBobinaModeloId(bobina.id || bobina.codigo || "");

    setForm(f => ({
      ...f,
      cor: bobina.cor || f.cor,
      chapa: bobina.chapa !== undefined && bobina.chapa !== null ? String(bobina.chapa) : f.chapa,
      qualidade: bobina.qualidade || f.qualidade,
      espessura_real: bobina.espessura_real || f.espessura_real || (bobina.chapa ? String(bobina.chapa) : ""),
      espessura_utilizada: bobina.espessura_utilizada || f.espessura_utilizada || (bobina.chapa ? String(bobina.chapa) : ""),
      sub_cod: bobina.sub_cod || f.sub_cod,
      largura_mm: bobina.largura_mm !== undefined && bobina.largura_mm !== null ? String(bobina.largura_mm) : f.largura_mm,
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

  const [lendoNF, setLendoNF] = useState(false);

  const handleProcessarNF = async (file) => {
    if (!file) return;
    setLendoNF(true);
    setUploadingNF(true);
    setDadosMultiplasBobinas(null);
    try {
      toast.info("Processando imagem da Nota Fiscal com IA...", { duration: 3500 });
      const { file_url, file_name, dados } = await lerNotaFiscalBobina(file);

      const temMultiplas = dados.bobinas && dados.bobinas.length > 1;
      const primeiraBobina = (dados.bobinas && dados.bobinas[0]) || {};

      const novaLargura = primeiraBobina.largura_mm
        ? String(primeiraBobina.largura_mm)
        : (dados.largura_mm_padrao ? String(dados.largura_mm_padrao) : (dados.largura_mm ? String(dados.largura_mm) : form.largura_mm));
      const novaChapa = primeiraBobina.chapa || dados.chapa_padrao || dados.chapa || form.chapa;
      const novoPeso = primeiraBobina.peso_kg
        ? String(primeiraBobina.peso_kg)
        : (dados.peso_liquido_total_kg ? String(dados.peso_liquido_total_kg) : (dados.peso_liquido_kg ? String(dados.peso_liquido_kg) : form.peso_kg));
      const novoPesoInicial = primeiraBobina.peso_inicial || primeiraBobina.peso_kg || novoPeso;

      setForm(f => ({
        ...f,
        anexo_nf_url: file_url,
        anexo_nf_nome: file_name,
        nf: dados.numero_nf ? String(dados.numero_nf) : f.nf,
        fornecedor: dados.fornecedor || f.fornecedor,
        data_recebimento: dados.data_emissao || f.data_recebimento,
        chapa: novaChapa || f.chapa,
        espessura_real: novaChapa || f.espessura_real,
        espessura_utilizada: novaChapa || f.espessura_utilizada,
        largura_mm: novaLargura || f.largura_mm,
        cor: primeiraBobina.cor || dados.cor_padrao || dados.cor || f.cor,
        qualidade: primeiraBobina.qualidade || dados.qualidade_padrao || dados.qualidade || f.qualidade,
        peso_kg: novoPeso || f.peso_kg,
        peso_inicial: String(novoPesoInicial) || f.peso_inicial,
        custo: primeiraBobina.custo_kg !== undefined && primeiraBobina.custo_kg !== null
          ? String(primeiraBobina.custo_kg)
          : (dados.custo_kg_padrao !== undefined && dados.custo_kg_padrao !== null
              ? String(dados.custo_kg_padrao)
              : (dados.custo_kg !== undefined && dados.custo_kg !== null ? String(dados.custo_kg) : f.custo)),
        sub_cod: primeiraBobina.lote || dados.sub_cod || f.sub_cod,
      }));

      if (temMultiplas) {
        setDadosMultiplasBobinas({ ...dados, file_url, file_name });
        toast.success(
          `Foram detectadas ${dados.bobinas.length} bobinas na NF ${dados.numero_nf || ""}! Escolha a opção recomendada de cadastro em lote.`,
          { duration: 8000 }
        );
      } else {
        toast.success(
          `Nota Fiscal ${dados.numero_nf || ""} lida com sucesso! Dados preenchidos pela IA.`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      console.error("Erro ao processar NF com IA:", err);
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

  const handleCadastrarLote = async (bobinas) => {
    if (!bobinas || !bobinas.length || !dadosMultiplasBobinas) return;
    setSalvandoLote(true);

    try {
      // 🔒 Busca bobinas de corte e dobra para gerar a sequência de códigos CD únicos
      const listaAtualizada = await base44.entities.Bobina.filter({ setor: "corte_dobra" }, "codigo", 2000);
      const numeros = listaAtualizada
        .map(b => b.codigo)
        .filter(c => c && /^CD\d{4}$/i.test(c))
        .map(c => parseInt(c.slice(2)));
      let proximoNum = numeros.length > 0 ? Math.max(...numeros) + 1 : 1;

      const criadas = [];

      for (let i = 0; i < bobinas.length; i++) {
        const b = bobinas[i];
        const codigoBobina = `CD${String(proximoNum++).padStart(4, "0")}`;
        const chapa = b.chapa || dadosMultiplasBobinas.chapa_padrao || form.chapa || "";
        const largura = b.largura_mm ? Number(b.largura_mm) : (dadosMultiplasBobinas.largura_mm_padrao || Number(form.largura_mm) || undefined);
        const peso = Number(b.peso_kg || 0);
        const pesoInicial = Number(b.peso_inicial || b.peso_kg || 0);
        const custo = b.custo_kg ? Number(b.custo_kg) : (dadosMultiplasBobinas.custo_kg_padrao ? Number(dadosMultiplasBobinas.custo_kg_padrao) : (form.custo ? Number(form.custo) : undefined));

        const payload = {
          codigo: codigoBobina,
          setor: "corte_dobra",
          unidade: filialAtiva || "Matriz AJL",
          cor: b.cor || dadosMultiplasBobinas.cor_padrao || form.cor || "Galvanizado",
          chapa: String(chapa),
          espessura_real: String(chapa),
          espessura_utilizada: String(chapa),
          qualidade: b.qualidade || dadosMultiplasBobinas.qualidade_padrao || form.qualidade || "GV",
          largura_mm: largura,
          peso_kg: peso,
          peso_inicial: pesoInicial,
          nf: dadosMultiplasBobinas.numero_nf ? String(dadosMultiplasBobinas.numero_nf) : (form.nf || undefined),
          fornecedor: dadosMultiplasBobinas.fornecedor || form.fornecedor || undefined,
          custo: custo,
          data_recebimento: dadosMultiplasBobinas.data_emissao || form.data_recebimento || new Date().toISOString().slice(0, 10),
          sub_cod: b.lote || b.sub_cod || undefined,
          anexo_nf_url: dadosMultiplasBobinas.file_url || form.anexo_nf_url || undefined,
          anexo_nf_nome: dadosMultiplasBobinas.file_name || form.anexo_nf_nome || undefined,
          reservada: false,
          estoque_minimo_kg: 500,
          consumo_diario_kg: form.consumo_diario_kg ? Number(form.consumo_diario_kg) : undefined,
          observacoes: form.observacoes || `Entrada em lote via NF ${dadosMultiplasBobinas.numero_nf || ""}${b.lote ? ` · Lote ${b.lote}` : ""}`,
        };

        // Remove campos undefined/null/vazios
        Object.keys(payload).forEach(k => {
          if (payload[k] === "" || payload[k] === undefined || payload[k] === null) delete payload[k];
        });

        const res = await base44.entities.Bobina.create(payload);
        if (res && res.id) {
          criadas.push(res);
          registrarAuditoria({
            usuario: user,
            acao: "criacao",
            entidade: "Bobina",
            registroId: res.id,
            registroIdentificador: res.codigo,
            detalhes: `Criação em lote via NF ${dadosMultiplasBobinas.numero_nf || ""}: ${res.codigo} (${res.peso_kg} kg, chapa ${res.chapa})`,
            unidade: res.unidade || "Matriz AJL"
          });
        }
      }

      toast.success(
        `🎉 ${criadas.length} bobinas cadastradas com sucesso em lote! (${criadas.map(c => c.codigo).join(", ")})`,
        { duration: 8000 }
      );
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      onClose();
    } catch (err) {
      console.error("Erro ao cadastrar lote de bobinas:", err);
      toast.error("Ocorreu um erro ao salvar o lote. Tente novamente ou cadastre individualmente.");
    } finally {
      setSalvandoLote(false);
    }
  };

  const handleSelecionarIndividual = (b, idx) => {
    const chapa = b.chapa || dadosMultiplasBobinas?.chapa_padrao || form.chapa;
    const largura = b.largura_mm ? String(b.largura_mm) : (dadosMultiplasBobinas?.largura_mm_padrao ? String(dadosMultiplasBobinas.largura_mm_padrao) : form.largura_mm);
    const peso = String(b.peso_kg || 0);
    const pesoInicial = String(b.peso_inicial || b.peso_kg || 0);

    setForm(f => ({
      ...f,
      sub_cod: b.lote || b.sub_cod || f.sub_cod,
      peso_kg: peso,
      peso_inicial: pesoInicial,
      largura_mm: largura,
      chapa: chapa,
      espessura_real: chapa,
      espessura_utilizada: chapa,
      cor: b.cor || dadosMultiplasBobinas?.cor_padrao || f.cor,
      qualidade: b.qualidade || dadosMultiplasBobinas?.qualidade_padrao || f.qualidade,
      custo: b.custo_kg ? String(b.custo_kg) : (dadosMultiplasBobinas?.custo_kg_padrao ? String(dadosMultiplasBobinas.custo_kg_padrao) : f.custo),
    }));

    setDadosMultiplasBobinas(null);
    toast.success(`Bobina #${idx + 1} (${Number(b.peso_kg).toLocaleString("pt-BR")} kg) carregada no formulário!`);
  };

  const handleUpload = async (file, tipo) => {
    if (!file) return;
    if (tipo === "nf") {
      return handleProcessarNF(file);
    }
    if (tipo === "cert") setUploadingCert(true);
    else setUploadingFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (tipo === "cert") {
        setForm(f => ({ ...f, anexo_cert_url: file_url, anexo_cert_nome: file.name }));
        setUploadingCert(false);
      } else {
        setForm(f => ({ ...f, foto_adicional_url: file_url, foto_adicional_nome: file.name }));
        setUploadingFoto(false);
      }
    } catch (e) {
      toast.error("Erro ao enviar arquivo");
      setUploadingCert(false);
      setUploadingFoto(false);
    }
  };

  const handleSave = () => {
    const novosErros = {};
    if (!form.chapa) novosErros.chapa = "Informe a chapa";
    setErros(novosErros);

    if (Object.keys(novosErros).length > 0) {
      toast.error("Preencha o campo obrigatório destacado em vermelho");
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (typeof onSave !== "function") {
      toast.error("Erro interno: função de salvamento não disponível");
      return;
    }

    const payload = {
      ...form,
      setor: "corte_dobra",
      largura_mm: form.largura_mm ? Number(form.largura_mm) : undefined,
      peso_kg: form.peso_kg ? Number(form.peso_kg) : undefined,
      peso_inicial: form.peso_inicial ? Number(form.peso_inicial) : undefined,
      custo: form.custo ? Number(form.custo) : undefined,
      estoque_minimo_kg: form.estoque_minimo_kg ? Number(form.estoque_minimo_kg) : undefined,
      consumo_diario_kg: form.consumo_diario_kg ? Number(form.consumo_diario_kg) : undefined,
      anexo_cert_ausencia: (!form.anexo_cert_url && confirmarSemCert) ? semCertAssinatura.trim() : undefined,
      reservada: form.reservada || false,
      reserva_tipo: form.reservada ? form.reserva_tipo : undefined,
      reserva_kg: (form.reservada && form.reserva_tipo === "parcial" && form.reserva_kg) ? Number(form.reserva_kg) : undefined,
      reserva_numero_pedido: form.reservada ? form.reserva_numero_pedido : undefined,
      reserva_motivo: form.reservada ? form.reserva_motivo : undefined,
      reserva_autorizado_por: form.reservada ? form.reserva_autorizado_por : undefined,
      reserva_data: form.reservada ? (form.reserva_data || new Date().toISOString().split("T")[0]) : undefined,
      reserva_data_hora: form.reservada ? (editItem?.reserva_data_hora || new Date().toISOString()) : undefined,
      reserva_usuario: form.reservada ? (editItem?.reserva_usuario || user?.full_name || user?.email || "Usuário") : undefined,
    };

    // Auditoria de reserva
    if (form.reservada && !editItem?.reservada) {
      registrarAuditoria({
        usuario: user,
        acao: "edicao",
        entidade: "Bobina",
        registroId: editItem?.id || "",
        registroIdentificador: payload.codigo || "",
        detalhes: `Reserva efetuada na bobina ${payload.codigo || ""}: ${payload.reserva_tipo === "inteira" ? "Bobina Inteira" : `Parcial (${payload.reserva_kg} kg)`}. Motivo: ${payload.reserva_motivo || "N/A"}. Autorizado por: ${payload.reserva_autorizado_por || "N/A"}.`,
        unidade: payload.unidade || "Matriz AJL"
      });
    } else if (!form.reservada && editItem?.reservada) {
      registrarAuditoria({
        usuario: user,
        acao: "edicao",
        entidade: "Bobina",
        registroId: editItem?.id || "",
        registroIdentificador: payload.codigo || "",
        detalhes: `Reserva da bobina ${payload.codigo || ""} foi liberada.`,
        unidade: payload.unidade || "Matriz AJL"
      });
    }

    // Remove campos vazios, undefined e null para evitar erro de validação no banco
    Object.keys(payload).forEach(k => {
      if (payload[k] === "" || payload[k] === undefined || payload[k] === null) {
        delete payload[k];
      }
    });

    onSave(payload);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">{editItem ? "Editar Bobina" : "Nova Bobina — Corte e Dobra"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2" ref={formTopRef}>

          {/* Card de Múltiplas Bobinas Detectadas na NF */}
          {!editItem && dadosMultiplasBobinas && (
            <MultiplasBobinasNFCard
              dadosNF={dadosMultiplasBobinas}
              onCadastrarEmLote={handleCadastrarLote}
              onSelecionarIndividual={handleSelecionarIndividual}
              onDescartar={() => setDadosMultiplasBobinas(null)}
              salvandoEmLote={salvandoLote}
            />
          )}

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
                  <a
                    href={form.anexo_nf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline text-xs text-emerald-700 hover:text-emerald-900 font-medium shrink-0"
                  >
                    Visualizar NF
                  </a>
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
                Selecione uma bobina existente para copiar especificações (cor, chapa, espessuras, largura e fornecedor) mantendo o novo código.
              </p>
            </div>
          )}

          {/* Seção 1: Características & Espessuras */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Características & Espessuras</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <Label className={erros.chapa ? "text-destructive" : ""}>Chapa *</Label>
                <Input
                  list="lista-chapas-cd"
                  placeholder="Ex: 0,43"
                  value={form.chapa}
                  onChange={e => { set("chapa", e.target.value); setErros(e2 => ({...e2, chapa: undefined})); }}
                  className={erros.chapa ? "border-destructive ring-destructive" : ""}
                />
                {erros.chapa && <p className="text-xs text-destructive">{erros.chapa}</p>}
              </div>
              <div className="space-y-1">
                <Label>Qualidade</Label>
                <Select value={form.qualidade} onValueChange={v => set("qualidade", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{QUALIDADE_OPTIONS.map(q => <SelectItem key={q} value={q}>{q}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Cor</Label>
                <Input
                  list="lista-cores-cd"
                  placeholder="Ex: Galvanizado, Branco..."
                  value={form.cor}
                  onChange={e => set("cor", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>Espessura Real (NF)</Label>
                <Input placeholder="Ex: 0,43" value={form.espessura_real} onChange={e => set("espessura_real", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Espessura literal da nota fiscal</p>
              </div>
              <div className="space-y-1">
                <Label>Espessura Utilizada (Comercial)</Label>
                <Input placeholder="Ex: 0,43 / 0,50" value={form.espessura_utilizada} onChange={e => set("espessura_utilizada", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Espessura que o vendedor visualiza</p>
              </div>
              <div className="space-y-1">
                <Label>SUB. COD (Substituto)</Label>
                <Input placeholder="Opcional" value={form.sub_cod} onChange={e => set("sub_cod", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Seção 2: Medidas e Pesos */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Medidas & Pesos</h5>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="space-y-1">
                <Label>Largura (mm)</Label>
                <Input type="number" placeholder="Ex: 1200" value={form.largura_mm} onChange={e => set("largura_mm", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Peso Atual (kg)</Label>
                <Input type="number" placeholder="0" value={form.peso_kg} onChange={e => set("peso_kg", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Peso Inicial (kg)</Label>
                <Input type="number" placeholder="0" value={form.peso_inicial} onChange={e => set("peso_inicial", e.target.value)} />
              </div>
            </div>
          </div>

          {/* Seção 3: Fiscal, Fornecedor e Valores */}
          <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-3">
            <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Identificação, NF & Fornecedor</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="space-y-1">
                <Label>Código (auto)</Label>
                <Input value={form.codigo} onChange={e => set("codigo", e.target.value)} className="font-mono bg-muted/40 font-bold text-primary" />
              </div>
              <div className="space-y-1">
                <Label>Número da NF</Label>
                <Input placeholder="Número da NF" value={form.nf} onChange={e => set("nf", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Fornecedor</Label>
                <Input
                  list="lista-fornecedores-cd"
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
                <Input type="number" placeholder="Ex: 500" value={form.estoque_minimo_kg} onChange={e => set("estoque_minimo_kg", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Alerta quando abaixo deste valor</p>
              </div>
              <div className="space-y-1">
                <Label>Consumo Diário Estimado (kg)</Label>
                <Input type="number" placeholder="Ex: 80" value={form.consumo_diario_kg} onChange={e => set("consumo_diario_kg", e.target.value)} />
                <p className="text-[10px] text-muted-foreground">Previsão de término do estoque</p>
              </div>
              <div className="sm:col-span-3 space-y-1">
                <Label>Observações</Label>
                <Textarea placeholder="Anotações adicionais..." value={form.observacoes} onChange={e => set("observacoes", e.target.value)} rows={2} />
              </div>
            </div>
          </div>

          {/* Anexos */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              Anexos
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {/* NF */}
              <div className="space-y-1.5">
                <input ref={nfInputRef} type="file" className="hidden" accept="image/*,.pdf"
                  onChange={e => handleUpload(e.target.files[0], "nf")} />
                <input ref={nfCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => handleUpload(e.target.files[0], "nf")} />
                {form.anexo_nf_url ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                    <FileCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                    <ImageLink url={form.anexo_nf_url} name={form.anexo_nf_nome}
                      className="truncate flex-1 underline underline-offset-2 font-medium text-left text-emerald-800" title={form.anexo_nf_nome}>
                      {form.anexo_nf_nome || "NF anexada"}
                    </ImageLink>
                    <button onClick={() => setForm(f => ({ ...f, anexo_nf_url: "", anexo_nf_nome: "" }))}
                      className="ml-auto text-emerald-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <UploadButton label="Anexar NF" icon={Paperclip} cameraRef={nfCameraRef} fileRef={nfInputRef} uploading={uploadingNF} />
                )}
              </div>

              {/* Certificado */}
              <div className="space-y-1.5">
                <input ref={certInputRef} type="file" className="hidden" accept="image/*,.pdf,.p7b,.cer,.crt"
                  onChange={e => { handleUpload(e.target.files[0], "cert"); setConfirmarSemCert(false); setSemCertAssinatura(""); }} />
                <input ref={certCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                  onChange={e => { handleUpload(e.target.files[0], "cert"); setConfirmarSemCert(false); setSemCertAssinatura(""); }} />
                {form.anexo_cert_url ? (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                    <ShieldCheck className="w-4 h-4 shrink-0 text-blue-600" />
                    <ImageLink url={form.anexo_cert_url} name={form.anexo_cert_nome}
                      className="truncate flex-1 underline underline-offset-2 font-medium text-left text-blue-800" title={form.anexo_cert_nome}>
                      {form.anexo_cert_nome || "Certificado"}
                    </ImageLink>
                    <button onClick={() => setForm(f => ({ ...f, anexo_cert_url: "", anexo_cert_nome: "" }))}
                      className="ml-auto text-blue-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <UploadButton label="Certificado" icon={ShieldCheck} cameraRef={certCameraRef} fileRef={certInputRef} uploading={uploadingCert} />
                )}
              </div>
            </div>

            {/* Sem certificado */}
            {!form.anexo_cert_url && (
              <div className="mt-2">
                {!confirmarSemCert ? (
                  <button type="button" onClick={() => setConfirmarSemCert(true)}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
                    Não tenho o certificado digital
                  </button>
                ) : (
                  <div className="rounded-lg border border-orange-300 bg-orange-50 p-3 space-y-2">
                    <p className="text-xs text-orange-800 font-medium">⚠ Declare seu nome completo confirmando que o certificado não foi fornecido:</p>
                    <Input placeholder="Nome completo do responsável" value={semCertAssinatura}
                      onChange={e => setSemCertAssinatura(e.target.value)} className="h-8 text-xs bg-white" />
                    <button type="button" onClick={() => { setConfirmarSemCert(false); setSemCertAssinatura(""); }}
                      className="text-xs text-orange-600 underline underline-offset-2">Cancelar — vou anexar o certificado</button>
                  </div>
                )}
              </div>
            )}


            {/* Foto adicional */}
            <div className="pt-1">
              <p className="text-xs text-muted-foreground mb-1.5">Foto adicional (opcional)</p>
              <input ref={fotoInputRef} type="file" className="hidden" accept="image/*,.pdf"
                onChange={e => handleUpload(e.target.files[0], "foto")} />
              <input ref={fotoCameraRef} type="file" className="hidden" accept="image/*" capture="environment"
                onChange={e => handleUpload(e.target.files[0], "foto")} />
              {form.foto_adicional_url ? (
                <div className="flex items-center gap-2 rounded-lg border border-purple-300 bg-purple-50 px-3 py-2 text-xs text-purple-800">
                  <Camera className="w-4 h-4 shrink-0 text-purple-600" />
                  <ImageLink url={form.foto_adicional_url} name={form.foto_adicional_nome}
                    className="truncate flex-1 underline underline-offset-2 font-medium text-left text-purple-800" title={form.foto_adicional_nome}>
                    {form.foto_adicional_nome || "Foto adicional"}
                  </ImageLink>
                  <button onClick={() => setForm(f => ({ ...f, foto_adicional_url: "", foto_adicional_nome: "" }))}
                    className="ml-auto text-purple-600 hover:text-red-500 shrink-0"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <UploadButton label="Foto adicional" icon={Paperclip} cameraRef={fotoCameraRef} fileRef={fotoInputRef} uploading={uploadingFoto} />
              )}
            </div>
          </div>

          {/* Reserva */}
          <ReservaPanel form={form} onChange={setForm} />

          {/* Datalists com sugestões automáticas baseadas em todas as bobinas */}
          <datalist id="lista-cores-cd">
            {listaCores.map(c => <option key={c} value={c} />)}
          </datalist>
          <datalist id="lista-chapas-cd">
            {listaChapas.map(c => <option key={c} value={c} />)}
          </datalist>
          <datalist id="lista-fornecedores-cd">
            {listaFornecedores.map(f => <option key={f} value={f} />)}
          </datalist>

        </div>

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