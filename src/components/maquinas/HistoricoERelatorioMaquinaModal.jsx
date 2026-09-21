import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  History,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Printer,
  Download,
  Clock,
  User,
  Package,
  Weight,
  Layers,
  CheckCircle2,
  AlertCircle,
  Play,
  Pause,
  Factory,
  Search,
  Sliders,
  Filter,
  RefreshCw,
  Sparkles
} from "lucide-react";
import { format, subDays, addDays, parseISO, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useFilial } from "@/contexts/FilialContext";
import { toast } from "sonner";

function formatSegundos(sec) {
  const s = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
}

function formatHora(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return isoString;
  }
}

function formatDataHora(isoString) {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return isoString;
  }
}

export default function HistoricoERelatorioMaquinaModal({
  open,
  onClose,
  maquinaNome = "Desbobinadeira",
  setor = "corte_dobra",
  initialTab = "relatorio"
}) {
  const { filialAtiva } = useFilial();
  const [tab, setTab] = useState(initialTab);
  const [selectedDay, setSelectedDay] = useState(format(new Date(), "yyyy-MM-dd"));
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState("todos");
  const [busca, setBusca] = useState("");

  // Sincroniza initialTab quando abre
  React.useEffect(() => {
    if (open && initialTab) {
      setTab(initialTab);
    }
  }, [open, initialTab]);

  // Consulta de Ordens da Desbobinadeira
  const { data: ordensDesbob = [], isLoading: loadingDesbob } = useQuery({
    queryKey: ["maquina-hist-desbob", filialAtiva],
    queryFn: () => base44.entities.OrdemDesbobinadeira.filter({ unidade: filialAtiva }, "-data", 1000),
    enabled: open && maquinaNome.toLowerCase().includes("desbobinadeira")
  });

  // Consulta de Ordens de Máquinas de Corte e Dobra
  const { data: ordensCD = [], isLoading: loadingCD } = useQuery({
    queryKey: ["maquina-hist-cd", filialAtiva],
    queryFn: () => base44.entities.OrdemMaquinaCD.filter({ unidade: filialAtiva }, "-data", 1000),
    enabled: open && setor === "corte_dobra" && !maquinaNome.toLowerCase().includes("desbobinadeira")
  });

  // Consulta de Pedidos de Telhas
  const { data: pedidosTelhas = [], isLoading: loadingTelhas } = useQuery({
    queryKey: ["maquina-hist-telhas", filialAtiva],
    queryFn: () => base44.entities.Pedido.filter({ unidade: filialAtiva }, "-data", 1000),
    enabled: open && setor === "telhas"
  });

  // Consulta de Logs de Auditoria e Setups
  const { data: logsAudit = [] } = useQuery({
    queryKey: ["maquina-hist-audit", filialAtiva, maquinaNome],
    queryFn: async () => {
      const logs = await base44.entities.AuditLog.list("-created_date", 500).catch(() => []);
      return logs.filter(l => {
        const det = (l.detalhes || "").toLowerCase();
        const maq = maquinaNome.toLowerCase();
        const reg = (l.registro_identificador || "").toLowerCase();
        return det.includes(maq) || reg === maq;
      });
    },
    enabled: open
  });

  // Unifica e normaliza as ordens da máquina correspondente
  const ordensNormalizadas = useMemo(() => {
    let listaBruta = [];

    const maqClean = maquinaNome.toLowerCase().replace(/[\s\-_]/g, "");

    if (maqClean.includes("desbobinadeira")) {
      listaBruta = ordensDesbob.map(o => ({
        id: o.id,
        tipo: "OP",
        origem: "Desbobinadeira",
        numero_op: o.numero_ordem || o.codigo || o.id?.slice(-5),
        numero_pedido: o.numero_pedido ? String(o.numero_pedido).replace(/^#/, "").trim() : "—",
        cliente: o.cliente || "Consumidor",
        produto: o.observacoes || `Corte ${o.comprimento_mm || 0}mm · Chapa ${o.espessura_utilizada || o.espessura_real || "—"}mm`,
        quantidade: Number(o.quantidade) || 1,
        metros: Number(o.metragem_cortada_m) || (o.quantidade && o.comprimento_mm ? (o.quantidade * o.comprimento_mm / 1000) : 0),
        peso_kg: Number(o.peso_gasto_kg || o.peso_kg || 0),
        bobina: o.bobina_codigo || o.bobina_descricao || "—",
        operador: o.operador_nome || o.created_by || "Operador",
        status: o.status || "pendente",
        data: o.data || o.created_date?.split("T")[0],
        created_date: o.created_date,
        updated_date: o.updated_date,
        inicio_producao_ts: o.inicio_producao_ts,
        fim_producao_ts: o.fim_producao_ts,
        tempo_producao_seg: Number(o.tempo_producao_seg || 0),
        tempo_setup_seg: Number(o.tempo_setup_seg || 0),
      }));
    } else if (setor === "corte_dobra") {
      listaBruta = ordensCD
        .filter(o => {
          const m = (o.maquina || "").toLowerCase().replace(/[\s\-_]/g, "");
          return m === maqClean || maqClean.includes(m) || m.includes(maqClean);
        })
        .map(o => ({
          id: o.id,
          tipo: "OP",
          origem: o.maquina || maquinaNome,
          numero_op: o.id?.slice(-5),
          numero_pedido: o.numero_pedido ? String(o.numero_pedido).replace(/^#/, "").trim() : "—",
          cliente: o.cliente || "Consumidor",
          produto: o.tipo_peca || o.desenvolvimento_descricao || "Peça Corte/Dobra",
          quantidade: Number(o.quantidade) || 1,
          metros: Number(o.comprimento_mm ? (o.quantidade * o.comprimento_mm / 1000) : 0),
          peso_kg: Number(o.peso_kg || 0),
          bobina: o.chapa_descricao || "—",
          operador: o.operador_nome || o.created_by || "Operador",
          status: o.status || "pendente",
          data: o.data || o.created_date?.split("T")[0],
          created_date: o.created_date,
          updated_date: o.updated_date,
          inicio_producao_ts: o.inicio_producao_ts,
          fim_producao_ts: o.fim_producao_ts,
          tempo_producao_seg: Number(o.tempo_producao_seg || 0),
          tempo_setup_seg: Number(o.tempo_setup_seg || 0),
        }));
    } else {
      // Telhas (TP40, TP25, Ondulada, Colonial, etc.)
      listaBruta = pedidosTelhas
        .filter(p => {
          const m = (p.maquina || "").toLowerCase().replace(/[\s\-_]/g, "");
          return m === maqClean || maqClean.includes(m) || m.includes(maqClean);
        })
        .map(p => ({
          id: p.id,
          tipo: "OP",
          origem: p.maquina || maquinaNome,
          numero_op: p.id?.slice(-5),
          numero_pedido: p.numero_pedido ? String(p.numero_pedido).replace(/^#/, "").trim() : "—",
          cliente: p.cliente || "Consumidor",
          produto: p.produto || "Telha",
          quantidade: Number(p.quantidade_telhas) || 1,
          metros: Number(p.metros) || (p.quantidade_telhas && p.metragem_mm ? (p.quantidade_telhas * p.metragem_mm / 1000) : 0),
          peso_kg: Number(p.kg_total || p.kg_superior || 0),
          bobina: p.bobina_superior || p.bobina_superior_id || "—",
          operador: p.operador_nome || p.usuario_nome || p.created_by || "Operador",
          status: p.status || "pendente",
          data: p.data || p.data_producao || p.created_date?.split("T")[0],
          created_date: p.created_date,
          updated_date: p.updated_date,
          inicio_producao_ts: p.inicio_producao_ts,
          fim_producao_ts: p.fim_producao_ts,
          tempo_producao_seg: Number(p.tempo_producao_seg || 0),
          tempo_setup_seg: Number(p.tempo_setup_seg || 0),
        }));
    }

    return listaBruta.sort((a, b) => (b.data || "").localeCompare(a.data || "") || (b.created_date || "").localeCompare(a.created_date || ""));
  }, [maquinaNome, setor, ordensDesbob, ordensCD, pedidosTelhas]);

  // ==========================================
  // ABA 1: DADOS DO RELATÓRIO DO DIA SELECIONADO
  // ==========================================
  const ordensDoDia = useMemo(() => {
    return ordensNormalizadas.filter(o => o.data === selectedDay);
  }, [ordensNormalizadas, selectedDay]);

  const setupsDoDia = useMemo(() => {
    return logsAudit.filter(l => {
      const dataLog = (l.data_hora || l.created_date || "").split("T")[0];
      return dataLog === selectedDay && (l.acao === "setup" || (l.detalhes || "").toLowerCase().includes("setup"));
    });
  }, [logsAudit, selectedDay]);

  // KPIs do Dia
  const kpisDia = useMemo(() => {
    const finalizadas = ordensDoDia.filter(o => o.status === "finalizado" || o.status === "Finalizada");
    const emAndamento = ordensDoDia.filter(o => o.status === "em_producao");
    const pendentes = ordensDoDia.filter(o => o.status === "pendente" || o.status === "pausado");

    const totalPecas = finalizadas.reduce((s, o) => s + (o.quantidade || 0), 0);
    const totalMetros = finalizadas.reduce((s, o) => s + (o.metros || 0), 0);
    const totalKg = finalizadas.reduce((s, o) => s + (o.peso_kg || 0), 0);
    const tempoProdutivoSeg = ordensDoDia.reduce((s, o) => s + (o.tempo_producao_seg || 0), 0);
    const tempoSetupSeg = ordensDoDia.reduce((s, o) => s + (o.tempo_setup_seg || 0), 0);

    const operadoresUnicos = Array.from(new Set(ordensDoDia.map(o => o.operador).filter(Boolean)));

    const taxaConclusao = ordensDoDia.length > 0 
      ? Math.round((finalizadas.length / ordensDoDia.length) * 100) 
      : 0;

    return {
      totalOrdens: ordensDoDia.length,
      finalizadasCount: finalizadas.length,
      emAndamentoCount: emAndamento.length,
      pendentesCount: pendentes.length,
      taxaConclusao,
      totalPecas,
      totalMetros,
      totalKg,
      tempoProdutivoSeg,
      tempoSetupSeg,
      operadores: operadoresUnicos
    };
  }, [ordensDoDia]);

  // Navegação de dias
  const mudarDia = (dias) => {
    try {
      const dt = parseISO(selectedDay);
      const novoDt = dias > 0 ? addDays(dt, dias) : subDays(dt, Math.abs(dias));
      setSelectedDay(format(novoDt, "yyyy-MM-dd"));
    } catch {
      setSelectedDay(format(new Date(), "yyyy-MM-dd"));
    }
  };

  // ==========================================
  // ABA 2: HISTÓRICO GERAL & LINHA DO TEMPO
  // ==========================================
  const eventosHistorico = useMemo(() => {
    const lista = [];

    // Adiciona OPs
    ordensNormalizadas.forEach(o => {
      const dataHora = o.fim_producao_ts || o.updated_date || (o.data ? `${o.data}T17:00:00Z` : o.created_date);
      lista.push({
        tipo: "OP",
        subtipo: o.status,
        titulo: `Ordem #${o.numero_op} · Pedido #${o.numero_pedido}`,
        data_hora: dataHora,
        data: o.data,
        operador: o.operador,
        detalhes: `${o.cliente} — ${o.produto}. Produzido: ${o.quantidade} peças · ${o.metros ? `${o.metros.toFixed(1)} m · ` : ""}${Number(o.peso_kg).toLocaleString("pt-BR")} kg (Bobina: ${o.bobina}).`,
        status: o.status,
        tempo: o.tempo_producao_seg,
        raw: o
      });
    });

    // Adiciona logs de setup e auditoria
    logsAudit.forEach(l => {
      const dataHora = l.data_hora || l.created_date;
      lista.push({
        tipo: "AUDITORIA",
        subtipo: l.acao,
        titulo: l.acao === "setup" ? `Setup / Troca de Ferramenta` : `Evento: ${l.acao.toUpperCase()}`,
        data_hora: dataHora,
        data: dataHora?.split("T")[0],
        operador: l.usuario_nome || l.usuario_email || "Operador",
        detalhes: l.detalhes || "Registro auditado da máquina.",
        status: l.acao,
        raw: l
      });
    });

    // Filtros
    return lista.filter(ev => {
      // Filtro de texto
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const match = (ev.titulo || "").toLowerCase().includes(q) ||
          (ev.detalhes || "").toLowerCase().includes(q) ||
          (ev.operador || "").toLowerCase().includes(q);
        if (!match) return false;
      }

      // Filtro de status
      if (filtroStatus !== "todos") {
        if (filtroStatus === "finalizado" && ev.status !== "finalizado" && ev.status !== "Finalizada") return false;
        if (filtroStatus === "em_producao" && ev.status !== "em_producao") return false;
        if (filtroStatus === "setup" && ev.subtipo !== "setup") return false;
        if (filtroStatus === "pausado" && ev.status !== "pausado") return false;
      }

      // Filtro de período
      if (filtroPeriodo === "hoje") {
        const hoje = format(new Date(), "yyyy-MM-dd");
        if (ev.data !== hoje) return false;
      } else if (filtroPeriodo === "7dias") {
        const limite = format(subDays(new Date(), 7), "yyyy-MM-dd");
        if (ev.data < limite) return false;
      } else if (filtroPeriodo === "30dias") {
        const limite = format(subDays(new Date(), 30), "yyyy-MM-dd");
        if (ev.data < limite) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.data_hora || 0).getTime() - new Date(a.data_hora || 0).getTime());
  }, [ordensNormalizadas, logsAudit, busca, filtroStatus, filtroPeriodo]);

  // ==========================================
  // EXPORTAR / IMPRIMIR RELATÓRIO A4
  // ==========================================
  const imprimirRelatorioDiario = () => {
    const dataFmt = (() => {
      try {
        return format(parseISO(selectedDay), "dd 'de' MMMM 'de' yyyy (EEEE)", { locale: ptBR });
      } catch {
        return selectedDay;
      }
    })();

    const linhasTabela = ordensDoDia.map((o) => `
      <tr>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 11px;">#${o.numero_op}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${o.numero_pedido !== "—" ? `#${o.numero_pedido}` : "—"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${o.cliente}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${o.produto}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${o.quantidade}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right;">${o.metros > 0 ? `${o.metros.toFixed(1)} m` : "—"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold;">${o.peso_kg > 0 ? `${Number(o.peso_kg).toLocaleString("pt-BR")} kg` : "—"}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; font-family: monospace; font-size: 11px;">${o.bobina}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0;">${o.operador}</td>
        <td style="padding: 6px 8px; border-bottom: 1px solid #e2e8f0; text-align: center;">
          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: bold; background: ${o.status === "finalizado" ? "#dcfce7; color: #166534;" : "#fef3c7; color: #92400e;"}">
            ${o.status.toUpperCase()}
          </span>
        </td>
      </tr>
    `).join("");

    const setupsHtml = setupsDoDia.length > 0 ? `
      <div style="margin-top: 15px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <h4 style="margin: 0 0 6px 0; font-size: 12px; color: #334155; text-transform: uppercase;">Setups e Ajustes de Ferramenta / Bobina Realizados:</h4>
        <ul style="margin: 0; padding-left: 18px; font-size: 11px; color: #475569;">
          ${setupsDoDia.map(s => `<li><strong>${formatHora(s.data_hora || s.created_date)}</strong> — ${s.detalhes} (${s.usuario_nome || 'Operador'})</li>`).join("")}
        </ul>
      </div>
    ` : "";

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Relatório Diário — ${maquinaNome} — ${selectedDay}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0f172a; font-size: 11px; margin: 0; padding: 0; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 15px; }
            .title-box h1 { margin: 0; font-size: 18px; color: #0f172a; text-transform: uppercase; }
            .title-box p { margin: 2px 0 0 0; color: #64748b; font-size: 11px; }
            .meta-box { text-align: right; font-size: 11px; color: #334155; }
            .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 15px; }
            .kpi-card { background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px; text-align: center; }
            .kpi-card .val { font-size: 16px; font-weight: bold; color: #0f172a; }
            .kpi-card .lbl { font-size: 9px; color: #64748b; text-transform: uppercase; margin-top: 2px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th { background: #0f172a; color: #fff; padding: 7px 8px; text-align: left; font-size: 10px; text-transform: uppercase; }
            .footer { margin-top: 30px; display: flex; justify-content: space-around; padding-top: 10px; }
            .signature { width: 220px; text-align: center; border-top: 1px solid #475569; padding-top: 5px; font-size: 10px; color: #334155; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title-box">
              <h1>AJL Ferro & Aço — Relatório Diário de Produção</h1>
              <p>Máquina: <strong>${maquinaNome.toUpperCase()}</strong> &bull; Setor: <strong>${setor.toUpperCase()}</strong> &bull; Unidade: <strong>${filialAtiva}</strong></p>
            </div>
            <div class="meta-box">
              <div>Data: <strong>${dataFmt}</strong></div>
              <div>Gerado em: <strong>${new Date().toLocaleString("pt-BR")}</strong></div>
            </div>
          </div>

          <div class="kpis">
            <div class="kpi-card">
              <div class="val">${kpisDia.finalizadasCount} / ${kpisDia.totalOrdens}</div>
              <div class="lbl">OPs Concluídas (${kpisDia.taxaConclusao}%)</div>
            </div>
            <div class="kpi-card">
              <div class="val">${kpisDia.totalPecas.toLocaleString("pt-BR")}</div>
              <div class="lbl">Peças Produzidas</div>
            </div>
            <div class="kpi-card">
              <div class="val">${kpisDia.totalMetros > 0 ? `${kpisDia.totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} m` : "—"}</div>
              <div class="lbl">Metragem Total</div>
            </div>
            <div class="kpi-card">
              <div class="val">${kpisDia.totalKg > 0 ? `${Number(kpisDia.totalKg).toLocaleString("pt-BR")} kg` : "—"}</div>
              <div class="lbl">Peso Processado</div>
            </div>
            <div class="kpi-card">
              <div class="val">${formatSegundos(kpisDia.tempoProdutivoSeg)}</div>
              <div class="lbl">Tempo de Produção</div>
            </div>
          </div>

          ${setupsHtml}

          <h3 style="margin: 15px 0 5px 0; font-size: 12px; text-transform: uppercase;">Ordens de Produção do Dia:</h3>
          <table>
            <thead>
              <tr>
                <th>OP</th>
                <th>Pedido</th>
                <th>Cliente</th>
                <th>Produto / Descrição</th>
                <th style="text-align: center;">Qtd</th>
                <th style="text-align: right;">Metros</th>
                <th style="text-align: right;">Peso</th>
                <th>Bobina / Chapa</th>
                <th>Operador</th>
                <th style="text-align: center;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${linhasTabela || `<tr><td colspan="10" style="padding: 16px; text-align: center; color: #64748b;">Nenhuma ordem programada ou produzida para este dia.</td></tr>`}
            </tbody>
          </table>

          <div class="footer">
            <div class="signature">
              <strong>${kpisDia.operadores.join(", ") || "Operador Responsável"}</strong><br/>
              Operador da Máquina
            </div>
            <div class="signature">
              <strong>Gestão Industrial / Supervisão</strong><br/>
              PCP &bull; AJL Ferro & Aço
            </div>
          </div>
        </body>
      </html>
    `;

    const janela = window.open("", "_blank", "width=900,height=750");
    if (!janela) {
      toast.error("Pop-up bloqueado. Permita os pop-ups para imprimir o relatório.");
      return;
    }
    janela.document.write(html);
    janela.document.close();
    setTimeout(() => {
      janela.print();
    }, 400);
  };

  // Exportar CSV
  const exportarCSV = () => {
    if (ordensDoDia.length === 0) {
      toast.warning("Nenhuma ordem para exportar nesta data.");
      return;
    }
    const headers = ["OP", "Pedido", "Cliente", "Produto", "Quantidade", "Metros", "Peso (kg)", "Bobina", "Operador", "Status", "Data"];
    const linhas = ordensDoDia.map(o => [
      `#${o.numero_op}`,
      o.numero_pedido,
      `"${(o.cliente || "").replace(/"/g, '""')}"`,
      `"${(o.produto || "").replace(/"/g, '""')}"`,
      o.quantidade,
      o.metros?.toFixed(2) || "0",
      o.peso_kg || "0",
      `"${(o.bobina || "").replace(/"/g, '""')}"`,
      `"${(o.operador || "").replace(/"/g, '""')}"`,
      o.status,
      o.data
    ]);
    const csvContent = "\uFEFF" + [headers.join(";"), ...linhas.map(l => l.join(";"))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Relatorio_${maquinaNome}_${selectedDay}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Relatório CSV baixado com sucesso!");
  };

  const isLoading = loadingDesbob || loadingCD || loadingTelhas;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Cabeçalho do Modal */}
        <DialogHeader className="p-5 pb-3 border-b border-border bg-muted/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold">
                <Factory className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                  {maquinaNome} — Histórico e Relatórios Diários
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {filialAtiva}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Consulte a produção diária, imprima relatórios oficiais e acompanhe a auditoria de operações.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={imprimirRelatorioDiario}
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" /> Imprimir A4
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={exportarCSV}
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> CSV
              </Button>
            </div>
          </div>

          {/* Abas */}
          <Tabs value={tab} onValueChange={setTab} className="mt-3">
            <TabsList className="grid grid-cols-2 w-full max-w-sm">
              <TabsTrigger value="relatorio" className="gap-1.5 text-xs font-medium">
                <FileText className="w-3.5 h-3.5" /> Relatório Diário
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-1.5 text-xs font-medium">
                <History className="w-3.5 h-3.5" /> Histórico & Auditoria
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>

        {/* Conteúdo Principal */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <div className="w-8 h-8 border-4 border-muted border-t-orange-500 rounded-full animate-spin mb-2" />
              <p className="text-xs">Carregando dados da máquina...</p>
            </div>
          ) : tab === "relatorio" ? (
            /* ========================================= */
            /* ABA 1: RELATÓRIO DIÁRIO                   */
            /* ========================================= */
            <div className="space-y-4">
              {/* Barra de Seleção de Dia */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 rounded-xl border border-border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => mudarDia(-1)}
                    title="Dia anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Input
                    type="date"
                    value={selectedDay}
                    onChange={(e) => e.target.value && setSelectedDay(e.target.value)}
                    className="h-8 w-40 text-xs font-semibold"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => mudarDia(1)}
                    title="Próximo dia"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-primary"
                    onClick={() => setSelectedDay(format(new Date(), "yyyy-MM-dd"))}
                  >
                    Hoje
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-muted-foreground"
                    onClick={() => setSelectedDay(format(subDays(new Date(), 1), "yyyy-MM-dd"))}
                  >
                    Ontem
                  </Button>
                </div>

                <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {(() => {
                    try {
                      return format(parseISO(selectedDay), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                    } catch {
                      return selectedDay;
                    }
                  })()}
                </div>
              </div>

              {/* KPIs do Dia */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3 bg-card border border-border rounded-xl shadow-sm text-center">
                  <span className="text-xs text-muted-foreground font-medium">Conclusão de OPs</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    {kpisDia.finalizadasCount} <span className="text-xs text-muted-foreground font-normal">/ {kpisDia.totalOrdens}</span>
                  </p>
                  <Badge variant="outline" className={`mt-1 text-[10px] ${kpisDia.taxaConclusao >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : 'bg-amber-50 text-amber-700 border-amber-300'}`}>
                    {kpisDia.taxaConclusao}% Concluído
                  </Badge>
                </div>

                <div className="p-3 bg-card border border-border rounded-xl shadow-sm text-center">
                  <span className="text-xs text-muted-foreground font-medium">Peças Produzidas</span>
                  <p className="text-xl font-bold text-primary mt-0.5">
                    {kpisDia.totalPecas.toLocaleString("pt-BR")}
                  </p>
                  <span className="text-[10px] text-muted-foreground">peças finalizadas</span>
                </div>

                <div className="p-3 bg-card border border-border rounded-xl shadow-sm text-center">
                  <span className="text-xs text-muted-foreground font-medium">Metragem Linear</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    {kpisDia.totalMetros > 0 ? `${kpisDia.totalMetros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}` : "—"}
                  </p>
                  <span className="text-[10px] text-muted-foreground">metros cortados</span>
                </div>

                <div className="p-3 bg-card border border-border rounded-xl shadow-sm text-center">
                  <span className="text-xs text-muted-foreground font-medium">Peso Processado</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    {kpisDia.totalKg > 0 ? `${Number(kpisDia.totalKg).toLocaleString("pt-BR")}` : "—"}
                  </p>
                  <span className="text-[10px] text-muted-foreground">kg de aço</span>
                </div>

                <div className="p-3 bg-card border border-border rounded-xl shadow-sm text-center">
                  <span className="text-xs text-muted-foreground font-medium">Tempo Produtivo</span>
                  <p className="text-xl font-bold text-foreground mt-0.5">
                    {formatSegundos(kpisDia.tempoProdutivoSeg)}
                  </p>
                  <span className="text-[10px] text-muted-foreground">horas em máquina</span>
                </div>
              </div>

              {/* Setups e Paradas do Dia */}
              {setupsDoDia.length > 0 && (
                <div className="p-3 bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl space-y-1.5">
                  <p className="text-xs font-semibold text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Setups e Trocas de Bobina Realizadas no Dia ({setupsDoDia.length}):
                  </p>
                  <div className="space-y-1 text-xs text-purple-800 dark:text-purple-200">
                    {setupsDoDia.map((s, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[11px] bg-white/60 dark:bg-black/20 px-2.5 py-1 rounded">
                        <span>{s.detalhes}</span>
                        <span className="text-muted-foreground font-mono">{formatHora(s.data_hora || s.created_date)} &bull; {s.usuario_nome || "Operador"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabela de OPs do Dia */}
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Package className="w-3.5 h-3.5" />
                    Ordens de Produção ({ordensDoDia.length})
                  </h3>
                  {kpisDia.operadores.length > 0 && (
                    <span className="text-xs text-muted-foreground">
                      Operador(es): <strong>{kpisDia.operadores.join(", ")}</strong>
                    </span>
                  )}
                </div>

                {ordensDoDia.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">
                    Nenhuma ordem programada ou produzida para este dia ({selectedDay}).
                  </div>
                ) : (
                  <div className="divide-y divide-border text-xs">
                    {ordensDoDia.map((o, idx) => {
                      const isFinalizada = o.status === "finalizado" || o.status === "Finalizada";
                      const isProduzindo = o.status === "em_producao";
                      return (
                        <div key={idx} className="p-3 hover:bg-muted/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-bold bg-muted px-1.5 py-0.5 rounded text-[11px]">
                                OP #{o.numero_op}
                              </span>
                              {o.numero_pedido !== "—" && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Ped #{o.numero_pedido}
                                </Badge>
                              )}
                              <span className="font-semibold text-foreground">
                                {o.cliente}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] ${
                                  isFinalizada ? "bg-emerald-50 text-emerald-700 border-emerald-300" :
                                  isProduzindo ? "bg-blue-50 text-blue-700 border-blue-300 animate-pulse" :
                                  "bg-amber-50 text-amber-700 border-amber-300"
                                }`}
                              >
                                {o.status.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-muted-foreground text-xs">
                              {o.produto}
                            </p>
                          </div>

                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="font-bold text-foreground">
                                {o.quantidade} peças
                                {o.metros > 0 && <span className="text-muted-foreground font-normal"> &bull; {o.metros.toFixed(1)} m</span>}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {o.peso_kg > 0 ? `${Number(o.peso_kg).toLocaleString("pt-BR")} kg` : "Sem peso"} &bull; Bob: {o.bobina}
                              </p>
                            </div>
                            <div className="hidden sm:block text-[11px] text-muted-foreground border-l border-border pl-3">
                              <p className="font-medium text-foreground">{o.operador}</p>
                              <p>{o.tempo_producao_seg > 0 ? formatSegundos(o.tempo_producao_seg) : "—"}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ========================================= */
            /* ABA 2: HISTÓRICO GERAL & AUDITORIA        */
            /* ========================================= */
            <div className="space-y-4">
              {/* Filtros do Histórico */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/40 rounded-xl border border-border">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nº pedido, cliente, operador, bobina..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5">
                  <select
                    value={filtroPeriodo}
                    onChange={(e) => setFiltroPeriodo(e.target.value)}
                    className="h-8 text-xs border border-border rounded-md px-2 bg-background"
                  >
                    <option value="todos">Todo o Período</option>
                    <option value="hoje">Apenas Hoje</option>
                    <option value="7dias">Últimos 7 dias</option>
                    <option value="30dias">Últimos 30 dias</option>
                  </select>

                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="h-8 text-xs border border-border rounded-md px-2 bg-background"
                  >
                    <option value="todos">Todos os Eventos</option>
                    <option value="finalizado">Concluídos</option>
                    <option value="em_producao">Em Produção</option>
                    <option value="setup">Setups / Paradas</option>
                    <option value="pausado">Pausados</option>
                  </select>
                </div>
              </div>

              {/* Lista Cronológica / Linha do Tempo */}
              {eventosHistorico.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-xs">
                  Nenhum registro histórico encontrado com os filtros selecionados.
                </div>
              ) : (
                <div className="relative border-l-2 border-orange-200 dark:border-orange-950 ml-4 space-y-4 py-1">
                  {eventosHistorico.map((ev, idx) => {
                    const isFinalizada = ev.status === "finalizado" || ev.status === "Finalizada";
                    const isProduzindo = ev.status === "em_producao";
                    const isSetup = ev.tipo === "AUDITORIA" && ev.subtipo === "setup";

                    return (
                      <div key={idx} className="relative pl-6">
                        {/* Ponto na timeline */}
                        <div className={`absolute -left-[15px] top-1 w-7 h-7 rounded-full border-2 flex items-center justify-center shadow-xs ${
                          isFinalizada ? "bg-emerald-100 text-emerald-700 border-emerald-300" :
                          isProduzindo ? "bg-blue-100 text-blue-700 border-blue-300 animate-pulse" :
                          isSetup ? "bg-purple-100 text-purple-700 border-purple-300" :
                          "bg-amber-100 text-amber-700 border-amber-300"
                        }`}>
                          {isFinalizada ? <CheckCircle2 className="w-3.5 h-3.5" /> :
                           isProduzindo ? <Play className="w-3.5 h-3.5" /> :
                           isSetup ? <RefreshCw className="w-3.5 h-3.5" /> :
                           <Clock className="w-3.5 h-3.5" />}
                        </div>

                        {/* Card do evento */}
                        <div className="p-3 bg-card border border-border rounded-xl shadow-xs space-y-1">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                            <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                              {ev.titulo}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {formatDataHora(ev.data_hora)}
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {ev.detalhes}
                          </p>

                          <div className="flex items-center gap-3 pt-1 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3 text-primary" />
                              {ev.operador}
                            </span>
                            {ev.tempo > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Tempo: {formatSegundos(ev.tempo)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
