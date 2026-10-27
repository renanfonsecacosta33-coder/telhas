import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Circle, ChevronLeft, ChevronRight, ChevronDown, CheckCircle2, ArrowLeft, BarChart2, Plus, Star, Trash2, Edit3, Route, Search, X, Calendar, Filter, History, FileText, AlertTriangle, RefreshCw, Palette, Layers, Truck, Zap, GitBranch, Target, Timer, Check } from "lucide-react";
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
import GuiaOperacionalModal from "@/components/pops/GuiaOperacionalModal";
import AlertaCancelamentoPcpBanner from "@/components/maquinas/AlertaCancelamentoPcpBanner";
import StatusRedeBadge from "@/components/common/StatusRedeBadge";
import { getItens, computePercentual, statusPcpPorPercentual, buildItensJson, classGrupo, detectarMaquinaTelha, gerarAssinaturaOp } from "@/lib/pedidoOdooHelper";
import { notificarStatus } from "@/lib/biNotificador";
import {
  SeletorPrioridadeDropdown,
  getPesoOrdenacaoPrioridade,
  compararPrioridadeEData,
  getDataEntregaParaOrdenacao,
  BannerPrioridadeDestaque,
  isPedidoRetiraAgora,
  isPedidoRota,
  getCardPrioridadeClasses
} from "@/lib/prioridadeHelper";
import AlterarDataPedidoMaquinaModal from "@/components/maquinas/AlterarDataPedidoMaquinaModal";
import { normalizarTextoBusca, calcularFiltrosTipoECor, pedidoAtendeFiltroTipoECor } from "@/lib/bobinaStatusHelper";
import TimerProducao from "@/components/producao/TimerProducao";
import MonitorOciosidadeMaquina from "@/components/maquinas/MonitorOciosidadeMaquina";
import { isOperadorDestaMaquina } from "@/lib/somPermissaoHelper";
import { salvarCacheLocal, obterCacheLocal, enfileirarAcaoOffline, purgarIdDoCacheLocal } from "@/lib/offlineStorage";
import { calcularMetrosPedido } from "@/lib/metrosHelper";
import { reajustarTodasBobinasMaquinasAutomaticamente } from "@/lib/reajusteAutomaticoBobinas";
import { isTelhaBandeja } from "@/lib/bandejaHelper";
import PedidoMiniCard from "@/components/producao/PedidoMiniCard";
import MaquinaSwitcherAdmin from "@/components/maquinas/MaquinaSwitcherAdmin";

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
  if (p.status_pcp === "concluido" || p.status_pcp === "cancelado" || (p.percentual_concluido != null && p.percentual_concluido >= 100)) return true;

  const norm = (m) => String(m || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const mPainelNorm = norm(maquina);
  if (!mPainelNorm || mPainelNorm === "COLAGEM") {
    return p.status === "finalizado" || p.status === "cancelado";
  }

  const mAtualNorm = norm(p.maquina);
  const mOrigemNorm = norm(p.maquina_origem);

  // 1. Em perfiladeiras (TP-40, TP-25, etc.), se a ordem já avançou para a Colagem,
  // ou está aguardando colagem, ou teve sua perfilação concluída:
  // ela é 100% considerada CONCLUÍDA nesta perfiladeira (fica na aba Concluídos)
  if (mAtualNorm === "COLAGEM" || p.status === "aguardando_colagem" || p.perfilacao_concluida) {
    return true;
  }

  // 2. Se a máquina atual registrada não for este painel
  if (mAtualNorm && mAtualNorm !== mPainelNorm) {
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
  const [expandidoMiniId, setExpandidoMiniId] = useState(null); // Visão mini: id do pedido expandido (null = todos recolhidos)
  const [termoBusca, setTermoBusca] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroCor, setFiltroCor] = useState("todas");
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [editandoPedido, setEditandoPedido] = useState(null);
  const [alterandoDataPedido, setAlterandoDataPedido] = useState(null);
  const [user, setUser] = useState(null);
  const [modalHistoricoOpen, setModalHistoricoOpen] = useState(false);
  const [modalHistoricoTab, setModalHistoricoTab] = useState("relatorio");
  const [guiaModalOpen, setGuiaModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

  const [searchParams] = useSearchParams();
  const focarId = searchParams.get("focarId");
  const focarPedido = searchParams.get("focarPedido");
  const dataParam = searchParams.get("data");
  const jaRolouRef = useRef(false);

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

  const { data: todosPedidos = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ["pedidos", filialAtiva],
    queryFn: async () => {
      try {
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          const cacheOffline = await obterCacheLocal(`pedidos_${filialAtiva}`);
          if (cacheOffline) return cacheOffline;
        }
        const filter = (filialAtiva && filialAtiva !== "todas") ? { unidade: filialAtiva } : {};
        const res = await base44.entities.Pedido.filter(filter, "-data", 500);
        salvarCacheLocal(`pedidos_${filialAtiva}`, res).catch(() => {});
        return res;
      } catch (fetchErr) {
        const cacheOffline = await obterCacheLocal(`pedidos_${filialAtiva}`);
        if (cacheOffline) return cacheOffline;
        throw fetchErr;
      }
    },
    refetchInterval: 15000,
    staleTime: 10000,
    refetchOnWindowFocus: false,
  });

  // Inscrição em tempo real para novos pedidos ou atualizações nas perfiladeiras/colagem
  useEffect(() => {
    let unsubscribe = null;
    try {
      if (base44.entities?.Pedido?.subscribe) {
        unsubscribe = base44.entities.Pedido.subscribe(() => {
          refetch();
        });
      }
    } catch (e) {
      console.warn("Realtime subscribe Pedido:", e);
    }
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [refetch]);

  // Localiza pedido alvo se a navegação veio com parâmetros de foco da busca/rastreamento
  const pedidoAlvoFoco = useMemo(() => {
    if (!focarId && !focarPedido) return null;
    return todosPedidos.find(p => {
      if (focarId && String(p.id) === String(focarId)) return true;
      if (focarPedido) {
        const pNum = String(p.numero_pedido || "").replace(/\D/g, "");
        const fNum = String(focarPedido).replace(/\D/g, "");
        if (pNum && fNum && (pNum === fNum || pNum.endsWith(fNum) || fNum.endsWith(pNum))) return true;
      }
      return false;
    }) || null;
  }, [todosPedidos, focarId, focarPedido]);

  // Sincroniza o dia selecionado com a data do pedido alvo
  useEffect(() => {
    if (dataParam && dataParam.match(/^\d{4}-\d{2}-\d{2}$/)) {
      setSelectedDay(dataParam);
    } else if (pedidoAlvoFoco) {
      const d = pedidoAlvoFoco.data || pedidoAlvoFoco.data_perfilacao || pedidoAlvoFoco.data_finalizacao || pedidoAlvoFoco.data_entrega;
      if (d && d.match(/^\d{4}-\d{2}-\d{2}$/)) {
        setSelectedDay(d);
      }
    }
  }, [dataParam, pedidoAlvoFoco]);

  // Scroll automático suave e direto para a frente do pedido
  useEffect(() => {
    if (!focarId && !focarPedido) return;
    const timer = setTimeout(() => {
      const cleanNum = focarPedido ? String(focarPedido).replace(/\D/g, "") : "";
      const el = (focarId && document.getElementById(`pedido-card-${focarId}`))
        || (cleanNum && document.querySelector(`[data-numero-pedido*="${cleanNum}"]`))
        || (focarId && document.querySelector(`[data-pedido-id="${focarId}"]`));

      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (!jaRolouRef.current) {
          jaRolouRef.current = true;
          toast.success(`🎯 Chegou na frente do Pedido #${focarPedido || focarId}!`, {
            description: "O pedido foi centralizado e destacado com foco ativo na sua tela.",
            duration: 6000,
          });
        }
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [focarId, focarPedido, selectedDay, todosPedidos]);

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

        // TELHA BANDEJA: fluxo sequencial estrito (TP-40/Colonial → BANDEJA → COLAGEM)
        // Regra Estrita AJL: Após tirarem a telha de cima, a OP DEVE ir primeiro para a BANDEJA.
        // A OP NUNCA pode aparecer na Colagem enquanto estiver na TP-40 ou na BANDEJA!
        // SÓ pode chegar na Colagem após tirarem a bandeja (maquina === "COLAGEM").
        if (isTelhaBandeja(p)) {
          if (mNorm !== "COLAGEM") {
            return false;
          }
          if (p.bloqueado_colagem || (p.tipo_componente_bandeja === "colagem_final" && !p.perfilacao_concluida)) {
            return false;
          }
          return p.status !== "cancelado";
        }

        // A OP SÓ DEVE APARECER NA COLAGEM SE:
        // A perfilação já terminou (aguardando_colagem ou perfilacao_concluida)
        // OU se já está sendo colada (em_producao / pausado / finalizado com maquina === "COLAGEM")
        // Se ela ainda estiver pendente ou em produção na perfiladeira (sem ter sido perfilada), NUNCA deve aparecer na Colagem!
        const estaEmColagemOuPronto = (
          p.status === "aguardando_colagem" ||
          p.perfilacao_concluida === true ||
          (mNorm === "COLAGEM" && (p.status === "em_producao" || p.status === "pausado" || p.status === "finalizado"))
        );
        return Boolean(estaEmColagemOuPronto);
      }

      // Identifica se este item é uma Bobininha / Fita de aço / Slitter
      const ehBobininhaReal = /\b(BOBININHA|BOBININHAS|BOBININA|SLITTER|CORTE\s*LONGITUDINAL|FITA\s*DE\s*A[CÇ]O|FITAS\s*DE\s*A[CÇ]O|DESBOBINAMENTO)\b/i.test(
        `${p.item_produto || ""} ${p.produto || ""} ${p.modelo || ""} ${p.observacoes || ""} ${p.produto_rotulo_pcp || ""}`
      ) || p.produto === "BOBININHA";

      // Se estamos na tela do DESBOBINADOR:
      if (targetNorm === "DESBOBINADOR") {
        // Telhas perfiladas (simples ou termoacústicas), cumeeiras e bandejas NUNCA devem aparecer no Desbobinador!
        const ehTelhaOuPerfilada = !ehBobininhaReal && (
          p.produto === "TELHA" ||
          String(p.produto || "").toUpperCase().startsWith("TELHA") ||
          p.produto === "CUMEEIRA" ||
          p.produto === "PAINEL" ||
          /\b(TELHA|TRAP[EÉ]ZIO|TP\s*[-/]?\s*40|TP\s*[-/]?\s*25|TR\s*[-/]?\s*40|TR\s*[-/]?\s*25|ONDULADA|COLONIAL|CUMEEIRA|BANDEJA)\b/i.test(
            `${p.item_produto || ""} ${p.modelo || ""} ${p.produto || ""} ${p.observacoes || ""}`
          )
        );

        if (ehTelhaOuPerfilada) {
          return false;
        }

        return mNorm === "DESBOBINADOR" || ehBobininhaReal;
      }

      // Se NÃO estamos no DESBOBINADOR e o item é Bobininha:
      // Bobininhas NUNCA devem aparecer em perfiladeiras (TP-40, TP-25, Colonial, Bandeja, Colagem)!
      if (targetNorm !== "DESBOBINADOR" && ehBobininhaReal) {
        return false;
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

      // Se a OP é uma TELHA e estava erroneamente com maquina === "DESBOBINADOR":
      // Acolhe na perfiladeira correta (TP-40, TP-25, Colonial, etc.)
      const ehTelhaOuPerfil = !ehBobininhaReal && (
        p.produto === "TELHA" ||
        String(p.produto || "").toUpperCase().startsWith("TELHA") ||
        /\b(TELHA|TRAP[EÉ]ZIO|TP\s*[-/]?\s*40|TP\s*[-/]?\s*25|TR\s*[-/]?\s*40|TR\s*[-/]?\s*25|ONDULADA|COLONIAL)\b/i.test(
          `${p.item_produto || ""} ${p.modelo || ""} ${p.produto || ""}`
        )
      );

      if (ehTelhaOuPerfil && (mNorm === "DESBOBINADOR" || mOrigemNorm === "DESBOBINADOR")) {
        const maqDetectada = maquinaNorm(detectarMaquinaTelha(p.modelo || p.item_produto || p.produto || "") || "TP - 40");
        if (maqDetectada === targetNorm) {
          return true;
        }
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

  // Auto-correção proativa: se houver qualquer OP de Telha com maquina: "DESBOBINADOR",
  // corrige no banco de dados e sincroniza o cache imediatamente
  useEffect(() => {
    if (!todosPedidos || todosPedidos.length === 0) return;
    const opsDeslocadas = todosPedidos.filter(p => {
      if (p.status === "cancelado") return false;
      const ehNoDesbobinador = maquinaNorm(p.maquina) === "DESBOBINADOR" || maquinaNorm(p.maquina_origem) === "DESBOBINADOR";
      if (!ehNoDesbobinador) return false;
      const ehTelha = (
        p.produto === "TELHA" ||
        String(p.produto || "").toUpperCase().startsWith("TELHA") ||
        /\b(TELHA|TRAP[EÉ]ZIO|TP\s*[-/]?\s*40|TP\s*[-/]?\s*25|TR\s*[-/]?\s*40|TR\s*[-/]?\s*25|ONDULADA|COLONIAL)\b/i.test(
          `${p.item_produto || ""} ${p.modelo || ""} ${p.produto || ""}`
        )
      );
      const ehBobininhaReal = /\b(BOBININHA|BOBININHAS|BOBININA|SLITTER|CORTE\s*LONGITUDINAL|FITA\s*DE\s*A[CÇ]O|FITAS\s*DE\s*A[CÇ]O|DESBOBINAMENTO)\b/i.test(
        `${p.item_produto || ""} ${p.produto || ""} ${p.modelo || ""} ${p.observacoes || ""} ${p.produto_rotulo_pcp || ""}`
      ) || p.produto === "BOBININHA";
      return ehTelha && !ehBobininhaReal;
    });

    if (opsDeslocadas.length > 0) {
      opsDeslocadas.forEach(async (opErr) => {
        const maqCerta = detectarMaquinaTelha(opErr) || "TP - 40";
        console.log(`[AutoCorrecao Máquinas] Realocando OP #${opErr.numero_pedido} de DESBOBINADOR para ${maqCerta}`);
        try {
          await base44.entities.Pedido.update(opErr.id, {
            maquina: maqCerta,
            modelo: maqCerta,
            maquina_origem: maqCerta
          });
          queryClient.setQueriesData({ queryKey: ["pedidos"] }, (antigos) => {
            if (!Array.isArray(antigos)) return antigos;
            return antigos.map(item => item.id === opErr.id ? { ...item, maquina: maqCerta, modelo: maqCerta, maquina_origem: maqCerta } : item);
          });
          queryClient.invalidateQueries({ queryKey: ["pedidos"] });
          queryClient.invalidateQueries({ queryKey: ["pedidos-maquina"] });
        } catch (e) {
          console.warn("[AutoCorrecao Máquinas] Erro ao corrigir OP no banco:", e);
        }
      });
    }
  }, [todosPedidos, queryClient]);

  // Auto-correção proativa para Telha Bandeja:
  // Se houver qualquer OP de Telha Bandeja indevidamente na Colagem sem ter sido perfilada
  // (ex: resquício de tríade antiga com bloqueado_colagem: true ou colagem_final)
  // reposiciona na máquina inicial de perfilação (TP-40 ou Colonial) com status 'pendente'
  useEffect(() => {
    if (!todosPedidos || todosPedidos.length === 0) return;
    const bandejasPresas = todosPedidos.filter(p => {
      if (p.status === "cancelado" || p.status === "finalizado") return false;
      if (!isTelhaBandeja(p)) return false;
      const ehNaColagem = maquinaNorm(p.maquina) === "COLAGEM";
      const semPerfilacao = !p.perfilacao_concluida;
      const temTravaTriade = Boolean(
        p.bloqueado_colagem ||
        p.tipo_componente_bandeja === "colagem_final" ||
        (ehNaColagem && p.status === "aguardando_colagem" && semPerfilacao)
      );
      return temTravaTriade;
    });

    if (bandejasPresas.length > 0) {
      bandejasPresas.forEach(async (opErr) => {
        const maqCerta = (opErr.modelo && /colonial/i.test(opErr.modelo)) ? "COLONIAL" : "TP - 40";
        console.log(`[AutoCorrecao Telha Bandeja] Reposicionando OP #${opErr.numero_pedido} de COLAGEM para ${maqCerta}`);
        try {
          await base44.entities.Pedido.update(opErr.id, {
            maquina: maqCerta,
            modelo: maqCerta,
            maquina_origem: maqCerta,
            status: "pendente",
            bloqueado_colagem: false,
            tipo_componente_bandeja: null,
            grupo_bandeja_id: null,
          });

          // Cancela eventuais ordens irmãs vazias da antiga tríade (para não duplicar componentes no galpão)
          const ordensIrmas = todosPedidos.filter(o =>
            o.id !== opErr.id &&
            o.status !== "cancelado" &&
            o.numero_pedido &&
            String(o.numero_pedido).trim().toUpperCase() === String(opErr.numero_pedido).trim().toUpperCase() &&
            (o.tipo_componente_bandeja === "bandeja_inferior" || o.tipo_componente_bandeja === "telha_superior")
          );

          for (const irma of ordensIrmas) {
            console.log(`[AutoCorrecao Telha Bandeja] Cancelando ordem irmã redundante #${irma.numero_pedido} (${irma.tipo_componente_bandeja})`);
            await base44.entities.Pedido.update(irma.id, { status: "cancelado" }).catch(() => {});
          }

          queryClient.invalidateQueries({ queryKey: ["pedidos"] });
          queryClient.invalidateQueries({ queryKey: ["pedidos-maquina"] });
        } catch (e) {
          console.warn("[AutoCorrecao Telha Bandeja] Erro ao reposicionar OP no banco:", e);
        }
      });
    }
  }, [todosPedidos, queryClient]);

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
      // Só toca som para pedidos pendentes que são NOVOS e que pertencem ATIVAMENTE a esta máquina
      // (não toca para pedidos que foram para outra máquina como colagem ou já estão concluídos nesta)
      const trulyNew = newOrders.filter(p => {
        if (isPedidoConcluidoNaMaquina(p, maquina)) return false;
        if (maquina === "COLAGEM") return p.status === "aguardando_colagem";
        return p.status === "pendente";
      });
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
    onMutate: async ({ id, data }) => {
      // Cancela refetchs concorrentes para evitar sobrescrever a UI
      await queryClient.cancelQueries({ queryKey: ["pedidos"] });

      // Salva snapshot anterior
      const prevPedidos = queryClient.getQueryData(["pedidos", filialAtiva]);

      // ATUALIZAÇÃO INSTANTÂNEA NA MEMÓRIA (0ms): card e status mudam no mesmo milissegundo do clique
      queryClient.setQueriesData({ queryKey: ["pedidos"] }, (antigos) => {
        if (!antigos || !Array.isArray(antigos)) return antigos;
        return antigos.map(p => p.id === id ? { ...p, ...data } : p);
      });

      return { prevPedidos };
    },
    onError: async (error, variables, context) => {
      if (error?.message === "OFFLINE_TRIGGERED" || (typeof navigator !== "undefined" && !navigator.onLine)) {
        try {
          await enfileirarAcaoOffline({
            tipo: "PEDIDO_UPDATE",
            entidade: "Pedido",
            registroId: variables.id,
            dados: variables.data,
            descricao: `Pedido #${variables.data?.numero_pedido || variables.id} -> ${variables.data?.status || 'atualizado'}`
          });
          toast.info("Modo Offline: Apontamento salvo no tablet!", {
            description: "Será enviado para a nuvem assim que o Wi-Fi restabelecer.",
            duration: 4000
          });
        } catch (errLocal) {
          console.error("Falha ao salvar offline:", errLocal);
          toast.error("Erro ao registrar apontamento.");
        }
      } else {
        if (context?.prevPedidos) {
          queryClient.setQueryData(["pedidos", filialAtiva], context.prevPedidos);
        }
        toast.error("Erro ao atualizar: " + (error?.message || ""));
      }
    },
    onSuccess: (resultadoServidor) => {
      // Atualiza o item sincronizado na memória sem disparar recarregamento massivo na tela
      if (resultadoServidor?.id) {
        queryClient.setQueriesData({ queryKey: ["pedidos"] }, (antigos) => {
          if (!antigos || !Array.isArray(antigos)) return antigos;
          return antigos.map(p => p.id === resultadoServidor.id ? { ...p, ...resultadoServidor } : p);
        });
      }
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
    const isPainelColagem = maquina === "COLAGEM";
    const maqOrigem = extraData.maquina_origem || pedido.maquina_origem || (!isPainelColagem ? maquina : null) || (pedido.maquina !== "COLAGEM" ? pedido.maquina : null);

    const colagemUpdates = (novoStatus === "aguardando_colagem" || isPainelColagem) ? {
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
      if (p.status === "cancelado" || p.status_pcp === "cancelado") return false;

      // REGRA DE OURO PARA MÁQUINA DE COLAGEM:
      // Todo pedido que já teve a perfilação tirada e está aguardando colagem
      // DEVE APARECER HOJE NA FILA DE COLAGEM, mesmo que a data planejada original seja futura ou anterior!
      if (targetNorm === "COLAGEM") {
        if (p.status === "aguardando_colagem" || p.status === "em_producao" || p.status === "pausado") {
          return true;
        }
        if (p.data_finalizacao === selectedDay || (isHoje && p.data_finalizacao && p.data_finalizacao.startsWith(hoje))) {
          return true;
        }
        if (p.data === selectedDay || p.data_perfilacao === selectedDay) {
          return true;
        }
        return false;
      }

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

  // ── SEPARAÇÃO ESTRITA: PEDIDOS A FAZER (ATIVOS) vs PEDIDOS FEITOS (CONCLUÍDOS) ──
  const pedidosAtivosDia = useMemo(() => {
    return pedidosDia.filter(p => !isPedidoConcluidoNaMaquina(p, maquina));
  }, [pedidosDia, maquina]);

  const pedidosFeitosDia = useMemo(() => {
    return pedidosDia.filter(p => isPedidoConcluidoNaMaquina(p, maquina));
  }, [pedidosDia, maquina]);

  // Metragens rigorosamente separadas:
  const metrosAFazer = useMemo(() => {
    return pedidosAtivosDia.reduce((s, p) => s + calcularMetrosPedido(p), 0);
  }, [pedidosAtivosDia]);

  const metrosFeitos = useMemo(() => {
    return pedidosFeitosDia.reduce((s, p) => s + calcularMetrosPedido(p), 0);
  }, [pedidosFeitosDia]);

  const pedidosAFazerCount = pedidosAtivosDia.length;
  const pedidosFeitosCount = pedidosFeitosDia.length;

  const finalizados = pedidosFeitosCount;

  const emProducao = pedidosAtivosDia.filter(p => {
    return p.status === "em_producao" || p.status === "pausado";
  }).length;

  const pendentes = pedidosAtivosDia.filter(p => {
    if (maquina === "COLAGEM") {
      return p.status === "aguardando_colagem";
    }
    return p.status === "pendente";
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

  // Base de pedidos estritamente ATIVOS na visão (dia selecionado ou resultado da busca textual)
  // Conforme solicitação do cliente: filtros e contagens operam EXCLUSIVAMENTE sobre pedidos ativos (a fazer)
  const baseParaFiltros = useMemo(() => {
    const q = termoBusca.trim();
    if (q) {
      return pedidos.filter(p => p.status !== "cancelado" && !isPedidoConcluidoNaMaquina(p, maquina) && matchPedidoBusca(p, q));
    }
    return pedidosAtivosDia;
  }, [pedidosAtivosDia, pedidos, termoBusca, maquina]);

  // Filtros dinâmicos gerados EXCLUSIVAMENTE a partir dos pedidos ativos (a fazer):
  // As OPs já concluídas/feitas NUNCA entram na contagem dos filtros!
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

  // Pedidos filtrados aplicando busca + filtro de Tipo e Cor de bobina (apenas pedidos ativos)
  const pedidosFiltrados = useMemo(() => {
    if (filtroTipo === "todos" && filtroCor === "todas") return baseParaFiltros;
    return baseParaFiltros.filter(p => pedidoAtendeFiltroTipoECor(p, filtroTipo, filtroCor));
  }, [baseParaFiltros, filtroTipo, filtroCor]);

  const [limpandoDuplicadas, setLimpandoDuplicadas] = useState(false);
  const [resgatandoColagem, setResgatandoColagem] = useState(false);

  // Identifica pedidos termoacústicos/EPS que já foram perfilados mas não estão ativos na Colagem
  const pedidosResgateColagem = useMemo(() => {
    if (targetNorm !== "COLAGEM") return [];
    return todosPedidos.filter(p => {
      if (!p || p.status === "cancelado") return false;
      if (p.status === "aguardando_colagem" || (maquinaNorm(p.maquina) === "COLAGEM" && p.status !== "finalizado")) {
        // Telha Bandeja só pode ser resgatada na Colagem se a máquina já for COLAGEM (já passou pela BANDEJA)
        if (isTelhaBandeja(p) && maquinaNorm(p.maquina) !== "COLAGEM") {
          return false;
        }
        return false;
      }
      const temEps = Boolean(
        (p.produto && ["TELHA + EPS", "TELHA + EPS + MANTA", "TELHA + EPS + TELHA", "TELHA BANDEJA"].includes(p.produto)) ||
        (p.eps && String(p.eps).trim().length > 0) ||
        /(eps|manta|sanduiche|sanduíche|isopor|termoacustica|termoacústica|pir|pur|bandeja)/i.test(
          `${p.produto || ""} ${p.modelo || ""} ${p.item_produto || ""} ${p.observacoes || ""} ${p.observacoes_odoo || ""}`
        )
      );
      if (!temEps) return false;

      // Se já foi perfilado (ou foi finalizado na perfiladeira sem foto de colagem)
      const jaPerfilado = Boolean(p.perfilacao_concluida || p.data_perfilacao || (p.status === "finalizado" && !p.foto_colagem_eps_url));
      return jaPerfilado;
    });
  }, [todosPedidos, targetNorm]);

  const handleResgatarParaColagem = async () => {
    if (pedidosResgateColagem.length === 0) return;
    setResgatandoColagem(true);
    let count = 0;
    const hojeStr = format(new Date(), "yyyy-MM-dd");
    const agoraIso = new Date().toISOString();
    for (const ped of pedidosResgateColagem) {
      try {
        await base44.entities.Pedido.update(ped.id, {
          status: "aguardando_colagem",
          maquina: "COLAGEM",
          maquina_origem: ped.maquina_origem || ped.maquina || "TP - 40",
          perfilacao_concluida: true,
          data_perfilacao: ped.data_perfilacao || hojeStr,
          hora_perfilacao: ped.hora_perfilacao || agoraIso
        });
        count++;
      } catch (err) {
        console.error("Erro ao resgatar pedido para colagem:", err);
      }
    }
    queryClient.invalidateQueries({ queryKey: ["pedidos"] });
    setResgatandoColagem(false);
    toast.success(`${count} pedido(s) trazido(s) para a fila da Máquina de Colagem com sucesso!`);
  };
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

    // 4.5 Agrupa OPs do mesmo número de pedido para ficarem SEMPRE uma abaixo da outra na fila
    const agruparOpsMesmoPedido = (lista) => {
      const grupos = new Map();
      for (const op of lista) {
        const num = String(op.numero_pedido || op._presets?.numero_pedido || "").trim().replace(/^#/, "").toUpperCase();
        const chave = num || `__unica_${op.id}`;
        if (!grupos.has(chave)) grupos.set(chave, []);
        grupos.get(chave).push(op);
      }
      const saida = [];
      const emitidos = new Set();
      for (const op of lista) {
        if (emitidos.has(op.id)) continue;
        const num = String(op.numero_pedido || op._presets?.numero_pedido || "").trim().replace(/^#/, "").toUpperCase();
        for (const g of grupos.get(num || `__unica_${op.id}`)) {
          if (!emitidos.has(g.id)) { saida.push(g); emitidos.add(g.id); }
        }
      }
      return saida;
    };
    const afazerAgrupadas = agruparOpsMesmoPedido(sortedAFazer);

    // 5. Detecta OPs duplicadas idênticas pendentes (apenas entre as que estão a fazer)
    const vistos = new Map();
    const dups = [];
    const marcarDups = (lista) => lista.map(p => {
      // Assinatura rigorosa: mesmo pedido + mesma maquina + modelo + mesmas medidas
      // Nao confunde cortes diferentes do mesmo pedido com duplicatas
      const chave = gerarAssinaturaOp(p);

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

    const afazerProcessado = marcarDups(afazerAgrupadas);
    const finalizadosProcessados = sortedFinalizados;

    // Se a navegação veio focada em um pedido específico (pedidoAlvoFoco), garante que ele esteja visível na frente do operador
    if (pedidoAlvoFoco && !afazerProcessado.some(p => p.id === pedidoAlvoFoco.id)) {
      afazerProcessado.unshift({ ...pedidoAlvoFoco, _focoForcado: true });
    }

    return {
      ordenadosAFazer: afazerProcessado,
      ordenadosFinalizados: finalizadosProcessados,
      ordenados: [...afazerProcessado, ...finalizadosProcessados],
      duplicadasDetectadas: dups,
    };
  }, [pedidosFiltrados, maquina, pedidoAlvoFoco]);

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
    const ehRetiraAgora = nivel === "RETIRA_AGORA";
    const ehRota = nivel === "ROTA";
    const nivelNum = !ehRetiraAgora && !ehRota && nivel ? Number(nivel) : null;
    const labelAcao = ehRetiraAgora
      ? "Marcou como CLIENTE RETIRA AGORA (Balcão)"
      : ehRota
      ? "Marcou como Carga de Rota"
      : nivelNum
      ? `Definiu Prioridade P${nivelNum}`
      : "Removeu Prioridade";
    const histData = appendHistorico(
      pedido,
      "prioridade",
      labelAcao,
      ehRetiraAgora
        ? "Cliente aguardando retirada imediata na fábrica"
        : ehRota
        ? "Pedido de rota de entrega expedida"
        : `Prioridade nível ${nivelNum || "nenhum"}`
    );
    updateMutation.mutate({
      id: pedido.id,
      data: {
        prioridade: Boolean(ehRetiraAgora || ehRota || (nivelNum && nivelNum >= 1 && nivelNum <= 3)),
        prioridade_nivel: nivelNum,
        cliente_retira_agora: ehRetiraAgora,
        cliente_retira: ehRetiraAgora,
        retira_agora: ehRetiraAgora,
        rota: ehRota,
        is_rota: ehRota,
        ...(ehRota ? { rota_ts: new Date().toISOString() } : {}),
        ...histData
      }
    });
  };

  const toggleRota = (pedido) => {
    const novaRota = !(pedido.rota || pedido.is_rota);
    const histData = appendHistorico(
      pedido,
      "rota",
      novaRota ? "Marcou como Carga de Rota" : "Removeu Carga de Rota"
    );
    updateMutation.mutate({
      id: pedido.id,
      data: {
        rota: novaRota,
        is_rota: novaRota,
        prioridade_nivel: novaRota ? null : (typeof pedido.prioridade_nivel === "number" ? pedido.prioridade_nivel : null),
        cliente_retira_agora: novaRota ? false : pedido.cliente_retira_agora,
        cliente_retira: novaRota ? false : pedido.cliente_retira,
        retira_agora: novaRota ? false : pedido.retira_agora,
        ...(novaRota ? { rota_ts: new Date().toISOString() } : {}),
        ...histData
      }
    });
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

      {/* Botão de voltar + Dashboard + Novo Pedido — oculto para operador */}
      {!isOperador && (
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
            className="gap-1.5 text-xs h-9 border-border bg-card shadow-xs hover:border-primary font-semibold"
            onClick={() => {
              refetch();
              queryClient.invalidateQueries({ queryKey: ["pedidos"] });
              queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
              toast.success("Pedidos sincronizados!");
            }}
            disabled={isFetching}
            title="Atualizar pedidos agora"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${isFetching ? "animate-spin" : ""}`} />
            <span>{isFetching ? "Sincronizando..." : "Sincronizar Pedidos"}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse ml-0.5" title="Tempo real ativo" />
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-9 bg-card shadow-xs border-primary/40 text-primary hover:bg-primary/10 font-bold"
            onClick={() => setGuiaModalOpen(true)}
            title="Abrir Procedimento Operacional Padrão, Fluxograma e Solução de Defeitos"
          >
            <GitBranch className="w-4 h-4 text-primary" />
            Guia & Fluxograma
          </Button>

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
      )}

      {/* Header máquina */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-primary-foreground shadow-lg">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm opacity-75 font-medium uppercase tracking-wide">Painel da Máquina</p>
            <h1 className="text-3xl font-black mt-1">{maquina}</h1>
          </div>
          <div className="bg-white/10 backdrop-blur-xs rounded-xl p-1.5 border border-white/20">
            <StatusRedeBadge className="bg-white/20 text-white border-white/30" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <div className="bg-white/20 rounded-lg px-3 py-1.5 text-sm font-bold flex items-center gap-1.5 shadow-xs">
            <span>{pedidosAFazerCount} pedido(s) a fazer</span>
            <span className="opacity-80 font-normal">({metrosAFazer.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m)</span>
          </div>
          {pedidosFeitosCount > 0 && (
            <div className="bg-emerald-500/30 border border-emerald-400/40 rounded-lg px-3 py-1.5 text-sm font-bold flex items-center gap-1.5 text-emerald-100 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              <span>{pedidosFeitosCount} feitos</span>
              <span className="opacity-80 font-normal">({metrosFeitos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m)</span>
            </div>
          )}
        </div>
      </div>

      {/* Troca rápida entre máquinas (apenas administradores/gestores) */}
      {["admin", "super_admin", "gestor"].includes(user?.role) && (
        <MaquinaSwitcherAdmin maquinaAtual={maquina} />
      )}

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

      {/* Resumo do dia: Metros a Fazer, Metros Feitos, Pedidos a Fazer, Pedidos Feitos */}
      {pedidosDia.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Metros a Fazer */}
          <div className="bg-card border-2 border-blue-200 dark:border-blue-900/60 rounded-xl p-3 sm:p-4 text-center shadow-xs">
            <p className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center justify-center gap-1.5">
              <Timer className="w-3.5 h-3.5 text-blue-500" />
              Metros a Fazer
            </p>
            <p className="text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-300 mt-1">
              {metrosAFazer.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              <span className="text-base font-bold ml-0.5 text-blue-500">m</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Fila ativa para produzir
            </p>
          </div>

          {/* Card 2: Metros Feitos */}
          <div className="bg-card border-2 border-emerald-200 dark:border-emerald-900/60 rounded-xl p-3 sm:p-4 text-center shadow-xs">
            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              Metros Feitos
            </p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {metrosFeitos.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
              <span className="text-base font-bold ml-0.5 text-emerald-500">m</span>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Já perfilados na máquina
            </p>
          </div>

          {/* Card 3: Pedidos a Fazer */}
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4 text-center shadow-xs">
            <p className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center justify-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              Pedidos a Fazer
            </p>
            <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 mt-1">
              {pedidosAFazerCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {pendentes} pendentes{emProducao > 0 ? ` · ${emProducao} em produção` : ""}
            </p>
          </div>

          {/* Card 4: Pedidos Feitos */}
          <div className="bg-card border border-border rounded-xl p-3 sm:p-4 text-center shadow-xs">
            <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wide flex items-center justify-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" />
              Pedidos Feitos
            </p>
            <p className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              {pedidosFeitosCount}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Concluídos hoje
            </p>
          </div>
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
        {(dadosFiltros.tipos.length > 1 || dadosFiltros.subtiposNatural.length > 0 || dadosFiltros.cores.length > 0) && (
          <div className="pt-2.5 border-t border-border/50 space-y-2.5">
            {/* Linha 1: TIPO DE BOBINA (some quando só existe o chip "Todos") */}
            {(dadosFiltros.tipos.length > 1 || dadosFiltros.subtiposNatural.length > 0) && (
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
            )}

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
{/* Card de Resgate de Pedidos para Colagem */}
          {targetNorm === "COLAGEM" && pedidosResgateColagem.length > 0 && (
            <div className="bg-purple-500/10 border-2 border-purple-500/40 rounded-xl p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 text-purple-900 dark:text-purple-200 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-purple-600 shrink-0" />
                <div>
                  <p className="font-bold text-sm">
                    📥 {pedidosResgateColagem.length} pedido(s) termoacústico(s) já tirado(s) aguardando colagem
                  </p>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    Peças já perfiladas na fábrica que necessitam de EPS e colagem.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs gap-1.5 shadow-sm ml-auto"
                disabled={resgatandoColagem}
                onClick={handleResgatarParaColagem}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {resgatandoColagem ? "Puxando..." : `Puxar ${pedidosResgateColagem.length} para a Fila de Colagem`}
              </Button>
            </div>
          )}

          {/* Banner de Alerta Urgente: Cancelamento / Exclusão pelo PCP */}
          <AlertaCancelamentoPcpBanner ordens={todosPedidos} maquinaNome={maquina} />

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
              {isOperador ? (
                <span className="text-xs font-bold text-amber-700 dark:text-amber-300 ml-auto">
                  Chame o encarregado para revisar as duplicadas.
                </span>
              ) : (
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
              )}
            </div>
          )}

          {/* 1. Pedidos A Fazer (Em Produção, Pausados, Pendentes) */}
          {ordenadosAFazer.map(p => {
            const dataPedido = p.data || p.data_perfilacao;
            const ehOutroDia = Boolean(termoBusca.trim() && dataPedido && dataPedido !== selectedDay);
            const numLimpoP = String(p.numero_pedido || "").replace(/\D/g, "");
            const numLimpoFoco = focarPedido ? String(focarPedido).replace(/\D/g, "") : "";
            const isFocado = Boolean(
              p._focoForcado ||
              (focarId && String(p.id) === String(focarId)) ||
              (numLimpoFoco && numLimpoP && (numLimpoP === numLimpoFoco || numLimpoP.endsWith(numLimpoFoco) || numLimpoFoco.endsWith(numLimpoP)))
            );

            const toolbarOp = podeGerenciar ? (
              <div className="op-tools justify-end">
                {p.status !== "finalizado" && p.status !== "cancelado" && (
                  <>
                    <button
                      type="button"
                      className={`op-tools-btn ${p.rota || p.is_rota ? "op-tools-btn-active" : ""}`}
                      onClick={() => toggleRota(p)}
                      title={p.rota || p.is_rota ? "Remover de Rota de Entrega" : "Marcar como Carga de Rota de Entrega"}
                    >
                      <Truck className="w-3.5 h-3.5" />
                      {p.rota || p.is_rota ? "Carga de Rota" : "Rota"}
                    </button>
                    <SeletorPrioridadeDropdown
                      pedido={p}
                      onSelectPrioridade={(nivel) => handleSetPrioridade(p, nivel)}
                      className="!h-9 !px-3 !text-[13px] !rounded-[9px] !font-semibold border border-[#e3e6ec] bg-[#f5f6f8] hover:bg-[#e9edfa]"
                    />
                  </>
                )}
                <button
                  type="button"
                  className="op-tools-btn op-tools-btn-date"
                  onClick={() => setAlterandoDataPedido(p)}
                  title="Alterar data de entrega e notificar vendedor/Odoo"
                >
                  <Calendar className="w-3 h-3" />
                  Data: {(() => {
                    const d = getDataEntregaParaOrdenacao(p);
                    if (!d || d === "9999-99-99") return "Prazo";
                    try {
                      return format(new Date(d + "T12:00:00"), "dd/MM");
                    } catch {
                      return d;
                    }
                  })()}
                </button>
                <HistoricoPedidoTelhasButton pedido={p} className="op-tools-btn" />
                <button type="button" className="op-tools-btn" onClick={() => setEditandoPedido(p)} title="Editar OP">
                  <Edit3 className="w-3 h-3" /> Editar
                </button>
                <button type="button" className="op-tools-btn op-tools-btn-danger" onClick={() => handleDeletePedido(p)} title="Excluir OP">
                  <Trash2 className="w-3 h-3" /> Excluir
                </button>
              </div>
            ) : null;

            return (
              <div
                key={p.id}
                id={`pedido-card-${p.id}`}
                data-pedido-id={p.id}
                data-numero-pedido={numLimpoP}
                className={`transition-all duration-500 rounded-2xl ${
                  isFocado
                    ? "ring-4 ring-blue-500 dark:ring-blue-400 shadow-2xl p-2.5 bg-blue-50/30 dark:bg-blue-950/30 border-2 border-blue-400 dark:border-blue-500 my-4"
                    : ""
                }`}
              >
                {/* Banner de Chegada e Foco Imediato na Frente do Pedido */}
                {isFocado && (
                  <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-between font-bold text-xs sm:text-sm shadow-md mb-2.5 animate-pulse">
                    <span className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-yellow-300 shrink-0" />
                      <span>📍 VOCÊ CHEGOU NA FRENTE DESTE PEDIDO!</span>
                    </span>
                    <Badge className="bg-white text-blue-900 font-extrabold text-[11px] shadow-sm">
                      #{p.numero_pedido || p.id}
                    </Badge>
                  </div>
                )}
                {/* Banner de OP Duplicada individual */}
                {p._isDuplicada && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-2 flex items-center justify-between text-xs text-red-800 dark:text-red-300">
                    <span className="font-semibold flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                      Aviso: Esta OP é uma cópia duplicada pendente.
                    </span>
                    {podeGerenciar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:bg-red-500/20 font-bold h-7 px-2 text-xs"
                        onClick={() => handleDeletePedido(p)}
                      >
                        <Trash2 className="w-3 h-3 mr-1" /> Excluir esta cópia
                      </Button>
                    )}
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
                {(p.status === "pendente" || p.status === "aguardando_material") && expandidoMiniId !== p.id ? (
                  <PedidoMiniCard pedido={p} toolbar={toolbarOp} onExpand={() => setExpandidoMiniId(p.id)} />
                ) : (
                  <>
                    {toolbarOp && <div className="mb-1.5">{toolbarOp}</div>}
                    {(p.status === "pendente" || p.status === "aguardando_material") && (
                      <button onClick={() => setExpandidoMiniId(null)} className="w-full flex items-center justify-center gap-1 text-[11px] font-bold text-muted-foreground hover:text-foreground py-1 cursor-pointer">
                        <ChevronDown className="w-3.5 h-3.5 rotate-180" /> Recolher para resumo
                      </button>
                    )}
                    <PedidoRow pedido={p} onStatusChange={handleStatusChange} onUpdate={handleStatusChange} userRole={user?.role} opRodando={opRodando} maquina={maquina} user={user} filialAtiva={filialAtiva} appendHistoricoFn={(pedido, acao, label, detalhes) => appendHistorico(pedido, acao, label, detalhes)} todosPedidos={todosPedidos} />
                  </>
                )}
              </div>
            );
          })}

          {/* Banner quando não há mais pedidos a fazer hoje */}
          {ordenadosAFazer.length === 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-6 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2 font-bold text-lg">
                ✓
              </div>
              <h3 className="font-bold text-base text-emerald-950 dark:text-emerald-100">
                Fila de Produção Deste Dia Concluída!
              </h3>
              <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 mt-1 max-w-md mx-auto">
                Não há pedidos pendentes nesta máquina para o dia selecionado.
              </p>
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

      {/* Modal do Guia Operacional Padrão & Fluxograma */}
      <GuiaOperacionalModal
        open={guiaModalOpen}
        onClose={() => setGuiaModalOpen(false)}
        maquinaNome={maquina}
      />
    </div>
  );
}