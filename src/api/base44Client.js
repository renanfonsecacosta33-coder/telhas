import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';
import { agendarComRetry } from '@/lib/rateLimiter';

const { appId, token, functionsVersion, appBaseUrl } = appParams;

//Create a client with authentication required
const clienteBase44 = createClient({
  appId,
  token,
  functionsVersion,
  serverUrl: '',
  requiresAuth: false,
  appBaseUrl
});

// Operações que não passam pela fila (o subscribe é um canal em tempo real,
// não uma requisição HTTP).
const FORA_DA_FILA = new Set(["subscribe"]);

const cacheEntidades = new Map();

function envolverEntidade(handler) {
  return new Proxy(handler, {
    get(alvo, metodo) {
      const valor = alvo[metodo];
      if (typeof valor !== "function") return valor;
      if (FORA_DA_FILA.has(metodo)) return valor.bind(alvo);
      // Toda leitura/gravação entra na fila global, que evita o erro 429
      // e repete automaticamente se o servidor ainda pedir para aguardar.
      return (...args) => agendarComRetry(() => valor.apply(alvo, args));
    },
  });
}

const entidades = new Proxy(clienteBase44.entities, {
  get(alvo, nomeEntidade) {
    const handler = alvo[nomeEntidade];
    if (!handler || typeof handler !== "object") return handler;
    if (!cacheEntidades.has(nomeEntidade)) cacheEntidades.set(nomeEntidade, envolverEntidade(handler));
    return cacheEntidades.get(nomeEntidade);
  },
});

export const base44 = new Proxy(clienteBase44, {
  get(alvo, prop) {
    if (prop === "entities") return entidades;
    const valor = Reflect.get(alvo, prop, alvo);
    return typeof valor === "function" ? valor.bind(alvo) : valor;
  },
});