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

/**
 * 🛡️ BLINDAGEM GLOBAL DO SCHEMA:
 * O Base44 possui validação estrita (Pydantic V2) nos campos numéricos como `prioridade_nivel`.
 * Se qualquer chamada enviar string (ex: "ROTA", "RETIRA_AGORA", "NORMAL", "") ou null indevido,
 * o backend rejeita com "Error in field prioridade_nivel: Input should be a valid number, unable to parse string as a number".
 * Esta sanitização intercepta e trata automaticamente qualquer gravação de entidade.
 */
function sanitizarPayloadBase44(obj) {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    obj.forEach(item => sanitizarPayloadBase44(item));
    return obj;
  }
  if ("prioridade_nivel" in obj) {
    const val = obj.prioridade_nivel;
    if (typeof val === "number" && !isNaN(val)) {
      obj.prioridade_nivel = Math.max(1, Math.min(5, Math.round(val)));
    } else if (typeof val === "string") {
      const parsed = parseInt(val, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= 5) {
        obj.prioridade_nivel = parsed;
      } else {
        const up = val.toUpperCase().trim();
        if (up === "RETIRA_AGORA" || up.includes("RETIRA")) obj.prioridade_nivel = 1;
        else if (up === "ROTA" || up.includes("ROTA")) obj.prioridade_nivel = 2;
        else if (up === "PRIORIDADE" || up.includes("URGENTE")) obj.prioridade_nivel = 2;
        else {
          delete obj.prioridade_nivel;
        }
      }
    } else {
      delete obj.prioridade_nivel;
    }
  }
  return obj;
}

function envolverEntidade(handler) {
  return new Proxy(handler, {
    get(alvo, metodo) {
      const valor = alvo[metodo];
      if (typeof valor !== "function") return valor;
      if (FORA_DA_FILA.has(metodo)) return valor.bind(alvo);
      // Toda leitura/gravação entra na fila global, que evita o erro 429
      // e repete automaticamente se o servidor ainda pedir para aguardar.
      // Mutações (ações diretas do usuário) têm PRIORIDADE MÁXIMA (0ms de espera).
      return (...args) => {
        const isMutacao = ["create", "update", "delete", "updateMany"].includes(metodo);
        if (metodo === "update" && args[1]) {
          sanitizarPayloadBase44(args[1]);
        } else if (metodo === "create" && args[0]) {
          sanitizarPayloadBase44(args[0]);
        } else if (metodo === "updateMany" && args[1]) {
          sanitizarPayloadBase44(args[1]);
        }
        return agendarComRetry(() => valor.apply(alvo, args), isMutacao);
      };
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