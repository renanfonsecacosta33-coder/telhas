import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

/**
 * Exporta as bobinas cadastradas no Base44 em formato CSV compatível com Excel e importador do Odoo.
 * Usa delimitador ';' e BOM UTF-8 (\uFEFF) para abrir perfeitamente no Excel do Brasil.
 *
 * @param {Object} options
 * @param {"todos" | "telhas" | "corte_dobra"} [options.setor="todos"] - Filtrar por setor ou exportar tudo
 * @param {boolean} [options.apenasAtivas=false] - Se true, ignora bobinas arquivadas
 * @param {string} [options.filial="todas"] - Filtrar por filial ou exportar todas
 */
export async function exportarPlanilhaBobinasOdoo({ setor = "todos", apenasAtivas = false, filial = "todas" } = {}) {
  // 1. Busca bobinas
  let filtro = {};
  if (setor && setor !== "todos") {
    filtro.setor = setor;
  }
  if (filial && filial !== "todas") {
    filtro.unidade = filial;
  }

  const lista = await base44.entities.Bobina.filter(filtro, "codigo", 3000);

  const bobinasFiltradas = apenasAtivas ? lista.filter(b => !b.arquivada) : lista;

  if (!bobinasFiltradas || bobinasFiltradas.length === 0) {
    throw new Error("Nenhuma bobina encontrada para exportar.");
  }

  // 2. Colunas padronizadas para o Odoo / Estoque
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

  // 3. Monta o Blob com BOM UTF-8 (\uFEFF) para garantir caracteres acentuados no Excel do Windows
  const csvContent = "\uFEFF" + linhas.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  
  const dataHoje = format(new Date(), "dd-MM-yyyy");
  const sufixoSetor = setor === "todos" ? "todas_as_bobinas" : setor;
  a.download = `bobinas_ajl_${sufixoSetor}_${dataHoje}.csv`;
  
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return { total: bobinasFiltradas.length };
}
