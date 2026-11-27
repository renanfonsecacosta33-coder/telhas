import React, { useState, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import GaleriaFotosRota from "@/components/logistica/GaleriaFotosRota";
import {
  Truck,
  Eye,
  Factory,
  Layers,
  PackageCheck,
  DollarSign,
  StickyNote,
  RefreshCw,
  Loader2,
  Trash2,
  Pencil,
  Camera,
  AlertTriangle,
  Weight,
  Printer,
  Download,
  ChevronDown,
  ChevronUp,
  FileText,
  MapPin,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Clock,
  Upload,
  Zap,
  Check,
  MoreHorizontal
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import ImageViewer from "@/components/ui/ImageViewer";
import RotaCarregamentoSlot from "@/components/logistica/RotaCarregamentoSlot";
import { parseRotaImage } from "@/lib/rotaParser";
import { useInvestigacaoBarracoes } from "@/lib/investigacaoBarracoesHelper";
import FotoPedidoButton from "@/components/logistica/FotoPedidoButton";
import RotaTraseiraCaminhaoSlot from "@/components/logistica/RotaTraseiraCaminhaoSlot";
import EditarRotaDialog from "@/components/logistica/EditarRotaDialog";
import PedidoOdooDetalheDialog from "@/components/pcp/PedidoOdooDetalheDialog";
import {
  TIPOS_VEICULOS,
  obterVeiculoPorIdOuNome,
  calcularPesoRota,
  analisarCapacidadeCaminhao,
} from "@/lib/veiculosCapacidadeHelper";
import { baixarRomaneioPdf, imprimirRomaneioHtml } from "@/lib/romaneioCargaPdfHelper";

const DEP_LABEL = { telhas: "Telhas", corte_dobra: "Corte e Dobra", expedicao: "Expedição" };
const DEP_COLOR = {
  telhas: "bg-blue-100 text-blue-700 border-blue-200",
  corte_dobra: "bg-orange-100 text-orange-700 border-orange-200",
  expedicao: "bg-purple-100 text-purple-700 border-purple-200",
};

export default function RotaEntregaCard({
  rota,
  departamento,
  allowDelete = false,
  numeroCarga,
  mapaExecucaoPorId
}) {
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");
  const [replacingRota, setReplacingRota] = useState(false);
  const [solicitandoPdfs, setSolicitandoPdfs] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [pedidoOdooModal, setPedidoOdooModal] = useState(null);
  const [tabelaExpandida, setTabelaExpandida] = useState(true);
  const [itemDetalheExpandido, setItemDetalheExpandido] = useState(null);
  const [anexandoPdfPedido, setAnexandoPdfPedido] = useState(null);
  const editRotaRef = useRef(null);
  const queryClient = useQueryClient();

  const handleAnexarPdfManual = async (numeroPedido, file) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo em formato PDF.");
      return;
    }
    setAnexandoPdfPedido(numeroPedido);
    toast.loading(`Enviando PDF do Pedido #${numeroPedido}...`, { id: "upload-pdf-manual" });
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      const fileUrl = uploadRes?.file_url;
      if (!fileUrl) throw new Error("Servidor não retornou link permanente.");

      const novosItens = itens.map((it) => {
        if (String(it.numero_pedido).trim() === String(numeroPedido).trim()) {
          return {
            ...it,
            pdf_url: fileUrl,
            pdf_nome: file.name
          };
        }
        return it;
      });

      await base44.entities.RotaEntrega.update(rota.id, {
        itens_json: JSON.stringify(novosItens)
      });

      // Tenta atualizar também em PedidoOdoo para sincronizar
      try {
        const limpo = String(numeroPedido).replace(/\D/g, "");
        const pOdoos = await base44.entities.PedidoOdoo.filter({
          $or: [
            { numero_pedido: String(numeroPedido) },
            ...(limpo ? [{ numero_pedido: limpo }, { numero_pedido: `S${limpo.padStart(5, "0")}` }] : [])
          ]
        }, "-created_date", 2);
        if (pOdoos && pOdoos.length > 0) {
          for (const p of pOdoos) {
            await base44.entities.PedidoOdoo.update(p.id, {
              pdf_pedido_url: fileUrl,
              pdf_pedido_nome: file.name,
              pdf_url: fileUrl
            }).catch(() => {});
          }
        }
      } catch {}

      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo"] });
      toast.success(`PDF do Pedido #${numeroPedido} anexado com sucesso!`, { id: "upload-pdf-manual" });
    } catch (err) {
      toast.error("Erro ao anexar PDF: " + (err?.message || "tente novamente"), { id: "upload-pdf-manual" });
    } finally {
      setAnexandoPdfPedido(null);
    }
  };

  const handleSolicitarPdfsOdoo = async () => {
    const listaPedidos = itens.map((it) => it.numero_pedido).filter(Boolean);
    if (listaPedidos.length === 0) {
      toast.error("Nenhum pedido identificado nesta rota.");
      return;
    }
    setSolicitandoPdfs(true);
    toast.loading("Disparando solicitação de PDFs para o Odoo ERP...", { id: "puxar-pdfs" });
    try {
      const rawRes = await base44.functions.invoke("solicitarPdfsOdoo", {
        rota_id: rota.id,
        pedidos: listaPedidos,
      });
      const res = rawRes?.data || rawRes;
      if (res?.success) {
        const naoLocalizados = (res.falhas || []).map((f) => f.pedido);
        if (naoLocalizados.length > 0) {
          toast.warning(
            `${res.enviados} de ${res.total_pedidos} PDFs solicitados. O Odoo não localizou: ${naoLocalizados.join(", ")}.`,
            { id: "puxar-pdfs", duration: 9000 }
          );
        } else {
          toast.success(
            res.ja_disponiveis ? res.message : `${res.enviados || res.total_pedidos} PDFs solicitados ao Odoo. Eles aparecem aqui conforme chegam.`,
            { id: "puxar-pdfs", duration: 6000 }
          );
        }

        // O recebimento continua sendo acompanhado pela assinatura da rota,
        // sem encerrar após 21 segundos nem recarregar todo o PCP a cada PDF.
        queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      } else if (res?.status_odoo) {
        toast.error(
          res.message || `O Odoo recusou a solicitação (status ${res.status_odoo}). Nenhum PDF foi gerado.`,
          { id: "puxar-pdfs", duration: 9000 }
        );
      } else if (res?.config_pendente) {
        toast.info(res.message || "Aguardando URL do webhook fornecida pela equipe do Odoo.", { id: "puxar-pdfs" });
      } else {
        toast.error(res?.message || "Não deu boa ao solicitar PDFs ao Odoo.", { id: "puxar-pdfs" });
      }
    } catch (e) {
      toast.error("Erro na comunicação com o Odoo: " + (e?.message || ""), { id: "puxar-pdfs" });
    } finally {
      setSolicitandoPdfs(false);
    }
  };

  const handleAbrirOdoo = async (it, info) => {
    if (info?.pedidoOdoo) {
      setPedidoOdooModal(info.pedidoOdoo);
      return;
    }
    const num = it.numero_odoo || it.numero_pedido;
    if (!num || String(num).toUpperCase() === "NT") {
      toast.info(`Pedido #${it.numero_pedido} não possui vínculo no Odoo ERP.`);
      return;
    }
    try {
      toast.loading("Buscando detalhes no Odoo...", { id: "busca-odoo" });
      const limpo = String(num).replace(/\D/g, "");
      const res = await base44.entities.PedidoOdoo.filter({
        $or: [
          { odoo_id: String(num) },
          { of_odoo_id: String(num) },
          { numero_pedido: String(num) },
          ...(limpo ? [{ odoo_id: limpo }, { of_odoo_id: limpo }, { numero_pedido: limpo }] : [])
        ]
      }, "-created_date", 1);
      toast.dismiss("busca-odoo");
      if (res && res.length > 0) {
        setPedidoOdooModal(res[0]);
      } else {
        toast.info(`Pedido Odoo #${num} não localizado no banco.`);
      }
    } catch {
      toast.dismiss("busca-odoo");
    }
  };

  const handleReplaceRota = async (file) => {
    if (!file) return;
    setReplacingRota(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const parsed = await parseRotaImage(file_url);
      await base44.entities.RotaEntrega.update(rota.id, {
        rota_imagem_url: file_url,
        rota_imagem_nome: file.name,
        titulo: parsed.titulo || rota.titulo,
        entrega_date: parsed.entrega_date || "",
        embarque_date: parsed.embarque_date || "",
        total_valor: parsed.total_valor || "",
        nota_geral: parsed.nota_geral || "",
        itens_json: JSON.stringify(parsed.itens || []),
        motorista_nome: parsed.motorista_nome || rota.motorista_nome,
        placa: (parsed.placa || rota.placa || "").toUpperCase(),
        data_criacao: format(new Date(), "yyyy-MM-dd"),
      });
      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      toast.success("Rota atualizada! IA releu todos os dados.");

      // 🚀 Gatilho imediato ao trocar a foto da rota: solicita os PDFs ao Odoo
      const pedidosParaPdf = (parsed.itens || []).map((i) => i.numero_pedido).filter(Boolean);
      if (pedidosParaPdf.length > 0) {
        toast.info(`🔄 Solicitando PDFs de ${pedidosParaPdf.length} pedidos ao Odoo...`, { duration: 3500 });
        base44.functions
          .invoke("solicitarPdfsOdoo", {
            pedidos: pedidosParaPdf,
            rota_id: rota.id,
            rota_titulo: parsed.titulo || rota.titulo,
          })
          .then((res) => {
            if (res?.data?.success) {
              toast.success(`✅ Pedido de PDFs disparado ao Odoo (${pedidosParaPdf.length} pedidos)!`);
            }
          })
          .catch(() => {});
      }
    } catch (e) {
      toast.error("Erro ao atualizar rota: " + (e?.message || ""));
    } finally {
      setReplacingRota(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Excluir esta rota de entrega? Esta ação não pode ser desfeita.")) return;
    try {
      await base44.entities.RotaEntrega.delete(rota.id);
      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      queryClient.invalidateQueries({ queryKey: ["rotas-arquivadas"] });
      toast.success("Rota excluída.");
    } catch (e) {
      toast.error("Erro: " + (e?.message || ""));
    }
  };

  const { getInfoPedido } = useInvestigacaoBarracoes(rota.unidade);

  const itens = useMemo(() => {
    try { return JSON.parse(rota.itens_json || "[]"); } catch { return []; }
  }, [rota.itens_json]);

  const resumoBarracoes = useMemo(() => {
    let telhas = 0;
    let cd = 0;
    let ambos = 0;
    let aguardando = 0;

    itens.forEach((it) => {
      const info = getInfoPedido(it.numero_pedido);
      const b = info?.barracao || it.barracao_sugerido || "aguardando";
      if (b === "ambos") ambos++;
      else if (b === "telhas") telhas++;
      else if (b === "corte_dobra") cd++;
      else aguardando++;
    });

    return { telhas, cd, ambos, aguardando };
  }, [itens, getInfoPedido]);

  const itensFiltrados = useMemo(() => {
    if (!departamento) return itens;
    return itens.filter((i) => {
      const info = getInfoPedido(i.numero_pedido);
      const b = info?.barracao || i.barracao_sugerido;
      if (departamento === "telhas") return b === "telhas" || b === "ambos" || (i.departamentos || []).includes("telhas");
      if (departamento === "corte_dobra") return b === "corte_dobra" || b === "ambos" || (i.departamentos || []).includes("corte_dobra");
      return (i.departamentos || []).includes(departamento);
    });
  }, [itens, departamento, getInfoPedido]);

  // Mapa de investigações para estimativa de peso físico da rota
  const infoPedidosMap = useMemo(() => {
    const map = {};
    itens.forEach((it) => {
      map[it.numero_pedido] = getInfoPedido(
        it.numero_pedido,
        it.observacao,
        rota.titulo,
        it.numero_odoo,
        it.cliente,
        it.vendedor
      );
    });
    return map;
  }, [itens, getInfoPedido, rota.titulo]);

  // Quantidade de PDFs recebidos do Odoo e disponíveis nesta rota
  const totalPdfsProntos = useMemo(() => {
    return itens.filter((it) => {
      const info = infoPedidosMap[it.numero_pedido];
      return Boolean(
        it.pdf_url ||
        info?.pedidoOdoo?.pdf_pedido_url ||
        info?.pedidoOdoo?.pdf_url ||
        info?.anexos?.find((a) => a?.toLowerCase?.()?.endsWith(".pdf"))
      );
    }).length;
  }, [itens, infoPedidosMap]);

  // Cálculo de peso total carregado (telhas, CD e itens)
  const dadosPeso = useMemo(() => {
    return calcularPesoRota(rota, infoPedidosMap);
  }, [rota, infoPedidosMap]);

  // Tipo de veículo e capacidade do caminhão
  const veiculoDef = useMemo(() => {
    return obterVeiculoPorIdOuNome(rota.tipo_veiculo);
  }, [rota.tipo_veiculo]);

  const capacidadeFinalKg = Number(rota.capacidade_kg) > 0 ? Number(rota.capacidade_kg) : veiculoDef.capacidade_kg;

  const analiseCapacidade = useMemo(() => {
    return analisarCapacidadeCaminhao(dadosPeso.pesoTotalKg, capacidadeFinalKg);
  }, [dadosPeso.pesoTotalKg, capacidadeFinalKg]);

  // Ambos os barracões de fabricação (Telhas e Corte & Dobra) DEVEM estar sempre disponíveis lado a lado
  const departamentosAtivos = useMemo(() => {
    const list = ["telhas", "corte_dobra"];
    if (rota.video_expedicao_url || rota.fotos_expedicao_json || (rota.itens_json && rota.itens_json.includes('"expedicao"'))) {
      list.push("expedicao");
    }
    return list;
  }, [rota]);

  const alterarBarracaoPedido = async (numeroPedido, novoBarracao) => {
    const novosItens = itens.map((it) => {
      if (String(it.numero_pedido).trim() === String(numeroPedido).trim()) {
        const deps = [];
        if (novoBarracao === "telhas" || novoBarracao === "ambos") deps.push("telhas");
        if (novoBarracao === "corte_dobra" || novoBarracao === "ambos") deps.push("corte_dobra");
        if (novoBarracao === "aguardando") deps.push("expedicao");
        return {
          ...it,
          barracao_sugerido: novoBarracao,
          departamentos: deps,
        };
      }
      return it;
    });

    try {
      await base44.entities.RotaEntrega.update(rota.id, {
        itens_json: JSON.stringify(novosItens),
      });
      queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
      toast.success(`Pedido #${numeroPedido} alterado para ${novoBarracao === "telhas" ? "Telhas" : novoBarracao === "corte_dobra" ? "Corte & Dobra" : novoBarracao === "ambos" ? "Ambos" : "Aguardando"}!`);
    } catch (e) {
      toast.error("Erro ao alterar barracão: " + (e?.message || ""));
    }
  };

  const carregamentoField = (dep) => ({
    fotosJson: rota[`fotos_${dep}_json`] || "",
    videoUrl: rota[`video_${dep}_url`] || "",
    videoNome: rota[`video_${dep}_nome`] || "",
    legadoUrl: rota[`imagem_carregamento_${dep}_url`],
    legadoNome: rota[`imagem_carregamento_${dep}_nome`],
  });

  const totalFmt = rota.total_valor || "";
  const dataCriacao = rota.data_criacao ? format(new Date(rota.data_criacao + "T12:00:00"), "dd/MM") : "";
  const numCargaExibicao = rota.numero_carga || numeroCarga || (rota.id ? rota.id.slice(-4).toUpperCase() : "01");

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm w-full transition-all">
      {/* Header Amplo da Rota */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-border">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-primary text-primary-foreground font-black px-2.5 py-0.5 rounded-md text-xs tracking-wider shadow-2xs">
                  CARGA #{numCargaExibicao}
                </span>
                <h3 className="font-bold text-base text-foreground leading-tight">
                  {rota.titulo || "Rota de Entrega"}
                </h3>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                {rota.entrega_date && (
                  <span className="flex items-center gap-1 font-semibold text-foreground">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> Entrega: <strong>{rota.entrega_date}</strong>
                  </span>
                )}
                {rota.embarque_date && (
                  <span>Embarque: <strong>{rota.embarque_date}</strong></span>
                )}
                {dataCriacao && <span>· Criada em: {dataCriacao}</span>}
              </div>
            </div>
          </div>

          {/* Motorista, Placa e Badges dos Barracões */}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {(rota.motorista_nome || rota.placa) && (
              <Badge variant="outline" className="text-xs bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold gap-1.5 py-1 px-2.5">
                <span>👤 Motorista: <strong>{rota.motorista_nome || "—"}</strong></span>
                {rota.placa && <span>· 🚛 Placa: <strong className="font-mono">{rota.placa}</strong></span>}
              </Badge>
            )}

            {resumoBarracoes.telhas > 0 && (
              <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-900 border-blue-200 text-xs font-bold gap-1 py-1 px-2.5">
                🏠 {resumoBarracoes.telhas} Telhas
              </Badge>
            )}
            {resumoBarracoes.cd > 0 && (
              <Badge className="bg-orange-100 hover:bg-orange-100 text-orange-900 border-orange-200 text-xs font-bold gap-1 py-1 px-2.5">
                🏗️ {resumoBarracoes.cd} Corte & Dobra
              </Badge>
            )}
            {resumoBarracoes.ambos > 0 && (
              <Badge className="bg-purple-100 hover:bg-purple-100 text-purple-900 border-purple-200 text-xs font-bold gap-1 py-1 px-2.5">
                📦 {resumoBarracoes.ambos} Ambos
              </Badge>
            )}
            {resumoBarracoes.aguardando > 0 && (
              <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 text-xs py-1 px-2.5">
                ⏳ {resumoBarracoes.aguardando} Aguardando Entrada
              </Badge>
            )}
          </div>
        </div>

        {/* Ações do Topo: Imprimir Romaneio em Destaque, Status de PDFs e Menu de Ações (...) */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {/* Botão Oficial Primário: Imprimir Romaneio em PDF */}
          <Button
            size="sm"
            onClick={() => imprimirRomaneioHtml(rota, { filialAtiva: rota.unidade, infoPedidosMap })}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-3.5 shadow-sm cursor-pointer"
            title="Abrir folha oficial do Romaneio/Manifesto de Carga para impressão ou salvar em PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Romaneio (PDF)</span>
          </Button>

          {/* Indicador de Status: Deu boa ou não na busca de PDFs */}
          {totalPdfsProntos === itens.length && itens.length > 0 ? (
            <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 font-bold text-xs gap-1.5 py-1 px-2.5 h-9 flex items-center shadow-2xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Deu boa! {totalPdfsProntos}/{itens.length} PDFs</span>
            </Badge>
          ) : totalPdfsProntos > 0 ? (
            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 font-bold text-xs gap-1.5 py-1 px-2.5 h-9 flex items-center">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>PDFs: {totalPdfsProntos}/{itens.length}</span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-slate-500 border-slate-300 dark:border-slate-700 font-medium text-xs gap-1.5 py-1 px-2.5 h-9 flex items-center" title="Nenhum PDF recebido do Odoo para esta rota ainda.">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>0/{itens.length} PDFs</span>
            </Badge>
          )}

          <Badge className="bg-slate-800 dark:bg-slate-700 text-white font-bold text-xs px-2.5 py-1 h-9 flex items-center">
            {itens.length} {itens.length === 1 ? "pedido" : "pedidos"}
          </Badge>

          {/* Menu de Três Pontinhos (...) com as Demais Opções */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-9 w-9 p-0 border-border bg-card hover:bg-muted text-foreground cursor-pointer"
                title="Mais ações da carga..."
              >
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 space-y-1">
              <DropdownMenuItem
                onClick={handleSolicitarPdfsOdoo}
                disabled={solicitandoPdfs}
                className="gap-2 cursor-pointer text-xs font-semibold"
              >
                {solicitandoPdfs ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <RefreshCw className="w-4 h-4 text-blue-600" />}
                <span>Puxar PDFs do Odoo</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => baixarRomaneioPdf(rota, { filialAtiva: rota.unidade, infoPedidosMap })}
                className="gap-2 cursor-pointer text-xs font-semibold"
              >
                <Download className="w-4 h-4 text-emerald-600" />
                <span>Baixar Romaneio em PDF</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => setEditDialogOpen(true)}
                className="gap-2 cursor-pointer text-xs font-semibold"
              >
                <Pencil className="w-4 h-4 text-primary" />
                <span>Editar Dados da Carga</span>
              </DropdownMenuItem>

              {allowDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="gap-2 cursor-pointer text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                    <span>Excluir Carga</span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Monitoramento de Capacidade do Veículo & Ocupação de Peso */}
      <div className="bg-slate-50/80 dark:bg-slate-900/50 border border-border rounded-xl p-3.5 space-y-2 shadow-2xs">
        <div className="flex items-center justify-between gap-3 text-xs flex-wrap">
          <div className="flex items-center gap-2 font-bold text-foreground">
            <span className="text-lg">{veiculoDef.icone}</span>
            <span className="text-sm">{veiculoDef.label}</span>
            {rota.placa && (
              <span className="text-muted-foreground font-mono font-normal">
                ({rota.placa})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`text-xs py-0.5 px-2.5 font-bold ${analiseCapacidade.badgeCls}`}>
              {analiseCapacidade.status === "sobrepeso" && <AlertTriangle className="w-3.5 h-3.5 mr-1 shrink-0" />}
              {analiseCapacidade.status === "sobrepeso"
                ? `SOBREPESO (${analiseCapacidade.percentual}%)`
                : `${analiseCapacidade.percentual}% ocupado`}
            </Badge>
          </div>
        </div>

        {/* Barra de progresso visual */}
        <div className="w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden border border-border/40">
          <div
            className={`h-full transition-all duration-500 rounded-full ${analiseCapacidade.corBarra}`}
            style={{ width: `${Math.min(100, analiseCapacidade.percentual)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-0.5 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 font-medium">
            <Weight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>Peso Est.: <strong className="text-foreground text-sm">{dadosPeso.pesoTotalKg.toLocaleString("pt-BR")} kg</strong></span>
            {(dadosPeso.pesoTelhasKg > 0 || dadosPeso.pesoCdKg > 0) && (
              <span className="text-xs text-muted-foreground/80 hidden sm:inline">
                ({dadosPeso.pesoTelhasKg > 0 ? `${dadosPeso.pesoTelhasKg.toLocaleString("pt-BR")}kg Telhas` : ""}
                {dadosPeso.pesoTelhasKg > 0 && dadosPeso.pesoCdKg > 0 ? " · " : ""}
                {dadosPeso.pesoCdKg > 0 ? `${dadosPeso.pesoCdKg.toLocaleString("pt-BR")}kg CD` : ""})
              </span>
            )}
          </div>
          <div>
            <span>Capacidade Máxima: <strong className="text-foreground text-sm">{capacidadeFinalKg.toLocaleString("pt-BR")} kg</strong></span>
          </div>
        </div>

        {analiseCapacidade.sobrepesoKg > 0 && (
          <div className="text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-lg p-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              Atenção: Peso da rota excede a capacidade do caminhão!
            </span>
            <span>+{analiseCapacidade.sobrepesoKg.toLocaleString("pt-BR")} kg excedentes</span>
          </div>
        )}
      </div>

      {/* Galeria de Fotos e Mídias Integrada da Carga */}
      <GaleriaFotosRota
        rota={rota}
        onAtualizarRota={() => queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] })}
      />

      {/* Botão de Auditoria Fotográfica Sequencial (5 Etapas) */}
      <Link
        to={`/timeline-carregamento?rotaId=${rota.id}`}
        className="flex items-center justify-between gap-3 w-full py-2.5 px-4 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all font-semibold text-xs shadow-xs group"
      >
        <div className="flex items-center gap-2.5">
          <Camera className="w-4 h-4 text-primary shrink-0 transition-transform group-hover:scale-110" />
          <span>📸 Timeline de Carregamento & Amarração (5 Etapas Fotográficas Oficiais)</span>
        </div>
        <span className="text-xs bg-primary/20 text-primary px-3 py-1 rounded-md font-mono font-bold">
          Iniciar Vistoria ➔
        </span>
      </Link>

      {/* Cabeçalho Interativo para Alternar a Visualização da Tabela de Pedidos */}
      {itensFiltrados.length > 0 && (
        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={() => setTabelaExpandida(!tabelaExpandida)}
            className="flex items-center justify-between w-full p-3 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 hover:bg-slate-200/80 dark:hover:bg-slate-800 transition-colors font-bold text-xs text-foreground cursor-pointer border border-border/80"
          >
            <span className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-primary" />
              Manifesto de Carga — Pedidos da Rota ({itensFiltrados.length} pedidos)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-primary font-bold">
              {tabelaExpandida ? (
                <>Recolher Tabela <ChevronUp className="w-4 h-4" /></>
              ) : (
                <>Visualizar Tabela Ampla <ChevronDown className="w-4 h-4" /></>
              )}
            </span>
          </button>

          {/* Tabela Ampla, Espaçosa e Nítida com Status em Chão de Fábrica */}
          {tabelaExpandida && (
            <div className="rounded-xl border border-border overflow-hidden bg-background shadow-xs max-h-[520px] overflow-y-auto overflow-x-auto transition-all">
              <table className="w-full text-xs min-w-[1050px] border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 sticky top-0 z-10 border-b border-border shadow-xs">
                  <tr>
                    <th className="text-center p-2.5 font-bold w-12">#</th>
                    <th className="text-left p-2.5 font-bold w-36">Pedido (Odoo)</th>
                    <th className="text-left p-2.5 font-bold min-w-[200px]">Cliente / Vendedor</th>
                    <th className="text-left p-2.5 font-bold w-36">Setor</th>
                    <th className="text-left p-2.5 font-bold min-w-[220px]">Status no Chão de Fábrica</th>
                    <th className="text-left p-2.5 font-bold min-w-[220px]">Observações da Rota</th>
                    <th className="text-left p-2.5 font-bold w-32">Bairro / Cidade</th>
                    <th className="text-right p-2.5 font-bold w-24">Valor</th>
                    <th className="text-center p-2.5 font-bold w-28">PDF (Odoo)</th>
                    <th className="text-center p-2.5 font-bold w-28 pr-3">Fotos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {itensFiltrados.map((it, idx) => {
                    const info = getInfoPedido(
                      it.numero_pedido,
                      it.observacao,
                      rota.titulo,
                      it.numero_odoo,
                      it.cliente,
                      it.vendedor
                    );

                    const setor = it.barracao_sugerido || info?.barracao || "aguardando";
                    const isTelhas = setor === "telhas";
                    const isCD = setor === "corte_dobra";
                    const isAmbos = setor === "ambos";

                    // Estilo de borda lateral colorida marcante por setor
                    const bordaSetorClass = isTelhas
                      ? "border-l-4 border-l-blue-500 bg-blue-50/20 dark:bg-blue-950/10"
                      : isCD
                      ? "border-l-4 border-l-orange-500 bg-orange-50/20 dark:bg-orange-950/10"
                      : isAmbos
                      ? "border-l-4 border-l-purple-500 bg-purple-50/20 dark:bg-purple-950/10"
                      : "border-l-4 border-l-slate-300 dark:border-l-slate-700";

                    // Resolução do PDF oficial do pedido
                    const pdfUrl =
                      it.pdf_url ||
                      info?.pedidoOdoo?.pdf_pedido_url ||
                      info?.pedidoOdoo?.pdf_url ||
                      info?.anexos?.find((a) => a?.toLowerCase?.()?.endsWith(".pdf"));
                    const pdfNome =
                      it.pdf_nome ||
                      info?.pedidoOdoo?.pdf_pedido_nome ||
                      `Pedido_${it.numero_pedido}.pdf`;

                    // Cálculo do progresso no chão de fábrica
                    const maquinasAtuais = [
                      ...(info?.maquinasTelhas || []),
                      ...(info?.maquinasCD || []),
                    ].filter(Boolean);

                    const produtos = [
                      ...(info?.produtosTelhas || []),
                      ...(info?.produtosCD || []),
                    ];

                    const totalItensProd = Math.max(1, produtos.length);
                    const estaConcluido =
                      info?.statusTelhas === "finalizado" ||
                      info?.statusCD === "finalizado" ||
                      (info?.pedidoOdoo?.status_pcp === "concluido");

                    const estaProduzindo =
                      info?.statusTelhas === "em_producao" ||
                      info?.statusCD === "em_producao" ||
                      maquinasAtuais.length > 0;

                    const itensProntosCount = estaConcluido
                      ? totalItensProd
                      : estaProduzindo
                      ? Math.max(0, totalItensProd - 1)
                      : 0;

                    const pctPronto = Math.round((itensProntosCount / totalItensProd) * 100);
                    const estaExpandido = itemDetalheExpandido === it.numero_pedido;

                    return (
                      <React.Fragment key={idx}>
                        <tr
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors ${bordaSetorClass}`}
                        >
                          <td className="p-2.5 text-center font-bold text-muted-foreground">
                            <span className="inline-block w-6 h-6 leading-6 text-center rounded-full bg-slate-100 dark:bg-slate-800 text-[11px]">
                              {it.ordem || idx + 1}
                            </span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleAbrirOdoo(it, info)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900 transition-colors shadow-2xs cursor-pointer group"
                              title="Nº Pedido Odoo — Clique para ver croquis, itens e espelho do pedido no Odoo"
                            >
                              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform" />
                              <span>#{it.numero_pedido}</span>
                              {pdfUrl && (
                                <span
                                  className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"
                                  title="PDF do pedido já recebido e anexado"
                                />
                              )}
                            </button>
                          </td>
                          <td className="p-2.5">
                            <div className="font-semibold text-foreground text-xs leading-snug">
                              {it.cliente}
                            </div>
                            {(it.vendedor || it.pagamento) && (
                              <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                                {it.vendedor && <span>Vend: <strong className="font-medium text-slate-700 dark:text-slate-300">{it.vendedor}</strong></span>}
                                {it.vendedor && it.pagamento && <span>•</span>}
                                {it.pagamento && <span>Pg: <strong className="font-medium text-slate-700 dark:text-slate-300">{it.pagamento}</strong></span>}
                              </div>
                            )}
                          </td>

                          {/* Setor: Telhas (Azul), Corte & Dobra (Laranja) ou Ambos (Roxo) */}
                          <td className="p-2.5">
                            <select
                              value={setor}
                              onChange={(e) => alterarBarracaoPedido(it.numero_pedido, e.target.value)}
                              className={`text-xs font-bold px-2 py-1 rounded-md border cursor-pointer outline-none transition-colors shadow-2xs ${
                                isTelhas
                                  ? "bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-200 dark:border-blue-800"
                                  : isCD
                                  ? "bg-orange-50 text-orange-700 border-orange-300 dark:bg-orange-950/60 dark:text-orange-200 dark:border-orange-800"
                                  : isAmbos
                                  ? "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-200 dark:border-purple-800"
                                  : "bg-slate-100 text-slate-700 border-slate-300"
                              }`}
                              title="Clique para alterar o setor responsável"
                            >
                              <option value="telhas">🏠 Telhas</option>
                              <option value="corte_dobra">🏗️ Corte & Dobra</option>
                              <option value="ambos">📦 Ambos os Barracões</option>
                              <option value="aguardando">⏳ Aguardando Entrada</option>
                            </select>
                          </td>

                          {/* Status no Chão de Fábrica & Máquina Atual */}
                          <td className="p-2.5">
                            <div className="space-y-1">
                              {/* Pílula da Máquina / Localização */}
                              {info?.tabletLocal ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border tracking-tight shadow-2xs ${info.tabletLocal.badgeClass}`}
                                >
                                  {info.tabletLocal.label}
                                </span>
                              ) : maquinasAtuais.length > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200">
                                  <Zap className="w-3 h-3 text-amber-600 fill-amber-500" />
                                  <span>Na Máquina: {maquinasAtuais.join(", ")}</span>
                                </span>
                              ) : estaConcluido ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                  <span>Pronto p/ Carregamento</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground font-medium">
                                  {info?.statusGeralLabel || "Fila de Produção"}
                                </span>
                              )}

                              {/* Mini Barra de Progresso de Itens */}
                              <div className="flex items-center gap-2">
                                <div className="flex-1 bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      estaConcluido ? "bg-emerald-500" : estaProduzindo ? "bg-amber-500" : "bg-slate-400"
                                    }`}
                                    style={{ width: `${pctPronto || (estaConcluido ? 100 : 25)}%` }}
                                  />
                                </div>
                                <span className="text-[9px] font-bold text-muted-foreground whitespace-nowrap">
                                  {itensProntosCount}/{totalItensProd} itens
                                </span>
                              </div>

                              {produtos.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setItemDetalheExpandido(estaExpandido ? null : it.numero_pedido)}
                                  className="text-[10px] text-primary hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
                                >
                                  {estaExpandido ? "Ocultar peças" : `Ver ${produtos.length} peças`}
                                  {estaExpandido ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </td>

                          <td className="p-2.5">
                            {it.observacao ? (
                              <div className="inline-flex items-start gap-1.5 font-semibold text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-md p-1.5 text-[11px] leading-tight">
                                <span className="flex-none">📌</span>
                                <span>{it.observacao}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                          <td className="p-2.5 text-foreground text-xs">
                            <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                              <MapPin className="w-3.5 h-3.5 text-muted-foreground flex-none" />
                              {it.bairro || "—"}
                            </span>
                          </td>
                          <td className="p-2.5 text-right font-bold text-foreground text-xs tabular-nums">
                            {it.valor || "—"}
                          </td>
                          <td className="p-2.5 text-center whitespace-nowrap">
                            {pdfUrl ? (
                              <div className="inline-flex items-center gap-1">
                                <a
                                  href={pdfUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center h-7 px-2.5 gap-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 rounded-md shadow-2xs cursor-pointer group transition-colors"
                                  title={`Abrir PDF oficial do Pedido #${it.numero_pedido} (${pdfNome})`}
                                >
                                  <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                                  <span>Ver PDF</span>
                                  <ExternalLink className="w-3 h-3 text-emerald-500 opacity-60" />
                                </a>
                                <label
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer shadow-2xs transition-colors"
                                  title="Substituir PDF deste pedido manualmente"
                                >
                                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    onChange={(e) => handleAnexarPdfManual(it.numero_pedido, e.target.files?.[0])}
                                    disabled={anexandoPdfPedido === it.numero_pedido}
                                  />
                                </label>
                              </div>
                            ) : (
                              <label
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold border cursor-pointer transition-all shadow-2xs ${
                                  anexandoPdfPedido === it.numero_pedido
                                    ? "bg-slate-100 text-slate-500 border-slate-300 animate-pulse"
                                    : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                                }`}
                                title="PDF ainda não recebido. Clique para anexar o PDF deste pedido manualmente."
                              >
                                <input
                                  type="file"
                                  accept=".pdf,application/pdf"
                                  className="hidden"
                                  disabled={anexandoPdfPedido === it.numero_pedido}
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleAnexarPdfManual(it.numero_pedido, file);
                                  }}
                                />
                                {anexandoPdfPedido === it.numero_pedido ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
                                    <span>Anexando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload className="w-3.5 h-3.5 text-amber-700" />
                                    <span>Anexar PDF</span>
                                  </>
                                )}
                              </label>
                            )}
                          </td>
                          <td className="p-2.5 text-center pr-3">
                            <FotoPedidoButton
                              rotaId={rota.id}
                              numeroPedido={it.numero_pedido}
                              cliente={it.cliente}
                              fotosPedidosJson={rota.fotos_pedidos_json}
                            />
                          </td>
                        </tr>

                        {/* Acordeão com Detalhamento de Peças e Máquinas do Pedido */}
                        {estaExpandido && (
                          <tr className="bg-slate-100/70 dark:bg-slate-900/70 border-l-4 border-l-primary">
                            <td colSpan={10} className="p-3 pl-12">
                              <div className="bg-card p-3 rounded-lg border border-border space-y-2">
                                <div className="text-[11px] font-bold text-foreground flex items-center justify-between">
                                  <span>Peças / Itens de Fabricação deste Pedido:</span>
                                  <span className="text-muted-foreground">{produtos.length} produtos listados</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {produtos.map((pNome, pIdx) => (
                                    <div
                                      key={pIdx}
                                      className="flex items-center justify-between p-2 rounded bg-slate-50 dark:bg-slate-800 border border-border text-[11px]"
                                    >
                                      <span className="font-medium text-foreground truncate mr-2">
                                        • {pNome}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="text-[9px] h-4 px-1 bg-emerald-50 text-emerald-700 border-emerald-300 font-bold shrink-0"
                                      >
                                        ✓ Concluído
                                      </Badge>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Departamentos Envolvidos */}
      {!departamento && (
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {["telhas", "corte_dobra", "expedicao"].map((d) => {
            const count = itens.filter((i) => (i.departamentos || []).includes(d)).length;
            if (count === 0) return null;
            return (
              <Badge key={d} className={`text-xs py-1 px-2.5 font-semibold ${DEP_COLOR[d]}`}>
                {d === "telhas" && <Factory className="w-3.5 h-3.5 mr-1" />}
                {d === "corte_dobra" && <Layers className="w-3.5 h-3.5 mr-1" />}
                {d === "expedicao" && <PackageCheck className="w-3.5 h-3.5 mr-1" />}
                {DEP_LABEL[d]}: {count} {count === 1 ? "pedido" : "pedidos"}
              </Badge>
            );
          })}
        </div>
      )}

      {/* OBS — Observações da Carga e Rota */}
      {(rota.observacao || rota.nota_geral) && (
        <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 rounded-xl p-3 shadow-2xs">
          <StickyNote className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-1">
            {rota.observacao && <p className="whitespace-pre-wrap font-bold">📝 {rota.observacao}</p>}
            {rota.nota_geral && rota.nota_geral !== rota.observacao && (
              <p className="whitespace-pre-wrap text-muted-foreground italic text-xs">Nota da folha: {rota.nota_geral}</p>
            )}
          </div>
        </div>
      )}

      {/* Barra Inferior com Total e Ação de Exclusão */}
      <div className="flex items-center justify-between text-xs pt-2 border-t border-border flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {totalFmt && (
            <div className="flex items-center gap-1.5 font-bold text-sm text-foreground">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <span>Valor Total da Rota: <strong className="text-emerald-700 dark:text-emerald-400">{totalFmt}</strong></span>
            </div>
          )}
        </div>

        {allowDelete && (
          <Button
            size="sm"
            variant="destructive"
            onClick={handleDelete}
            className="gap-1.5 text-xs font-bold h-8 px-3 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Excluir Rota
          </Button>
        )}
      </div>

      <input
        ref={editRotaRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleReplaceRota(e.target.files?.[0])}
      />
      <ImageViewer url={viewerUrl} name={viewerName} open={!!viewerUrl} onClose={() => setViewerUrl(null)} />
      <EditarRotaDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} rota={rota} />
      {pedidoOdooModal && (
        <PedidoOdooDetalheDialog
          pedido={pedidoOdooModal}
          open={Boolean(pedidoOdooModal)}
          onOpenChange={(op) => { if (!op) setPedidoOdooModal(null); }}
        />
      )}
    </div>
  );
}