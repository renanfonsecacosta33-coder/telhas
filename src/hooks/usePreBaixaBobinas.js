import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hook que calcula a pré-baixa (reserva virtual) de KG nas bobinas
 * e o status de programação em tempo real (Em uso vs Programada).
 */
export function usePreBaixaBobinas(setor, filiais = null) {
  const filialKey = filiais ? filiais.join(",") : "all";

  const { data = {}, isLoading } = useQuery({
    queryKey: ["pre-baixa-bobinas-v2", setor, filialKey],
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
        const isProduzindo = ["em_producao", "produzindo", "iniciado"].includes(status?.toLowerCase());
        const isPausado = status?.toLowerCase() === "pausado";

        if (existing) {
          if (isProduzindo) {
            statusMap[bobinaId] = { maquina, status: "em_producao" };
          } else if (existing.status === "em_producao") {
            return;
          } else if (isPausado && existing.status !== "pausado") {
            statusMap[bobinaId] = { maquina, status: "pausado" };
          }
        } else {
          statusMap[bobinaId] = { maquina, status: isProduzindo ? "em_producao" : "programado" };
        }
      };

      const filialMatch = (unidade) => !filiais || filiais.includes(unidade);

      if (setor === "telhas") {
        // Busca ordens ativas (OrdemProducao e Pedido) não finalizadas e não canceladas
        const [pedidos, ordens] = await Promise.all([
          base44.entities.Pedido.filter({
            status: { $nin: ["finalizado", "cancelado"] }
          }, "-created_date", 500).catch(() => []),
          base44.entities.OrdemProducao.filter({
            arquivada: false,
            status: { $nin: ["finalizado", "cancelado"] }
          }, "-created_date", 500).catch(() => [])
        ]);

        // Unifica lista de ordens/pedidos ativos
        const todosAtivos = [...pedidos, ...ordens];

        // Buscar bobinas para obter espessura/chapa para cálculo de KG se kg_superior for omisso
        const allBobinas = await base44.entities.Bobina.filter({ setor: "telhas" }, "-created_date", 1000).catch(() => []);
        const bobinaChapas = {};
        allBobinas.forEach(b => { 
          if (b.id) bobinaChapas[b.id] = Number(b.chapa || b.espessura_mm) || 0.43;
        });

        todosAtivos.forEach(p => {
          if (!filialMatch(p.unidade)) return;

          let vars = [];
          try { vars = JSON.parse(p.variacoes_telhas || "[]"); } catch {}
          const hasVarBobinas = Array.isArray(vars) && vars.some(v => v.bobina_id || v.bobina_inf_id);

          if (hasVarBobinas) {
            // Modo variações
            vars.forEach(v => {
              const q = Number(v.qty) || 0;
              const mm = Number(v.mm) || 0;
              const metros = q * mm / 1000;

              if (v.bobina_id) {
                const chapa = bobinaChapas[v.bobina_id] || 0.43;
                const kg = metros * chapa;
                addKg(v.bobina_id, kg);
                addStatus(v.bobina_id, p.maquina || "Produção", p.status);
              }
              if (v.bobina_inf_id) {
                const chapa = bobinaChapas[v.bobina_inf_id] || 0.43;
                const kg = metros * chapa;
                addKg(v.bobina_inf_id, kg);
                addStatus(v.bobina_inf_id, p.maquina || "Produção", p.status);
              }
            });
          } else {
            // Modo legado: resolve qualquer variação de propriedade do ID da bobina (superior, inferior ou direta)
            const bSupId = p.bobina_superior || p.bobina_superior_id || p.bobina_id;
            const bInfId = p.bobina_inferior || p.bobina_inferior_id;

            const metragemM = (Number(p.metros) || Number(p.quantidade_telhas) || 0) * ((Number(p.metragem_mm) || 1000) / 1000);

            if (bSupId) {
              const kgSup = Number(p.kg_superior) || (metragemM * (bobinaChapas[bSupId] || 0.43));
              addKg(bSupId, kgSup);
              addStatus(bSupId, p.maquina || "Produção", p.status);
            }
            if (bInfId) {
              const kgInf = Number(p.kg_inferior) || (metragemM * (bobinaChapas[bInfId] || 0.43));
              addKg(bInfId, kgInf);
              addStatus(bInfId, p.maquina || "Produção", p.status);
            }
          }
        });
      } else {
        // Corte e Dobra — Desbobinadeira
        const ordens = await base44.entities.OrdemDesbobinadeira.filter({
          status: { $nin: ["finalizado", "cancelado"] }
        }, "-created_date", 500).catch(() => []);

        ordens.forEach(o => {
          if (!filialMatch(o.unidade)) return;
          const bId = o.bobina_id || o.bobina_superior || o.bobina_superior_id;
          addKg(bId, o.kg_estimado || o.peso_kg);
          addStatus(bId, "Desbobinadeira", o.status);
        });

        // Ordens de máquina CD com bobina direta (perfiladeira)
        const ordensMaq = await base44.entities.OrdemMaquinaCD.filter({
          status: { $nin: ["finalizado", "cancelado"] }
        }, "-created_date", 500).catch(() => []);

        ordensMaq.forEach(o => {
          if (!filialMatch(o.unidade)) return;
          const bId = o.bobina_id || o.bobina_superior;
          if (bId) {
            addKg(bId, o.peso_kg || o.kg_estimado);
            addStatus(bId, o.maquina || "Máquina CD", o.status);
          }
        });
      }

      const totalPreBaixaKg = Object.values(preBaixaMap).reduce((s, kg) => s + kg, 0);
      return { preBaixaMap, statusMap, totalPreBaixaKg };
    },
    refetchInterval: 15000,
  });

  return {
    preBaixaMap: data.preBaixaMap || {},
    statusMap: data.statusMap || {},
    totalPreBaixaKg: data.totalPreBaixaKg || 0,
    isLoading,
  };
}