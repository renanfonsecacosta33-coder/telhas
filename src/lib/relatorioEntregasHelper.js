import { format, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { classGrupo, getItens } from "@/lib/pedidoOdooHelper";

/**
 * Retorna texto amigável e badge de tempo relativo para pedidos entregues
 * Ex: "Entregue hoje às 15:30", "Entregue ontem", "Entregue há 3 dias"
 */
export function formatarTempoEntregaRelativo(dataEntregaStr) {
  if (!dataEntregaStr) {
    return {
      texto: "Entregue",
      dias: 0,
      dataFormatada: "—",
      horaFormatada: "—",
      badgeCls: "bg-sky-600 text-white border-sky-700"
    };
  }

  try {
    const dataEntrega = new Date(dataEntregaStr);
    if (isNaN(dataEntrega.getTime())) {
      return {
        texto: "Entregue",
        dias: 0,
        dataFormatada: String(dataEntregaStr),
        horaFormatada: "—",
        badgeCls: "bg-sky-600 text-white border-sky-700"
      };
    }

    const hoje = new Date();
    const dias = differenceInCalendarDays(hoje, dataEntrega);
    const dataFormatada = format(dataEntrega, "dd/MM/yyyy", { locale: ptBR });
    const horaFormatada = format(dataEntrega, "HH:mm", { locale: ptBR });

    let texto = "";
    let badgeCls = "bg-sky-600 text-white border-sky-700";

    if (dias === 0) {
      texto = `Entregue hoje às ${horaFormatada}`;
      badgeCls = "bg-emerald-600 text-white border-emerald-700";
    } else if (dias === 1) {
      texto = `Entregue ontem às ${horaFormatada}`;
      badgeCls = "bg-sky-600 text-white border-sky-700";
    } else {
      texto = `Entregue há ${dias} dias (${dataFormatada})`;
      badgeCls = "bg-slate-700 text-slate-100 border-slate-600";
    }

    return {
      texto,
      dias,
      dataFormatada,
      horaFormatada,
      badgeCls
    };
  } catch {
    return {
      texto: "Entregue",
      dias: 0,
      dataFormatada: String(dataEntregaStr),
      horaFormatada: "—",
      badgeCls: "bg-sky-600 text-white border-sky-700"
    };
  }
}

/**
 * Exporta lista de pedidos entregues para planilha CSV compatível com Microsoft Excel
 */
export function exportarRelatorioEntregasCSV(pedidos, options = {}) {
  const lista = (pedidos || []).filter(Boolean);
  if (!lista.length) return false;

  const headers = [
    "Pedido Odoo",
    "Ordem de Compra (OC)",
    "Identificador OF",
    "Cliente",
    "Vendedor",
    "Filial / Fábrica",
    "Setor Industrial",
    "Qtd Peças",
    "Metros Total (m)",
    "Resumo de Produtos",
    "Chegada no PCP",
    "Data Prometida (SLA)",
    "Data Entrega Realizada",
    "Horário da Entrega",
    "Dias desde Entrega",
    "Despachado Por"
  ];

  const escapeCSV = (val) => {
    if (val == null) return '""';
    const s = String(val).replace(/"/g, '""');
    return `"${s}"`;
  };

  const linhas = lista.map((p) => {
    const itens = getItens(p);
    const g = classGrupo(p);
    const setorNome = g === "telha" ? "Telhas" : g === "cd" ? "Corte e Dobra" : "Outros";

    let totalPecas = 0;
    let totalMetros = 0;
    const nomesProdutos = [];

    itens.forEach((it) => {
      const qtd = Number(it.quantidade || it.qtd || 0);
      const m = Number(it.comprimento || it.metros || 0);
      totalPecas += qtd;
      if (m > 0 && qtd > 0) totalMetros += qtd * m;
      if (it.produto || it.descricao) nomesProdutos.push(it.produto || it.descricao);
    });

    const infoTempo = formatarTempoEntregaRelativo(p.data_entrega_realizada || p.updated_date);

    const formatDataSimples = (dStr) => {
      if (!dStr) return "—";
      try {
        const d = new Date(dStr);
        if (isNaN(d.getTime())) return String(dStr);
        return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
      } catch {
        return String(dStr);
      }
    };

    return [
      escapeCSV(p.numero_pedido || `OF_${p.id}`),
      escapeCSV(p.numero_oc || "—"),
      escapeCSV(p.of_nome || p.of_odoo_id || "—"),
      escapeCSV(p.cliente_nome || "Cliente não informado"),
      escapeCSV(p.vendedor_nome || "—"),
      escapeCSV(p.unidade || "Matriz AJL"),
      escapeCSV(setorNome),
      escapeCSV(totalPecas || p.total_itens || 0),
      escapeCSV(totalMetros > 0 ? totalMetros.toFixed(2) : "—"),
      escapeCSV(nomesProdutos.slice(0, 3).join(" | ") || p.descricao || "—"),
      escapeCSV(formatDataSimples(p.data_recebimento || p.created_date)),
      escapeCSV(formatDataSimples(p.data_entrega)),
      escapeCSV(infoTempo.dataFormatada),
      escapeCSV(infoTempo.horaFormatada),
      escapeCSV(infoTempo.dias),
      escapeCSV(p.usuario_entrega || "Central PCP / Expedição")
    ].join(";");
  });

  const dataHoje = format(new Date(), "yyyy-MM-dd_HHmm");
  const filial = options.filial && options.filial !== "todas" ? `_${options.filial}` : "";
  const nomeArquivo = `relatorio_entregas_pcp${filial}_${dataHoje}.csv`;

  const csvContent = "\uFEFF" + [headers.join(";"), ...linhas].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", nomeArquivo);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return true;
}
