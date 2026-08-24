// Utilitários de SLA (Dias Úteis) para a Central PCP
// Regra: a contagem NUNCA inicia no dia do envio/recebimento;
// inicia obrigatoriamente no próximo dia útil (Segunda a Sexta).

// Mapeia categoria industrial → dias úteis de SLA
// Telhas: 7 | Corte e Dobra / Perfis / Chapas: 5
export function slaDiasPorCategoria(pedido) {
  const hasTelha = (pedido.itens_telha_count || 0) > 0;
  const hasCD = (pedido.itens_cd_count || 0) > 0;
  if (hasTelha) return 7;
  if (hasCD) return 5;
  return 5;
}

// Verifica se uma data é dia útil (seg-sex)
function isDiaUtil(date) {
  const dow = date.getDay();
  return dow !== 0 && dow !== 6;
}

// Calcula a data prometida somando `slaDias` dias úteis a partir de dataRecebimento.
// O primeiro dia útil contado é sempre o próximo dia útil APÓS o recebimento.
export function calcularDataPrometidaSLA(dataRecebimento, slaDias) {
  const start = dataRecebimento ? new Date(dataRecebimento) : new Date();
  const cursor = new Date(start);
  // Avança para o próximo dia (nunca conta o dia do envio)
  cursor.setDate(cursor.getDate() + 1);

  let contados = 0;
  // Loop de segurança
  for (let i = 0; i < 60 && contados < slaDias; i++) {
    if (isDiaUtil(cursor)) {
      contados++;
      if (contados === slaDias) break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  // Zera horário para representar uma "data" limpa
  cursor.setHours(0, 0, 0, 0);
  return cursor;
}

// Formata Date para YYYY-MM-DD (compatível com format:date do schema)
export function toISODate(date) {
  if (!date) return "";
  const d = date instanceof Date ? date : new Date(date);
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 10);
}

// Formata data para exibição BR
export function formatDataBR(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

// Retorna quantos dias úteis restam até a data prometida (negativo = atrasado)
export function diasUteisRestantes(dataPrometida) {
  if (!dataPrometida) return 0;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(dataPrometida);
  alvo.setHours(0, 0, 0, 0);
  if (alvo < hoje) {
    // calcula dias úteis de atraso
    let dias = 0;
    const c = new Date(alvo);
    while (c < hoje) {
      if (isDiaUtil(c)) dias--;
      c.setDate(c.getDate() + 1);
    }
    return dias;
  }
  let dias = 0;
  const c = new Date(hoje);
  while (c < alvo) {
    c.setDate(c.getDate() + 1);
    if (isDiaUtil(c)) dias++;
  }
  return dias;
}