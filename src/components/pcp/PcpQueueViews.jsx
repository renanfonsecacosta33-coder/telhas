import React, { lazy } from "react";
import DeferredPanel from "@/components/routing/DeferredPanel";
import DeferredQueueItem from "@/components/pcp/DeferredQueueItem";
import PedidoOdooGrupoCard from "@/components/pcp/PedidoOdooGrupoCard";
import PedidoOdooCard from "@/components/pcp/PedidoOdooCard";
import { calcularProgressoRealPedido } from "@/lib/pedidoOdooHelper";

const Table = lazy(() => import("@/components/pcp/FilaPCPTabelaView"));
const Kanban = lazy(() => import("@/components/pcp/FilaPCPKanbanView"));
const Calendar = lazy(() => import("@/components/pcp/CalendarioPcpView"));

export default function PcpQueueViews({ viewMode, mode, orders, groups, calendarGroups, productionOrders, cdOrders, selected, expanded, onToggleGroup, groupProps, cardProps, viewProps }) {
  const dataProps = { pedidosProducao: productionOrders, ordensCD: cdOrders };
  if (["tabela", "kanban", "calendario"].includes(viewMode)) {
    const Component = viewMode === "tabela" ? Table : viewMode === "kanban" ? Kanban : Calendar;
    const calendar = viewMode === "calendario";
    return <DeferredPanel><Component
      {...viewProps} {...dataProps}
      pedidos={orders}
      gruposPedidos={calendar ? calendarGroups : groups}
      pedidosFiltrados={calendar ? calendarGroups : orders}
      estoqueContext={groupProps.estoqueContext}
      selecionados={selected}
    /></DeferredPanel>;
  }
  if (mode === "agrupado") return <div className="space-y-3">
    {groups.map((group, index) => <DeferredQueueItem key={group.numero_pedido} eager={index < 6} label={`Pedido #${group.numero_pedido} · ${group.cliente_nome}`}>
      <PedidoOdooGrupoCard {...groupProps} {...dataProps} grupo={group} selecionados={selected}
        expandido={expanded.has(group.numero_pedido)} onToggle={() => onToggleGroup(group.numero_pedido)} />
    </DeferredQueueItem>)}
  </div>;
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
    {orders.map((order, index) => <DeferredQueueItem key={order.id} eager={index < 6} label={`OF ${order.of_nome || order.of_odoo_id || order.numero_pedido} · ${order.cliente_nome || ""}`}>
      <PedidoOdooCard {...cardProps} {...dataProps} pedido={order}
        progressoReal={calcularProgressoRealPedido(order, productionOrders, cdOrders)}
        selecionado={selected.has(order.id)} onClick={() => viewProps.onOpenDetalhe(order)} />
    </DeferredQueueItem>)}
  </div>;
}