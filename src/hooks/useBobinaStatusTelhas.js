import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useMemo } from "react";

/**
 * Calcula o status automático de uma bobina do setor telhas.
 *
 * Regras (por ordem de prioridade):
 * 1. Se reservada → "RESERVADA"
 * 2. Se em produção numa máquina → "Na [MÁQUINA]"
 * 3. Se KG cheio (100% do inicial) → "Fechada"
 * 4. Se KG parcial (já consumiu) → "Aberta"
 * 5. Se arquivada → "Finalizada"
 *
 * @param {Object} bobina - A bobina do estoque
 * @param {Object} maquinaEmUso - { maquina: "TP - 40", status: "em_producao" } ou null
 * @returns {string} status calculado
 */
export function calcStatusBobina(bobina, maquinaEmUso) {
  if (!bobina) return "Aberta";

  // 1. Reservada tem prioridade
  if (bobina.reservada) return "RESERVADA";

  // 2. Em produção numa máquina
  if (maquinaEmUso && maquinaEmUso.maquina) {
    const maq = maquinaEmUso.maquina;
    // Normaliza nome da máquina para exibição
    const maqMap = {
      "TP - 25": "TP25",
      "TP - 40": "TP40",
      "ONDULADA": "ONDULADA",
      "COLONIAL": "COLONIAL",
      "BANDEJA": "BANDEJA",
      "DESBOBINADOR": "DESBOBINADOR",
      "CUMEEIRA": "CUMEEIRA",
      "COLAGEM": "COLAGEM",
    };
    const nome = maqMap[maq] || maq;
    return `Na ${nome}`;
  }

  // 3 e 4. Baseado no peso
  const peso = Number(bobina.peso_kg) || 0;
  const inicial = Number(bobina.peso_inicial) || peso;

  if (bobina.arquivada || peso <= 0) return "Finalizada";

  if (inicial > 0) {
    const pct = peso / inicial;
    if (pct >= 0.99) return "Fechada";
    return "Aberta";
  }

  return bobina.status || "Aberta";
}

/**
 * Hook que busca pedidos em produção e mapeia bobina_id → { maquina, status }.
 * Usado para saber em qual máquina cada bobina está rodando.
 */
export function useBobinaStatusTelhas(filialAtiva) {
  const { data: pedidosAtivos = [] } = useQuery({
    queryKey: ["pedidos-ativos-bobina-status", filialAtiva],
    queryFn: () =>
      base44.entities.Pedido.filter({
        unidade: filialAtiva,
      }, "-updated_date", 300),
    refetchInterval: 8000,
  });

  // Mapa: bobina_id → { maquina, status_pedido }
  const maquinaPorBobina = useMemo(() => {
    const map = {};
    for (const p of pedidosAtivos) {
      // Só considera pedidos que estão em produção ou aguardando colagem
      // (a bobina ainda está na máquina)
      if (p.status !== "em_producao" && p.status !== "aguardando_colagem") continue;

      // Bobina superior
      if (p.bobina_superior_id) {
        map[p.bobina_superior_id] = { maquina: p.maquina, status: p.status };
      }
      // Bobina inferior
      if (p.bobina_inferior_id) {
        map[p.bobina_inferior_id] = { maquina: p.maquina, status: p.status };
      }
      // Variações — cada variação pode ter sua própria bobina
      if (p.variacoes_telhas) {
        try {
          const vars = JSON.parse(p.variacoes_telhas);
          if (Array.isArray(vars)) {
            for (const v of vars) {
              if (v.bobina_id) map[v.bobina_id] = { maquina: p.maquina, status: p.status };
              if (v.bobina_inf_id) map[v.bobina_inf_id] = { maquina: p.maquina, status: p.status };
            }
          }
        } catch {}
      }
    }
    return map;
  }, [pedidosAtivos]);

  // Função que retorna o status calculado de uma bobina
  const getStatus = (bobina) => {
    if (!bobina) return "Aberta";
    const emUso = maquinaPorBobina[bobina.id] || null;
    return calcStatusBobina(bobina, emUso);
  };

  return { getStatus, maquinaPorBobina };
}