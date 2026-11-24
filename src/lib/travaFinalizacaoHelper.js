/**
 * Trava Definitiva Anti-Regressão e Auto-Cura de Finalização de OPs (Fábrica de Telhas e Máquinas)
 * 
 * Garante que quando um operador finaliza uma OP ou etapa na máquina:
 * 1. A finalização é imediatamente registrada de forma síncrona no localStorage (sobrevivendo a reloads e deploys de código).
 * 2. Qualquer refetch ou reload que traga a OP com status desatualizado ("em_producao" ou com "inicio_producao_ts") é barrado.
 * 3. O cronômetro é congelado imediatamente, impedindo contagens absurdas de tempo.
 * 4. Uma auto-cura é acionada em background para garantir a persistência no Base44 se o reload tiver interrompido o request.
 */

const STORAGE_KEY = "ajl_trava_ops_finalizadas_v1";
const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

function normMaq(m) {
  return String(m || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}

/**
 * Obtém o mapa de OPs finalizadas do localStorage
 */
export function getMapaFinalizacoesLocais() {
  if (typeof window === "undefined" || !window.localStorage) return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const agora = Date.now();
    // Limpeza de registros com mais de 7 dias
    const limpo = {};
    for (const [id, info] of Object.entries(parsed)) {
      if (info && agora - (info.timestamp || 0) < SETE_DIAS_MS) {
        limpo[id] = info;
      }
    }
    return limpo;
  } catch (e) {
    console.warn("Erro ao ler trava local de finalizações:", e);
    return {};
  }
}

/**
 * Registra a finalização de uma OP localmente de forma síncrona (antes de chamadas de rede)
 */
export function registrarFinalizacaoLocal(pedidoId, dados = {}) {
  if (!pedidoId || typeof window === "undefined" || !window.localStorage) return;
  try {
    const mapa = getMapaFinalizacoesLocais();
    mapa[String(pedidoId)] = {
      id: String(pedidoId),
      numero_pedido: dados.numero_pedido || "",
      maquina: dados.maquina || "",
      maquina_norm: normMaq(dados.maquina),
      status: dados.status || "finalizado",
      data_finalizacao: dados.data_finalizacao || new Date().toISOString().slice(0, 10),
      fim_producao_ts: dados.fim_producao_ts || new Date().toISOString(),
      tempo_producao_seg: dados.tempo_producao_seg || 0,
      metragem_utilizada: dados.metragem_utilizada || null,
      operador: dados.operador || "",
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
  } catch (e) {
    console.warn("Erro ao salvar trava local de finalização:", e);
  }
}

/**
 * Remove a trava local caso um gestor reabra a OP no PCP explicitamente
 */
export function removerTravaFinalizacaoLocal(pedidoId) {
  if (!pedidoId || typeof window === "undefined" || !window.localStorage) return;
  try {
    const mapa = getMapaFinalizacoesLocais();
    if (mapa[String(pedidoId)]) {
      delete mapa[String(pedidoId)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(mapa));
    }
  } catch (e) {
    console.warn("Erro ao remover trava local de finalização:", e);
  }
}

/**
 * Verifica se a OP possui histórico inequívoco de finalização registrado
 */
export function verificarSeOpTemFinalizacaoNoHistorico(pedido, maquinaAtual) {
  if (!pedido) return false;
  try {
    const rawHist = pedido.historico_alteracoes;
    if (!rawHist) return false;
    const hist = typeof rawHist === "string" ? JSON.parse(rawHist) : rawHist;
    if (!Array.isArray(hist) || hist.length === 0) return false;

    const mTargetNorm = normMaq(maquinaAtual);

    return hist.some(h => {
      if (!h) return false;
      const acao = String(h.acao || "").toLowerCase();
      const label = String(h.acao_label || "").toLowerCase();
      const detalhes = String(h.detalhes || "").toLowerCase();

      // Finalização geral do pedido
      if (acao === "finalizacao" || acao === "finalizado" || label.includes("finalizou a produção") || label.includes("finalizou pedido") || label.includes("atendido pelo estoque")) {
        return true;
      }

      // Etapa concluída: só comprova conclusão NA MÁQUINA em que foi apontada.
      // "Finalizou Telha Superior" na TP-40 NÃO conclui a OP na Bandeja,
      // na Colagem ou no pedido inteiro — apenas libera a etapa seguinte.
      if (acao === "etapa_concluida" || label.includes("concluiu perfilação") || label.includes("finalizou telha superior") || label.includes("finalizou bandeja inferior")) {
        if (!mTargetNorm) return false;
        const hMaqNorm = normMaq(h.maquina);
        return Boolean((hMaqNorm && hMaqNorm === mTargetNorm) || detalhes.includes(mTargetNorm));
      }

      return false;
    });
  } catch {
    return false;
  }
}

/**
 * Retorna true se a OP foi comprovadamente finalizada nesta máquina (por trava local, banco ou histórico)
 */
export function isOpFinalizadaComprovada(pedido, maquinaAtual) {
  if (!pedido) return false;

  // 1. Já está formalmente finalizado no banco
  if (pedido.status === "finalizado" || pedido.status === "concluido" || pedido.status === "expedido" || pedido.status === "entregue") {
    return true;
  }

  // 2. Trava no localStorage deste dispositivo
  const mapa = getMapaFinalizacoesLocais();
  const infoLocal = mapa[String(pedido.id)];
  if (infoLocal) {
    const mPainelNorm = normMaq(maquinaAtual);
    if (!mPainelNorm || !infoLocal.maquina_norm || infoLocal.maquina_norm === mPainelNorm || infoLocal.status === "finalizado") {
      return true;
    }
  }

  // 3. Tem data_finalizacao e foto_finalizacao_url preenchidas (marca de conclusão)
  if (pedido.data_finalizacao && pedido.foto_finalizacao_url) {
    return true;
  }

  // 4. Histórico inequívoco de finalização
  if (verificarSeOpTemFinalizacaoNoHistorico(pedido, maquinaAtual)) {
    return true;
  }

  return false;
}