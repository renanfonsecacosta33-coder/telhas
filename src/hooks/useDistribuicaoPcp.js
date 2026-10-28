import { useState } from "react";
import { distribuirLotePedidos, distribuirPedidoPCP } from "@/lib/distribuicaoPcpHelper";
import { isAutoRoteamentoTelhasAtivo } from "@/lib/autoBobinaTelhasHelper";
import { iniciarEnvio, concluirEnvio, cancelarEnvio, ID_LOTE_ENVIO } from "@/lib/envioDistribuicaoStore";

/**
 * Handlers de distribuição de OFs da Central PCP (individual e em lote).
 * Extraídos de CentralPCP.jsx para hook dedicado.
 * Cada envio é registrado no envioDistribuicaoStore — os cards da fila
 * mostram a % subindo (1 → 100%), o tempo decorrido e há quanto tempo
 * foi enviado, para dar visibilidade à demora do envio às máquinas.
 */
export default function useDistribuicaoPcp({
  bobinasEstoque = [],
  filialAtiva = "todas",
  queryClient,
  toast,
  setPedidoSelecionado,
  setSelecionados,
}) {
  const [distribuindo, setDistribuindo] = useState(false);

  const handleDistribuir = async (pedido) => {
    setDistribuindo(true); iniciarEnvio([pedido.id]);
    try {
      const { atualizado, telhasAutoRoteadas, bobinasVinculadas } = await distribuirPedidoPCP({
        pedido,
        bobinasEstoque,
        filialAtiva
      });

      concluirEnvio([pedido.id]);
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-pcp"] });
      setPedidoSelecionado({ ...pedido, ...atualizado });

      if (telhasAutoRoteadas > 0) {
        toast({
          title: "⚡ Telhas Roteadas Direto p/ Máquinas!",
          description: `#${pedido.numero_pedido}: ${telhasAutoRoteadas} telha(s) nas perfiladeiras (${bobinasVinculadas} com bobina vinculada pelo Odoo). C&D na fila normal.`,
          className: "border-amber-500/40"
        });
      } else {
        toast({
          title: "Pedido distribuído!",
          description: `#${pedido.numero_pedido} enviado para os galpões.`,
          className: "border-blue-500/40"
        });
      }
    } catch (e) {
      cancelarEnvio([pedido.id]);
      toast({ title: "Erro ao distribuir", description: e.message, variant: "destructive" });
    } finally {
      setDistribuindo(false);
    }
  };

  const handleDistribuirLote = async (pedidosADistribuir, opcoes = {}) => {
    if (!pedidosADistribuir || pedidosADistribuir.length === 0) return;
    const idsLote = pedidosADistribuir.map(p => p.id).filter(Boolean);
    setDistribuindo(true); iniciarEnvio([...idsLote, ID_LOTE_ENVIO]);
    try {
      const autoTelhasAtivo = isAutoRoteamentoTelhasAtivo();
      const { sucesso, telhasCount, preservadosManual, falhas, ultimoErro } = await distribuirLotePedidos({
        pedidos: pedidosADistribuir,
        opcoes,
        bobinasEstoque,
        filialAtiva
      });

      concluirEnvio([...idsLote, ID_LOTE_ENVIO]);
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-pcp"] });
      queryClient.refetchQueries({ queryKey: ["pedidos-odoo-pcp"] });
      setSelecionados(new Set());
      if (sucesso > 0) {
        toast({
          title: `🚀 ${sucesso} pedidos distribuídos!`,
          description: autoTelhasAtivo && telhasCount > 0
            ? `${sucesso} pedido(s) distribuído(s) — ${telhasCount} item(ns) de telhas enviados direto às máquinas com bobina automática. C&D na fila normal.${preservadosManual ? ` ${preservadosManual} devolvido(s) manualmente foram preservados no PCP.` : ""}`
            : `Todas as ordens selecionadas foram encaminhadas simultaneamente para as filas dos galpões.${preservadosManual ? ` ${preservadosManual} devolvido(s) manualmente foram preservados no PCP.` : ""}`,
          className: "border-emerald-500/40"
        });
        if (falhas > 0) {
          toast({
            title: `⚠️ ${falhas} pedido(s) NÃO foram distribuídos`,
            description: `${ultimoErro || "A OP não foi criada na máquina."} As OFs continuam na fila do PCP.`,
            variant: "destructive"
          });
        }
      } else if (falhas > 0) {
        toast({
          title: `Falha na distribuição`,
          description: `${ultimoErro || `Não foi possível distribuir ${falhas} pedido(s).`} As OFs continuam na fila do PCP.`,
          variant: "destructive"
        });
      }
    } catch (e) {
      cancelarEnvio([...idsLote, ID_LOTE_ENVIO]);
      toast({ title: "Erro na distribuição em lote", description: e.message, variant: "destructive" });
    } finally {
      setDistribuindo(false);
    }
  };

  return { distribuindo, handleDistribuir, handleDistribuirLote };
}