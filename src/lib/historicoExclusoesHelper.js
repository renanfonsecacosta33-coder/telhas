import { base44 } from "@/api/base44Client";

const STORAGE_KEY = "ajl_historico_exclusoes_pcp_v1";

/**
 * Registra formalmente a exclusão de pedidos/OFs na Central PCP
 * com data/hora, operador responsável, motivo obrigatório e estágio na fábrica.
 */
export async function registrarHistoricoExclusao({
  pedidos = [],
  motivo = "",
  usuario = "Gestor PCP",
  todayIso = new Date().toISOString().slice(0, 10),
}) {
  if (!pedidos || pedidos.length === 0) return [];

  const timestamp = new Date().toISOString();
  const registros = pedidos.map((p) => {
    // Detecta o estágio atual em que a ordem se encontrava
    const estagio = (() => {
      if (p.status_pcp === "em_producao" || p.status === "em_producao") return "Em Produção no Galpão";
      if (p.status_pcp === "aguardando_colagem" || p.status === "aguardando_colagem") return "Aguardando Colagem";
      if (p.status_pcp === "pausado" || p.status === "pausado") return "Pausado na Máquina";
      if (p.status_pcp === "concluido" || p.percentual_concluido >= 100) return "Concluído";
      if (p.status_pcp === "distribuido") return "Distribuído na Fila";
      return "Pendente PCP";
    })();

    // Resumo dos itens
    const itensDesc = (() => {
      try {
        const itens = typeof p.itens_json === "string" ? JSON.parse(p.itens_json || "[]") : (p.itens || []);
        if (Array.isArray(itens) && itens.length > 0) {
          return itens.map(i => `${i.quantidade || 1}x ${i.produto || "Telha"}`).join(", ");
        }
      } catch {}
      return p.produto || "Telhas";
    })();

    return {
      id: `EXC_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      pedido_id: p.id,
      numero_pedido: p.numero_pedido || p.pedido_numero || "S/N",
      of_odoo_id: p.of_odoo_id || "",
      of_nome: p.of_nome || "",
      cliente_nome: p.cliente_nome || p.cliente || "Cliente não informado",
      vendedor_nome: p.vendedor_nome || p.vendedor || "—",
      unidade: p.unidade || "Matriz AJL",
      maquina: p.maquina || p.maquina_destino || "Geral",
      motivo: motivo.trim() || "Cancelamento via Central PCP",
      usuario: usuario || "Gestor PCP",
      data_exclusao: timestamp,
      data_iso: todayIso,
      estagio_no_cancelamento: estagio,
      itens_resumo: itensDesc,
      percentual_concluido: p.percentual_concluido || 0,
    };
  });

  // 1. Salva no localStorage (persistência imediata e auditável no navegador)
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const atual = raw ? JSON.parse(raw) : [];
    const novoHistorico = [...registros, ...atual].slice(0, 500); // mantém últimos 500
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novoHistorico));
  } catch (err) {
    console.warn("[HistoricoExclusao] Erro ao salvar local:", err);
  }

  // 2. Se a entidade Auditoria existir no Base44, salva remotamente
  try {
    if (base44?.entities?.Auditoria?.create) {
      for (const reg of registros) {
        await base44.entities.Auditoria.create({
          tipo: "exclusao_pedido_pcp",
          acao: "Exclusão / Cancelamento de OS",
          descricao: `Pedido #${reg.numero_pedido} excluído por ${reg.usuario}. Motivo: ${reg.motivo}`,
          detalhes_json: JSON.stringify(reg),
          usuario: reg.usuario,
          data: todayIso,
          created_date: timestamp,
        }).catch(() => {});
      }
    }
  } catch {}

  return registros;
}

/**
 * Retorna todo o histórico de exclusões para consulta do gestor
 */
export function obterHistoricoExclusoes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return arr;
    }
  } catch {}
  return [];
}
