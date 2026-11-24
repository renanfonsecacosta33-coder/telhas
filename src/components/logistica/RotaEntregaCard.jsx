import React, { useState, useMemo, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "react-router-dom";
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
  ExternalLink
} from "lucide-react";
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

export default function RotaEntregaCard({ rota, departamento, allowDelete = false }) {
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerName, setViewerName] = useState("");
  const [replacingRota, setReplacingRota] = useState(false);
  const [solicitandoPdfs, setSolicitandoPdfs] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [pedidoOdooModal, setPedidoOdooModal] = useState(null);
  const [tabelaExpandida, setTabelaExpandida] = useState(true);
  const editRotaRef = useRef(null);
  const queryClient = useQueryClient();

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
        toast.success(
          `✅ Deu boa no envio! Solicitação aceita pelo Odoo (ID: ${res.request_id}). Aguardando recebimento dos ${listaPedidos.length} PDFs...`,
          { id: "puxar-pdfs", duration: 6000 }
        );

        // Monitoramento ativo em tempo real: atualiza a cada 3 segundos durante 21 segundos
        let ciclo = 0;
        const interval = setInterval(() => {
          ciclo++;
          queryClient.invalidateQueries({ queryKey: ["rotas-entrega"] });
          queryClient.invalidateQueries({ queryKey: ["pedidos-odoo"] });
          if (ciclo >= 7) {
            clearInterval(interval);
          }
        }, 3000);
      } else if (res?.status_odoo) {
        toast.error(
          `❌ Não deu boa com o Odoo (Status ${res.status_odoo}): O webhook do Odoo deu erro. Peça ao Guilherme para salvar a URL do Base44 no Odoo.`,
          { id: "puxar-pdfs", duration: 8000 }
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

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm w-full transition-all">
      {/* Header Amplo da Rota */}
      <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-border">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="font-bold text-base text-foreground leading-tight">
                {rota.titulo || "Rota de Entrega"}
              </h3>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
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

        {/* Ações do Topo: Gerar PDF, Editar e Quantidade de Pedidos */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {/* Botão: Solicitar PDFs ao Odoo ERP */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleSolicitarPdfsOdoo}
            disabled={solicitandoPdfs}
            className="gap-1.5 text-xs font-semibold h-9 px-3 border-blue-300 dark:border-blue-700 bg-blue-50/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 dark:bg-blue-950/30 cursor-pointer shadow-2xs"
            title="Solicitar envio dos PDFs de venda ao Webhook do Odoo ERP"
          >
            {solicitandoPdfs ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 text-blue-600" />}
            <span>Puxar PDFs do Odoo</span>
          </Button>

          {/* Indicador de Status: Se deu boa ou não na busca de PDFs */}
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
            <Badge variant="outline" className="text-slate-500 border-slate-300 dark:border-slate-700 font-medium text-xs gap-1.5 py-1 px-2.5 h-9 flex items-center" title="Nenhum PDF recebido do Odoo para esta rota ainda. Clique em 'Puxar PDFs do Odoo' para solicitar.">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>0/{itens.length} PDFs</span>
            </Badge>
          )}

          {/* Botão Oficial: Imprimir Romaneio em PDF */}
          <Button
            size="sm"
            onClick={() => imprimirRomaneioHtml(rota, { filialAtiva: rota.unidade, infoPedidosMap })}
            className="gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs h-9 px-3.5 shadow-sm cursor-pointer"
            title="Abrir folha oficial do Romaneio/Manifesto de Carga para impressão ou salvar em PDF"
          >
            <Printer className="w-4 h-4" />
            Imprimir Romaneio (PDF)
          </Button>

          {/* Botão: Baixar PDF nativo */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => baixarRomaneioPdf(rota, { filialAtiva: rota.unidade, infoPedidosMap })}
            className="gap-1.5 text-xs font-semibold h-9 px-3 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            title="Baixar arquivo PDF nativo do Romaneio de Carga"
          >
            <Download className="w-3.5 h-3.5" />
            Baixar PDF
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setEditDialogOpen(true)}
            className="h-9 w-9 p-0 rounded-lg text-primary hover:bg-primary/10 border-primary/20"
            title="Editar dados da rota"
          >
            <Pencil className="w-4 h-4" />
          </Button>

          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-bold text-xs px-3 py-1.5">
            {itens.length} {itens.length === 1 ? "pedido" : "pedidos"}
          </Badge>
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

      {/* Imagem da rota + Carregamento por Barracão em Grid Espaçoso */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-stretch">
        {rota.rota_imagem_url && (
          <div className="relative h-24 md:h-full min-h-[90px] rounded-xl border border-border overflow-hidden bg-muted group md:col-span-1 shadow-2xs">
            <img src={rota.rota_imagem_url} alt="Folha de Rota" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => { setViewerUrl(rota.rota_imagem_url); setViewerName(rota.rota_imagem_nome || "Folha de Rota"); }}
                className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white transition-all shadow-sm flex items-center gap-1 text-[11px] font-bold cursor-pointer"
                title="Visualizar documento em tela cheia"
              >
                <Eye className="w-4 h-4 text-primary" /> Ver Folha
              </button>
            </div>
            <button
              type="button"
              onClick={() => editRotaRef.current?.click()}
              disabled={replacingRota}
              className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md bg-background/90 border border-border shadow-xs flex items-center justify-center hover:bg-background disabled:opacity-60 cursor-pointer"
              title="Trocar folha da rota e reler com IA"
            >
              {replacingRota ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <RefreshCw className="w-3.5 h-3.5 text-primary" />}
            </button>
            <span className="absolute bottom-0 inset-x-0 bg-slate-900/80 text-white text-[10px] text-center py-0.5 font-bold">
              Foto Original da Rota
            </span>
          </div>
        )}

        <div className={`grid gap-2.5 ${rota.rota_imagem_url ? "md:col-span-3" : "md:col-span-4"} ${departamentosAtivos.length === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-3"}`}>
          {departamentosAtivos.map((dep) => {
            const f = carregamentoField(dep);
            const fotosArr = (() => { try { return JSON.parse(f.fotosJson || "[]"); } catch { return []; } })();
            const fotosJsonFinal = fotosArr.length > 0
              ? f.fotosJson
              : (f.legadoUrl ? JSON.stringify([{ url: f.legadoUrl, nome: f.legadoNome || "foto" }]) : "[]");
            return (
              <RotaCarregamentoSlot
                key={dep}
                rotaId={rota.id}
                dep={dep}
                fotosJson={fotosJsonFinal}
                videoUrl={f.videoUrl}
                videoNome={f.videoNome}
              />
            );
          })}
        </div>
      </div>

      {/* Slot Traseira do Caminhão (Carga Geral) */}
      <RotaTraseiraCaminhaoSlot
        rotaId={rota.id}
        fotosJson={rota.fotos_caminhao_traseira_json}
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

          {/* Tabela Ampla, Espaçosa e Nítida */}
          {tabelaExpandida && (
            <div className="rounded-xl border border-border overflow-hidden bg-background shadow-xs max-h-[460px] overflow-y-auto overflow-x-auto transition-all">
              <table className="w-full text-xs min-w-[950px] border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-300 sticky top-0 z-10 border-b border-border shadow-xs">
                  <tr>
                    <th className="text-center p-2.5 font-bold w-12">#</th>
                    <th className="text-left p-2.5 font-bold w-36">Pedido (Odoo)</th>
                    <th className="text-left p-2.5 font-bold min-w-[220px]">Cliente / Vendedor</th>
                    <th className="text-left p-2.5 font-bold w-44">Barracão / Destino</th>
                    <th className="text-left p-2.5 font-bold min-w-[260px]">Observações da Rota</th>
                    <th className="text-left p-2.5 font-bold w-36">Bairro / Cidade</th>
                    <th className="text-right p-2.5 font-bold w-28">Valor</th>
                    <th className="text-center p-2.5 font-bold w-28">PDF (Odoo)</th>
                    <th className="text-center p-2.5 font-bold w-32 pr-3">Fotos Pedido</th>
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

                    // Resolução do PDF oficial do pedido (recebido via webhook do Odoo ou anexo)
                    const pdfUrl =
                      it.pdf_url ||
                      info?.pedidoOdoo?.pdf_pedido_url ||
                      info?.pedidoOdoo?.pdf_url ||
                      info?.anexos?.find((a) => a?.toLowerCase?.()?.endsWith(".pdf"));
                    const pdfNome =
                      it.pdf_nome ||
                      info?.pedidoOdoo?.pdf_pedido_nome ||
                      `Pedido_${it.numero_pedido}.pdf`;

                    return (
                      <tr
                        key={idx}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors"
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
                        <td className="p-2.5">
                          <div className="flex flex-col gap-1">
                            <select
                              value={it.barracao_sugerido || info?.barracao || "aguardando"}
                              onChange={(e) => alterarBarracaoPedido(it.numero_pedido, e.target.value)}
                              className={`text-xs font-bold px-2 py-1 rounded-md border cursor-pointer outline-none transition-colors shadow-2xs ${info?.barracaoBadgeClass || "bg-background border-border text-foreground"}`}
                              title="Clique para alterar o barracão responsável deste pedido"
                            >
                              <option value="telhas">🏠 Telhas</option>
                              <option value="corte_dobra">🏗️ Corte & Dobra</option>
                              <option value="ambos">📦 Ambos os Barracões</option>
                              <option value="aguardando">⏳ Aguardando Entrada</option>
                            </select>
                            {info?.statusGeralLabel && (
                              <span className="text-[10px] text-muted-foreground font-medium">
                                {info.statusGeralLabel}
                                {info.maquinasTelhas?.length > 0 && ` (${info.maquinasTelhas.join(",")})`}
                                {info.maquinasCD?.length > 0 && ` (${info.maquinasCD.join(",")})`}
                              </span>
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
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(pdfUrl, "_blank")}
                              className="h-7 px-2.5 gap-1.5 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs cursor-pointer group"
                              title={`Abrir PDF oficial do Pedido #${it.numero_pedido} (${pdfNome})`}
                            >
                              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
                              <span>Ver PDF</span>
                              <ExternalLink className="w-3 h-3 text-emerald-500 opacity-60" />
                            </Button>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900"
                              title="PDF ainda não recebido do Odoo. Clique em 'Puxar PDFs do Odoo' acima para solicitar."
                            >
                              <Clock className="w-3 h-3 text-amber-600" />
                              Sem PDF
                            </span>
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
