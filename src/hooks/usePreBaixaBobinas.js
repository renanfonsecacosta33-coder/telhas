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

      const addStatus = (bobinaId, maquina, status, numeroPedido = null) => {
        if (!bobinaId) return;
        const existing = statusMap[bobinaId];
        const statusClean = String(status || "").toLowerCase();
        const isProduzindo = ["em_producao", "produzindo", "iniciado"].includes(statusClean);
        const isPausado = statusClean === "pausado";
        const pedClean = numeroPedido ? String(numeroPedido).replace(/^#/, "").trim() : null;

        if (existing) {
          if (isProduzindo) {
            statusMap[bobinaId] = { 
              maquina, 
              status: "em_producao", 
              numero_pedido: pedClean || existing.numero_pedido 
            };
          } else if (existing.status === "em_producao") {
            return;
          } else if (isPausado && existing.status !== "pausado") {
            statusMap[bobinaId] = { 
              maquina, 
              status: "pausado", 
              numero_pedido: pedClean || existing.numero_pedido 
            };
          }
        } else {
          statusMap[bobinaId] = { 
            maquina, 
            status: isProduzindo ? "em_producao" : (isPausado ? "pausado" : "programado"), 
            numero_pedido: pedClean 
          };
        }
      };

      const filialMatch = (unidade) => {
        if (!filiais || filiais.length === 0) return true;
        if (!unidade) return true;
        return filiais.some(f => String(f).trim().toLowerCase() === String(unidade).trim().toLowerCase());
      };

      // 1. Busca todas as bobinas do sistema para mapeamento bidirecional ID <-> CÓDIGO
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
        if (b.codigo_bobina) bobinaByCodigo[String(b.codigo_bobina).trim().toUpperCase()] = b;
      });

      // Helper universal para resolver o ID e Código canônicos da bobina
      const resolveBobinaIds = (idField, textField, fallbackId) => {
        let b = null;
        if (idField && bobinaById[idField]) b = bobinaById[idField];
        else if (fallbackId && bobinaById[fallbackId]) b = bobinaById[fallbackId];
        else if (textField) {
          const clean = String(textField).trim().toUpperCase();
          if (bobinaByCodigo[clean]) b = bobinaByCodigo[clean];
          else if (bobinaById[textField]) b = bobinaById[textField];
          else {
            const found = allBobinas.find(x => x.codigo && clean.includes(String(x.codigo).trim().toUpperCase()));
            if (found) b = found;
          }
        }
        if (b) {
          return { id: b.id, codigo: b.codigo || b.codigo_bobina, bobina: b };
        }
        const cleanRaw = idField || fallbackId || textField;
        return { id: cleanRaw, codigo: cleanRaw, bobina: null };
      };

      const addReservaUniversal = (idField, textField, fallbackId, kg, metros, opInfo) => {
        const { id, codigo } = resolveBobinaIds(idField, textField, fallbackId);
        if (!id && !codigo) return;
        const k = Number(kg) || 0;
        const m = Number(metros) || 0;
        if (k > 0) {
          if (id) preBaixaMap[id] = (preBaixaMap[id] || 0) + k;
          if (codigo && codigo !== id) preBaixaMap[codigo] = (preBaixaMap[codigo] || 0) + k;
        }
        if (m > 0) {
          if (id) preBaixaMetrosMap[id] = (preBaixaMetrosMap[id] || 0) + m;
          if (codigo && codigo !== id) preBaixaMetrosMap[codigo] = (preBaixaMetrosMap[codigo] || 0) + m;
        }
        if (opInfo) {
          if (id) {
            if (!preBaixaOpsMap[id]) preBaixaOpsMap[id] = [];
            preBaixaOpsMap[id].push(opInfo);
          }
          if (codigo && codigo !== id) {
            if (!preBaixaOpsMap[codigo]) preBaixaOpsMap[codigo] = [];
            preBaixaOpsMap[codigo].push(opInfo);
          }
        }
      };

      // ── A. ORDENS DE TELHAS (Fábrica de Telhas) ──────────────────────────
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
          vars.forEach(v => {
            if (v.finalizado) return;

            const q = Number(v.qty) || 0;
            const mm = Number(v.mm) || 0;
            const metros = (q * mm) / 1000;

            const sup = resolveBobinaIds(v.bobina_id, v.bobina_desc);
            const inf = resolveBobinaIds(v.bobina_inf_id, v.bobina_inf_desc);

            if (sup.id || sup.codigo) {
              const chapa = Number(sup.bobina?.chapa || sup.bobina?.espessura_mm) || 0.43;
              const kg = Number(v.kg) > 0 ? Number(v.kg) : (metros * chapa);
              addReservaUniversal(v.bobina_id, v.bobina_desc, null, kg, metros, {
                id: p.id,
                numero_pedido: p.numero_pedido,
                cliente: p.cliente,
                produto: p.produto,
                metros,
                kg,
                maquina: p.maquina || "Produção",
                status: p.status,
                data: p.data,
                setor: "Telhas"
              });
              if (sup.id) addStatus(sup.id, p.maquina || "Produção", p.status, p.numero_pedido);
            }
            if (inf.id || inf.codigo) {
              const chapa = Number(inf.bobina?.chapa || inf.bobina?.espessura_mm) || 0.43;
              const kg = Number(v.kg_inf) > 0 ? Number(v.kg_inf) : (metros * chapa);
              addReservaUniversal(v.bobina_inf_id, v.bobina_inf_desc, null, kg, metros, {
                id: p.id,
                numero_pedido: p.numero_pedido,
                cliente: p.cliente,
                produto: `${p.produto} (Inferior)`,
                metros,
                kg,
                maquina: p.maquina || "Produção",
                status: p.status,
                data: p.data,
                setor: "Telhas"
              });
              if (inf.id) addStatus(inf.id, p.maquina || "Produção", p.status, p.numero_pedido);
            }
          });
        } else {
          const qtdPecas = Number(p.metros) || Number(p.quantidade_telhas) || 1;
          const compM = (Number(p.metragem_mm) || 1000) / 1000;
          const metragemM = qtdPecas * compM;

          const sup = resolveBobinaIds(p.bobina_superior_id, p.bobina_superior, p.bobina_id);
          const inf = resolveBobinaIds(p.bobina_inferior_id, p.bobina_inferior);
          const sec = resolveBobinaIds(p.bobina_secundaria_id, p.bobina_secundaria);

          if (sup.id || sup.codigo) {
            const chapaSup = Number(sup.bobina?.chapa || sup.bobina?.espessura_mm) || 0.43;
            let kgSup = Number(p.kg_superior) || 0;
            if (!kgSup && Number(p.kg_total) > 0) {
              kgSup = inf.id ? (Number(p.kg_total) / 2) : Number(p.kg_total);
            }
            if (!kgSup) kgSup = metragemM * chapaSup;

            addReservaUniversal(p.bobina_superior_id, p.bobina_superior, p.bobina_id, kgSup, metragemM, {
              id: p.id,
              numero_pedido: p.numero_pedido,
              cliente: p.cliente,
              produto: p.produto,
              metros: metragemM,
              kg: kgSup,
              maquina: p.maquina || "Produção",
              status: p.status,
              data: p.data,
              setor: "Telhas"
            });
            if (sup.id) addStatus(sup.id, p.maquina || "Produção", p.status, p.numero_pedido);
          }

          if (sec.id || sec.codigo) {
            const chapaSec = Number(sec.bobina?.chapa || sec.bobina?.espessura_mm) || 0.43;
            const kgSec = Number(p.kg_secundaria) || 0;
            const metrosSec = chapaSec > 0 ? (kgSec / (chapaSec * 7.85 * 1.2)) : 0;
            addReservaUniversal(p.bobina_secundaria_id, p.bobina_secundaria, null, kgSec, metrosSec, {
              id: p.id,
              numero_pedido: p.numero_pedido,
              cliente: p.cliente,
              produto: `${p.produto} (2ª Bobina)`,
              metros: metrosSec,
              kg: kgSec,
              maquina: p.maquina || "Produção",
              status: p.status,
              data: p.data,
              setor: "Telhas"
            });
            if (sec.id) addStatus(sec.id, p.maquina || "Produção", p.status, p.numero_pedido);
          }

          if (inf.id || inf.codigo) {
            const chapaInf = Number(inf.bobina?.chapa || inf.bobina?.espessura_mm) || 0.43;
            let kgInf = Number(p.kg_inferior) || 0;
            if (!kgInf && Number(p.kg_total) > 0) {
              kgInf = Number(p.kg_total) / 2;
            }
            if (!kgInf) kgInf = metragemM * chapaInf;

            addReservaUniversal(p.bobina_inferior_id, p.bobina_inferior, null, kgInf, metragemM, {
              id: p.id,
              numero_pedido: p.numero_pedido,
              cliente: p.cliente,
              produto: `${p.produto} (Inferior)`,
              metros: metragemM,
              kg: kgInf,
              maquina: p.maquina || "Produção",
              status: p.status,
              data: p.data,
              setor: "Telhas"
            });
            if (inf.id) addStatus(inf.id, p.maquina || "Produção", p.status, p.numero_pedido);
          }
        }
      });

      // ── B. CORTE E DOBRA: DESBOBINADEIRA ──────────────────────────────────
      let ordensDesb = [];
      try {
        ordensDesb = await base44.entities.OrdemDesbobinadeira.list("-created_date", 500);
      } catch {
        try {
          ordensDesb = await base44.entities.OrdemDesbobinadeira.filter({}, "-created_date", 500);
        } catch {
          ordensDesb = [];
        }
      }

      const ordensDesbAtivas = ordensDesb.filter(o => !["finalizado", "cancelado"].includes(String(o.status || "").toLowerCase()));

      ordensDesbAtivas.forEach(o => {
        if (!filialMatch(o.unidade)) return;
        const bId = o.bobina_id || o.bobina_superior_id || o.bobina_superior;
        const bCodigo = o.bobina_codigo || o.codigo_bobina;
        const kg = Number(o.kg_estimado || o.peso_kg) || 0;
        const metros = Number(o.comprimento_mm || 0) / 1000 * (Number(o.quantidade) || 1);
        addReservaUniversal(bId, bCodigo, null, kg, metros, {
          id: o.id,
          numero_pedido: o.numero_pedido,
          cliente: o.cliente,
          produto: "Chapa / Corte",
          metros,
          kg,
          maquina: "Desbobinadeira",
          status: o.status,
          data: o.data,
          setor: "Corte & Dobra"
        });
        const res = resolveBobinaIds(bId, bCodigo);
        if (res.id) addStatus(res.id, "Desbobinadeira", o.status, o.numero_pedido);
      });

      // ── C. CORTE E DOBRA: MÁQUINAS COM BOBINA DIRETA (Perfiladeiras C&D) ──
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
        const bCodigo = o.bobina_codigo || o.codigo_bobina;
        if (bId || bCodigo) {
          const kg = Number(o.peso_kg || o.kg_estimado) || 0;
          addReservaUniversal(bId, bCodigo, null, kg, 0, {
            id: o.id,
            numero_pedido: o.numero_pedido,
            cliente: o.cliente,
            produto: o.tipo_peca || "Perfil",
            metros: 0,
            kg,
            maquina: o.maquina || "Máquina CD",
            status: o.status,
            data: o.data,
            setor: "Corte & Dobra"
          });
          const res = resolveBobinaIds(bId, bCodigo);
          if (res.id) addStatus(res.id, o.maquina || "Máquina CD", o.status, o.numero_pedido);
        }
      });

      const totalPreBaixaKg = Object.values(preBaixaMap).reduce((s, kg) => s + kg, 0);
      const totalPreBaixaMetros = Object.values(preBaixaMetrosMap).reduce((s, m) => s + m, 0);
      return { preBaixaMap, preBaixaMetrosMap, preBaixaOpsMap, statusMap, totalPreBaixaKg, totalPreBaixaMetros };
    },
    refetchInterval: 15000,
  });

  const preBaixaMap = data.preBaixaMap || {};
  const preBaixaMetrosMap = data.preBaixaMetrosMap || {};
  const preBaixaOpsMap = data.preBaixaOpsMap || {};

  const getPreBaixa = (bobinaOrId) => {
    if (!bobinaOrId) return { kg: 0, metros: 0, ops: [], disponivelReal: 0, pctComprometido: 0 };
    const id = typeof bobinaOrId === "object" ? bobinaOrId.id : bobinaOrId;
    const cod = typeof bobinaOrId === "object" ? (bobinaOrId.codigo || bobinaOrId.codigo_bobina) : null;
    const pesoTotal = typeof bobinaOrId === "object" ? (Number(bobinaOrId.peso_kg) || 0) : 0;
    const reservaKg = typeof bobinaOrId === "object"
      ? (bobinaOrId.reservada ? (bobinaOrId.reserva_tipo === "parcial" ? (bobinaOrId.reserva_kg || 0) : pesoTotal) : 0)
      : 0;

    const kgId = id ? (preBaixaMap[id] || 0) : 0;
    const kgCod = cod ? (preBaixaMap[cod] || 0) : 0;
    const kg = Math.max(kgId, kgCod);

    const mId = id ? (preBaixaMetrosMap[id] || 0) : 0;
    const mCod = cod ? (preBaixaMetrosMap[cod] || 0) : 0;
    const metros = Math.max(mId, mCod);

    const ops = (id && preBaixaOpsMap[id]) || (cod && preBaixaOpsMap[cod]) || [];
    const disponivelReal = Math.max(0, pesoTotal - reservaKg - kg);

    return {
      kg,
      metros,
      ops,
      disponivelReal,
      pctComprometido: pesoTotal > 0 ? Math.min(100, Math.round(((kg + reservaKg) / pesoTotal) * 100)) : 0
    };
  };

  return {
    preBaixaMap,
    preBaixaMetrosMap,
    preBaixaOpsMap,
    statusMap: data.statusMap || {},
    totalPreBaixaKg: data.totalPreBaixaKg || 0,
    totalPreBaixaMetros: data.totalPreBaixaMetros || 0,
    getPreBaixa,
    isLoading,
  };
}