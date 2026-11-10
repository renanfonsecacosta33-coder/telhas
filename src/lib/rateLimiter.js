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

const MAX_CONCORRENTES = 6;
const JANELA_MS = 60000;
const MAX_POR_JANELA = 95;
const MAX_TENTATIVAS = 3;

let ativos = 0;
let marcas = [];
const fila = [];
let timerJanela = null;

function processarFila() {
  while (fila.length && ativos < MAX_CONCORRENTES) {
    const agora = Date.now();
    marcas = marcas.filter((t) => agora - t < JANELA_MS);
    if (marcas.length >= MAX_POR_JANELA) {
      if (!timerJanela) {
        const espera = Math.max(JANELA_MS - (agora - marcas[0]) + 30, 200);
        timerJanela = setTimeout(() => {
          timerJanela = null;
          processarFila();
        }, espera);
      }
      return;
    }
    const tarefa = fila.shift();
    ativos++;
    marcas.push(agora);
    tarefa();
  }
}

/** Enfileira uma requisição e resolve com o resultado dela. */
export function agendar(executar) {
  return new Promise((resolve, reject) => {
    fila.push(async () => {
      try {
        resolve(await executar());
      } catch (e) {
        reject(e);
      } finally {
        ativos--;
        processarFila();
      }
    });
    processarFila();
  });
}

/** Extrai os segundos de espera de uma resposta 429 do servidor. */
function esperaSugerida(erro) {
  const texto = `${erro?.message || ""} ${erro?.data?.message || ""} ${erro?.data?.error?.message || ""}`;
  const achado = texto.match(/retry after\s+([\d.,]+)\s*s/i);
  const segundos = achado ? Number(achado[1].replace(",", ".")) : 20;
  return Math.min(Math.max(Number.isFinite(segundos) ? segundos : 20, 1), 60) * 1000;
}

function ehLimite(erro) {
  if (!erro) return false;
  if (erro.status === 429) return true;
  return /rate limit|too many requests/i.test(String(erro.message || ""));
}

/** Enfileira uma requisição e repete sozinha quando o limite é atingido. */
export function agendarComRetry(executar) {
  const tentar = (tentativa) =>
    agendar(executar).catch(async (erro) => {
      if (!ehLimite(erro) || tentativa >= MAX_TENTATIVAS) throw erro;
      await new Promise((r) => setTimeout(r, esperaSugerida(erro) + 250));
      return tentar(tentativa + 1);
    });
  return tentar(1);
}