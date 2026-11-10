import { useState, useRef } from "react";
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
  const envioAtivo = useRef(false);

  const handleDistribuir = async (pedido, roteiroCDPorItem = null) => {
    if (envioAtivo.current) return;
    envioAtivo.current = true;
    setDistribuindo(true); iniciarEnvio([pedido.id]);
    try {
      const { atualizado, telhasAutoRoteadas, bobinasVinculadas, cdAutoRoteados } = await distribuirPedidoPCP({
        pedido,
        bobinasEstoque,
        filialAtiva,
        roteiroCDPorItem
      });

      concluirEnvio([pedido.id]);
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-maquina-cd-todas"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desb-todas"] });
      queryClient.invalidateQueries({ queryKey: ["ordens-desbobinadeira"] });
      setPedidoSelecionado({ ...pedido, ...atualizado });

      const partesMsg = [];
      if (telhasAutoRoteadas > 0) partesMsg.push(`${telhasAutoRoteadas} telha(s) nas perfiladeiras`);
      if (cdAutoRoteados > 0) partesMsg.push(`${cdAutoRoteados} item(ns) de C&D direto nas máquinas`);

      if (partesMsg.length > 0) {
        toast({
          title: "⚡ Produção Roteada Direto p/ as Máquinas!",
          description: `#${pedido.numero_pedido}: ${partesMsg.join(" e ")}.`,
          className: "border-emerald-500/40"
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
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      toast({ title: "Erro ao distribuir", description: e.message, variant: "destructive" });
    } finally {
      envioAtivo.current = false;
      setDistribuindo(false);
    }
  };

  const handleDistribuirLote = async (entrada, opcoes = {}) => {
    const pedidosADistribuir = Array.isArray(entrada) ? entrada : entrada?.ofs || [];
    if (!pedidosADistribuir.length || envioAtivo.current) return;
    envioAtivo.current = true;
    const idsLote = pedidosADistribuir.map(p => p.id).filter(Boolean);
    setDistribuindo(true); iniciarEnvio([...idsLote, ID_LOTE_ENVIO]);
    try {
      const autoTelhasAtivo = isAutoRoteamentoTelhasAtivo();
      const { sucesso, telhasCount, preservadosManual, falhas, ultimoErro, idsSucesso, idsFalha } = await distribuirLotePedidos({
        pedidos: pedidosADistribuir,
        opcoes,
        bobinasEstoque,
        filialAtiva
      });

      // Selo "Enviado" só para quem realmente foi distribuído; quem falhou volta
      // a mostrar o botão Distribuir e continua pendente na fila do PCP.
      if (idsSucesso.length > 0) concluirEnvio(idsSucesso);
      if (idsFalha.length > 0) cancelarEnvio(idsFalha);
      if (sucesso > 0) concluirEnvio([ID_LOTE_ENVIO]);
      else cancelarEnvio([ID_LOTE_ENVIO]);
      queryClient.invalidateQueries({ queryKey: ["pedidos-odoo-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos-producao-todos"] });
      queryClient.invalidateQueries({ queryKey: ["bobinas-estoque-pcp"] });
      queryClient.invalidateQueries({ queryKey: ["pedidos"] });
      queryClient.invalidateQueries({ queryKey: ["resumo-pcp"] });
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
      envioAtivo.current = false;
      setDistribuindo(false);
    }
  };

  return { distribuindo, handleDistribuir, handleDistribuirLote };
}