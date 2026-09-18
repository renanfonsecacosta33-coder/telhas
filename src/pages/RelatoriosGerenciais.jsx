import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useFilial, FILIAIS } from "@/contexts/FilialContext";
import { useNavigate } from "react-router-dom";
import {
  FileText,
  Download,
  Printer,
  Factory,
  Package,
  Truck,
  ArrowLeft,
  Calendar,
  Filter,
  CheckCircle2,
  Building2,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import UserAvatarButton from "@/components/UserAvatarButton";
import NotificationBell from "@/components/NotificationBell";
import { toast } from "sonner";
import {
  exportarPdfProducao,
  exportarPdfEstoque,
  exportarPdfLogistica
} from "@/lib/pdfRelatorioHelper";

export default function RelatoriosGerenciais() {
  const navigate = useNavigate();
  const { filialAtiva } = useFilial();

  const [tipoRelatorio, setTipoRelatorio] = useState("producao"); // producao | estoque | logistica
  const [filialFiltro, setFilialFiltro] = useState("Todas");
  const [periodo, setPeriodo] = useState("mes"); // hoje | semana | mes | todos
  const [user, setUser] = useState(null);
  const [gerando, setGerando] = useState(false);

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // 1. Pedidos Telhas
  const { data: pedidosTelhas = [], isLoading: loadingTelhas } = useQuery({
    queryKey: ["relatorio-telhas", filialFiltro],
    queryFn: () => {
      const q = filialFiltro !== "Todas" ? { unidade: filialFiltro } : {};
      return base44.entities.Pedido.filter(q, "-data_finalizacao", 500);
    }
  });

  // 2. Ordens CD
  const { data: ordensCD = [], isLoading: loadingCD } = useQuery({
    queryKey: ["relatorio-cd", filialFiltro],
    queryFn: () => {
      const q = filialFiltro !== "Todas" ? { unidade: filialFiltro } : {};
      return base44.entities.OrdemMaquinaCD.filter(q, "-data_finalizacao", 500);
    }
  });

  // 3. Bobinas
  const { data: bobinas = [], isLoading: loadingBobinas } = useQuery({
    queryKey: ["relatorio-bobinas", filialFiltro],
    queryFn: () => {
      const q = filialFiltro !== "Todas" ? { unidade: filialFiltro } : {};
      return base44.entities.Bobina.filter(q, "-peso_liquido", 500);
    }
  });

  // 4. Rotas
  const { data: rotas = [], isLoading: loadingRotas } = useQuery({
    queryKey: ["relatorio-rotas", filialFiltro],
    queryFn: () => {
      const q = filialFiltro !== "Todas" ? { unidade: filialFiltro } : {};
      return base44.entities.RotaEntrega.filter(q, "-created_date", 300);
    }
  });

  const isLoading = loadingTelhas || loadingCD || loadingBobinas || loadingRotas;

  // Itens unificados de produção
  const itensProducao = useMemo(() => {
    const telhas = pedidosTelhas.map(p => ({ ...p, _setor: "Telhas" }));
    const cd = ordensCD.map(o => ({ ...o, _setor: "Corte e Dobra" }));
    return [...telhas, ...cd];
  }, [pedidosTelhas, ordensCD]);

  const handleGerarPdf = () => {
    setGerando(true);
    try {
      const emissor = user?.full_name || user?.email || "Administração";
      if (tipoRelatorio === "producao") {
        exportarPdfProducao({
          itens: itensProducao,
          filial: filialFiltro,
          periodo: periodo === "mes" ? "Mês Atual" : periodo === "hoje" ? "Hoje" : "Geral",
          usuarioNome: emissor
        });
      } else if (tipoRelatorio === "estoque") {
        exportarPdfEstoque({
          bobinas,
          filial: filialFiltro,
          usuarioNome: emissor
        });
      } else if (tipoRelatorio === "logistica") {
        exportarPdfLogistica({
          rotas,
          filial: filialFiltro,
          usuarioNome: emissor
        });
      }
      toast.success("Relatório gerado e baixado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar PDF: " + (err?.message || "Tente novamente"));
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/setor")}
            className="gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground h-8 px-2.5"
            title="Voltar ao Hub"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar</span>
          </Button>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-bold tracking-tight">Central de Relatórios Executivos</h1>
                <Badge className="bg-teal-500/20 text-teal-700 dark:text-teal-300 border-teal-500/30 text-[10px] py-0 font-bold">
                  PDF / Impressão
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                Emissão de relatórios operacionais e gerenciais da AJL Ferro & Aço
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <UserAvatarButton size="sm" />
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Painel de Configuração do Relatório */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" /> Configurar Parâmetros de Emissão
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Tipo de Relatório */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tipo de Relatório</label>
              <Select value={tipoRelatorio} onValueChange={setTipoRelatorio}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="producao">🏭 Produção e OPs (Telhas e C&D)</SelectItem>
                  <SelectItem value="estoque">📦 Estoque de Bobinas & Matéria-Prima</SelectItem>
                  <SelectItem value="logistica">🚚 Expedição, Cargas e Entregas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filial */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Fábrica / Filial</label>
              <Select value={filialFiltro} onValueChange={setFilialFiltro}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione a filial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Todas">Todas as Filiais (Consolidado)</SelectItem>
                  {FILIAIS.map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Período */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Período de Análise</label>
              <Select value={periodo} onValueChange={setPeriodo}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hoje">Hoje</SelectItem>
                  <SelectItem value="semana">Últimos 7 dias</SelectItem>
                  <SelectItem value="mes">Mês Atual</SelectItem>
                  <SelectItem value="todos">Todo o Histórico</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Botão de Ação Principal */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border">
            <p className="text-xs text-muted-foreground">
              O PDF gerado inclui cabeçalho oficial da AJL, somatórios executivos e paginação automática.
            </p>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                onClick={() => window.print()}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Tela
              </Button>
              <Button
                onClick={handleGerarPdf}
                disabled={gerando || isLoading}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 font-bold text-xs h-9 shadow-xs"
              >
                {gerando ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Gerando PDF...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> Baixar Relatório em PDF
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Pré-visualização dos Dados em Tela */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Pré-visualização dos Registros</h3>
              <p className="text-xs text-muted-foreground">Dados que constarão nas páginas do relatório PDF</p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              {tipoRelatorio === "producao"
                ? `${itensProducao.length} registros`
                : tipoRelatorio === "estoque"
                ? `${bobinas.length} bobinas`
                : `${rotas.length} rotas`}
            </Badge>
          </div>

          <div className="overflow-x-auto max-h-[460px]">
            {tipoRelatorio === "producao" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Pedido</th>
                    <th className="py-2.5 px-4">Cliente</th>
                    <th className="py-2.5 px-4">Produto</th>
                    <th className="py-2.5 px-4">Máquina</th>
                    <th className="py-2.5 px-4">Setor</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Qtd / Metros</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {itensProducao.slice(0, 50).map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-bold">{item.numero_pedido || item.id?.slice(-5)}</td>
                      <td className="py-2.5 px-4 truncate max-w-[180px]">{item.cliente || "Consumidor"}</td>
                      <td className="py-2.5 px-4">{item.produto || item.tipo_peca || "Item"}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{item.maquina || item.maquina_inicial || "—"}</td>
                      <td className="py-2.5 px-4">{item._setor}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[10px] py-0">{item.status}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        {item._setor === "Telhas" ? `${item.metros || 0} m` : `${item.quantidade || 0} un`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tipoRelatorio === "estoque" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Código</th>
                    <th className="py-2.5 px-4">Cor</th>
                    <th className="py-2.5 px-4">Espessura</th>
                    <th className="py-2.5 px-4">Largura</th>
                    <th className="py-2.5 px-4">Fornecedor</th>
                    <th className="py-2.5 px-4 text-right">Peso Atual (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {bobinas.slice(0, 50).map((b, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-bold">{b.codigo_bobina || b.codigo || "—"}</td>
                      <td className="py-2.5 px-4">{b.cor || "Natural"}</td>
                      <td className="py-2.5 px-4">{b.espessura || "0.43"} mm</td>
                      <td className="py-2.5 px-4">{b.largura || "1200"} mm</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{b.fornecedor || "CSN"}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        {Math.round(Number(b.peso_liquido || b.peso_atual_kg || 0)).toLocaleString("pt-BR")} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tipoRelatorio === "logistica" && (
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 text-muted-foreground uppercase text-[10px] font-bold tracking-wider sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-4">Destino / Polo</th>
                    <th className="py-2.5 px-4">Motorista</th>
                    <th className="py-2.5 px-4">Caminhão</th>
                    <th className="py-2.5 px-4">Data Entrega</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Peso (kg)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border font-medium">
                  {rotas.slice(0, 50).map((r, idx) => (
                    <tr key={idx} className="hover:bg-muted/30">
                      <td className="py-2.5 px-4 font-bold">{r.cidade_polo || r.nome || "Rota"}</td>
                      <td className="py-2.5 px-4">{r.motorista || "Não alocado"}</td>
                      <td className="py-2.5 px-4 text-muted-foreground">{r.veiculo || "—"}</td>
                      <td className="py-2.5 px-4">{r.entrega_date || "—"}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="outline" className="text-[10px] py-0">{r.status}</Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold">
                        {Math.round(Number(r.peso_total_kg || 0)).toLocaleString("pt-BR")} kg
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
