import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hook que calcula a pré-baixa (reserva virtual) de KG nas bobinas.
 *
 * A pré-baixa é VIRTUAL: soma o KG estimado de todos os pedidos/ordens ativos
 * (não finalizados, não cancelados) que referenciam uma bobina.
 *
 * Quando o pedido é finalizado, a função descontarEstoquePedido faz a baixa real
 * (deduz do peso_kg), e a pré-baixa desaparece automaticamente (pedido deixa de ser ativo).
 *
 * @param {string} setor - "telhas" ou "corte_dobra"
 * @param {string[]|null} filiais - filiais para filtrar (null = todas)
 */
export function usePreBaixaBobinas(setor, filiais = null) {
  const filialKey = filiais ? filiais.join(",") : "all";

  const { data = {}, isLoading } = useQuery({
    queryKey: ["pre-baixa-bobinas", setor, filialKey],
    queryFn: async () => {
      const preBaixaMap = {};
      const statusMap = {};

      const addKg = (bobinaId, kg) => {
        if (!bobinaId || !kg || kg <= 0) return;
        preBaixaMap[bobinaId] = (preBaixaMap[bobinaId] || 0) + kg;
      };

      const addStatus = (bobinaId, maquina, status) => {
        if (!bobinaId) return;
        const existing = statusMap[bobinaId];
        if (existing) {
          if (status === "em_producao") {
            statusMap[bobinaId] = { maquina, status };
          } else if (existing.status === "em_producao") {
            return;
          } else if (status === "pausado" && existing.status !== "pausado") {
            statusMap[bobinaId] = { maquina, status };
          }
        } else {
          statusMap[bobinaId] = { maquina, status };
        }
      };

      const filialMatch = (unidade) => !filiais || filiais.includes(unidade);

      if (setor === "telhas") {
        const pedidos = await base44.entities.Pedido.filter({
          status: { $nin: ["finalizado", "cancelado"] }
        }, "-created_date", 500);

        // Coletar IDs de bobinas referenciadas (para buscar chapa — necessário p/ variações)
        const bobinaIds = new Set();
        pedidos.forEach(p => {
          if (!filialMatch(p.unidade)) return;
          let vars = [];
          try { vars = JSON.parse(p.variacoes_telhas || "[]"); } catch {}
          if (Array.isArray(vars)) {
            vars.forEach(v => {
              if (v.bobina_id) bobinaIds.add(v.bobina_id);
              if (v.bobina_inf_id) bobinaIds.add(v.bobina_inf_id);
            });
          }
          if (p.bobina_superior_id) bobinaIds.add(p.bobina_superior_id);
          if (p.bobina_inferior_id) bobinaIds.add(p.bobina_inferior_id);
        });

        // Buscar bobinas para obter valores de chapa (cálculo de KG por variação)
        const bobinaChapas = {};
        if (bobinaIds.size > 0) {
          const allBobinas = await base44.entities.Bobina.filter({ setor: "telhas" }, "-created_date", 1000);
          allBobinas.forEach(b => { bobinaChapas[b.id] = Number(b.chapa) || 0; });
        }

        pedidos.forEach(p => {
          if (!filialMatch(p.unidade)) return;

          let vars = [];
          try { vars = JSON.parse(p.variacoes_telhas || "[]"); } catch {}
          const hasVarBobinas = Array.isArray(vars) && vars.some(v => v.bobina_id);

          if (hasVarBobinas) {
            // Modo variações: calcular KG por bobina individualmente
            const kgPorBobina = {};
            vars.forEach(v => {
              const q = Number(v.qty) || 0;
              const mm = Number(v.mm) || 0;
              const metros = q * mm / 1000;
              if (metros > 0 && v.bobina_id) {
                const chapa = bobinaChapas[v.bobina_id] || 0;
                if (chapa > 0) kgPorBobina[v.bobina_id] = (kgPorBobina[v.bobina_id] || 0) + chapa * metros;
                addStatus(v.bobina_id, p.maquina || "Produção", p.status);
              }
              if (metros > 0 && v.bobina_inf_id) {
                const chapa = bobinaChapas[v.bobina_inf_id] || 0;
                if (chapa > 0) kgPorBobina[v.bobina_inf_id] = (kgPorBobina[v.bobina_inf_id] || 0) + chapa * metros;
                addStatus(v.bobina_inf_id, p.maquina || "Produção", p.status);
              }
            });
            Object.entries(kgPorBobina).forEach(([bid, kg]) => addKg(bid, kg));
          } else {
            // Modo legado: usar KG direto do pedido
            addKg(p.bobina_superior_id, p.kg_superior);
            addKg(p.bobina_inferior_id, p.kg_inferior);
            addStatus(p.bobina_superior_id, p.maquina || "Produção", p.status);
            addStatus(p.bobina_inferior_id, p.maquina || "Produção", p.status);
          }
        });
      } else {
        // Corte e Dobra — Desbobinadeira
        const ordens = await base44.entities.OrdemDesbobinadeira.filter({
          status: { $nin: ["finalizado", "cancelado"] }
        }, "-created_date", 500);

        ordens.forEach(o => {
          if (!filialMatch(o.unidade)) return;
          addKg(o.bobina_id, o.kg_estimado);
          addStatus(o.bobina_id, "Desbobinadeira", o.status);
        });

        // Ordens de máquina CD com bobina direta (perfiladeira)
        const ordensMaq = await base44.entities.OrdemMaquinaCD.filter({
          status: { $nin: ["finalizado", "cancelado"] }
        }, "-created_date", 500);

        ordensMaq.forEach(o => {
          if (!filialMatch(o.unidade)) return;
          if (o.chapa_origem === "direto" && o.bobina_id) {
            addKg(o.bobina_id, o.peso_kg);
            addStatus(o.bobina_id, o.maquina || "Máquina CD", o.status);
          }
        });
      }

      const totalPreBaixaKg = Object.values(preBaixaMap).reduce((s, kg) => s + kg, 0);
      return { preBaixaMap, statusMap, totalPreBaixaKg };
    },
    refetchInterval: 30000,
  });

  return {
    preBaixaMap: data.preBaixaMap || {},
    statusMap: data.statusMap || {},
    totalPreBaixaKg: data.totalPreBaixaKg || 0,
    isLoading,
  };
}