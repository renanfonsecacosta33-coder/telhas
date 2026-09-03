import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

/**
 * Hook universal que calcula a pré-baixa (reserva virtual) de KG nas bobinas
 * e o status de programação em tempo real (Em uso vs Programada).
 * Suporta Telhas e Corte & Dobra com resolução precisa de IDs e KG.
 */
export function usePreBaixaBobinas(setor, filiais = null) {
  const filialKey = filiais ? filiais.join(",") : "all";

  const { data = {}, isLoading } = useQuery({
    queryKey: ["pre-baixa-bobinas-v2", setor, filialKey],
    queryFn: async () => {
      const preBaixaMap = {};
      const statusMap = {};

      const addKg = (bobinaId, kg) => {
        if (!bobinaId || !kg || isNaN(kg) || kg <= 0) return;
        preBaixaMap[bobinaId] = (preBaixaMap[bobinaId] || 0) + Number(kg);
      };

      const addStatus = (bobinaId, maquina, status) => {
        if (!bobinaId) return;
        const existing = statusMap[bobinaId];
        const statusClean = String(status || "").toLowerCase();
        const isProduzindo = ["em_producao", "produzindo", "iniciado"].includes(statusClean);
        const isPausado = statusClean === "pausado";

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

      const filialMatch = (unidade) => {
        if (!filiais || filiais.length === 0) return true;
        if (!unidade) return true;
        return filiais.some(f => String(f).trim().toLowerCase() === String(unidade).trim().toLowerCase());
      };

      if (setor === "telhas") {
        // 1. Busca bobinas de telhas para mapear ID, código e espessura/chapa
        let allBobinas = [];
        try {
          allBobinas = await base44.entities.Bobina.list("-created_date", 1000);
        } catch {
          try {
            allBobinas = await base44.entities.Bobina.filter({}, "-created_date", 1000);
          } catch {
            allBobinas = [];
          }
        }

        const bobinaById = {};
        const bobinaByCodigo = {};
        allBobinas.forEach(b => {
          if (b.id) bobinaById[b.id] = b;
          if (b.codigo) bobinaByCodigo[String(b.codigo).trim().toUpperCase()] = b;
        });

        // Helper para resolver ID real da bobina
        const resolveBobinaId = (idField, textField, fallbackId) => {
          if (idField && bobinaById[idField]) return idField;
          if (fallbackId && bobinaById[fallbackId]) return fallbackId;
          if (idField) return idField;
          if (fallbackId) return fallbackId;
          if (textField) {
            if (bobinaById[textField]) return textField;
            const clean = String(textField).trim().toUpperCase();
            if (bobinaByCodigo[clean]) return bobinaByCodigo[clean].id;
            const found = allBobinas.find(b => b.codigo && clean.includes(String(b.codigo).trim().toUpperCase()));
            if (found) return found.id;
          }
          return null;
        };

        // 2. Busca ordens de produção de telhas (Pedido)
        let pedidos = [];
        try {
          pedidos = await base44.entities.Pedido.list("-data", 500);
        } catch {
          try {
            pedidos = await base44.entities.Pedido.filter({}, "-data", 500);
          } catch {
            pedidos = [];
          }
        }

        // Filtra pedidos ativos (não finalizados e não cancelados)
        const pedidosAtivos = pedidos.filter(p => {
          const st = String(p.status || "").toLowerCase();
          return !["finalizado", "cancelado"].includes(st);
        });

        pedidosAtivos.forEach(p => {
          if (!filialMatch(p.unidade)) return;

          let vars = [];
          try { vars = JSON.parse(p.variacoes_telhas || "[]"); } catch {}
          const hasVarBobinas = Array.isArray(vars) && vars.length > 0 && vars.some(v => v.bobina_id || v.bobina_inf_id);

          if (hasVarBobinas) {
            // Pedidos com múltiplas variações de telhas
            vars.forEach(v => {
              if (v.finalizado) return; // Se a variação já foi finalizada, não conta pré-baixa

              const q = Number(v.qty) || 0;
              const mm = Number(v.mm) || 0;
              const metros = (q * mm) / 1000;

              const bSupId = resolveBobinaId(v.bobina_id, v.bobina_desc);
              const bInfId = resolveBobinaId(v.bobina_inf_id, v.bobina_inf_desc);

              if (bSupId) {
                const chapa = Number(bobinaById[bSupId]?.chapa || bobinaById[bSupId]?.espessura_mm) || 0.43;
                const kg = Number(v.kg) > 0 ? Number(v.kg) : (metros * chapa);
                addKg(bSupId, kg);
                addStatus(bSupId, p.maquina || "Produção", p.status);
              }
              if (bInfId) {
                const chapa = Number(bobinaById[bInfId]?.chapa || bobinaById[bInfId]?.espessura_mm) || 0.43;
                const kg = Number(v.kg_inf) > 0 ? Number(v.kg_inf) : (metros * chapa);
                addKg(bInfId, kg);
                addStatus(bInfId, p.maquina || "Produção", p.status);
              }
            });
          } else {
            // Pedido padrão (bobina superior e opcionalmente inferior)
            const bSupId = resolveBobinaId(p.bobina_superior_id, p.bobina_superior, p.bobina_id);
            const bInfId = resolveBobinaId(p.bobina_inferior_id, p.bobina_inferior);

            // Metragem total calculada: quantidade de peças * comprimento
            const qtdPecas = Number(p.metros) || Number(p.quantidade_telhas) || 1;
            const compM = (Number(p.metragem_mm) || 1000) / 1000;
            const metragemM = qtdPecas * compM;

            if (bSupId) {
              const chapaSup = Number(bobinaById[bSupId]?.chapa || bobinaById[bSupId]?.espessura_mm) || 0.43;
              let kgSup = Number(p.kg_superior) || 0;
              if (!kgSup && Number(p.kg_total) > 0) {
                kgSup = bInfId ? (Number(p.kg_total) / 2) : Number(p.kg_total);
              }
              if (!kgSup) {
                kgSup = metragemM * chapaSup;
              }
              addKg(bSupId, kgSup);
              addStatus(bSupId, p.maquina || "Produção", p.status);
            }

            if (bInfId) {
              const chapaInf = Number(bobinaById[bInfId]?.chapa || bobinaById[bInfId]?.espessura_mm) || 0.43;
              let kgInf = Number(p.kg_inferior) || 0;
              if (!kgInf && Number(p.kg_total) > 0) {
                kgInf = Number(p.kg_total) / 2;
              }
              if (!kgInf) {
                kgInf = metragemM * chapaInf;
              }
              addKg(bInfId, kgInf);
              addStatus(bInfId, p.maquina || "Produção", p.status);
            }
          }
        });
      } else {
        // Corte e Dobra — Desbobinadeira
        let ordens = [];
        try {
          ordens = await base44.entities.OrdemDesbobinadeira.list("-created_date", 500);
        } catch {
          try {
            ordens = await base44.entities.OrdemDesbobinadeira.filter({}, "-created_date", 500);
          } catch {
            ordens = [];
          }
        }

        const ordensAtivas = ordens.filter(o => !["finalizado", "cancelado"].includes(String(o.status || "").toLowerCase()));

        ordensAtivas.forEach(o => {
          if (!filialMatch(o.unidade)) return;
          const bId = o.bobina_id || o.bobina_superior_id || o.bobina_superior;
          addKg(bId, Number(o.kg_estimado || o.peso_kg) || 0);
          addStatus(bId, "Desbobinadeira", o.status);
        });

        // Ordens de máquina CD com bobina direta (perfiladeira)
        let ordensMaq = [];
        try {
          ordensMaq = await base44.entities.OrdemMaquinaCD.list("-created_date", 500);
        } catch {
          try {
            ordensMaq = await base44.entities.OrdemMaquinaCD.filter({}, "-created_date", 500);
          } catch {
            ordensMaq = [];
          }
        }

        const ordensMaqAtivas = ordensMaq.filter(o => !["finalizado", "cancelado"].includes(String(o.status || "").toLowerCase()));

        ordensMaqAtivas.forEach(o => {
          if (!filialMatch(o.unidade)) return;
          const bId = o.bobina_id || o.bobina_superior;
          if (bId) {
            addKg(bId, Number(o.peso_kg || o.kg_estimado) || 0);
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