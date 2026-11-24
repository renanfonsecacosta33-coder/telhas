import React, { lazy } from "react";
import DeferredPanel from "@/components/routing/DeferredPanel";

const DIALOGS = {
  detalhe: lazy(() => import("@/components/pcp/PedidoOdooDetalheDialog")),
  roteiro: lazy(() => import("@/components/pcp/ModalRoteamentoCD")),
  exclusoes: lazy(() => import("@/components/pcp/HistoricoExclusoesModal")),
  saude: lazy(() => import("@/components/pcp/CentralSaudeSistemaModal")),
  diagnostico: lazy(() => import("@/components/pcp/DiagnosticoOperacionalModal")),
  etapas: lazy(() => import("@/components/pcp/ModalFinalizarEtapasCalendario")),
  webhook: lazy(() => import("@/components/pcp/WebhookSimulatorDialog")),
  recuperar: lazy(() => import("@/components/pcp/RecuperarPedidoOdooDialog")),
  auditar: lazy(() => import("@/components/pcp/AuditarRestaurarOpsDialog")),
  transferir: lazy(() => import("@/components/pcp/TransferirLojaDialog")),
  historico: lazy(() => import("@/components/corte-dobra/HistoricoPedidoSidebar")),
  movimentacao: lazy(() => import("@/components/pcp/HistoricoMovimentacaoDialog")),
  guia: lazy(() => import("@/components/pops/GuiaOperacionalModal")),
  relatorio: lazy(() => import("@/components/pcp/RelatorioAuditoriaDiariaModal"))
};

export default function PcpDeferredDialogs({ dialogs }) {
  return <>{Object.entries(dialogs).map(([name, props]) => {
    const Component = DIALOGS[name];
    return <DeferredPanel key={name} when={Boolean(props.open)}><Component {...props} /></DeferredPanel>;
  })}</>;
}