import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Circle, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, ArrowLeft, BarChart2, Plus, Star, Trash2, Edit3, Route, Search, X, Calendar, Filter, History, FileText, AlertTriangle, RefreshCw, Palette, Layers } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import PedidoRow from "@/components/producao/PedidoRow";
import PedidoFormDialog from "@/components/producao/PedidoFormDialog";
import { useFilial } from "@/contexts/FilialContext";
import { playAlertSound, speakNovaOp, playFinishSound, speakOpFinalizada } from "@/lib/sounds";
import { HistoricoPedidoTelhasButton } from "@/components/producao/HistoricoPedidoTelhasSidebar";
import PainelSolicitacoesProducao from "@/components/producao/PainelSolicitacoesProducao";
import BotaoVozFabrica from "@/components/producao/BotaoVozFabrica";
import ChatFloatingButton from "@/components/chat/ChatFloatingButton";
import FinalizarExpedienteButton from "@/components/expediente/FinalizarExpedienteButton";
import HistoricoERelatorioMaquinaModal from "@/components/maquinas/HistoricoERelatorioMaquinaModal";
import { getItens, computePercentual, statusPcpPorPercentual, buildItensJson, classGrupo, detectarMaquinaTelha } from "@/lib/pedidoOdooHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { SeletorPrioridadeDropdown, getPesoOrdenacaoPrioridade, compararPrioridadeEData, getDataEntregaParaOrdenacao } from "@/lib/prioridadeHelper";
import AlterarDataPedidoMaquinaModal from "@/components/maquinas/AlterarDataPedidoMaquinaModal";
import { normalizarTextoBusca, calcularFiltrosTipoECor, pedidoAtendeFiltroTipoECor } from "@/lib/bobinaStatusHelper";
import TimerProducao from "@/components/producao/TimerProducao";
import MonitorOciosidadeMaquina from "@/components/maquinas/MonitorOciosidadeMaquina";
import { isOperadorDestaMaquina } from "@/lib/somPermissaoHelper";
import { salvarCacheLocal, obterCacheLocal, enfileirarAcaoOffline, purgarIdDoCacheLocal } from "@/lib/offlineStorage";
import { calcularMetrosPedido } from "@/lib/metrosHelper";
import { reajustarTodasBobinasMaquinasAutomaticamente } from "@/lib/reajusteAutomaticoBobinas";

const STATUS_LABELS_TELHAS = {
  pendente: "Pendente",
  em_producao: "Em Produção",
  pausado: "Pausado",
  aguardando_colagem: "Aguardando Colagem",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};

/**
 * Identifica se um pedido já foi concluído / finalizado no contexto específico desta máquina.
 * - Na Colagem: apenas status 'finalizado' ou 'cancelado' é considerado concluído.
 * - Em perfiladeiras (TP-25, TP-40, Bandeja, etc.): status 'finalizado', 'cancelado' ou se as peças
 *   já foram perfiladas/tiradas nesta máquina e encaminhadas para a colagem/etapa seguinte.
 */
export function isPedidoConcluidoNaMaquina(p, maquina) {
  if (!p) return false;
  if (p.status === "finalizado" || p.status === "cancelado") return true;

  const norm = (m) => String(m || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const mPainelNorm = norm(maquina);
  if (!mPainelNorm || mPainelNorm === "COLAGEM") {
    return p.status === "finalizado" || p.status === "cancelado";
  }

  const mAtualNorm = norm(p.maquina);
  const mOrigemNorm = norm(p.maquina_origem);

  // 1. Se já avançou para a colagem ou aguardando colagem
  if (mAtualNorm !== mPainelNorm && (mAtualNorm === "COLAGEM" || p.status === "aguardando_colagem")) {
    return true;
  }
  // 2. Se a perfilação já foi concluída
  if (p.perfilacao_concluida && (mAtualNorm === "COLAGEM" || p.status === "aguardando_colagem" || mAtualNorm !== mPainelNorm)) {
    return true;
  }
  // 3. Regra de isPerfiladoNestaMaquina do PedidoRow
  if (
    mAtualNorm !== mPainelNorm &&
    (mOrigemNorm === mPainelNorm || p.etapa_anterior_concluida === maquina || (!p.maquina_origem && (mAtualNorm === "COLAGEM" || p.status === "aguardando_colagem"))) &&
    (mAtualNorm === "COLAGEM" || p.status === "aguardando_colagem" || p.status === "finalizado" || p.perfilacao_concluida)
  ) {
    return true;
  }

  return false;
}







const DASH_PATHS = {
  "TP - 40": "/dashboard/tp40",
  "TP - 25": "/dashboard/tp25",
  "ONDULADA": "/dashboard/ondulada",
  "COLONIAL": "/dashboard/colonial",
  "BANDEJA": "/dashboard/bandeja",
  "DESBOBINADOR": "/dashboard/desbobinador",
  "CUMEEIRA": "/dashboard/cumeeira",
  "COLAGEM": "/dashboard/colagem",
};

export default function MaquinaPanel({ maquina }) {
  const navigate = useNavigate();
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCor, setFiltroCor] = useState("todas");
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [editandoPedido, setEditandoPedido] = useState(null);
  const [alterandoDataPedido, setAlterandoDataPedido] = useState(null);
  const [user, setUser] = useState(null);
  const [modalHistoricoOpen, setModalHistoricoOpen] = useState(false);
  const [modalHistoricoTab, setModalHistoricoTab] = useState("relatorio");
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

  // Reset de qualquer chave de bobina montada em máquina e reajuste automático das bobinas com dados do Odoo
  useEffect(() => {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith("bobina_montada_") || key.startsWith("setup_bobina_") || key.includes("bobina_instalada")) {
          localStorage.removeItem(key);
        }
      });
    } catch {}

    // Reajusta automaticamente todas as OPs para preencher o texto da bobina com base no Odoo
    reajustarTodasBobinasMaquinasAutomaticamente().then(res => {
      if (res && res.totalReajustadas > 0) {
        queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      }
    }).catch(err => {
      console.warn("[MaquinaPanel] Reajuste automático de bobinas:", err);
    });
  }, [queryClient]);

  // Consulta catálogo de bobinas para checagem de estoque e sequenciamento de setup
  const { data: todasBobinas = [] } = useQuery({
    queryKey: ["bobinas"],
    queryFn: () => base44.entities.Bobina.list(),
    staleTime: 60000,
  });

  const isOperador = user?.role === "operador";
  const podeGerenciar = !isOperador;

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Adiciona entrada ao histórico de alterações do pedido
  const appendHistorico = (pedido, acao, acaoLabel, detalhes = "") => {
    if (!user) return {};
    const hist = (() => {
      try { return JSON.parse(pedido.historico_alteracoes || "[]"); }
      catch { return []; }
    })();
    hist.push({
      data: new Date().toISOString(),
      usuario: user.full_name || user.email || "—",
      acao,
      acao_label: acaoLabel,
      detalhes,
      maquina: maquina || pedido.maquina || "",
    });
    return { historico_alteracoes: JSON.stringify(hist) };
  };

  const maquinaNorm = (m) => String(m || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const targetNorm = maquinaNorm(maquina);

  const { data: todosPedidos = [], isLoading } = useQuery({
    queryKey: ["pedidos", filialAtiva],
    queryFn: async () => {
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const cacheOffline = await obterCacheLocal(`pedidos_${filialAtiva}`);
          if (cacheOffline) return cacheOffline;
        }
        const res = await base44.entities.Pedido.filter({ unidade: filialAtiva }, "-data", 500);
        salvarCacheLocal(`pedidos_${filialAtiva}`, res).catch(() => {});
        return res;
      } catch (fetchErr) {
        const cacheOffline = await obterCacheLocal(`pedidos_${filialAtiva}`);
        if (cacheOffline) return cacheOffline;
        throw fetchErr;
      }
    },
    refetchInterval: 10000,
  });

  const pedidos = useMemo(() => {
    return todosPedidos.filter(p => {
      const mNorm = maquinaNorm(p.maquina);
      const mOrigemNorm = maquinaNorm(p.maquina_origem);

      // Se estamos na tela da COLAGEM:
      if (targetNorm === "COLAGEM") {
        // Telha simples pura NUNCA deve ir para a tela de colagem
        const ehSimplesPura = (p.produto === "TELHA") && !p.eps && !/\b(eps|isopor|sanduiche|sanduíche|manta|bandeja|pir|pur)\b/i.test(`${p.item_produto || ""} ${p.modelo || ""} ${p.observacoes_odoo || ""}`);
        if (ehSimplesPura) {
          return false;
        }

        // Componentes individuais de perfilação (telha superior ou bandeja inferior) rodam nas perfiladeiras, não na Colagem
        if (p.tipo_componente_bandeja === "telha_superior" || p.tipo_componente_bandeja === "bandeja_inferior") {
          return false;
        }
        return mNorm === "COLAGEM" || p.status === "aguardando_colagem";
      }

      // Identifica se este item é uma CUMEEIRA
      const ehCumeeira = (p.produto === "CUMEEIRA") ||
        /\bCUMEEIRA\b/i.test(`${p.item_produto || ""} ${p.modelo || ""} ${p.observacoes || ""} ${p.observacoes_odoo || ""}`);

      // Se estamos em máquina de telhas (TP-25, TP-40, Colonial, etc.) e NÃO é a máquina CUMEEIRA:
      // Cumeeiras NUNCA devem aparecer nesta máquina!
      if (targetNorm !== "CUMEEIRA" && ehCumeeira) {
        return false;
      }

      // Se estamos na tela da CUMEEIRA:
      if (targetNorm === "CUMEEIRA") {
        return ehCumeeira || mNorm === "CUMEEIRA" || String(p.maquina || "").toUpperCase().includes("CUMEEIRA");
      }

      // Se estamos em máquina perfiladeira (TP-40, BANDEJA, etc.):
      // A OP de colagem final da Telha Bandeja fica restrita à máquina de Colagem
      if (p.tipo_componente_bandeja === "colagem_final") {
        return false;
      }

      // 1. Está atualmente atribuído a esta máquina perfiladeira
      if (mNorm === targetNorm || String(p.maquina || "").toUpperCase().includes(targetNorm)) {
        return true;
      }

      // 2. Foi perfilado nesta máquina originalmente (maquina_origem bate com esta máquina)
      if (mOrigemNorm === targetNorm || String(p.maquina_origem || "").toUpperCase().includes(targetNorm)) {
        return true;
      }

      // 3. Retrocompatibilidade: Se o pedido está em COLAGEM ou aguardando_colagem,
      // mas não tem maquina_origem explicitamente salvo ainda:
      if (mNorm === "COLAGEM" || p.status === "aguardando_colagem") {
        const maqDetectada = maquinaNorm(detectarMaquinaTelha(p.produto || p.modelo || ""));
        if (maqDetectada === targetNorm) {
          return true;
        }
        try {
          const hist = JSON.parse(p.historico_alteracoes || "[]");
          if (hist.some(h => maquinaNorm(h.maquina) === targetNorm || String(h.detalhes || "").toUpperCase().includes(targetNorm))) {
            return true;
          }
        } catch {}
      }

      return false;
    });
  }, [todosPedidos, targetNorm]);

  // Detectar novas OPs e anunciar por voz
  const prevOrderIds = useRef(new Set());
  useEffect(() => {
    if (!pedidos || pedidos.length === 0) {
      prevOrderIds.current = new Set();
      return;
    }
    const currentIds = new Set(pedidos.map(p => p.id));
    const newOrders = pedidos.filter(p => !prevOrderIds.current.has(p.id));
    if (prevOrderIds.current.size > 0 && newOrders.length > 0) {
      // Só toca som para pedidos pendentes que são NOVOS nesta máquina
      // (não toca para pedidos que vieram de outra máquina já em produção/colagem)
      const trulyNew = newOrders.filter(p => p.status === "pendente");
      // Sinais sonoros da máquina só chegam para o operador cadastrado nesta máquina específica!
      if (trulyNew.length > 0 && isOperadorDestaMaquina(user, maquina)) {
        playAlertSound();
        trulyNew.forEach(p => {
          speakNovaOp(p.maquina, p.numero_pedido);
        });
      }
    }
    prevOrderIds.current = currentIds;
  }, [pedidos]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        throw new Error("OFFLINE_TRIGGERED");
      }
      return await base44.entities.Pedido.update(id, data);
    },
    onError: async (error, variables) => {
      // Salva na fila offline com fallback para envio em segundo plano
      try {
        await enfileirarAcaoOffline({
          tipo: "PEDIDO_UPDATE",
          entidade: "Pedido",
          registroId: variables.id,
          dados: variables.data,
          descricao: `Pedido #${variables.data?.numero_pedido || variables.id} -> ${variables.data?.status || 'atualizado'}`
        });

        // Atualização otimista na memória para a UI atualizar instantaneamente
        queryClient.setQueryData(["pedidos", filialAtiva], (antigos) => {
          if (!antigos || !Array.isArray(antigos)) return antigos;
          return antigos.map(p => p.id === variables.id ? { ...p, ...variables.data } : p);
        });

        toast.info("Modo Offline: Apontamento salvo no tablet!", {
          description: "Será enviado para a nuvem assim que o Wi-Fi restabelecer.",
          duration: 4000
        });
      } catch (errLocal) {
        console.error("Falha ao salvar offline:", errLocal);
        toast.error("Erro ao registrar apontamento.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pre-baixa-bobinas-v2"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      toast.success("Status atualizado!");
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const hist = [{
        data: new Date().toISOString(),
        usuario: user?.full_name || user?.email || "—",
        acao: "criado",
        acao_label: "Pedido Criado",
        detalhes: `Produto: ${data.produto || "—"}${data.cliente ? " · Cliente: " + data.cliente : ""}`,
      }];
      return base44.entities.Pedido.create({ ...data, historico_alteracoes: JSON.stringify(hist) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pre-baixa-bobinas-v2"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas"] });
      setNovoPedidoOpen(false);
      toast.success("Pedido criado!");
    },
  });

  const handleStatusChange = (pedido, novoStatus, extraData = {}) => {
    // Chamado sem pedido (ex: refresh após salvar o texto da bobina) = apenas recarrega a lista
    if (!pedido) {
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      return;
    }
    const acaoMap = {
      em_producao: pedido.status === "pausado" ? ["retomado", "Retomou Produção"] : ["iniciado", "Iniciou Produção"],
      pausado: ["pausado", "Pausou Produção"],
      finalizado: extraData?.atendido_estoque
        ? ["finalizado", "Atendido pelo Estoque Físico"]
        : ["finalizado", "Finalizou Pedido"],
      aguardando_colagem: ["status_alterado", "Enviado para Colagem"],
      pendente: ["status_alterado", `Retornou para Pendente`],
      cancelado: ["status_alterado", "Cancelado"],
    };
    const [acao, label] = acaoMap[novoStatus] || ["status_alterado", `Status → ${STATUS_LABELS_TELHAS[novoStatus] || novoStatus}`];
    const detalhes = novoStatus === "pausado" && extraData.motivo_pausa
      ? `Motivo: ${extraData.motivo_pausa}`
      : extraData?.atendido_estoque
        ? `Separado do estoque físico (${extraData.quantidade_atendida_estoque || pedido.quantidade_telhas || pedido.metros || 0} peças - sem consumo de bobina)`
        : novoStatus === "finalizado" && extraData.metragem_utilizada
          ? `Metragem: ${extraData.metragem_utilizada}m`
          : "";
    const histData = appendHistorico(pedido, acao, label, detalhes);
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    const agoraIso = new Date().toISOString();
    const maqOrigem = extraData.maquina_origem || pedido.maquina_origem || (maquina !== "COLAGEM" ? maquina : null) || (pedido.maquina !== "COLAGEM" ? pedido.maquina : null);

    const colagemUpdates = novoStatus === "aguardando_colagem" ? {
      maquina: "COLAGEM",
      maquina_origem: maqOrigem,
      data_perfilacao: pedido.data_perfilacao || extraData.data_perfilacao || hojeStr,
      hora_perfilacao: pedido.hora_perfilacao || extraData.hora_perfilacao || agoraIso,
      perfilacao_concluida: true,
    } : {};

    const data = { ...pedido, status: novoStatus, ...colagemUpdates, ...extraData, ...histData };
    if (novoStatus === "finalizado") {
      playFinishSound();
      speakOpFinalizada(pedido.maquina, pedido.numero_pedido);
    }
    updateMutation.mutate({ id: pedido.id, data });

    // Sincroniza em tempo real com o PedidoOdoo e notifica o Mini BI
    if (pedido.numero_pedido) {
      (async () => {
        try {
          const numRaw = String(pedido.numero_pedido || "").trim();
          let odooList = await base44.entities.PedidoOdoo.filter({ numero_pedido: numRaw }, "-created_date", 1).catch(() => []);
          if (!odooList?.length) {
            const numUpper = numRaw.toUpperCase();
            odooList = await base44.entities.PedidoOdoo.filter({ numero_pedido: numUpper }, "-created_date", 1).catch(() => []);
          }
          if (!odooList?.length) {
            const cleanDigits = numRaw.replace(/\D/g, "");
            if (cleanDigits) {
              odooList = await base44.entities.PedidoOdoo.filter({ numero_pedido: `S${cleanDigits.padStart(5, "0")}` }, "-created_date", 1).catch(() => []);
            }
          }

          if (odooList && odooList[0]) {
            const pedOdoo = odooList[0];
            const itens = getItens(pedOdoo);
            let itemIdx = itens.findIndex(i => {
              const iProd = String(i.produto || "").toLowerCase();
              const pedProd = String(pedido.produto || "").toLowerCase();
              return iProd.includes(pedProd) || pedProd.includes(iProd);
            });
            if (itemIdx < 0) {
              itemIdx = itens.findIndex(i => classGrupo(i) === "telha");
            }
            const targetIdx = itemIdx >= 0 ? itemIdx : 0;

            if (novoStatus === "finalizado") {
              const fotoUrl = extraData.foto_finalizacao_url || "";
              if (itens[targetIdx]) {
                itens[targetIdx] = {
                  ...itens[targetIdx],
                  status: "concluido",
                  quantidade_produzida: pedido.quantidade_telhas || pedido.metros || itens[targetIdx].quantidade,
                  foto_url: fotoUrl || itens[targetIdx].foto_url || ""
                };
              }
              const pct = computePercentual(itens);
              const status_pcp = statusPcpPorPercentual(pct, "concluido");
              const updated = await base44.entities.PedidoOdoo.update(pedOdoo.id, {
                itens_json: buildItensJson(itens),
                percentual_concluido: pct,
                status_pcp,
                ...(fotoUrl ? { foto_producao_url: fotoUrl } : {})
              });
              const eventoNotif = (pct >= 100 || status_pcp === "concluido") ? "concluido" : "etapa_concluida";
              await notificarStatus(updated, eventoNotif, {
                maquina_atual: pedido.maquina || "",
                item_nome: itens[targetIdx]?.produto || pedido.produto || "",
                fim_fmt: new Date().toISOString(),
                status_novo: status_pcp,
                percentual_concluido: pct,
                foto_finalizacao_url: fotoUrl,
                usuario: user?.full_name || user?.email || `Operador ${pedido.maquina || ""}`
              });
            } else if (novoStatus === "aguardando_colagem") {
              if (itens[targetIdx]) {
                itens[targetIdx] = {
                  ...itens[targetIdx],
                  status: "aguardando_colagem",
                  maquina: "COLAGEM",
                };
              }
              const pct = computePercentual(itens);
              const status_pcp = statusPcpPorPercentual(pct, "em_producao");
              const updated = await base44.entities.PedidoOdoo.update(pedOdoo.id, {
                itens_json: buildItensJson(itens),
                percentual_concluido: pct,
                status_pcp
              });
              await notificarStatus(updated, "etapa_concluida", {
                maquina_atual: "COLAGEM",
                item_nome: itens[targetIdx]?.produto || pedido.produto || "",
                status_novo: status_pcp,
                percentual_concluido: pct,
                usuario: user?.full_name || user?.email || `Operador ${pedido.maquina || ""}`
              });
            } else if (novoStatus === "em_producao") {
              if (itens[targetIdx]) {
                itens[targetIdx] = {
                  ...itens[targetIdx],
                  status: "em_producao",
                  maquina: pedido.maquina || itens[targetIdx].maquina || "",
                  iniciada: true
                };
              }
              const pct = computePercentual(itens);
              const status_pcp = statusPcpPorPercentual(pct, "em_producao");
              const updated = await base44.entities.PedidoOdoo.update(pedOdoo.id, {
                itens_json: buildItensJson(itens),
                percentual_concluido: pct,
                status_pcp
              });
              await notificarStatus(updated, "maquina_inicio", {
                maquina_atual: pedido.maquina || "",
                item_nome: itens[targetIdx]?.produto || pedido.produto || "",
                inicio_fmt: new Date().toISOString(),
                status_novo: status_pcp,
                percentual_concluido: pct,
                usuario: user?.full_name || user?.email || `Operador ${pedido.maquina || ""}`
              });
            }
          }
        } catch (e) {
          console.error("[MaquinaPanel] falha notificar Mini BI:", e?.message || e);
        }
      })();
    }
  };

  // Pedidos que pertencem ao dia selecionado:
  // Se é uma máquina perfiladeira (ex: TP - 25), inclui também pedidos cujas peças foram perfiladas/tiradas aqui neste dia!
  const pedidosDia = useMemo(() => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    const isHoje = selectedDay === hoje;

    return pedidos.filter(p => {
      // 0. Cancelados nunca devem aparecer na fila de produção da máquina
      if (p.status === "cancelado") return false;

      // 1. Data planejada do pedido bate com o dia selecionado
      if (p.data === selectedDay) return true;
      // 2. Data em que as peças foram perfiladas nesta máquina bate com o dia selecionado
      if (p.data_perfilacao === selectedDay) return true;
      if (p.hora_perfilacao && p.hora_perfilacao.startsWith(selectedDay)) return true;
      // 3. Data de finalização bate com o dia selecionado
      if (p.data_finalizacao === selectedDay) return true;
      // 4. Status ativo hoje
      if (p.status === "pausado" || p.status === "em_producao") return true;

      // 5. Se hoje: pedidos pendentes ou atrasados
      if (isHoje && p.data && p.data < hoje && p.status !== "finalizado" && p.status !== "cancelado") {
        return true;
      }

      // 6. Se hoje e houve movimentação/trabalho registrado no histórico hoje
      if (isHoje) {
        try {
          const hist = JSON.parse(p.historico_alteracoes || "[]");
          if (hist.some(h => h.data && h.data.startsWith(hoje))) {
            return true;
          }
        } catch {}
      }

      return false;
    });
  }, [pedidos, selectedDay]);

  const hoje = isToday(new Date(selectedDay + "T12:00:00"));
  const totalMetros = pedidosDia.reduce((s, p) => s + calcularMetrosPedido(p), 0);
  
  // Para o painel da máquina:
  // - Pedidos finalizados ou já perfilados nesta máquina e encaminhados
  const finalizados = pedidosDia.filter(p => isPedidoConcluidoNaMaquina(p, maquina)).length;

  const emProducao = pedidosDia.filter(p => {
    if (isPedidoConcluidoNaMaquina(p, maquina)) return false;
    return p.status === "em_producao" || p.status === "pausado";
  }).length;

  const pendentes = pedidosDia.filter(p => {
    if (isPedidoConcluidoNaMaquina(p, maquina)) return false;
    if (p.status === "pendente") return true;
    if (maquinaNorm(p.maquina) === targetNorm && p.status === "aguardando_colagem") return true;
    return false;
  }).length;

  // Função para match de busca: número do pedido (#, dígitos ou texto), cliente, produto/modelo ou obs
  const matchPedidoBusca = (p, query) => {
    if (!query) return true;
    const q = normalizarTextoBusca(query);
    if (!q) return true;

    // 1. Número do pedido (ex: #299065, 299065, S00299065) ou Número da OC
    const numRaw = normalizarTextoBusca(p.numero_pedido);
    const numOc = normalizarTextoBusca(p.numero_oc);
    if (numRaw.includes(q) || numOc.includes(q)) return true;

    // Comparação por dígitos limpos
    const qDigits = q.replace(/\D/g, "");
    const pDigits = String(p.numero_pedido || "").replace(/\D/g, "");
    const ocDigits = String(p.numero_oc || "").replace(/\D/g, "");
    if (qDigits && (
      (pDigits && (pDigits.includes(qDigits) || qDigits.includes(pDigits))) ||
      (ocDigits && (ocDigits.includes(qDigits) || ocDigits.includes(qDigits)))
    )) {
      return true;
    }

    // 2. Nome do cliente
    const cli = normalizarTextoBusca(p.cliente);
    if (cli.includes(q)) return true;

    // 3. Produto ou modelo
    const prod = normalizarTextoBusca(p.produto);
    const mod = normalizarTextoBusca(p.modelo);
    if (prod.includes(q) || mod.includes(q)) return true;

    // 4. Observações / Cidade
    const obs = normalizarTextoBusca(p.observacoes || p.obs);
    if (obs.includes(q)) return true;
    const cid = normalizarTextoBusca(p.cidade);
    if (cid.includes(q)) return true;

    return false;
  };

  // Base de pedidos ativos na visão (dia selecionado ou resultado da busca textual)
  const baseParaFiltros = useMemo(() => {
    const q = termoBusca.trim();
    if (q) {
      return pedidos.filter(p => p.status !== "cancelado" && matchPedidoBusca(p, q));
    }
    return pedidosDia;
  }, [pedidosDia, pedidos, termoBusca]);

  // Filtros dinâmicos gerados EXCLUSIVAMENTE a partir dos pedidos que estão atualmente na tela:
  const dadosFiltros = useMemo(() => {
    return calcularFiltrosTipoECor(baseParaFiltros);
  }, [baseParaFiltros]);

  // Auto-reset se o filtro ativo deixar de existir na lista disponível
  useEffect(() => {
    if (filtroTipo !== "todos") {
      const existeTipo = dadosFiltros.tipos.some(t => t.key === filtroTipo) || dadosFiltros.subtiposNatural.some(st => st.key === filtroTipo);
      if (!existeTipo) {
        setFiltroTipo("todos");
      }
    }
  }, [dadosFiltros, filtroTipo]);

  useEffect(() => {
    if (filtroCor !== "todas") {
      const existeCor = dadosFiltros.cores.some(c => c.key === filtroCor);
      if (!existeCor) {
        setFiltroCor("todas");
      }
    }
  }, [dadosFiltros, filtroCor]);

  const handleSelecionarTipo = (tipoKey) => {
    if (tipoKey === filtroTipo) {
      setFiltroTipo("todos");
      return;
    }
    setFiltroTipo(tipoKey);
    // Se selecionou Natural, limpa cor pré-pintada
    if (tipoKey === "natural" || tipoKey.startsWith("natural_")) {
      setFiltroCor("todas");
    }
  };

  const handleSelecionarCor = (corKey) => {
    if (corKey === filtroCor) {
      setFiltroCor("todas");
      return;
    }
    setFiltroCor(corKey);
    // Se selecionou uma cor e o tipo era natural, ajusta para pré-pintada
    if (filtroTipo === "natural" || filtroTipo.startsWith("natural_")) {
      setFiltroTipo("pre_pintada");
    }
  };

  const handleLimparTodosFiltros = () => {
    setFiltroTipo("todos");
    setFiltroCor("todas");
  };

  // Pedidos filtrados aplicando busca + filtro de Tipo e Cor de bobina
  const pedidosFiltrados = useMemo(() => {
    if (filtroTipo === "todos" && filtroCor === "todas") return baseParaFiltros;
    return baseParaFiltros.filter(p => pedidoAtendeFiltroTipoECor(p, filtroTipo, filtroCor));
  }, [baseParaFiltros, filtroTipo, filtroCor]);

  const [limpandoDuplicadas, setLimpandoDuplicadas] = useState(false);
  const [finalizadosAbertos, setFinalizadosAbertos] = useState(false);

  const {
    ordenadosAFazer,
    ordenadosFinalizados,
    ordenados,
    duplicadasDetectadas,
  } = useMemo(() => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    const orderAtivo = { em_producao: 0, pausado: 1, pendente: 2, aguardando_colagem: 3 };

    // 1. Remove duplicatas exatas de ID
    const mapIds = new Map();
    for (const p of pedidosFiltrados) {
      const pid = p.id || Math.random().toString();
      if (!mapIds.has(pid)) {
        mapIds.set(pid, p);
      }
    }
    const listaUnica = Array.from(mapIds.values());

    // 2. Separa estritamente: Pedidos a Fazer (Ativos) vs Pedidos Concluídos/Finalizados
    const aFazer = [];
    const concluidos = [];

    for (const p of listaUnica) {
      if (isPedidoConcluidoNaMaquina(p, maquina)) {
        concluidos.push(p);
      } else {
        aFazer.push(p);
      }
    }

    // 3. Ordenação rigorosa dos PEDIDOS A FAZER:
    //    - 1º: Status imediato (em_producao em 1º absoluto, depois pausado, depois pendente)
    //    - 2º: Regra de Ouro AJL (1. as rotas, 2. P1, 3. P2, 4. P3, 5. P4, 6. P5, 7. Por data mais próxima de entrega)
    const sortedAFazer = aFazer.sort((a, b) => {
      const statusA = orderAtivo[a.status] ?? 2;
      const statusB = orderAtivo[b.status] ?? 2;
      if (statusA !== statusB) return statusA - statusB;

      return compararPrioridadeEData(a, b);
    });

    // 4. Ordenação dos PEDIDOS FINALIZADOS:
    //    - Mais recentemente finalizado/perfilado no topo dos finalizados
    const sortedFinalizados = concluidos.sort((a, b) => {
      const timeA = new Date(a.data_finalizacao || a.hora_perfilacao || a.data_perfilacao || a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.data_finalizacao || b.hora_perfilacao || b.data_perfilacao || b.updated_at || b.created_at || 0).getTime();
      if (timeB !== timeA) return timeB - timeA;
      return getPesoOrdenacaoPrioridade(a) - getPesoOrdenacaoPrioridade(b);
    });

    // 5. Detecta OPs duplicadas idênticas pendentes (apenas entre as que estão a fazer)
    const vistos = new Map();
    const dups = [];
    const marcarDups = (lista) => lista.map(p => {
      const presets = p._presets || {};
      const numPed = p.numero_pedido || presets.numero_pedido || "";
      const odooId = p.pedido_odoo_id || presets.pedido_odoo_id || "";
      const itemIdx = p.item_idx != null ? p.item_idx : (presets.item_idx != null ? presets.item_idx : "");
      const metros = p.metros != null ? p.metros : (presets.metros || 0);
      const mm = p.metragem_mm != null ? p.metragem_mm : (presets.metragem_mm || 0);
      const chave = odooId ? `${odooId}_${itemIdx}` : (numPed ? `${numPed}_${metros}_${mm}` : "");

      if (chave && p.status === "pendente") {
        if (vistos.has(chave)) {
          dups.push(p);
          return { ...p, _isDuplicada: true, _originalId: vistos.get(chave) };
        } else {
          vistos.set(chave, p.id);
        }
      }
      return p;
    });

    const afazerProcessado = marcarDups(sortedAFazer);
    const finalizadosProcessados = sortedFinalizados;

    return {
      ordenadosAFazer: afazerProcessado,
      ordenadosFinalizados: finalizadosProcessados,
      ordenados: [...afazerProcessado, ...finalizadosProcessados],
      duplicadasDetectadas: dups,
    };
  }, [pedidosFiltrados, maquina]);

  const handleExcluirOpRegistro = async (targetId) => {
    if (!targetId) return;
    try {
      await base44.entities.Pedido.delete(targetId);
    } catch (err) {
      const msg = String(err?.message || "").toLowerCase();
      if (msg.includes("not found") || msg.includes("não encontrado") || msg.includes("404")) {
        try {
          if (base44.entities.OrdemDesbobinadeira?.delete) {
            await base44.entities.OrdemDesbobinadeira.delete(targetId);
          }
        } catch {
          // Já não existe no banco, prossegue normalmente
        }
      } else {
        console.warn("Aviso na exclusão remota:", err);
      }
    }

    // Purga de todos os caches locais (IndexedDB e fila offline)
    await purgarIdDoCacheLocal(targetId);

    // Remove imediatamente do cache do React Query em memória
    queryClient.setQueriesData({ queryKey: ["pedidos"] }, (old) => {
      if (!Array.isArray(old)) return old;
      return old.filter(p => p.id !== targetId);
    });
    queryClient.setQueriesData({ queryKey: ["pedidos-maquina"] }, (old) => {
      if (!Array.isArray(old)) return old;
      return old.filter(p => p.id !== targetId);
    });
  };

  const handleLimparDuplicadas = async () => {
    if (duplicadasDetectadas.length === 0) return;
    if (!confirm(`Foram detectadas ${duplicadasDetectadas.length} OP(s) duplicada(s) pendente(s) nesta máquina.\nDeseja remover todas as duplicadas agora?`)) return;
    setLimpandoDuplicadas(true);
    let removidos = 0;
    for (const dup of duplicadasDetectadas) {
      try {
        await handleExcluirOpRegistro(dup.id);
        removidos++;
      } catch (err) {
        console.error("Erro ao remover duplicada:", err);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
    setLimpandoDuplicadas(false);
    toast.success(`${removidos} OP(s) duplicada(s) removida(s) com sucesso!`);
  };

  const handleSetPrioridade = (pedido, nivel) => {
    const ehRota = nivel === "ROTA";
    const nivelNum = !ehRota && nivel ? Number(nivel) : null;
    const labelAcao = ehRota ? "Marcou como Rota" : nivelNum ? `Definiu Prioridade P${nivelNum}` : "Removeu Prioridade";
    const histData = appendHistorico(pedido, "prioridade", labelAcao, ehRota ? "Pedido de rota de entrega" : `Prioridade nível ${nivelNum || "nenhum"}`);
    updateMutation.mutate({
      id: pedido.id,
      data: {
        prioridade: Boolean((nivelNum && nivelNum >= 1 && nivelNum <= 3) || ehRota),
        prioridade_nivel: ehRota ? "ROTA" : nivelNum,
        rota: ehRota,
        is_rota: ehRota,
        ...histData
      }
    });
  };

  const toggleRota = (pedido) => {
    const novaRota = !pedido.rota;
    const histData = appendHistorico(pedido, "rota", novaRota ? "Marcou como Rota" : "Removeu Rota");
    updateMutation.mutate({ id: pedido.id, data: { rota: novaRota, ...histData } });
  };

  const handleEditPedido = (pedido, formData) => {
    const histData = appendHistorico(pedido, "editado", "Editou Pedido", "Campos atualizados");
    updateMutation.mutate({ id: pedido.id, data: { ...formData, ...histData } });
    setEditandoPedido(null);
  };

  const handleDeletePedido = async (pedido, semConfirmacao = false) => {
    if (!semConfirmacao && !confirm(`Excluir pedido ${pedido.numero_pedido ? "#" + pedido.numero_pedido : ""}?\nEsta ação não pode ser desfeita.`)) return;
    try {
      await handleExcluirOpRegistro(pedido.id);
      toast.success("Pedido excluído!");
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
    } catch (err) {
      await purgarIdDoCacheLocal(pedido.id);
      queryClient.setQueriesData({ queryKey: ["pedidos"] }, (old) => {
        if (!Array.isArray(old)) return old;
        return old.filter(p => p.id !== pedido.id);
      });
      toast.success("OP removida da máquina!");
    }
  };

  // Próximos dias com pedidos
  const diasComPedidos = useMemo(() => {
    const set = new Set();
    pedidos.forEach(p => {
      if (p.status === "cancelado") return;
      if (p.data) set.add(p.data);
      if (p.data_finalizacao) set.add(p.data_finalizacao);
      if (p.data_perfilacao) set.add(p.data_perfilacao);
    });
    return Array.from(set).sort();
  }, [pedidos]);

  // OP que está rodando agora nesta máquina
  const opRodando = pedidosDia.find(p => p.status === "em_producao");

  // Pedidos ativos (em produção ou pausados) para o botão de expediente
  const pedidosAtivosExpediente = pedidosDia.filter(p => p.status === "em_producao" || p.status === "pausado");

  // Pausar todas as OPs ativas (para o botão de finalizar expediente)
  const pausarTodasOPs = async () => {
    const ativas = pedidosDia.filter(p => p.status === "em_producao");
    for (const p of ativas) {
      let prodSeg = p.tempo_producao_seg || 0;
      if (p.inicio_producao_ts) {
        prodSeg += Math.floor((Date.now() - new Date(p.inicio_producao_ts).getTime()) / 1000);
      }
      await base44.entities.Pedido.update(p.id, {
        status: "pausado",
        tempo_producao_seg: prodSeg,
        inicio_producao_ts: null,
        inicio_pausa_ts: new Date().toISOString(),
        motivo_pausa: "expediente",
      });
    }
    queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Painel de solicitações de produção para o encarregado */}
      {podeGerenciar && (
        <PainelSolicitacoesProducao maquina={maquina} user={user} />
      )}

      {/* Botão de voltar + Dashboard + Novo Pedido */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/producao")}
          className="gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para Produção
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-9 bg-card shadow-xs"
            onClick={() => {
              setModalHistoricoTab("historico");
              setModalHistoricoOpen(true);
            }}
          >
            <History className="w-4 h-4 text-purple-600" />
            Histórico da Máquina
          </Button>

          <BotaoVozFabrica />

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-9 bg-card shadow-xs"
            onClick={() => {
              setModalHistoricoTab("relatorio");
              setModalHistoricoOpen(true);
            }}
          >
            <FileText className="w-4 h-4 text-blue-600" />
            Relatório Diário
          </Button>

          {!isOperador && DASH_PATHS[maquina] && (
            <Link to={DASH_PATHS[maquina]}>
              <Button variant="outline" size="sm" className="gap-2 h-9">
                <BarChart2 className="w-4 h-4" />
                Dashboard
              </Button>
            </Link>
          )}

          {!isOperador && (
            <Button size="sm" className="gap-2 h-9" onClick={() => setNovoPedidoOpen(true)}>
              <Plus className="w-4 h-4" />
              Novo Pedido
            </Button>
          )}
        </div>
      </div>

      {/* Header máquina */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground shadow-lg">
        <p className="text-sm opacity-75 font-medium uppercase tracking-wide">Painel da Máquina</p>
        <h1 className="text-3xl font-black mt-1">{maquina}</h1>
        <div className="flex items-center gap-3 mt-3">
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold">
            {pedidosDia.length} pedido(s)
          </div>
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-semibold">
            {totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} metros
          </div>
          {finalizados > 0 && (
            <div className="bg-green-500/30 rounded-lg px-3 py-1.5 text-sm font-semibold">
              {finalizados} ✓ prontos
            </div>
          )}
        </div>
      </div>

      {/* Monitor de Ociosidade e Setup da Máquina */}
      <MonitorOciosidadeMaquina
        maquinaNome={maquina}
        setor="telhas"
        isProduzindo={!!opRodando}
        user={user}
      />

      {/* Cronômetro e Metas em Tempo Real da OP em Produção */}
      {opRodando && (
        <TimerProducao
          ordem={opRodando}
          maquinaNome={maquina}
          tipoSetor="telhas"
        />
      )}

      {/* Navegação de dia */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => setSelectedDay(d => format(subDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-center">
            <p className="font-bold capitalize">{format(new Date(selectedDay + "T12:00:00"), "EEEE", { locale: ptBR })}</p>
            <p className="text-sm text-muted-foreground">{format(new Date(selectedDay + "T12:00:00"), "dd 'de' MMMM yyyy", { locale: ptBR })}</p>
            {hoje && <Badge className="text-xs mt-1 bg-primary/10 text-primary border-primary/20">Hoje</Badge>}
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSelectedDay(d => format(addDays(new Date(d + "T12:00:00"), 1), "yyyy-MM-dd"))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Mini calendário de dias com pedidos */}
        {diasComPedidos.length > 0 && (
          <div className="px-4 py-2 flex gap-1.5 overflow-x-auto">
            {diasComPedidos.slice(-14).map(dia => {
              const qtd = pedidos.filter(p => p.data === dia).length;
              const fin = pedidos.filter(p => p.data === dia && p.status === "finalizado").length;
              const isSelected = dia === selectedDay;
              return (
                <button
                  key={dia}
                  onClick={() => setSelectedDay(dia)}
                  className={`flex-shrink-0 rounded-lg px-2.5 py-1.5 text-center transition-all border text-xs ${
                    isSelected ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <p className="font-bold">{format(new Date(dia + "T12:00:00"), "dd/MM")}</p>
                  <p className={isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}>
                    {fin}/{qtd}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Resumo do dia */}
      {pedidosDia.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: `${totalMetros.toFixed(0)}m`, color: "text-primary" },
            { label: "Pendentes", value: pendentes, color: "text-slate-600" },
            { label: "Produzindo", value: emProducao, color: "text-amber-600" },
            { label: "Prontos", value: finalizados, color: "text-green-600" },
          ].map(c => (
            <div key={c.label} className="bg-card border border-border rounded-xl p-3 text-center">
              <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Dialog novo pedido */}
      <PedidoFormDialog
        open={novoPedidoOpen}
        onClose={() => setNovoPedidoOpen(false)}
        onSave={(data) => createMutation.mutate({ ...data, maquina, data: selectedDay })}
        defaultDate={selectedDay}
        editItem={{ _presets: { maquina, data: selectedDay } }}
      />

      {/* Dialog editar pedido */}
      {editandoPedido && (
        <PedidoFormDialog
          open={true}
          onClose={() => setEditandoPedido(null)}
          onSave={(data) => handleEditPedido(editandoPedido, data)}
          editItem={editandoPedido}
        />
      )}

      {/* Dialog rápido para Alterar Data de Entrega / Previsão Fabril */}
      {alterandoDataPedido && (
        <AlterarDataPedidoMaquinaModal
          open={true}
          onClose={() => setAlterandoDataPedido(null)}
          pedido={alterandoDataPedido}
          usuarioNome={user?.full_name || user?.email || "Operador"}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["pedidos"] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
            queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
          }}
        />
      )}

      {/* Barra de Pesquisa por Pedido ou Cliente */}
      <div className="bg-card border border-border rounded-xl p-3 shadow-sm space-y-2">
        <div className="relative flex items-center">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            placeholder="Pesquisar por número do pedido (#) ou nome do cliente..."
            className="pl-9 pr-9 h-10 text-sm bg-background/50 focus:bg-background transition-colors"
          />
          {termoBusca && (
            <button
              type="button"
              onClick={() => setTermoBusca("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full hover:bg-muted transition-colors cursor-pointer"
              title="Limpar pesquisa"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {termoBusca.trim() && (
          <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
            <span>
              {ordenados.length === 0 ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  Nenhum pedido encontrado para &ldquo;{termoBusca}&rdquo;
                </span>
              ) : (
                <span>
                  Mostrando <strong>{ordenados.length}</strong> pedido(s) encontrado(s) para &ldquo;<strong>{termoBusca}</strong>&rdquo;
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setTermoBusca("")}
              className="text-primary hover:underline font-medium cursor-pointer"
            >
              Limpar busca
            </button>
          </div>
        )}

        {/* Filtros em 2 Linhas: TIPO DE BOBINA e COR DE BOBINA */}
        {(dadosFiltros.tipos.length > 1 || dadosFiltros.cores.length > 0) && (
          <div className="pt-2.5 border-t border-border/50 space-y-2.5">
            {/* Linha 1: TIPO DE BOBINA */}
            <div className="space-y-1">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-primary" />
                  Tipo de Bobina
                </span>
                {(filtroTipo !== "todos" || filtroCor !== "todas") && (
                  <button
                    type="button"
                    onClick={handleLimparTodosFiltros}
                    className="text-[11px] text-primary hover:underline font-bold cursor-pointer flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Limpar filtros ({baseParaFiltros.length} pedidos)
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar flex-wrap sm:flex-nowrap">
                {/* Tipos Principais (Todos, Natural, Pré-Pintada) */}
                {dadosFiltros.tipos.map((t) => {
                  const isSelected = filtroTipo === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => handleSelecionarTipo(t.key)}
                      className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm font-bold ring-2 ring-primary ring-offset-1"
                          : "bg-muted/40 hover:bg-muted text-foreground border-border/70 font-medium"
                      }`}
                      title={`Filtrar por ${t.label}`}
                    >
                      <span>{t.icone}</span>
                      <span>{t.label}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${
                        isSelected ? "bg-primary-foreground/25 text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        {t.count}
                      </span>
                    </button>
                  );
                })}

                {/* Subopções de Natural se houver (Importada, Nacional, Espessuras) */}
                {dadosFiltros.subtiposNatural.length > 0 && (
                  <div className="flex items-center gap-1 pl-1.5 border-l border-border/60">
                    {dadosFiltros.subtiposNatural.map((st) => {
                      const isSelected = filtroTipo === st.key;
                      return (
                        <button
                          key={st.key}
                          type="button"
                          onClick={() => handleSelecionarTipo(st.key)}
                          className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer flex items-center gap-1 border ${
                            isSelected
                              ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border-slate-900 font-bold ring-1 ring-primary shadow-xs"
                              : "bg-background/80 hover:bg-muted text-muted-foreground hover:text-foreground border-border/60 font-medium"
                          }`}
                          title={`Filtrar por ${st.label}`}
                        >
                          <span>{st.icone}</span>
                          <span>{st.label}</span>
                          <span className={`px-1 py-0.2 rounded text-[9px] font-bold ${
                            isSelected ? "bg-white/20 dark:bg-black/20" : "bg-muted"
                          }`}>
                            {st.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Linha 2: COR DE BOBINA (aparece quando houver pedidos coloridos na tela) */}
            {dadosFiltros.cores.length > 0 && (
              <div className="space-y-1 pt-1.5 border-t border-border/40">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    Cor da Bobina
                  </span>
                  {filtroCor !== "todas" && (
                    <button
                      type="button"
                      onClick={() => setFiltroCor("todas")}
                      className="text-[10px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                    >
                      Todas as cores
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
                  {/* Botão Todas as Cores */}
                  <button
                    type="button"
                    onClick={() => setFiltroCor("todas")}
                    className={`flex-shrink-0 px-2.5 py-0.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                      filtroCor === "todas"
                        ? "bg-purple-600 text-white border-purple-600 shadow-sm font-bold ring-1 ring-purple-400"
                        : "bg-muted/40 hover:bg-muted text-muted-foreground border-border/70 font-medium"
                    }`}
                  >
                    <span>Todas as Cores</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      filtroCor === "todas" ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                    }`}>
                      {dadosFiltros.countPrePintada}
                    </span>
                  </button>

                  {/* Chips Individuais de Cada Cor */}
                  {dadosFiltros.cores.map((c) => {
                    const isSelected = filtroCor === c.key;
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => handleSelecionarCor(c.key)}
                        className={`flex-shrink-0 px-2.5 py-0.5 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                          isSelected
                            ? `ring-2 ring-purple-500 ring-offset-1 font-bold shadow-xs ${c.badgeCls}`
                            : "bg-background hover:bg-muted/70 text-foreground border-border/80 font-medium"
                        }`}
                        title={`Filtrar pedidos com bobina ${c.label}`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0 shadow-2xs"
                          style={{ backgroundColor: c.dotColor }}
                        />
                        <span>{c.label}</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${
                          isSelected ? "bg-black/15 dark:bg-white/25" : "bg-muted text-muted-foreground"
                        }`}>
                          {c.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Lista de pedidos */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : ordenados.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl py-16 flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Circle className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold">
              {termoBusca.trim() ? "Nenhum pedido encontrado" : "Sem pedidos para este dia"}
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              {termoBusca.trim()
                ? `Nenhum pedido na máquina ${maquina} corresponde a "${termoBusca}". Verifique o número ou o cliente.`
                : diasComPedidos.length > 0
                ? "Navegue nos dias acima para ver pedidos de outros dias"
                : "Quando o admin cadastrar pedidos para esta máquina, eles aparecerão aqui"}
            </p>
            {termoBusca.trim() && (
              <Button variant="outline" size="sm" onClick={() => setTermoBusca("")} className="mt-3">
                Limpar busca
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Alerta inteligente: se houver OPs duplicadas detectadas nesta máquina */}
          {duplicadasDetectadas.length > 0 && (
            <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-bold text-sm">
                    {duplicadasDetectadas.length} OP(s) duplicada(s) detectada(s) nesta máquina
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300">
                    Ordens repetidas com mesmas medidas e status pendente na fila.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="destructive"
                className="font-bold text-xs gap-1.5 shadow-sm ml-auto"
                disabled={limpandoDuplicadas}
                onClick={handleLimparDuplicadas}
              >
                <Trash2 className="w-3.5 h-3.5" />
                {limpandoDuplicadas ? "Removendo..." : `Limpar ${duplicadasDetectadas.length} Duplicada(s)`}
              </Button>
            </div>
          )}

          {/* 1. Pedidos A Fazer (Em Produção, Pausados, Pendentes) */}
          {ordenadosAFazer.map(p => {
            const dataPedido = p.data || p.data_perfilacao;
            const ehOutroDia = Boolean(termoBusca.trim() && dataPedido && dataPedido !== selectedDay);

            return (
              <div key={p.id}>
                {/* Banner de OP Duplicada individual */}
                {p._isDuplicada && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-2 flex items-center justify-between text-xs text-red-800 dark:text-red-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      Aviso: Esta OP é uma cópia duplicada pendente.
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-red-600 hover:bg-red-500/20 font-bold h-7 px-2 text-xs"
                      onClick={() => handleDeletePedido(p)}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Excluir esta cópia
                    </Button>
                  </div>
                )}
                {ehOutroDia && (
                  <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 mb-1.5 text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-1.5 font-medium">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                      <span>
                        Agendado para: <strong>{format(new Date(dataPedido + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}</strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDay(dataPedido);
                      }}
                      className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer ml-2"
                    >
                      Ir para este dia
                    </button>
                  </div>
                )}
                {podeGerenciar && (
                  <div className="flex justify-end gap-1 mb-1 items-center flex-wrap">
                    {p.status !== "finalizado" && p.status !== "cancelado" && (
                      <>
                        <Button size="sm" variant="ghost" className={`text-xs h-6 px-2 ${p.rota ? "text-red-600 font-bold" : "text-muted-foreground"}`} onClick={() => toggleRota(p)}>
                          <Route className={`w-3 h-3 mr-1 ${p.rota ? "fill-red-500 text-red-500" : ""}`} /> {p.rota ? "Rota" : "Rota"}
                        </Button>
                        <SeletorPrioridadeDropdown
                          pedido={p}
                          onSelectPrioridade={(nivel) => handleSetPrioridade(p, nivel)}
                        />
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-6 px-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold"
                      onClick={() => setAlterandoDataPedido(p)}
                      title="Alterar data de entrega e notificar vendedor/Odoo"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Data: {(() => {
                        const d = getDataEntregaParaOrdenacao(p);
                        if (!d || d === "9999-99-99") return "Prazo";
                        try {
                          return format(new Date(d + "T12:00:00"), "dd/MM");
                        } catch {
                          return d;
                        }
                      })()}
                    </Button>
                    <HistoricoPedidoTelhasButton pedido={p} />
                    <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground hover:text-blue-600" onClick={() => setEditandoPedido(p)}>
                      <Edit3 className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground hover:text-red-600" onClick={() => handleDeletePedido(p)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Excluir
                    </Button>
                  </div>
                )}
                <PedidoRow pedido={p} onStatusChange={handleStatusChange} onUpdate={handleStatusChange} userRole={user?.role} opRodando={opRodando} maquina={maquina} user={user} filialAtiva={filialAtiva} appendHistoricoFn={(pedido, acao, label, detalhes) => appendHistorico(pedido, acao, label, detalhes)} todosPedidos={todosPedidos} />
              </div>
            );
          })}

          {/* Banner quando não há mais pedidos a fazer hoje */}
          {ordenadosAFazer.length === 0 && ordenadosFinalizados.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 font-bold text-lg">
                ✓
              </div>
              <h3 className="font-bold text-base text-emerald-950 dark:text-emerald-100">
                Fila de Produção Deste Dia Concluída!
              </h3>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1 max-w-md mx-auto">
                Não há pedidos pendentes nesta máquina. Todos os {ordenadosFinalizados.length} pedidos já foram perfilados/finalizados.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 text-xs h-7 gap-1.5 border-emerald-400 text-emerald-800 hover:bg-emerald-100"
                onClick={() => setFinalizadosAbertos(true)}
              >
                Visualizar Pedidos Finalizados ({ordenadosFinalizados.length})
              </Button>
            </div>
          )}

          {/* 2. Pedidos Finalizados / Concluídos (Minimizados lá para baixo) */}
          {ordenadosFinalizados.length > 0 && (
            <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-200 dark:border-slate-800">
              <div className="bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs transition-all">
                <button
                  type="button"
                  onClick={() => setFinalizadosAbertos(v => !v)}
                  className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-100/80 dark:hover:bg-slate-800/60 transition-colors cursor-pointer select-none"
                  title={finalizadosAbertos ? "Clique para recolher e minimizar" : "Clique para expandir e ver detalhes"}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                          Pedidos Finalizados / Concluídos
                        </span>
                        <Badge className="bg-emerald-600 text-white font-bold text-xs h-5 px-2">
                          {ordenadosFinalizados.length}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {finalizadosAbertos || Boolean(termoBusca.trim())
                          ? "Lista expandida · Clique para recolher e manter minimizado"
                          : "Minimizados no final da fila · Clique para expandir detalhes"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span className="hidden sm:inline">
                      {finalizadosAbertos || Boolean(termoBusca.trim()) ? "Minimizar" : "Expandir"}
                    </span>
                    <div className="p-1 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", (finalizadosAbertos || Boolean(termoBusca.trim())) && "rotate-180")} />
                    </div>
                  </div>
                </button>

                {(finalizadosAbertos || Boolean(termoBusca.trim())) && (
                  <div className="p-4 pt-1 border-t border-slate-200/70 dark:border-slate-800/70 space-y-4 bg-white/50 dark:bg-slate-950/30">
                    {ordenadosFinalizados.map(p => {
                      const dataPedido = p.data || p.data_perfilacao;
                      const ehOutroDia = Boolean(termoBusca.trim() && dataPedido && dataPedido !== selectedDay);

                      return (
                        <div key={p.id}>
                          {ehOutroDia && (
                            <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-1.5 mb-1.5 text-xs text-amber-800 dark:text-amber-300">
                              <div className="flex items-center gap-1.5 font-medium">
                                <Calendar className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                                <span>
                                  Agendado para: <strong>{format(new Date(dataPedido + "T12:00:00"), "dd/MM/yyyy (EEEE)", { locale: ptBR })}</strong>
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDay(dataPedido);
                                }}
                                className="underline font-semibold hover:text-amber-900 dark:hover:text-amber-100 cursor-pointer ml-2"
                              >
                                Ir para este dia
                              </button>
                            </div>
                          )}
                          {podeGerenciar && (
                            <div className="flex justify-end gap-1 mb-1 items-center flex-wrap">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-6 px-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 font-semibold"
                                onClick={() => setAlterandoDataPedido(p)}
                                title="Alterar data de entrega e notificar vendedor/Odoo"
                              >
                                <Calendar className="w-3 h-3 mr-1" />
                                Data: {(() => {
                                  const d = getDataEntregaParaOrdenacao(p);
                                  if (!d || d === "9999-99-99") return "Prazo";
                                  try {
                                    return format(new Date(d + "T12:00:00"), "dd/MM");
                                  } catch {
                                    return d;
                                  }
                                })()}
                              </Button>
                              <HistoricoPedidoTelhasButton pedido={p} />
                              <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground hover:text-blue-600" onClick={() => setEditandoPedido(p)}>
                                <Edit3 className="w-3 h-3 mr-1" /> Editar
                              </Button>
                              <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground hover:text-red-600" onClick={() => handleDeletePedido(p)}>
                                <Trash2 className="w-3 h-3 mr-1" /> Excluir
                              </Button>
                            </div>
                          )}
                          <PedidoRow pedido={p} onStatusChange={handleStatusChange} onUpdate={handleStatusChange} userRole={user?.role} opRodando={opRodando} maquina={maquina} user={user} filialAtiva={filialAtiva} appendHistoricoFn={(pedido, acao, label, detalhes) => appendHistorico(pedido, acao, label, detalhes)} todosPedidos={todosPedidos} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <FinalizarExpedienteButton
        maquina={maquina}
        setor="telhas"
        pedidosAtivos={pedidosAtivosExpediente}
        filialAtiva={filialAtiva}
        user={user}
        onPausarTodas={pausarTodasOPs}
      />

      <ChatFloatingButton canal_id={maquina} canal_label={maquina} currentUser={user} />

      {/* Modal de Histórico e Relatórios Diários da Máquina */}
      <HistoricoERelatorioMaquinaModal
        open={modalHistoricoOpen}
        onClose={() => setModalHistoricoOpen(false)}
        maquinaNome={maquina}
        setor="telhas"
        initialTab={modalHistoricoTab}
      />
    </div>
  );
}