import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { calcularMetrosPedido } from "@/lib/metrosHelper";

const STORAGE_KEY_GERAL = "ajl_metas_producao_geral";
const EVENTO_METAS_CHANGED = "ajl_metas_changed";

// Padrões iniciais para a meta geral da fábrica
export const DEFAULT_META_GERAL = {
  min: 1000,        // Mínimo de 1.000 metros/dia para a fábrica
  max: 3500,        // Máximo/Capacidade teto de 3.500 metros/dia
  travarMaximo: true // Trava/bloqueia agendamento acima do limite máximo
};

// Padrões de fallback por modelo/máquina caso não configurado no banco
export const DEFAULT_METAS_POR_MODELO = {
  "TP-40": { min: 500, max: 1800 },
  "TP - 40": { min: 500, max: 1800 },
  "TP-25": { min: 400, max: 1500 },
  "TP - 25": { min: 400, max: 1500 },
  "ONDULADA": { min: 200, max: 800 },
  "Ondulada": { min: 200, max: 800 },
  "COLONIAL": { min: 200, max: 800 },
  "Colonial": { min: 200, max: 800 },
  "BANDEJA": { min: 150, max: 600 },
  "Bandeja": { min: 150, max: 600 },
  "CUMEEIRA": { min: 50, max: 300 },
  "Cumeeira": { min: 50, max: 300 },
  "COLAGEM": { min: 300, max: 1200 },
  "Colagem": { min: 300, max: 1200 },
  "DESBOBINADOR": { min: 200, max: 1000 },
};

function normalizarChave(str) {
  if (!str) return "";
  return String(str).toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function useMetasProducao() {
  const qc = useQueryClient();

  // ─── 1. Estado da Meta Geral da Fábrica ────────────────────────
  const [metaGeral, setMetaGeralState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_GERAL);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          min: Number(parsed.min) || DEFAULT_META_GERAL.min,
          max: Number(parsed.max) || DEFAULT_META_GERAL.max,
          travarMaximo: parsed.travarMaximo !== undefined ? Boolean(parsed.travarMaximo) : DEFAULT_META_GERAL.travarMaximo,
        };
      }
    } catch {
      // fallback
    }
    return DEFAULT_META_GERAL;
  });

  // Ouve mudanças entre componentes ou abas
  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_GERAL);
        if (saved) {
          const parsed = JSON.parse(saved);
          setMetaGeralState({
            min: Number(parsed.min) || DEFAULT_META_GERAL.min,
            max: Number(parsed.max) || DEFAULT_META_GERAL.max,
            travarMaximo: parsed.travarMaximo !== undefined ? Boolean(parsed.travarMaximo) : DEFAULT_META_GERAL.travarMaximo,
          });
        }
      } catch {}
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(EVENTO_METAS_CHANGED, handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(EVENTO_METAS_CHANGED, handleStorage);
    };
  }, []);

  const salvarMetaGeral = useCallback((novasMetas) => {
    const atualizado = {
      min: Number(novasMetas.min) > 0 ? Number(novasMetas.min) : DEFAULT_META_GERAL.min,
      max: Number(novasMetas.max) > 0 ? Number(novasMetas.max) : DEFAULT_META_GERAL.max,
      travarMaximo: Boolean(novasMetas.travarMaximo),
    };
    setMetaGeralState(atualizado);
    try {
      localStorage.setItem(STORAGE_KEY_GERAL, JSON.stringify(atualizado));
      window.dispatchEvent(new Event(EVENTO_METAS_CHANGED));
    } catch (e) {
      console.error("Erro ao salvar meta geral no localStorage:", e);
    }
  }, []);

  // ─── 2. Metas por Modelo de Produto (Base44) ────────────────────
  const { data: modelosCadastrados = [], isLoading: loadingModelos } = useQuery({
    queryKey: ["modelos-produto"],
    queryFn: () => base44.entities.ModeloProduto.list("produto"),
  });

  // Mapeamento rápido de metas por modelo e máquinas
  const metasPorModeloMap = useMemo(() => {
    const map = new Map();

    // 1. Aplica padrões iniciais
    Object.entries(DEFAULT_METAS_POR_MODELO).forEach(([nome, metas]) => {
      map.set(normalizarChave(nome), metas);
    });

    // 2. Sobrescreve com o que estiver salvo em cada ModeloProduto do banco
    modelosCadastrados.forEach(m => {
      const minBanco = Number(m.meta_min_metros);
      const maxBanco = Number(m.meta_max_metros);

      const chaveModelo = normalizarChave(m.modelo);
      const chaveProd = normalizarChave(m.produto);

      // Metas definidas no modelo ou herança do default
      const defaultAtual = map.get(chaveModelo) || { min: 300, max: 1200 };
      const metaFinal = {
        min: minBanco > 0 ? minBanco : defaultAtual.min,
        max: maxBanco > 0 ? maxBanco : defaultAtual.max,
        id: m.id,
        modelo: m.modelo,
        produto: m.produto,
        maquinas: m.maquinas,
      };

      if (chaveModelo) map.set(chaveModelo, metaFinal);

      // Também mapeia para cada máquina associada ao modelo
      if (m.maquinas) {
        String(m.maquinas).split(",").forEach(mq => {
          const cMq = normalizarChave(mq);
          if (cMq && !map.has(cMq)) {
            map.set(cMq, metaFinal);
          }
        });
      }
    });

    return map;
  }, [modelosCadastrados]);

  const obterMetaModelo = useCallback((modeloOuMaquina) => {
    if (!modeloOuMaquina) return null;
    const chave = normalizarChave(modeloOuMaquina);
    return metasPorModeloMap.get(chave) || null;
  }, [metasPorModeloMap]);

  // Mutation para atualizar as metas de um modelo no banco
  const updateModeloMetaMutation = useMutation({
    mutationFn: async ({ id, meta_min_metros, meta_max_metros }) => {
      return base44.entities.ModeloProduto.update(id, {
        meta_min_metros: Number(meta_min_metros) || undefined,
        meta_max_metros: Number(meta_max_metros) || undefined,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modelos-produto"] });
    },
  });

  // ─── 3. Helpers de Status e Avaliação de Metas ───────────────────
  const calcularStatusMeta = useCallback((metros, min, max) => {
    const m = Number(metros) || 0;
    const mi = Number(min) || 0;
    const ma = Number(max) || 0;

    const pctMin = mi > 0 ? Math.min(100, Math.round((m / mi) * 100)) : 100;
    const pctMax = ma > 0 ? Math.round((m / ma) * 100) : 0;

    if (ma > 0 && m > ma) {
      return {
        status: "limite_estourado",
        label: "Capacidade Esgotada / Limite Atingido",
        curto: "Limite Excedido",
        pctMin: 100,
        pctMax,
        excesso: +(m - ma).toFixed(1),
        bgClass: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/40",
        badgeVariant: "destructive",
        dotClass: "bg-red-500",
        barClass: "bg-red-500",
      };
    }

    if (mi > 0 && m >= mi) {
      return {
        status: "meta_atingida",
        label: "Meta Mínima Atingida",
        curto: "Meta Atingida",
        pctMin: 100,
        pctMax,
        excesso: 0,
        bgClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
        badgeVariant: "default",
        dotClass: "bg-emerald-500",
        barClass: "bg-emerald-500",
      };
    }

    return {
      status: "abaixo_minimo",
      label: `Abaixo da Meta (Faltam ${mi > 0 ? +(mi - m).toFixed(1) : 0}m)`,
      curto: "Abaixo da Meta",
      pctMin,
      pctMax,
      excesso: 0,
      bgClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40",
      badgeVariant: "secondary",
      dotClass: "bg-amber-500",
      barClass: "bg-amber-500",
    };
  }, []);

  // Verifica as metas de um dia específico
  const verificarMetasDoDia = useCallback((dataStr, pedidos = []) => {
    const pedidosDoDia = pedidos.filter(p => p.data === dataStr && String(p.status).toLowerCase() !== "cancelado");
    const totalDia = pedidosDoDia.reduce((s, p) => s + calcularMetrosPedido(p), 0);

    const statusGeral = calcularStatusMeta(totalDia, metaGeral.min, metaGeral.max);

    // Agrupa e calcula por modelo/máquina
    const porModelo = {};
    pedidosDoDia.forEach(p => {
      const mod = p.modelo || p.maquina || "Outros";
      const m = calcularMetrosPedido(p);
      porModelo[mod] = (porModelo[mod] || 0) + m;
    });

    const modelosDetalhados = Object.entries(porModelo).map(([nome, metros]) => {
      const config = obterMetaModelo(nome) || { min: 200, max: 1000 };
      const st = calcularStatusMeta(metros, config.min, config.max);
      return {
        nome,
        metros,
        min: config.min,
        max: config.max,
        ...st
      };
    });

    return {
      data: dataStr,
      totalDia,
      qtdPedidos: pedidosDoDia.length,
      statusGeral,
      metaGeral,
      modelosDetalhados
    };
  }, [metaGeral, calcularStatusMeta, obterMetaModelo]);

  // Valida se a inserção de um pedido excede o limite máximo diário
  const verificarExcessoAgendamento = useCallback(({ data, novoMetros, modelo, maquina, pedidos = [], idEditando = null }) => {
    if (!data || !novoMetros || Number(novoMetros) <= 0) {
      return { excedeuGeral: false, excedeuModelo: false, deveBloquear: false };
    }

    const metrosAdicionar = Number(novoMetros) || 0;

    // Pedidos do mesmo dia excluindo o próprio pedido em edição e cancelados
    const pedidosDoDia = pedidos.filter(p => {
      if (idEditando && String(p.id) === String(idEditando)) return false;
      if (String(p.status).toLowerCase() === "cancelado") return false;
      return p.data === data;
    });

    const totalAtualGeral = pedidosDoDia.reduce((s, p) => s + calcularMetrosPedido(p), 0);
    const totalNovoGeral = totalAtualGeral + metrosAdicionar;
    const excedeuGeral = totalNovoGeral > metaGeral.max;
    const excessoGeral = excedeuGeral ? +(totalNovoGeral - metaGeral.max).toFixed(1) : 0;

    // Verificação por modelo específico
    const modeloRef = modelo || maquina || "";
    const metaMod = obterMetaModelo(modeloRef);
    let excedeuModelo = false;
    let excessoModelo = 0;
    let totalAtualModelo = 0;
    let totalNovoModelo = 0;

    if (metaMod && metaMod.max > 0) {
      totalAtualModelo = pedidosDoDia
        .filter(p => {
          const modP = p.modelo || p.maquina || "";
          return normalizarChave(modP) === normalizarChave(modeloRef);
        })
        .reduce((s, p) => s + calcularMetrosPedido(p), 0);

      totalNovoModelo = totalAtualModelo + metrosAdicionar;
      excedeuModelo = totalNovoModelo > metaMod.max;
      excessoModelo = excedeuModelo ? +(totalNovoModelo - metaMod.max).toFixed(1) : 0;
    }

    const deveBloquear = metaGeral.travarMaximo && (excedeuGeral || excedeuModelo);

    return {
      excedeuGeral,
      excessoGeral,
      totalAtualGeral,
      totalNovoGeral,
      limiteMaxGeral: metaGeral.max,
      excedeuModelo,
      excessoModelo,
      totalAtualModelo,
      totalNovoModelo,
      limiteMaxModelo: metaMod?.max || null,
      modeloNome: metaMod?.modelo || modeloRef,
      deveBloquear,
      travaAtiva: metaGeral.travarMaximo,
    };
  }, [metaGeral, obterMetaModelo]);

  return {
    metaGeral,
    salvarMetaGeral,
    modelosCadastrados,
    loadingModelos,
    metasPorModeloMap,
    obterMetaModelo,
    updateModeloMeta: updateModeloMetaMutation.mutateAsync,
    calcularStatusMeta,
    verificarMetasDoDia,
    verificarExcessoAgendamento,
  };
}
