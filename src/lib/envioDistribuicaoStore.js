/**
 * Store leve (pub/sub em módulo) do status de ENVIO/DISTRIBUIÇÃO de OFs da Central PCP.
 * Registra quando o envio para as máquinas começou e terminou, permitindo que
 * qualquer card mostre o progresso animado e "há quanto tempo foi enviado"
 * sem precisar de prop drilling pelos vários níveis de componentes.
 */

// Id especial para o progresso agregado da distribuição em LOTE (botões do cabeçalho)
export const ID_LOTE_ENVIO = "__lote__";

const envios = new Map(); // pedidoId -> { inicioTs, fimTs }
const listeners = new Map(); // pedidoId -> Set<callback>

function notify(id) {
  const set = listeners.get(id);
  if (set) set.forEach((fn) => fn());
}

export function iniciarEnvio(ids) {
  for (const id of ids) {
    if (!id) continue;
    envios.set(id, { inicioTs: Date.now(), fimTs: null });
    notify(id);
  }
}

export function concluirEnvio(ids) {
  for (const id of ids) {
    if (!id) continue;
    const atual = envios.get(id);
    envios.set(id, { inicioTs: atual?.inicioTs || Date.now(), fimTs: Date.now() });
    notify(id);
  }
}

export function cancelarEnvio(ids) {
  for (const id of ids) {
    if (!id) continue;
    envios.delete(id);
    notify(id);
  }
}

export function getEnvio(id) {
  return envios.get(id) || null;
}

export function subscribeEnvio(id, cb) {
  if (!listeners.has(id)) listeners.set(id, new Set());
  const set = listeners.get(id);
  set.add(cb);
  return () => {
    set.delete(cb);
    if (set.size === 0) listeners.delete(id);
  };
}