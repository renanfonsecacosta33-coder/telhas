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
      const preBaixaMetrosMap = {};
      const preBaixaOpsMap = {};
      const statusMap = {};

      const addReserva = (bobinaId, kg, metros, opInfo) => {
        if (!bobinaId) return;
        const k = Number(kg) || 0;
        const m = Number(metros) || 0;
        if (k > 0) preBaixaMap[bobinaId] = (preBaixaMap[bobinaId] || 0) + k;
        if (m > 0) preBaixaMetrosMap[bobinaId] = (preBaixaMetrosMap[bobinaId] || 0) + m;
        if (opInfo) {
          if (!preBaixaOpsMap[bobinaId]) preBaixaOpsMap[bobinaId] = [];
          preBaixaOpsMap[bobinaId].push(opInfo);
        }
      };

      const addKg = (bobinaId, kg) => {
        addReserva(bobinaId, kg, 0, null);
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
                addReserva(bSupId, kg, metros, {
                  id: p.id,
                  numero_pedido: p.numero_pedido,
                  cliente: p.cliente,
                  produto: p.produto,
                  metros,
                  kg,
                  maquina: p.maquina || "Produção",
                  status: p.status,
                  data: p.data
                });
                addStatus(bSupId, p.maquina || "Produção", p.status);
              }
              if (bInfId) {
                const chapa = Number(bobinaById[bInfId]?.chapa || bobinaById[bInfId]?.espessura_mm) || 0.43;
                const kg = Number(v.kg_inf) > 0 ? Number(v.kg_inf) : (metros * chapa);
                addReserva(bInfId, kg, metros, {
                  id: p.id,
                  numero_pedido: p.numero_pedido,
                  cliente: p.cliente,
                  produto: `${p.produto} (Inferior)`,
                  metros,
                  kg,
                  maquina: p.maquina || "Produção",
                  status: p.status,
                  data: p.data
                });
                addStatus(bInfId, p.maquina || "Produção", p.status);
              }
            });
          } else {
            // Pedido padrão (bobina superior e opcionalmente inferior/secundária)
            const bSupId = resolveBobinaId(p.bobina_superior_id, p.bobina_superior, p.bobina_id);
            const bInfId = resolveBobinaId(p.bobina_inferior_id, p.bobina_inferior);
            const bSecId = resolveBobinaId(p.bobina_secundaria_id, p.bobina_secundaria);

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
              addReserva(bSupId, kgSup, metragemM, {
                id: p.id,
                numero_pedido: p.numero_pedido,
                cliente: p.cliente,
                produto: p.produto,
                metros: metragemM,
                kg: kgSup,
                maquina: p.maquina || "Produção",
                status: p.status,
                data: p.data
              });
              addStatus(bSupId, p.maquina || "Produção", p.status);
            }

            if (bSecId && Number(p.kg_secundaria) > 0) {
              const chapaSec = Number(bobinaById[bSecId]?.chapa || bobinaById[bSecId]?.espessura_mm) || 0.43;
              const kgSec = Number(p.kg_secundaria) || 0;
              const metrosSec = chapaSec > 0 ? (kgSec / (chapaSec * 7.85 * 1.2)) : 0;
              addReserva(bSecId, kgSec, metrosSec, {
                id: p.id,
                numero_pedido: p.numero_pedido,
                cliente: p.cliente,
                produto: `${p.produto} (2ª Bobina / Emenda)`,
                metros: metrosSec,
                kg: kgSec,
                maquina: p.maquina || "Produção",
                status: p.status,
                data: p.data
              });
              addStatus(bSecId, p.maquina || "Produção", p.status);
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
              addReserva(bInfId, kgInf, metragemM, {
                id: p.id,
                numero_pedido: p.numero_pedido,
                cliente: p.cliente,
                produto: `${p.produto} (Inferior)`,
                metros: metragemM,
                kg: kgInf,
                maquina: p.maquina || "Produção",
                status: p.status,
                data: p.data
              });
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
          const kg = Number(o.kg_estimado || o.peso_kg) || 0;
          const metros = Number(o.comprimento_mm || 0) / 1000 * (Number(o.quantidade) || 1);
          addReserva(bId, kg, metros, {
            id: o.id,
            numero_pedido: o.numero_pedido,
            cliente: o.cliente,
            produto: "Chapa / Corte",
            metros,
            kg,
            maquina: "Desbobinadeira",
            status: o.status,
            data: o.data
          });
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
            const kg = Number(o.peso_kg || o.kg_estimado) || 0;
            addReserva(bId, kg, 0, {
              id: o.id,
              numero_pedido: o.numero_pedido,
              cliente: o.cliente,
              produto: o.tipo_peca || "Perfil",
              metros: 0,
              kg,
              maquina: o.maquina || "Máquina CD",
              status: o.status,
              data: o.data
            });
            addStatus(bId, o.maquina || "Máquina CD", o.status);
          }
        });
      }

      const totalPreBaixaKg = Object.values(preBaixaMap).reduce((s, kg) => s + kg, 0);
      const totalPreBaixaMetros = Object.values(preBaixaMetrosMap).reduce((s, m) => s + m, 0);
      return { preBaixaMap, preBaixaMetrosMap, preBaixaOpsMap, statusMap, totalPreBaixaKg, totalPreBaixaMetros };
    },
    refetchInterval: 15000,
  });

  return {
    preBaixaMap: data.preBaixaMap || {},
    preBaixaMetrosMap: data.preBaixaMetrosMap || {},
    preBaixaOpsMap: data.preBaixaOpsMap || {},
    statusMap: data.statusMap || {},
    totalPreBaixaKg: data.totalPreBaixaKg || 0,
    totalPreBaixaMetros: data.totalPreBaixaMetros || 0,
    isLoading,
  };
}