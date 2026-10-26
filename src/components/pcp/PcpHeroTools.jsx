import React from "react";
import {
  Search,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  Activity,
  History,
  BookOpen,
  ChevronDown,
  Inbox,
  Layers
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "@/components/ui/dropdown-menu";

/* ─────────────────────────────────────────────────────────────
   FAIXA HERO DA CENTRAL PCP — ferramentas de manutenção sobre
   a imagem do galpão (topo da coluna principal).
   ───────────────────────────────────────────────────────────── */

const TOOL_BTN =
  "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-white/20 bg-white/10 text-white text-[13px] font-semibold cursor-pointer backdrop-blur-[6px] transition-colors duration-150 hover:bg-white/20 active:bg-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500";

export default function PcpHeroTools({
  onRecuperarPedido,
  onAuditar,
  onAbrirRelatorio,
  onConciliacaoManual,
  conciliando,
  relatorioAuditoria,
  onAbrirSaude,
  onAbrirExclusoes,
  exclusoesCount,
  onAbrirPop
}) {
  const temPendencias =
    relatorioAuditoria?.errosCorrigidosCount > 0 || relatorioAuditoria?.alertasPendentesCount > 0;

  return (
    <div className="relative h-[210px] shrink-0 overflow-hidden bg-slate-900 lg:ml-60">
      <img
        src="https://media.base44.com/images/public/6a0467e5d5ff5dda4351d2c3/fe3d832b1_generated_2462f3d5.jpg"
        alt="Bobinas de aço no galpão"
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900/95 to-slate-900/55" />
      <div className="relative h-full px-4 sm:px-7 py-6 flex flex-col justify-center gap-3.5">
        <p className="text-white/50 text-[11px] font-semibold uppercase tracking-[0.08em]">
          Manutenção · Diagnóstico · Históricos · Guias Operacionais
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRecuperarPedido} title="Localizar pedido ou OF que sumiu ou verificar status no banco" className={TOOL_BTN}>
            <Search className="w-3.5 h-3.5" />
            Recuperar Pedido
          </button>
          <button type="button" onClick={onAuditar} title="Auditar OPs no chão de fábrica e restaurar modelos e bobinas corrompidos" className={TOOL_BTN}>
            <ShieldCheck className="w-3.5 h-3.5" />
            Auditar &amp; Restaurar OPs
          </button>
          <button
            type="button"
            onClick={onAbrirRelatorio}
            title="Ver Relatório Diário de Auditoria e Saúde do Sistema (Rumo a Erro 0)"
            className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border text-[13px] font-semibold cursor-pointer backdrop-blur-[6px] transition-colors duration-150 ${
              temPendencias
                ? "bg-amber-500/20 border-amber-400/50 text-amber-200 hover:bg-amber-500/30"
                : "bg-white/10 border-white/20 text-white hover:bg-white/20"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {relatorioAuditoria
              ? `Saúde: ${relatorioAuditoria.scoreSaude}% (${relatorioAuditoria.alertasPendentesCount > 0 ? `${relatorioAuditoria.alertasPendentesCount} pendências` : "Erro 0"})`
              : "Auditoria Diária"}
          </button>
          <button
            type="button"
            onClick={onConciliacaoManual}
            disabled={conciliando}
            title="Varre todas as máquinas e baixa pedidos que já foram finalizados ou cancelados no PCP"
            className={`${TOOL_BTN} disabled:opacity-60`}
          >
            <CheckCircle2 className={`w-3.5 h-3.5 ${conciliando ? "animate-spin" : ""}`} />
            {conciliando ? "Limpando Máquinas..." : "Baixar Finalizados"}
          </button>
          <button
            type="button"
            onClick={onAuditar}
            title="Recolher e resetar todas as OPs das máquinas de volta para o PCP (exceto Colagem)"
            className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg border border-red-400/40 bg-red-500/15 text-red-200 text-[13px] font-semibold cursor-pointer backdrop-blur-[6px] transition-colors duration-150 hover:bg-red-500/25 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset / Recolher Máquinas
          </button>
          <button
            type="button"
            onClick={onAbrirSaude}
            title="Central de Saúde 360°: Diagnóstico de conectividade, Odoo ERP, banco de dados e meta Erro Zero"
            className={TOOL_BTN}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            Saúde do Sistema
            <span className="ml-0.5 bg-emerald-600 text-white text-[10px] px-1.5 rounded-full font-mono font-bold">
              100% OK
            </span>
          </button>
          <button
            type="button"
            onClick={onAbrirExclusoes}
            title="Ver histórico e motivos de todas as ordens de fabricação excluídas no PCP"
            className={TOOL_BTN}
          >
            <History className="w-3.5 h-3.5 text-red-400" />
            Histórico de Exclusões
            {exclusoesCount > 0 && (
              <span className="ml-0.5 bg-red-500 text-white text-[10px] px-1.5 rounded-full font-bold">
                {exclusoesCount}
              </span>
            )}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Guias Operacionais e Fluxogramas do PCP"
                className={TOOL_BTN}
              >
                <BookOpen className="w-3.5 h-3.5 text-blue-300" />
                Guias do PCP
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuItem
                onClick={() => onAbrirPop("PCP_CENTRAL")}
                className="gap-2 cursor-pointer text-xs font-semibold py-2"
              >
                <Inbox className="w-4 h-4 text-orange-500 shrink-0" />
                <div>
                  <p className="font-bold">POP: Central PCP & Odoo</p>
                  <p className="text-[10px] text-slate-500 font-normal">Recepção de pedidos e filtros</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onAbrirPop("PCP_FILA")}
                className="gap-2 cursor-pointer text-xs font-semibold py-2"
              >
                <Layers className="w-4 h-4 text-blue-500 shrink-0" />
                <div>
                  <p className="font-bold">POP: Gestão da Fila PCP</p>
                  <p className="text-[10px] text-slate-500 font-normal">FIFO, Prioridade P1 e Bloqueios</p>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}