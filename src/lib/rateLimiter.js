/**
 * Fila global de requisições ao servidor.
 *
 * O servidor aceita 70 requisições de listagem por minuto por usuário. As telas do PCP e
 * dos painéis abrem várias listagens ao mesmo tempo (fila, OPs das máquinas,
 * bobinas, chapas, estoque), e uma rajada estourava o limite (erro 429:
 * "Rate limit exceeded: entity_list ...").
 *
 * Aqui as requisições passam por:
 *  - limite de concorrência (não abre 30 chamadas de uma vez);
 *  - teto por minuto, com folga abaixo do limite do servidor;
 *  - repetição automática quando o servidor mesmo assim responde 429,
 *    respeitando o tempo de espera informado por ele.
 */

const MAX_CONCORRENTES = 10;
const RESERVA_PRIORITARIA = 3;
const JANELA_MS = 60000;
// Teto abaixo do limite do servidor (70/min) para nunca chegar no 429
const MAX_POR_JANELA = 58;
// A tela do usuário pode ir um pouco além do fundo, mas também tem teto
const MAX_PRIORITARIA = 66;
const MAX_TENTATIVAS = 3;

let ativos = 0;
let marcas = [];
const fila = [];
const filaPrioritaria = [];
let timerJanela = null;
let proximaPrioritaria = false;
let syncStorageTimer = null;

// Inicializa marcas da memória uma única vez
if (typeof window !== "undefined" && window.localStorage) {
  try {
    const raw = localStorage.getItem("ajl_rate_limiter_marcas");
    if (raw) {
      const agora = Date.now();
      marcas = JSON.parse(raw).filter((t) => agora - t < JANELA_MS);
    }
  } catch {}

  // Sincroniza apenas quando outra aba altera, de forma passiva
  window.addEventListener("storage", (e) => {
    if (e.key === "ajl_rate_limiter_marcas" && e.newValue) {
      try {
        const agora = Date.now();
        const recebidas = JSON.parse(e.newValue).filter((t) => agora - t < JANELA_MS);
        marcas = Array.from(new Set([...marcas, ...recebidas])).sort((a, b) => a - b);
      } catch {}
    }
  });
}

function registrarMarcaEmMemoria(novaMarca) {
  marcas.push(novaMarca);
  const agora = Date.now();
  if (marcas.length > 200) {
    marcas = marcas.filter((t) => agora - t < JANELA_MS);
  }

  // Gravação no localStorage 100% assíncrona e debounced (não trava o clique)
  if (typeof window !== "undefined" && window.localStorage && !syncStorageTimer) {
    syncStorageTimer = setTimeout(() => {
      syncStorageTimer = null;
      try {
        const ativas = marcas.filter((t) => Date.now() - t < JANELA_MS);
        localStorage.setItem("ajl_rate_limiter_marcas", JSON.stringify(ativas));
      } catch {}
    }, 1000);
  }
}

/** Consultas da tela do usuário (lista visível, contadores) furam a fila. */
export function comPrioridade(fn) {
  proximaPrioritaria = true;
  try {
    return fn();
  } finally {
    proximaPrioritaria = false;
  }
}

function janelaDisponivel(teto) {
  const agora = Date.now();
  marcas = marcas.filter((t) => agora - t < JANELA_MS);
  if (marcas.length < teto) return true;
  if (!timerJanela) {
    const espera = Math.max(JANELA_MS - (agora - marcas[0]) + 30, 200);
    timerJanela = setTimeout(() => {
      timerJanela = null;
      processarFila();
    }, espera);
  }
  return false;
}

function despachar(tarefa) {
  ativos++;
  registrarMarcaEmMemoria(Date.now());
  tarefa();
}

function processarFila() {
  // 1) VIA EXPRESSA (CLIQUES E MUTAÇÕES DO USUÁRIO):
  // Despacha instantaneamente com prioridade máxima (0ms de espera) sem esperar janela de background!
  while (filaPrioritaria.length && ativos < MAX_CONCORRENTES && janelaDisponivel(MAX_PRIORITARIA)) {
    despachar(filaPrioritaria.shift());
  }

  // 2) Trabalho de fundo (polling passivo, estoque, pré-baixa):
  // Respeita o teto de requisições por minuto deixando vagas livres para a tela nunca travar.
  const limiteFundo = filaPrioritaria.length ? MAX_CONCORRENTES - RESERVA_PRIORITARIA : MAX_CONCORRENTES;
  while (fila.length && ativos < limiteFundo && janelaDisponivel(MAX_POR_JANELA)) {
    despachar(fila.shift());
  }
}

/** Enfileira uma requisição e resolve com o resultado dela. */
export function agendar(executar, prioridade = false) {
  return new Promise((resolve, reject) => {
    const tarefa = async () => {
      try {
        resolve(await executar());
      } catch (e) {
        reject(e);
      } finally {
        ativos--;
        processarFila();
      }
    };
    if (prioridade) filaPrioritaria.push(tarefa);
    else fila.push(tarefa);
    processarFila();
  });
}

/** Extrai os segundos de espera com escalonamento rápido inteligente em vez de congelar 20s */
function esperaSugerida(erro, tentativa = 1) {
  const texto = `${erro?.message || ""} ${erro?.data?.message || ""} ${erro?.data?.error?.message || ""}`;
  const achado = texto.match(/retry after\s+([\d.,]+)\s*s/i);
  if (achado) {
    const segundos = Number(achado[1].replace(",", "."));
    if (Number.isFinite(segundos) && segundos > 0) {
      return Math.min(segundos, 6) * 1000;
    }
  }
  // Backoff escalonado rápido: 1s na 1ª tentativa, 2s na 2ª
  return Math.min(1000 * Math.pow(2, tentativa - 1), 4000);
}

function ehLimite(erro) {
  if (!erro) return false;
  if (erro.status === 429) return true;
  return /rate limit|too many requests/i.test(String(erro.message || ""));
}

/** Enfileira uma requisição e repete sozinha quando o limite é atingido. */
export function agendarComRetry(executar, prioridadeForcada = false) {
  const prioridade = prioridadeForcada || proximaPrioritaria;
  const tentar = (tentativa) =>
    agendar(executar, prioridade).catch(async (erro) => {
      if (!ehLimite(erro) || tentativa >= MAX_TENTATIVAS) throw erro;
      await new Promise((r) => setTimeout(r, esperaSugerida(erro, tentativa) + 100));
      return tentar(tentativa + 1);
    });
  return tentar(1);
}