import { base44 } from "@/api/base44Client";
import { getItens, buildItensJson } from "@/lib/pedidoOdooHelper";
import { distribuirPedidoPCP } from "@/lib/distribuicaoPcpHelper";
import { hojeLocalISO } from "@/lib/dataLocal";

export default function useProgramacaoPcp({ bobinasEstoque, filialAtiva, queryClient, toast, setPedidoSelecionado }) {
  const salvar = async (pedido, programados, distribuir, indicesAlvo = null) => {
    try {
      let atualizado;
      if (distribuir) {
        ({ atualizado } = await distribuirPedidoPCP({ pedido, bobinasEstoque, filialAtiva, itensProgramados: programados, indicesAlvo, forcarRoteamento: true }));
      } else {
        const atual = await base44.entities.PedidoOdoo.get(pedido.id);
        const itens = getItens(atual).map((it, idx) => {
          if (indicesAlvo && !indicesAlvo.includes(idx)) return it;
          return { ...it, maquina: programados[idx]?.maquina || it.maquina || "", data_programada: programados[idx]?.data_programada || it.data_programada || hojeLocalISO() };
        });
        const log = JSON.parse(atual.historico_log || "[]");
        log.push({ data: new Date().toISOString(), usuario: "PCP", acao: "programacao_itens", detalhes: "Programação salva sem alterar a distribuição ou a produção." });
        atualizado = await base44.entities.PedidoOdoo.update(atual.id, { itens_json: buildItensJson(itens), historico_log: JSON.stringify(log) });
      }
      setPedidoSelecionado({ ...pedido, ...atualizado });
      toast({ title: distribuir ? "Distribuição confirmada" : "Programação salva", description: distribuir ? "Os destinos das telhas foram confirmados antes de atualizar o PCP." : "Máquina e data salvas sem enviar itens para produção." });
    } catch (e) {
      toast({ title: "Não foi possível concluir a programação", description: e.message, variant: "destructive" });
    } finally {
      for (const prefixo of ["pedidos-odoo-pcp", "pedidos-producao-todos", "pedidos", "resumo-pcp"]) queryClient.invalidateQueries({ queryKey: [prefixo] });
    }
  };
  const handleProgramarItem = (pedido, idx, { maquina, data_programada, distribuir = false }) => {
    const itens = getItens(pedido);
    if (!itens[idx]) return;
    itens[idx] = { ...itens[idx], maquina: maquina || itens[idx].maquina || "", data_programada: data_programada || itens[idx].data_programada || hojeLocalISO() };
    return salvar(pedido, itens, distribuir, [idx]);
  };
  const handleProgramarTodosItens = (pedido, itens, distribuir = true) => salvar(pedido, itens, distribuir);
  return { handleProgramarItem, handleProgramarTodosItens };
}