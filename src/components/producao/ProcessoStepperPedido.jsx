import React from "react";
import { CheckCircle2, Clock, Circle, ArrowRight, Factory, Package, Layers, Scissors, Truck, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isTelhaBandeja } from "@/lib/bandejaHelper";

/**
 * Determina o roteiro de processos de um pedido com base nas suas características.
 * Suporta Telhas (Simples e Sanduíche) e Corte & Dobra.
 */
export function calcularEtapasProcesso(pedido, setor = "telhas") {
  const isCD = setor === "corte_dobra" || pedido?.tipo_ordem === "cd" || pedido?.setor === "corte_dobra";
  const stGeral = (pedido?.status || pedido?.status_pcp || "").toLowerCase();
  const percentual = Number(pedido?.percentual_concluido) || (stGeral === "finalizado" || stGeral === "concluido" ? 100 : 0);

  // Verifica se o pedido é sanduíche (precisa de colagem)
  const desc = String(pedido?.produto || pedido?.modelo || pedido?.descricao || "").toLowerCase();
  const isSanduiche = desc.includes("sandu") || desc.includes("termo") || desc.includes("isopor") || desc.includes("eps") || desc.includes("pu") || desc.includes("filme");

  if (isCD) {
    // Roteiro Corte e Dobra: PCP -> Desbobinadeira -> Guilhotina (Corte) -> Dobradeira -> Expedição
    const hasDesb = Boolean(pedido?.ordem_desbobinadeira_id || pedido?.desbobinadeira_status || pedido?.bobina_id);
    const stDesb = (pedido?.desbobinadeira_status || "").toLowerCase();
    const stCorte = (pedido?.corte_status || "").toLowerCase();
    const stDobra = (pedido?.dobra_status || "").toLowerCase();

    return [
      {
        id: "pcp",
        label: "PCP",
        descricao: "Triagem e Programação",
        status: "concluido",
        icon: Factory,
      },
      {
        id: "desbobinadeira",
        label: "Desbobinadeira",
        descricao: hasDesb ? "Bobina vinculada" : "Aguardando corte de fita",
        status: percentual >= 100 || stDesb === "finalizado" ? "concluido" : (stDesb === "em_producao" ? "em_andamento" : "pendente"),
        icon: Package,
      },
      {
        id: "corte",
        label: "Corte / Guilhotina",
        descricao: "Corte nas medidas",
        status: percentual >= 100 || stCorte === "finalizado" ? "concluido" : (stCorte === "em_producao" || stGeral === "em_producao" ? "em_andamento" : "pendente"),
        icon: Scissors,
      },
      {
        id: "dobra",
        label: "Dobra",
        descricao: "Conformação e dobras",
        status: percentual >= 100 || stDobra === "finalizado" ? "concluido" : (stDobra === "em_producao" ? "em_andamento" : "pendente"),
        icon: Layers,
      },
      {
        id: "expedicao",
        label: "Expedição",
        descricao: "Pronto para despacho",
        status: percentual >= 100 ? "concluido" : "pendente",
        icon: Truck,
      },
    ];
  }

  // ── ROTEIRO ESPECIAL: TELHA BANDEJA ──
  // Central PCP -> Telha Superior (bobina da superior) -> Bandeja Inferior (bobina da inferior) -> Colagem -> Finalizado
  if (isTelhaBandeja(pedido)) {
    const maqNorm = String(pedido?.maquina || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const is100 = percentual >= 100 || stGeral === "finalizado" || stGeral === "concluido";
    const emColagem = maqNorm === "COLAGEM";
    const emBandeja = maqNorm === "BANDEJA";
    const perfilacaoConcluida = pedido?.perfilacao_concluida === true;
    const superiorPronta = is100 || perfilacaoConcluida || emBandeja || emColagem || stGeral === "aguardando_colagem";
    const bandejaPronta = is100 || perfilacaoConcluida || emColagem || stGeral === "aguardando_colagem";
    const rodando = stGeral === "em_producao" || stGeral === "pausado";

    return [
      {
        id: "pcp",
        label: "PCP",
        descricao: "Recebimento e Fila",
        status: "concluido",
        icon: Factory,
      },
      {
        id: "telha_superior",
        label: "Telha Superior",
        descricao: "Tirar telha superior com a bobina da telha superior",
        status: superiorPronta ? "concluido" : rodando ? "em_andamento" : "pendente",
        icon: Scissors,
      },
      {
        id: "bandeja_inferior",
        label: "Bandeja",
        descricao: "Tirar a telha inferior (bandeja) com a bobina da telha inferior",
        status: bandejaPronta ? "concluido" : (rodando && emBandeja) ? "em_andamento" : "pendente",
        icon: Layers,
      },
      {
        id: "colagem",
        label: "Colagem",
        descricao: "Ir para a colagem!",
        status: is100 ? "concluido" : (rodando && emColagem) ? "em_andamento" : "pendente",
        icon: Package,
      },
      {
        id: "finalizado",
        label: "Finalizado",
        descricao: "Processo finalizado",
        status: is100 ? "concluido" : "pendente",
        icon: CheckCircle2,
      },
    ];
  }

  // Roteiro Telhas: PCP -> Bobina -> Perfiladeira -> (Colagem se sanduíche) -> Expedição
  const hasBobina = Boolean(pedido?.bobina_superior || pedido?.bobina_id || pedido?.rvm_superior);
  const stProd = stGeral === "em_producao" || stGeral === "distribuido" || percentual > 0;
  const is100 = percentual >= 100 || stGeral === "finalizado" || stGeral === "concluido";

  const etapas = [
    {
      id: "pcp",
      label: "PCP",
      descricao: "Recebimento e Fila",
      status: "concluido",
      icon: Factory,
    },
    {
      id: "bobina",
      label: "Bobina",
      descricao: hasBobina ? "Matéria-prima alocada" : "Aguardando bobina",
      status: is100 || hasBobina ? "concluido" : "pendente",
      icon: Package,
    },
    {
      id: "perfiladeira",
      label: "Perfiladeira",
      descricao: pedido?.maquina || "Máquina de telhas",
      status: is100 ? "concluido" : (stProd ? "em_andamento" : "pendente"),
      icon: Scissors,
    },
  ];

  if (isSanduiche) {
    const colagemOk = is100 || stGeral === "colagem_concluida";
    const colagemAndamento = stGeral === "aguardando_colagem" || stGeral === "em_colagem";
    etapas.push({
      id: "colagem",
      label: "Colagem EPS",
      descricao: "Injeção e colagem",
      status: colagemOk ? "concluido" : (colagemAndamento ? "em_andamento" : "pendente"),
      icon: Layers,
    });
  }

  etapas.push({
    id: "expedicao",
    label: "Expedição",
    descricao: "Concluído e Liberado",
    status: is100 ? "concluido" : "pendente",
    icon: Truck,
  });

  return etapas;
}

/**
 * Stepper Visual Interativo de Processos
 * - modo "compacto": barra fina para tabelas
 * - modo "completo": badges interativos para cards
 */
export default function ProcessoStepperPedido({
  pedido,
  setor = "telhas",
  compacto = false,
  onEtapaClick = null,
  className = "",
}) {
  const etapas = calcularEtapasProcesso(pedido, setor);

  if (compacto) {
    return (
      <div className={`flex flex-wrap items-center gap-x-1 gap-y-1 bg-slate-50 dark:bg-slate-900/60 p-1 rounded-md border border-slate-200 dark:border-slate-800 ${className}`}>
        {etapas.map((et, idx) => {
          const isUltima = idx === etapas.length - 1;
          const isDone = et.status === "concluido";
          const isProgress = et.status === "em_andamento";

          return (
            <React.Fragment key={et.id}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEtapaClick?.(et, pedido);
                }}
                title={`${et.label}: ${et.descricao} (${et.status === "concluido" ? "Concluído" : et.status === "em_andamento" ? "Em Produção" : "Pendente"})`}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                  isDone
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                    : isProgress
                    ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 animate-pulse font-extrabold"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700 opacity-60 hover:opacity-100"
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600 dark:text-emerald-400" />
                ) : isProgress ? (
                  <Clock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400 animate-spin" />
                ) : (
                  <Circle className="w-2.5 h-2.5" />
                )}
                <span>{et.label}</span>
              </button>
              {!isUltima && (
                <ArrowRight className="w-2.5 h-2.5 text-slate-300 dark:text-slate-600 shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground px-0.5">
        <span>Roteiro de Processos</span>
        <span className="text-[10px] font-semibold text-slate-400">
          {etapas.filter(e => e.status === "concluido").length}/{etapas.length} etapas
        </span>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap bg-slate-50/70 dark:bg-slate-900/40 p-2 rounded-xl border border-slate-200/80 dark:border-slate-800">
        {etapas.map((et, idx) => {
          const isUltima = idx === etapas.length - 1;
          const isDone = et.status === "concluido";
          const isProgress = et.status === "em_andamento";
          const IconComp = et.icon || Circle;

          return (
            <React.Fragment key={et.id}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onEtapaClick?.(et, pedido);
                }}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isDone
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20"
                    : isProgress
                    ? "bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40 shadow-xs ring-1 ring-amber-400/50 hover:bg-amber-500/30 font-bold"
                    : "bg-white dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:border-slate-300 opacity-75 hover:opacity-100"
                }`}
                title={`Etapa: ${et.label}\nStatus: ${isDone ? "100% Concluído" : isProgress ? "Em Produção na Máquina" : "Aguardando Início"}\nClique para ver detalhes desta etapa`}
              >
                <div className="shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : isProgress ? (
                    <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 animate-spin" />
                  ) : (
                    <IconComp className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <div className="text-left">
                  <span className="block text-[11px] leading-tight font-bold">{et.label}</span>
                  <span className="text-[9px] block text-muted-foreground leading-tight truncate max-w-[85px]">
                    {isDone ? "Pronto" : isProgress ? "Rodando" : "Fila"}
                  </span>
                </div>
              </button>
              {!isUltima && (
                <ArrowRight className="w-3 h-3 text-slate-300 dark:text-slate-600 shrink-0 mx-0.5" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}