/**
 * Fila global de requisições ao servidor.
 *
 * O servidor aceita ~140 requisições por minuto por usuário. As telas do PCP e
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

const MAX_CONCORRENTES = 8;
const RESERVA_PRIORITARIA = 2;
const JANELA_MS = 60000;
// Margem de segurança (80 req/min) compartilhada entre abas para nunca estourar os 140 req/min do servidor por usuário
const MAX_POR_JANELA = 80;
const TETO_PRIORITARIO = MAX_POR_JANELA + 20;
const MAX_TENTATIVAS = 3;

let ativos = 0;
let marcas = [];
const fila = [];
const filaPrioritaria = [];
let timerJanela = null;
let proximaPrioritaria = false;

function obterMarcasCompartilhadas() {
  const agora = Date.now();
  if (typeof window === "undefined" || !window.localStorage) {
    marcas = marcas.filter((t) => agora - t < JANELA_MS);
    return marcas;
  }
  try {
    const raw = localStorage.getItem("ajl_rate_limiter_marcas");
    const salvas = raw ? JSON.parse(raw) : [];
    const combinadas = Array.from(new Set([...marcas, ...salvas]))
      .filter((t) => agora - t < JANELA_MS)
      .sort((a, b) => a - b);
    marcas = combinadas;
    return combinadas;
  } catch {
    marcas = marcas.filter((t) => agora - t < JANELA_MS);
    return marcas;
  }
}

function registrarMarcaCompartilhada(novaMarca) {
  marcas.push(novaMarca);
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const agora = Date.now();
      const combinadas = marcas.filter((t) => agora - t < JANELA_MS);
      localStorage.setItem("ajl_rate_limiter_marcas", JSON.stringify(combinadas));
    } catch {}
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
  const marcasAtivas = obterMarcasCompartilhadas();
  if (marcasAtivas.length < teto) return true;
  if (!timerJanela) {
    const espera = Math.max(JANELA_MS - (agora - marcasAtivas[0]) + 30, 200);
    timerJanela = setTimeout(() => {
      timerJanela = null;
      processarFila();
    }, espera);
  }
  return false;
}

function despachar(tarefa) {
  ativos++;
  registrarMarcaCompartilhada(Date.now());
  tarefa();
}

function processarFila() {
  // 1) O que a pessoa está olhando sai primeiro, sem esperar a janela de 1 minuto.
  while (filaPrioritaria.length && ativos < MAX_CONCORRENTES && janelaDisponivel(TETO_PRIORITARIO)) {
    despachar(filaPrioritaria.shift());
  }
  // 2) Trabalho de fundo (estoque, pré-baixa, OPs) respeita a janela e deixa
  //    vagas livres para a tela nunca ficar esperando.
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
      return Math.min(segundos, 8) * 1000;
    }
  }
  // Backoff escalonado rápido: 2s na 1ª tentativa, 4s na 2ª (máximo 6s)
  return Math.min(2000 * Math.pow(2, tentativa - 1), 6000);
}

function ehLimite(erro) {
  if (!erro) return false;
  if (erro.status === 429) return true;
  return /rate limit|too many requests/i.test(String(erro.message || ""));
}

/** Enfileira uma requisição e repete sozinha quando o limite é atingido. */
export function agendarComRetry(executar) {
  const prioridade = proximaPrioritaria;
  const tentar = (tentativa) =>
    agendar(executar, prioridade).catch(async (erro) => {
      if (!ehLimite(erro) || tentativa >= MAX_TENTATIVAS) throw erro;
      await new Promise((r) => setTimeout(r, esperaSugerida(erro, tentativa) + 200));
      return tentar(tentativa + 1);
    });
  return tentar(1);
}