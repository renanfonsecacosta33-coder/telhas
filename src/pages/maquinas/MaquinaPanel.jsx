import React, { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Circle, ChevronLeft, ChevronRight, ArrowLeft, BarChart2, Plus, Star, Trash2, Edit3, Route, Search, X, Calendar, Filter } from "lucide-react";
import { format, addDays, subDays, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import PedidoRow from "@/components/producao/PedidoRow";
import PedidoFormDialog from "@/components/producao/PedidoFormDialog";
import { useFilial } from "@/contexts/FilialContext";
import { playAlertSound, speakNovaOp, playFinishSound, speakOpFinalizada } from "@/lib/sounds";
import { HistoricoPedidoTelhasButton } from "@/components/producao/HistoricoPedidoTelhasSidebar";
import PainelSolicitacoesProducao from "@/components/producao/PainelSolicitacoesProducao";
import ChatFloatingButton from "@/components/chat/ChatFloatingButton";
import FinalizarExpedienteButton from "@/components/expediente/FinalizarExpedienteButton";
import { getItens, computePercentual, statusPcpPorPercentual, buildItensJson, classGrupo, detectarMaquinaTelha } from "@/lib/pedidoOdooHelper";
import { notificarStatus } from "@/lib/biNotificador";
import { SeletorPrioridadeDropdown, getPesoOrdenacaoPrioridade } from "@/lib/prioridadeHelper";
import { normalizarTextoBusca, calcularFiltrosDisponiveis, pedidoAtendeFiltroMaterial } from "@/lib/bobinaStatusHelper";
import TimerProducao from "@/components/producao/TimerProducao";
import MonitorOciosidadeMaquina from "@/components/maquinas/MonitorOciosidadeMaquina";
import { isOperadorDestaMaquina } from "@/lib/somPermissaoHelper";
import { salvarCacheLocal, obterCacheLocal, enfileirarAcaoOffline } from "@/lib/offlineStorage";
import { calcularMetrosPedido } from "@/lib/metrosHelper";

const STATUS_LABELS_TELHAS = {
  pendente: "Pendente",
  em_producao: "Em Produção",
  pausado: "Pausado",
  aguardando_colagem: "Aguardando Colagem",
  finalizado: "Finalizado",
  cancelado: "Cancelado",
};







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
  const [filtroMaterial, setFiltroMaterial] = useState("todos");
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [editandoPedido, setEditandoPedido] = useState(null);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();
  const { filialAtiva } = useFilial();

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
        return mNorm === "COLAGEM" || p.status === "aguardando_colagem";
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
    const acaoMap = {
      em_producao: pedido.status === "pausado" ? ["retomado", "Retomou Produção"] : ["iniciado", "Iniciou Produção"],
      pausado: ["pausado", "Pausou Produção"],
      finalizado: ["finalizado", "Finalizou Pedido"],
      aguardando_colagem: ["status_alterado", "Enviado para Colagem"],
      pendente: ["status_alterado", `Retornou para Pendente`],
      cancelado: ["status_alterado", "Cancelado"],
    };
    const [acao, label] = acaoMap[novoStatus] || ["status_alterado", `Status → ${STATUS_LABELS_TELHAS[novoStatus] || novoStatus}`];
    const detalhes = novoStatus === "pausado" && extraData.motivo_pausa
      ? `Motivo: ${extraData.motivo_pausa}`
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
  // - Na COLAGEM: segue o fluxo padrão de colagem.
  // - Na perfiladeira (TP - 25, etc.): se o pedido já foi para aguardando_colagem ou COLAGEM,
  //   as peças já foram TIRADAS nesta máquina! Conta como concluído/pronto na máquina.
  const finalizados = pedidosDia.filter(p => {
    if (p.status === "finalizado") return true;
    if (targetNorm !== "COLAGEM" && (p.status === "aguardando_colagem" || maquinaNorm(p.maquina) === "COLAGEM")) {
      return true;
    }
    return false;
  }).length;

  const emProducao = pedidosDia.filter(p => {
    if (targetNorm !== "COLAGEM" && (p.status === "aguardando_colagem" || maquinaNorm(p.maquina) === "COLAGEM")) {
      return false;
    }
    return p.status === "em_producao" || p.status === "pausado";
  }).length;

  const pendentes = pedidosDia.filter(p => {
    if (targetNorm !== "COLAGEM" && (p.status === "aguardando_colagem" || maquinaNorm(p.maquina) === "COLAGEM")) {
      return false;
    }
    return p.status === "pendente";
  }).length;

  // Função para match de busca: número do pedido (#, dígitos ou texto), cliente, produto/modelo ou obs
  const matchPedidoBusca = (p, query) => {
    if (!query) return true;
    const q = normalizarTextoBusca(query);
    if (!q) return true;

    // 1. Número do pedido (ex: #299065, 299065, S00299065)
    const numRaw = normalizarTextoBusca(p.numero_pedido);
    if (numRaw.includes(q)) return true;

    // Comparação por dígitos limpos
    const qDigits = q.replace(/\D/g, "");
    const pDigits = String(p.numero_pedido || "").replace(/\D/g, "");
    if (qDigits && pDigits && (pDigits.includes(qDigits) || qDigits.includes(pDigits))) {
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
  // Se não existir bobina branca, o botão 'Branca' NÃO aparece!
  const filtrosDisponiveis = useMemo(() => {
    return calcularFiltrosDisponiveis(baseParaFiltros);
  }, [baseParaFiltros]);

  // Auto-reset se o filtro ativo deixar de existir na lista disponível
  useEffect(() => {
    if (filtroMaterial !== "todos") {
      const existe = filtrosDisponiveis.some(f => f.key === filtroMaterial);
      if (!existe) {
        setFiltroMaterial("todos");
      }
    }
  }, [filtrosDisponiveis, filtroMaterial]);

  // Pedidos filtrados aplicando busca + filtro de material/bobina
  const pedidosFiltrados = useMemo(() => {
    if (!filtroMaterial || filtroMaterial === "todos") return baseParaFiltros;
    return baseParaFiltros.filter(p => pedidoAtendeFiltroMaterial(p, filtroMaterial));
  }, [baseParaFiltros, filtroMaterial]);

  const ordenados = useMemo(() => {
    const hoje = format(new Date(), "yyyy-MM-dd");
    const order = { em_producao: 0, pausado: 1, pendente: 2, aguardando_colagem: 3, finalizado: 4, cancelado: 5 };
    return [...pedidosFiltrados].sort((a, b) => {
      // Prioridade 1 a 5 (P1 é a mais urgente de todas a fazer!)
      const priDiff = getPesoOrdenacaoPrioridade(a) - getPesoOrdenacaoPrioridade(b);
      if (priDiff !== 0) return priDiff;

      const aAtrasado = (a.data && a.data < hoje) ? 0 : 1;
      const bAtrasado = (b.data && b.data < hoje) ? 0 : 1;
      if (aAtrasado !== bAtrasado) return aAtrasado - bAtrasado;
      return (order[a.status] ?? 2) - (order[b.status] ?? 2);
    });
  }, [pedidosFiltrados]);

  const handleSetPrioridade = (pedido, nivel) => {
    const novaPri = Boolean(nivel);
    const nivelNum = nivel ? Number(nivel) : null;
    const labelAcao = nivelNum ? `Definiu Prioridade P${nivelNum}` : "Removeu Prioridade";
    const histData = appendHistorico(pedido, "prioridade", labelAcao, `Prioridade nível ${nivelNum || "nenhum"}`);
    updateMutation.mutate({
      id: pedido.id,
      data: {
        prioridade: novaPri,
        prioridade_nivel: nivelNum,
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

  const handleDeletePedido = async (pedido) => {
    if (!confirm(`Excluir pedido ${pedido.numero_pedido ? "#" + pedido.numero_pedido : ""}?\nEsta ação não pode ser desfeita.`)) return;
    const histData = appendHistorico(pedido, "excluido", "Excluiu Pedido");
    // Registra no histórico antes de excluir (best-effort — se o pedido for excluído, o log se perde,
    // mas o usuário será notificado via toast)
    try {
      await base44.entities.Pedido.delete(pedido.id);
      toast.success("Pedido excluído!");
      queryClient.invalidateQueries({ queryKey: ["pedidos-maquina", maquina] });
    } catch (err) {
      toast.error("Erro ao excluir: " + (err.message || ""));
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
        {!isOperador && (
          <div className="flex items-center gap-2">
            {DASH_PATHS[maquina] && (
              <Link to={DASH_PATHS[maquina]}>
                <Button variant="outline" size="sm" className="gap-2">
                  <BarChart2 className="w-4 h-4" />
                  Dashboard
                </Button>
              </Link>
            )}
            <Button size="sm" className="gap-2" onClick={() => setNovoPedidoOpen(true)}>
              <Plus className="w-4 h-4" />
              Novo Pedido
            </Button>
          </div>
        )}
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

        {/* Filtros Dinâmicos de Bobinas (Aparecem APENAS os itens que realmente existem nos pedidos desta visão) */}
        {filtrosDisponiveis.length > 0 && (
          <div className="pt-2 border-t border-border/50 space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-primary" />
                Filtrar por Bobina / Material
              </span>
              {filtroMaterial !== "todos" && (
                <button
                  type="button"
                  onClick={() => setFiltroMaterial("todos")}
                  className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                >
                  Ver todos ({baseParaFiltros.length})
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
              {/* Botão Todos */}
              <button
                type="button"
                onClick={() => setFiltroMaterial("todos")}
                className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border ${
                  filtroMaterial === "todos"
                    ? "bg-primary text-primary-foreground border-primary shadow-sm font-semibold"
                    : "bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-transparent"
                }`}
              >
                <span>Todos</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${
                  filtroMaterial === "todos"
                    ? "bg-primary-foreground/25 text-primary-foreground"
                    : "bg-muted-foreground/15 text-muted-foreground"
                }`}>
                  {baseParaFiltros.length}
                </span>
              </button>

              {/* Filtros Dinâmicos Presentes nos Pedidos */}
              {filtrosDisponiveis.map((f) => {
                const isSelected = filtroMaterial === f.key;
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setFiltroMaterial(isSelected ? "todos" : f.key)}
                    className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? "ring-2 ring-primary ring-offset-1 shadow-sm font-bold " + (f.corBadge || "bg-primary text-primary-foreground border-primary")
                        : "bg-background hover:bg-muted/70 text-foreground border-border/80 font-medium"
                    }`}
                    title={`Filtrar pedidos com bobina ${f.label}`}
                  >
                    <span>{f.icone}</span>
                    <span>{f.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold leading-none ${
                      isSelected ? "bg-black/15 dark:bg-white/25" : "bg-muted text-muted-foreground"
                    }`}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>
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
          {ordenados.map(p => {
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
                  <div className="flex justify-end gap-1 mb-1">
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
                    <HistoricoPedidoTelhasButton pedido={p} />
                    <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground hover:text-blue-600" onClick={() => setEditandoPedido(p)}>
                      <Edit3 className="w-3 h-3 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="ghost" className="text-xs h-6 px-2 text-muted-foreground hover:text-red-600" onClick={() => handleDeletePedido(p)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Excluir
                    </Button>
                  </div>
                )}
                <PedidoRow pedido={p} onStatusChange={handleStatusChange} onUpdate={handleStatusChange} userRole={user?.role} opRodando={opRodando} maquina={maquina} user={user} filialAtiva={filialAtiva} appendHistoricoFn={(pedido, acao, label, detalhes) => appendHistorico(pedido, acao, label, detalhes)} />
              </div>
            );
          })}
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
    </div>
  );
}