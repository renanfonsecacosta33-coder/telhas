import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import {
  Ruler,
  AlertTriangle,
  Search,
  Pencil,
  Check,
  X,
  Trash2,
  RefreshCw,
  ArrowUpDown,
  Filter,
  Layers,
  Sparkles,
  Calculator,
  RotateCcw,
  Lock
} from "lucide-react";
import { calcularMetrosPedido, calcKgDeMetros } from "@/lib/metrosHelper";
import { useAuth } from "@/lib/AuthContext";

export default function AjustarMetragensModal({
  open,
  onOpenChange,
  ordens = [],
  onAtualizado,
}) {
  const [busca, setBusca] = useState("");
  const [maquinaFiltro, setMaquinaFiltro] = useState("todas");
  const [apenasSuspeitos, setApenasSuspeitos] = useState(false);
  const [ordemEdicao, setOrdemEdicao] = useState(null);

  // Regra de negócio: retificação pós-produção é exclusiva do
  // Encarregado/PCP (gestor) — operador e vendedor apenas visualizam.
  const { user } = useAuth();
  const podeRetificar = ["admin", "super_admin", "gestor"].includes(
    String(user?.role || "").toLowerCase()
  );

  // Estados do formulário de edição rápida
  const [modoEdicao, setModoEdicao] = useState("direto"); // "direto" | "pecas_mm"
  const [metrosDiretos, setMetrosDiretos] = useState("");
  const [pecas, setPecas] = useState("");
  const [comprimentoMm, setComprimentoMm] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Lista de máquinas disponíveis para filtro
  const maquinasDisponiveis = useMemo(() => {
    const set = new Set();
    ordens.forEach((o) => {
      if (o.maquina) set.add(o.maquina);
    });
    return Array.from(set).sort();
  }, [ordens]);

  // Filtra e ordena ordens (maiores metros primeiro por padrão)
  const ordensProcessadas = useMemo(() => {
    let lista = ordens.filter((o) => o.status === "finalizado");

    // Filtro de máquina
    if (maquinaFiltro !== "todas") {
      lista = lista.filter((o) => o.maquina === maquinaFiltro);
    }

    // Filtro de busca (pedido, cliente, produto)
    if (busca.trim()) {
      const termo = busca.toLowerCase().trim();
      lista = lista.filter((o) => {
        const ped = String(o.numero_pedido || o.pedido_numero || "").toLowerCase();
        const cli = String(o.cliente || o.cliente_nome || "").toLowerCase();
        const prod = String(o.produto || "").toLowerCase();
        const ofNum = String(o.of_nome || o.of_odoo_id || "").toLowerCase();
        return ped.includes(termo) || cli.includes(termo) || prod.includes(termo) || ofNum.includes(termo);
      });
    }

    // Calcula metros e marca ordens suspeitas
    const comMetros = lista.map((o) => {
      const m = calcularMetrosPedido(o);
      const isSuspeito = m >= 500; // Pedido de telha com mais de 500m lineares costuma ter erro de digitação
      return { ...o, _metrosCalculados: m, _isSuspeito: isSuspeito };
    });

    // Filtro apenas suspeitos
    let filtrados = comMetros;
    if (apenasSuspeitos) {
      filtrados = filtrados.filter((o) => o._isSuspeito);
    }

    // Ordenação decrescente (maiores valores primeiro)
    return filtrados.sort((a, b) => b._metrosCalculados - a._metrosCalculados);
  }, [ordens, maquinaFiltro, busca, apenasSuspeitos]);

  const totalMetrosFiltrados = useMemo(() => {
    return ordensProcessadas.reduce((s, o) => s + (o._metrosCalculados || 0), 0);
  }, [ordensProcessadas]);

  const totalSuspeitos = useMemo(() => {
    return ordens.filter(o => o.status === "finalizado" && calcularMetrosPedido(o) >= 500).length;
  }, [ordens]);

  // Iniciar edição de uma ordem
  const handleIniciarEdicao = (ordem) => {
    if (!podeRetificar) {
      toast.error("Somente encarregado/gestor pode retificar metragens.");
      return;
    }
    setOrdemEdicao(ordem);
    const mAtual = calcularMetrosPedido(ordem);
    setMetrosDiretos(String(mAtual > 0 ? mAtual : ""));
    setPecas(String(ordem.quantidade || ordem.quantidade_telhas || 1));
    setComprimentoMm(String(ordem.metragem_mm || ""));
    setModoEdicao("direto");
  };

  const handleCancelarEdicao = () => {
    setOrdemEdicao(null);
    setMetrosDiretos("");
    setPecas("");
    setComprimentoMm("");
  };

  // Metros calculados no formulário
  const metrosFormulario = useMemo(() => {
    if (modoEdicao === "direto") {
      return parseFloat(String(metrosDiretos).replace(",", ".")) || 0;
    }
    const p = parseFloat(pecas) || 0;
    const mm = parseFloat(comprimentoMm) || 0;
    return (p * mm) / 1000;
  }, [modoEdicao, metrosDiretos, pecas, comprimentoMm]);

  // Salvar retificação
  const handleSalvarRetificacao = async () => {
    if (!ordemEdicao) return;
    if (metrosFormulario < 0 || isNaN(metrosFormulario)) {
      toast.error("Informe uma metragem válida maior ou igual a zero.");
      return;
    }

    setSalvando(true);
    try {
      const metrosAntigos = calcularMetrosPedido(ordemEdicao);
      const novosMetros = Number(metrosFormulario.toFixed(2));
      const novasPecas = parseFloat(pecas) || ordemEdicao.quantidade || 1;
      const novoMm = modoEdicao === "pecas_mm" ? (parseFloat(comprimentoMm) || 0) : (ordemEdicao.metragem_mm || 0);

      // Recalcular KG teórico de aço
      const espessura = parseFloat(ordemEdicao.espessura || ordemEdicao.chapa) || 0.43;
      const novoKg = Number(calcKgDeMetros(novosMetros, espessura).toFixed(1));

      // Histórico
      const hist = (() => {
        try {
          return JSON.parse(ordemEdicao.historico_alteracoes || "[]");
        } catch {
          return [];
        }
      })();

      hist.push({
        data: new Date().toISOString(),
        usuario: user?.full_name || user?.email || "—",
        acao: "retificacao_metros_pcp",
        detalhes: `Metragem retificada manualmente de ${metrosAntigos.toFixed(1)}m para ${novosMetros}m (Ajuste rápido Dashboard sem reiniciar na máquina).`,
        metros_antigos: metrosAntigos,
        metros_novos: novosMetros,
      });

      const payload = {
        metros: novosMetros,
        metros_totais: novosMetros,
        quantidade: novasPecas,
        quantidade_telhas: novasPecas,
        kg_total: novoKg,
        peso_kg: novoKg,
        historico_alteracoes: JSON.stringify(hist),
        // Mantém o status finalizado intacto para não mandar para a máquina de novo
        status: "finalizado",
      };

      if (novoMm > 0) {
        payload.metragem_mm = novoMm;
      }

      await base44.entities.Pedido.update(ordemEdicao.id, payload);

      toast.success(
        `Pedido #${ordemEdicao.numero_pedido || ordemEdicao.id} retificado para ${novosMetros.toFixed(1)}m!`
      );

      handleCancelarEdicao();
      if (onAtualizado) onAtualizado();
    } catch (err) {
      toast.error("Erro ao retificar metragem: " + (err.message || String(err)));
    } finally {
      setSalvando(false);
    }
  };

  // Zerar metragem (0m)
  const handleZerarMetros = async (ordem) => {
    if (!podeRetificar) {
      toast.error("Somente encarregado/gestor pode zerar metragens.");
      return;
    }
    if (!window.confirm(`Deseja realmente zerar os metros do pedido #${ordem.numero_pedido || ordem.id}? O pedido continuará finalizado, mas com 0 metros computados.`)) {
      return;
    }

    try {
      const hist = (() => {
        try {
          return JSON.parse(ordem.historico_alteracoes || "[]");
        } catch {
          return [];
        }
      })();

      hist.push({
        data: new Date().toISOString(),
        usuario: user?.full_name || user?.email || "—",
        acao: "zerar_metros_pcp",
        detalhes: "Metragem zerada para 0m (correção de valor aberrante/duplicado).",
      });

      await base44.entities.Pedido.update(ordem.id, {
        metros: 0,
        metros_totais: 0,
        kg_total: 0,
        peso_kg: 0,
        historico_alteracoes: JSON.stringify(hist),
        status: "finalizado",
      });

      toast.success(`Metros do pedido #${ordem.numero_pedido || ordem.id} zerados com sucesso!`);
      if (onAtualizado) onAtualizado();
    } catch (err) {
      toast.error("Erro ao zerar metros: " + err.message);
    }
  };

  // Excluir ordem duplicada/fantasma
  const handleExcluirOrdem = async (ordem) => {
    if (!podeRetificar) {
      toast.error("Somente encarregado/gestor pode excluir ordens.");
      return;
    }
    if (!window.confirm(`ATENÇÃO: Deseja EXCLUIR definitivamente a ordem #${ordem.numero_pedido || ordem.id} da máquina ${ordem.maquina}? Esta ação removerá totalmente esta ordem dos cálculos.`)) {
      return;
    }

    try {
      await base44.entities.Pedido.delete(ordem.id);
      toast.success(`Ordem #${ordem.numero_pedido || ordem.id} excluída com sucesso!`);
      if (onAtualizado) onAtualizado();
    } catch (err) {
      toast.error("Erro ao excluir ordem: " + err.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        className="w-[96vw] max-w-5xl max-h-[92vh] overflow-hidden flex flex-col p-0 border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl rounded-2xl"
      >
        {/* Topo / Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 bg-slate-900/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg font-black text-white tracking-tight">
                  Ajuste Rápido de Metragens de Telhas
                </DialogTitle>
                <Badge className="bg-blue-600/20 text-blue-400 border-blue-500/30 text-[10px] font-bold">
                  Auditoria de Metros
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-400 mt-0.5">
                Retifique ordens com metragens incorretas diretamente, <strong>sem enviar de volta para as máquinas</strong>.
                {!podeRetificar && (
                  <span className="text-amber-400 font-bold"> · Visualização somente leitura (ação exclusiva de Encarregado/Gestor).</span>
                )}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Exibido</p>
              <p className="text-base font-black text-blue-400">
                {totalMetrosFiltrados.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
              </p>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca */}
        <div className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-900/30 flex flex-col sm:flex-row items-center gap-2.5">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nº pedido, cliente, modelo ou OF..."
              className="pl-9 h-9 bg-slate-950 border-slate-800 text-xs text-white placeholder:text-slate-500 focus-visible:ring-blue-500"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Seletor de Máquina */}
            <select
              value={maquinaFiltro}
              onChange={(e) => setMaquinaFiltro(e.target.value)}
              className="h-9 px-3 rounded-md bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="todas">Todas as Máquinas</option>
              {maquinasDisponiveis.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            {/* Toggle de Suspeitos */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setApenasSuspeitos(!apenasSuspeitos)}
              className={`h-9 text-xs font-bold gap-1.5 border transition-all ${
                apenasSuspeitos
                  ? "bg-red-500/20 text-red-300 border-red-500/50 hover:bg-red-500/30"
                  : "bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-900"
              }`}
              title="Filtrar pedidos com valores muito altos (≥ 500m)"
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${apenasSuspeitos ? "text-red-400" : "text-amber-500"}`} />
              <span>Suspeitos ({totalSuspeitos})</span>
            </Button>
          </div>
        </div>

        {/* Modal/Gaveta de Edição se uma ordem estiver selecionada */}
        {ordemEdicao && (
          <div className="p-4 bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border-b border-blue-500/30 animate-in fade-in duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-sm text-white">
                  Editando Pedido #{ordemEdicao.numero_pedido || ordemEdicao.id}
                </span>
                <Badge variant="outline" className="border-blue-400/40 text-blue-300 text-[10px]">
                  {ordemEdicao.maquina || "Telha"}
                </Badge>
                <span className="text-xs text-slate-400 truncate max-w-xs">
                  {ordemEdicao.cliente || "Cliente s/ nome"}
                </span>
              </div>

              <button
                type="button"
                onClick={handleCancelarEdicao}
                className="text-slate-400 hover:text-white p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              {/* Abas de Modo */}
              <div className="sm:col-span-12 flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => setModoEdicao("direto")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    modoEdicao === "direto"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-800/80 text-slate-400 hover:text-white"
                  }`}
                >
                  Digitar Metros Totais Diretos
                </button>
                <button
                  type="button"
                  onClick={() => setModoEdicao("pecas_mm")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    modoEdicao === "pecas_mm"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "bg-slate-800/80 text-slate-400 hover:text-white"
                  }`}
                >
                  Calcular: Peças × Milímetros (mm)
                </button>
              </div>

              {modoEdicao === "direto" ? (
                <div className="sm:col-span-6">
                  <label className="text-[11px] font-bold text-slate-300 mb-1 block">
                    Metragem Linear Total (em metros)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      value={metrosDiretos}
                      onChange={(e) => setMetrosDiretos(e.target.value)}
                      placeholder="Ex: 60.5"
                      className="bg-slate-950 border-blue-500/50 text-base font-black text-blue-400 h-10 pr-8"
                      autoFocus
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      m
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-bold text-slate-300 mb-1 block">
                      Quantidade de Telhas
                    </label>
                    <Input
                      type="number"
                      value={pecas}
                      onChange={(e) => setPecas(e.target.value)}
                      placeholder="Ex: 10"
                      className="bg-slate-950 border-slate-700 h-10 text-sm font-bold text-white"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="text-[11px] font-bold text-slate-300 mb-1 block">
                      Comprimento em mm
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={comprimentoMm}
                        onChange={(e) => setComprimentoMm(e.target.value)}
                        placeholder="Ex: 6000 (6m)"
                        className="bg-slate-950 border-slate-700 h-10 text-sm font-bold text-white pr-9"
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                        mm
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Resultado e Ação */}
              <div className="sm:col-span-3 flex flex-col justify-end">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Novo Total</span>
                <span className="text-lg font-black text-emerald-400 leading-tight">
                  {metrosFormulario.toFixed(1)} metros
                </span>
              </div>

              <div className="sm:col-span-3 flex items-center gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelarEdicao}
                  className="h-10 text-xs border-slate-700 hover:bg-slate-800 text-slate-300"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleSalvarRetificacao}
                  disabled={salvando}
                  className="h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-lg shadow-emerald-950/40"
                >
                  {salvando ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Salvar Metros
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Lista de Ordens (Ordenadas do Maior para o Menor) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[300px]">
          {ordensProcessadas.length === 0 ? (
            <div className="py-16 text-center text-slate-500">
              <Ruler className="w-12 h-12 mx-auto mb-3 opacity-30 text-blue-400" />
              <p className="font-semibold text-sm">Nenhuma ordem encontrada com os filtros atuais.</p>
              <p className="text-xs text-slate-600 mt-1">Altere os filtros acima para visualizar mais pedidos.</p>
            </div>
          ) : (
            ordensProcessadas.map((ordem, idx) => {
              const metros = ordem._metrosCalculados;
              const isSuspeito = ordem._isSuspeito;
              const isSendoEditada = ordemEdicao?.id === ordem.id;

              return (
                <div
                  key={ordem.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isSendoEditada
                      ? "bg-blue-950/40 border-blue-500 ring-1 ring-blue-500/50"
                      : isSuspeito
                      ? "bg-red-950/20 border-red-500/40 hover:border-red-500/80"
                      : "bg-slate-900/60 border-slate-800/80 hover:border-slate-700"
                  }`}
                >
                  {/* Informações da Ordem */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-500">#{idx + 1}</span>
                      <h4 className="font-extrabold text-sm text-white flex items-center gap-1.5">
                        <span>Pedido #{ordem.numero_pedido || ordem.id}</span>
                        {ordem.of_nome && (
                          <Badge variant="outline" className="text-[10px] font-mono border-indigo-400/40 text-indigo-300">
                            OF: {ordem.of_nome}
                          </Badge>
                        )}
                      </h4>

                      <Badge className="bg-slate-800 text-slate-300 border-slate-700 text-[10px] font-bold">
                        {ordem.maquina || "Telha"}
                      </Badge>

                      {isSuspeito && (
                        <Badge className="bg-red-500/20 text-red-300 border-red-500/40 text-[10px] font-extrabold gap-1 animate-pulse">
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          VALOR ANORMAL (≥ 500m)
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                      <span className="font-medium text-slate-300 truncate max-w-[200px]">
                        {ordem.cliente || "Cliente não informado"}
                      </span>
                      <span>•</span>
                      <span className="truncate max-w-[180px] text-slate-400">
                        {ordem.produto || "Telha"}
                      </span>
                      <span>•</span>
                      <span className="text-slate-500 text-[11px]">
                        {ordem.data_finalizacao || ordem.data || "Sem data"}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1 font-mono">
                      Qtd original: <strong>{ordem.quantidade || ordem.quantidade_telhas || 1} peças</strong>
                      {ordem.metragem_mm ? ` × ${ordem.metragem_mm}mm` : ""}
                    </div>
                  </div>

                  {/* Valor Atual em Metros e Ações */}
                  <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto justify-between sm:justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                    <div className="text-right">
                      <span className={`text-base sm:text-lg font-black tracking-tight ${
                        isSuspeito ? "text-red-400" : "text-blue-400"
                      }`}>
                        {metros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}m
                      </span>
                      <p className="text-[10px] text-slate-500 font-medium">Metragem computada</p>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {podeRetificar ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleIniciarEdicao(ordem)}
                            className="h-8 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white gap-1 px-3 shadow-xs"
                            title="Editar metragem correta deste pedido"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleZerarMetros(ordem)}
                            className="h-8 text-xs font-semibold border-amber-500/40 text-amber-400 hover:bg-amber-500/10 px-2"
                            title="Zerar metros para 0m (sem excluir o pedido)"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span className="hidden md:inline">Zerar</span>
                          </Button>

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleExcluirOrdem(ordem)}
                            className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:border-red-500/50 border-slate-800"
                            title="Excluir ordem fantasma definitivamente"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <Badge className="bg-slate-800/80 text-slate-400 border-slate-700 gap-1 text-[10px] font-bold whitespace-nowrap">
                          <Lock className="w-3 h-3" />
                          Só Encarregado/Gestor
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}