import React, { useState, useMemo, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Play, RotateCcw, Settings2, ChevronDown, ChevronUp,
  Layers, Package, AlertTriangle, CheckCircle2, BarChart2, Scissors,
  Sparkles, CheckCheck
} from "lucide-react";
import PainelPecas from "./PainelPecas";
import PainelChapas from "./PainelChapas";
import VisualizacaoChapa from "./VisualizacaoChapa";
import { otimizarCorte } from "./algoritmo";
import { gerarId, corPeca } from "./types";

export default function OtimizadorCorte({ devInicial = null }) {
  const queryClient = useQueryClient();
  const [pecas, setPecas] = useState(() => {
    if (devInicial) {
      return [{
        id: gerarId(),
        nome: devInicial.nome_peca || "Peça",
        comprimento: String(devInicial.comprimento_desenvolvido_mm || devInicial.comprimento_final_mm || ""),
        largura: String(devInicial.largura_mm || devInicial.largura_final_mm || ""),
        quantidade: String(devInicial.quantidade_peca || "1"),
      }];
    }
    return [];
  });
  const [chapas, setChapas] = useState([
    { id: gerarId(), nome: "Padrão 3000×1200", comprimento: "3000", largura: "1200", quantidade: "5", origem: "manual" },
  ]);
  const [kerf, setKerf] = useState("3");
  const [permitirRotacao, setPermitirRotacao] = useState(true);
  const [resultado, setResultado] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [mostrarOpcoes, setMostrarOpcoes] = useState(false);
  const [chapaAtiva, setChapaAtiva] = useState(0);
  const [executandoCorte, setExecutandoCorte] = useState(false);

  // Busca chapas disponíveis do estoque CD
  const { data: chapasCDEstoque = [] } = useQuery({
    queryKey: ["chapas-cd-otimizador"],
    queryFn: () => base44.entities.ChapaCD.list("-data_corte", 100),
    select: (data) => data.filter(c =>
      c.status !== "consumido" && c.status !== "cancelado" &&
      c.comprimento_mm > 0 && c.largura_mm > 0
    ),
  });

  // Busca retalhos disponíveis do estoque CD
  const { data: retalhosEstoque = [] } = useQuery({
    queryKey: ["retalhos-cd-otimizador"],
    queryFn: () => base44.entities.RetalhoCD.list("-created_date", 100),
    select: (data) => data.filter(r => r.status === "disponivel"),
  });

  const calcular = useCallback(() => {
    setCalculando(true);
    setTimeout(() => {
      const res = otimizarCorte(pecas, chapas, {
        kerf: parseFloat(kerf) || 0,
        permitirRotacao,
      });
      setResultado(res);
      setChapaAtiva(0);
      setCalculando(false);
    }, 200);
  }, [pecas, chapas, kerf, permitirRotacao]);

  const limpar = () => {
    setResultado(null);
    setPecas([]);
    setChapas([{ id: gerarId(), nome: "Padrão 3000×1200", comprimento: "3000", largura: "1200", quantidade: "5", origem: "manual" }]);
    setKerf("3");
  };

  // Executa corte em lote (baixa das chapas e cadastro automático de todos os retalhos)
  const handleExecutarCorteCompleto = async () => {
    if (!resultado || resultado.chapasUsadas.length === 0) return;
    setExecutandoCorte(true);

    try {
      let retalhosCriadosQtd = 0;
      let chapasBaixadasQtd = 0;

      for (const chapaResult of resultado.chapasUsadas) {
        const c = chapaResult.chapa;
        // 1. Dá baixa na chapa do estoque se for vinculada
        if (c.chapa_cd_id) {
          const chapaAtual = chapasCDEstoque.find(item => item.id === c.chapa_cd_id);
          if (chapaAtual) {
            const novaQtd = Math.max(0, (chapaAtual.quantidade_disponivel || 1) - 1);
            await base44.entities.ChapaCD.update(c.chapa_cd_id, {
              quantidade_disponivel: novaQtd,
              status: novaQtd === 0 ? "consumido" : chapaAtual.status,
            });
            chapasBaixadasQtd++;
          }
        } else if (c.retalho_id) {
          await base44.entities.RetalhoCD.update(c.retalho_id, {
            status: "consumido",
            observacoes: "Consumido no Otimizador de Corte",
          });
          chapasBaixadasQtd++;
        }

        // 2. Cadastra todos os retalhos úteis gerados por essa chapa
        const retalhosUteis = (chapaResult.retalhos || []).filter(r => r.ehUtil);
        for (const ret of retalhosUteis) {
          const espessura = devInicial?.espessura_mm || c.espessura_mm || 1.5;
          const material = devInicial?.material || c.material || "Aço galvanizado";
          const areaCm2 = Math.round(ret.area / 100);
          const volDm3 = (ret.w / 1000) * (ret.h / 1000) * (espessura / 1000) * 1000;
          const pesoEstimado = Number((volDm3 * 7.85).toFixed(2));

          await base44.entities.RetalhoCD.create({
            origem: "corte_chapa",
            material,
            espessura_mm: Number(espessura),
            comprimento_mm: ret.w,
            largura_mm: ret.h,
            area_cm2: areaCm2,
            peso_estimado_kg: pesoEstimado,
            status: "disponivel",
            data_entrada: new Date().toISOString().split("T")[0],
            observacoes: `Gerado via Otimizador (Chapa ${c.nome || "Manual"})`,
          });
          retalhosCriadosQtd++;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["chapas-cd-otimizador"] });
      queryClient.invalidateQueries({ queryKey: ["retalhos-cd-otimizador"] });
      queryClient.invalidateQueries({ queryKey: ["retalhos-cd"] });

      toast.success(
        `Corte registrado com sucesso! ${chapasBaixadasQtd > 0 ? `${chapasBaixadasQtd} matéria(s)-prima baixada(s). ` : ""}${retalhosCriadosQtd} retalho(s) útil(eis) cadastrado(s) no estoque!`
      );
    } catch (err) {
      console.error("Erro ao registrar corte:", err);
      toast.error("Erro ao registrar corte no sistema.");
    } finally {
      setExecutandoCorte(false);
    }
  };

  const podeCalcular = pecas.some(p => parseFloat(p.comprimento) > 0 && parseFloat(p.largura) > 0 && parseInt(p.quantidade) > 0)
    && chapas.some(c => parseFloat(c.comprimento) > 0 && parseFloat(c.largura) > 0);

  const stats = resultado?.stats;

  return (
    <div className="flex flex-col gap-0 h-full min-h-[calc(100vh-200px)]">
      {/* Banner de desenvolvimento vinculado */}
      {devInicial && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-200 flex items-center justify-between gap-2 text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600 shrink-0" />
            <span>Peça em desenvolvimento: <strong>{devInicial.nome_peca}</strong></span>
            {devInicial.comprimento_desenvolvido_mm && (
              <span className="text-blue-700 font-bold">· Blank: {devInicial.comprimento_desenvolvido_mm} mm</span>
            )}
          </div>
          {devInicial.espessura_mm && (
            <Badge variant="outline" className="bg-white border-blue-300 text-blue-800 text-[10px]">
              e = {devInicial.espessura_mm} mm
            </Badge>
          )}
        </div>
      )}

      {/* Top bar — ações globais */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-card border-b border-border sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <Scissors className="w-5 h-5 text-orange-500" />
          <span className="font-bold text-sm">Otimizador & Aproveitamento 2D</span>
          {resultado && (
            <Badge className="bg-orange-100 text-orange-800 border-orange-200 text-[10px] font-semibold">
              {resultado.chapasUsadas.length} chapa(s) cortada(s)
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMostrarOpcoes(!mostrarOpcoes)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border border-border hover:border-foreground/30 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Opções
            {mostrarOpcoes ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={limpar}>
            <RotateCcw className="w-3.5 h-3.5" />
            Limpar
          </Button>
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5 bg-orange-500 hover:bg-orange-600 font-bold px-4"
            onClick={calcular}
            disabled={!podeCalcular || calculando}
          >
            {calculando ? (
              <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5 fill-white" />
            )}
            Calcular Corte
          </Button>
          {resultado && resultado.chapasUsadas.length > 0 && (
            <Button
              size="sm"
              onClick={handleExecutarCorteCompleto}
              disabled={executandoCorte}
              className="h-8 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 font-bold text-white shadow-xs"
            >
              {executandoCorte ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              Registrar Corte & Salvar Retalhos
            </Button>
          )}
        </div>
      </div>

      {/* Opções (Kerf e Rotação) */}
      {mostrarOpcoes && (
        <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Espessura do corte (kerf):</Label>
            <Input
              type="number"
              min="0"
              step="0.5"
              value={kerf}
              onChange={e => setKerf(e.target.value)}
              className="h-7 w-20 text-xs"
            />
            <span className="text-xs text-muted-foreground">mm (0 mm p/ guilhotina)</span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Permitir rotação da peça:</Label>
            <button
              onClick={() => setPermitirRotacao(!permitirRotacao)}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${permitirRotacao ? "bg-orange-500" : "bg-muted-foreground/30"}`}
            >
              <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${permitirRotacao ? "translate-x-4" : "translate-x-1"}`} />
            </button>
            <span className="text-xs text-muted-foreground">{permitirRotacao ? "Sim (90°)" : "Não (respeitar sentido do grão)"}</span>
          </div>
        </div>
      )}

      {/* Layout split */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Coluna esquerda — inputs de Peças e Chapas */}
        <div className="w-full lg:w-[420px] lg:min-w-[380px] border-r border-border overflow-y-auto">
          <div className="p-4 space-y-6">
            <PainelPecas pecas={pecas} onChange={setPecas} />
            <div className="border-t border-border" />
            <PainelChapas
              chapas={chapas}
              onChange={setChapas}
              chapasCDEstoque={chapasCDEstoque}
              retalhosEstoque={retalhosEstoque}
            />
          </div>
        </div>

        {/* Coluna direita — visualização do resultado */}
        <div className="flex-1 overflow-y-auto bg-muted/20">
          {!resultado ? (
            <div className="flex flex-col items-center justify-center h-full min-h-64 text-center p-8 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center">
                <Scissors className="w-8 h-8 text-orange-400" />
              </div>
              <div>
                <p className="font-bold text-foreground">Otimizador de Corte Guilhotinado 2D</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Defina as peças e chapas ao lado e clique em <strong>Calcular Corte</strong>.<br />
                  O sistema gerará o mapa visual e identificará automaticamente os retalhos úteis.
                </p>
              </div>
              {!podeCalcular && pecas.length > 0 && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 max-w-xs text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  Informe as dimensões (comprimento e largura) de todas as peças e chapas
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Stats globais com aproveitamento direto e com retalhos */}
              {stats && (
                <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xs">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <BarChart2 className="w-4 h-4 text-orange-500" />
                      <span className="font-bold text-sm">Resumo Geral do Aproveitamento</span>
                    </div>
                    {stats.aproveitamento_com_retalhos && (
                      <span className="text-xs text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                        Aproveitamento Global (Peças + Retalhos): {stats.aproveitamento_com_retalhos}%
                      </span>
                    )}
                  </div>
                  <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <StatGlobal
                      label="Chapas Usadas"
                      value={stats.chapas_usadas}
                      icon={<Layers className="w-4 h-4 text-slate-500" />}
                    />
                    <StatGlobal
                      label="Peças Encaixadas"
                      value={`${stats.pecas_encaixadas}/${stats.total_pecas}`}
                      icon={<Package className="w-4 h-4 text-emerald-500" />}
                      color={stats.nao_couberam === 0 ? "text-emerald-700" : "text-amber-700"}
                    />
                    <StatGlobal
                      label="Aproveitamento Útil"
                      value={`${stats.aproveitamento_geral}%`}
                      icon={<CheckCircle2 className="w-4 h-4 text-orange-500" />}
                      color={
                        parseFloat(stats.aproveitamento_geral) >= 85 ? "text-emerald-700" :
                        parseFloat(stats.aproveitamento_geral) >= 65 ? "text-amber-700" : "text-red-600"
                      }
                      big
                    />
                    <StatGlobal
                      label="Retalhos Úteis"
                      value={`${((stats.area_retalhos_mm2 || 0) / 1e6).toFixed(3)} m²`}
                      icon={<Sparkles className="w-4 h-4 text-teal-500" />}
                      color="text-teal-700"
                    />
                    <StatGlobal
                      label="Sucata Real"
                      value={`${((stats.area_sucata_mm2 || stats.area_desperdicada_mm2) / 1e6).toFixed(3)} m²`}
                      color="text-red-600"
                    />
                    <StatGlobal
                      label="Total de Cortes"
                      value={stats.total_cortes}
                      icon={<Scissors className="w-4 h-4 text-slate-400" />}
                    />
                  </div>
                </div>
              )}

              {/* Peças que não couberam */}
              {resultado.naoCouberam.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <span className="font-bold text-sm text-red-700">
                      {resultado.naoCouberam.length} peça(s) não couberam nas chapas selecionadas
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resultado.naoCouberam.map((p, i) => (
                      <span key={i} className="text-xs bg-red-100 border border-red-200 text-red-700 rounded-lg px-2.5 py-1.5">
                        <span className="font-bold">{p.nome || `Peça`}</span>
                        <span className="text-red-500 ml-1">({p.comp}×{p.larg}mm)</span>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-red-600 mt-2">
                    Adicione mais chapas no painel esquerdo para acomodar as peças restantes.
                  </p>
                </div>
              )}

              {/* Navegação de chapas */}
              {resultado.chapasUsadas.length > 1 && (
                <div className="flex items-center gap-2 flex-wrap bg-card border border-border rounded-xl p-2.5">
                  <span className="text-xs font-bold text-muted-foreground">Ir para Chapa:</span>
                  {resultado.chapasUsadas.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setChapaAtiva(i)}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all border ${
                        chapaAtiva === i
                          ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                          : "bg-muted/40 border-border text-muted-foreground hover:border-orange-300"
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>
              )}

              {/* Legenda de cores */}
              {pecas.length > 0 && (
                <div className="bg-card border border-border rounded-xl p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold mb-2">Legenda de Peças</p>
                  <div className="flex flex-wrap gap-2">
                    {pecas.filter(p => parseFloat(p.comprimento) > 0).map((p, idx) => (
                      <div key={p.id} className="flex items-center gap-1.5 text-xs bg-muted/40 px-2 py-1 rounded-md border border-border/50">
                        <div className="w-3 h-3 rounded-xs" style={{ backgroundColor: corPeca(idx) }} />
                        <span className="text-foreground font-medium">{p.nome || `Peça ${idx + 1}`}</span>
                        <span className="text-muted-foreground font-mono">({p.comprimento}×{p.largura}mm)</span>
                        <span className="bg-muted font-bold rounded px-1 text-[10px]">×{p.quantidade}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-1.5 text-xs bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200 text-emerald-800">
                      <div className="w-3 h-3 rounded-xs border border-dashed border-emerald-600 bg-emerald-200" />
                      <span className="font-bold">Retalho Útil Aproveitável</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs bg-red-50 px-2 py-1 rounded-md border border-red-200 text-red-700">
                      <div className="w-3 h-3 rounded-xs border border-dashed border-red-400 bg-red-100" />
                      <span>Sucata Residual / Aparas</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Visualizações das chapas */}
              {resultado.chapasUsadas.map((cr, i) => (
                <div
                  key={i}
                  id={`chapa-${i}`}
                  className={i !== chapaAtiva && resultado.chapasUsadas.length > 1 ? "opacity-35 hover:opacity-100 transition-opacity" : ""}
                >
                  <VisualizacaoChapa chapaResult={cr} index={i} devVinculado={devInicial} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatGlobal({ label, value, icon, color = "text-foreground", big = false }) {
  return (
    <div className="bg-muted/40 rounded-xl px-3 py-2.5 flex flex-col gap-1 border border-border/40">
      {icon && <div>{icon}</div>}
      <p className={`font-black ${big ? "text-2xl" : "text-lg"} ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
    </div>
  );
}