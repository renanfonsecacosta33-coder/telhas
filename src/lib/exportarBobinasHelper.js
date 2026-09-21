import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

/**
 * Exporta as bobinas cadastradas no Base44 em formato CSV compatível com Excel e importador do Odoo.
 * Usa delimitador ';' e BOM UTF-8 (\uFEFF) para abrir perfeitamente no Excel do Brasil.
 *
 * @param {Object} options
 * @param {"todos" | "telhas" | "corte_dobra"} [options.setor="todos"] - Filtrar por setor ou exportar tudo
 * @param {"todas" | "ativas" | "arquivadas"} [options.status="todas"] - Filtrar por status das bobinas
 * @param {boolean} [options.apenasAtivas=false] - Retrocompatibilidade (se true, status="ativas")
 * @param {string} [options.filial="todas"] - Filtrar por filial ou exportar todas
 * @param {Array} [options.dadosPrecarregados=null] - Lista de bobinas já carregadas na memória (opcional)
 */
export async function exportarPlanilhaBobinasOdoo({
  setor = "todos",
  status = "todas",
  apenasAtivas = false,
  filial = "todas",
  dadosPrecarregados = null
} = {}) {
  let statusFinal = status;
  if (apenasAtivas && status === "todas") {
    statusFinal = "ativas";
  }

  let lista = dadosPrecarregados;

  // 1. Se não recebeu dados já em memória, busca no Base44
  if (!lista || !Array.isArray(lista)) {
    let filtro = {};
    if (setor && setor !== "todos") {
      filtro.setor = setor;
    }
    if (filial && filial !== "todas") {
      filtro.unidade = filial;
    }
    lista = await base44.entities.Bobina.filter(filtro, "codigo", 4000);
  }

  // 2. Aplica filtros na lista
  let bobinasFiltradas = lista || [];

  // Filtro de setor (caso tenha vindo de dadosPrecarregados gerais)
  if (setor && setor !== "todos") {
    bobinasFiltradas = bobinasFiltradas.filter(b => b.setor === setor);
  }

  // Filtro de filial
  if (filial && filial !== "todas") {
    bobinasFiltradas = bobinasFiltradas.filter(b => (b.unidade || "Matriz AJL") === filial);
  }

  // Filtro de status (ativas vs arquivadas)
  if (statusFinal === "ativas") {
    bobinasFiltradas = bobinasFiltradas.filter(b => !b.arquivada);
  } else if (statusFinal === "arquivadas") {
    bobinasFiltradas = bobinasFiltradas.filter(b => b.arquivada);
  }

  if (!bobinasFiltradas || bobinasFiltradas.length === 0) {
    throw new Error("Nenhuma bobina encontrada com os filtros selecionados para exportação.");
  }

  // 3. Colunas padronizadas para o Odoo / Estoque
  const cabecalho = [
    "ID Base44",
    "Código da Bobina",
    "Setor",
    "Unidade / Filial",
    "Qualidade (Aço)",
    "Origem",
    "Cor / RVM",
    "Espessura Nominal (Chapa)",
    "Espessura Real (NF)",
    "Espessuras Permitidas",
    "Largura (mm)",
    "Peso Atual (kg)",
    "Peso Inicial (kg)",
    "Metragem Restante (m)",
    "Metragem Total (m)",
    "Nota Fiscal",
    "Fornecedor",
    "Status",
    "Arquivada (Acabou)",
    "Data Encerramento",
    "Data Recebimento",
    "Custo (R$/kg)",
    "Custo Total (R$)",
    "Reservada",
    "Reserva Tipo",
    "Reserva kg",
    "Reserva Pedido",
    "Observações"
  ];

  const escapeCSV = (val) => {
    if (val === null || val === undefined) return "";
    let str = String(val).trim();
    if (str.includes(";") || str.includes("\n") || str.includes("\"") || str.includes("\r")) {
      str = `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const formatNumero = (num) => {
    if (num === null || num === undefined || isNaN(num)) return "";
    return String(num).replace(".", ",");
  };

  const linhas = [cabecalho.join(";")];

  for (const b of bobinasFiltradas) {
    const linha = [
      escapeCSV(b.id),
      escapeCSV(b.codigo),
      escapeCSV(b.setor === "telhas" ? "Fábrica de Telhas" : (b.setor === "corte_dobra" ? "Corte & Dobra" : b.setor || "")),
      escapeCSV(b.unidade || "Matriz AJL"),
      escapeCSV(b.qualidade || ""),
      escapeCSV(b.origem || "Nacional"),
      escapeCSV(b.cor || ""),
      escapeCSV(b.chapa || ""),
      escapeCSV(b.espessura_real || ""),
      escapeCSV(b.espessura_utilizada || ""),
      formatNumero(b.largura_mm),
      formatNumero(b.peso_kg),
      formatNumero(b.peso_inicial),
      formatNumero(b.metragem_restante),
      formatNumero(b.metragem),
      escapeCSV(b.nf || ""),
      escapeCSV(b.fornecedor || ""),
      escapeCSV(b.status || ""),
      b.arquivada ? "Sim" : "Não",
      escapeCSV(b.data_encerramento || ""),
      escapeCSV(b.data_recebimento || ""),
      formatNumero(b.custo),
      formatNumero(b.custo_total),
      b.reservada ? "Sim" : "Não",
      escapeCSV(b.reserva_tipo || ""),
      formatNumero(b.reserva_kg),
      escapeCSV(b.reserva_numero_pedido || ""),
      escapeCSV(b.observacoes || "")
    ];
    linhas.push(linha.join(";"));
  }

  // 4. Monta o Blob com BOM UTF-8 (\uFEFF) para garantir caracteres acentuados no Excel do Windows
  const csvContent = "\uFEFF" + linhas.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  
  const dataHoje = format(new Date(), "dd-MM-yyyy");
  const descSetor = setor === "todos" ? "ambos_setores" : (setor === "telhas" ? "telhas" : "corte_dobra");
  const descStatus = statusFinal === "ativas" ? "ativas" : (statusFinal === "arquivadas" ? "arquivadas" : "todas");
  const nomeArquivo = `bobinas_ajl_${descSetor}_${descStatus}_${dataHoje}.csv`;
  
  a.download = nomeArquivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { total: bobinasFiltradas.length, nomeArquivo };
}
