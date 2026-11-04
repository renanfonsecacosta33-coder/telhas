import { getItens, classGrupo, localizarOpDoItem } from "@/lib/pedidoOdooHelper";
import { opDaMesmaOf } from "@/lib/opVinculoSeguro";

export default function temPendenciasDistribuicao(pedido, pedidosProducao = [], ordensCD = []) {
  if (!pedido || pedido.status_pcp !== "pendente_distribuicao") return false;
  const itens = getItens(pedido);
  const telhas = pedidosProducao.filter(op => opDaMesmaOf(op, pedido));
  const cd = ordensCD.filter(op => opDaMesmaOf(op, pedido));
  return itens.some(it => {
    if (it.concluido || it.status === "concluido") return false;
    const fonte = classGrupo(it) === "telha" ? telhas : cd;
    if (localizarOpDoItem(it, fonte, itens)) return false;
    return classGrupo(it) === "telha" || !it.distribuido;
  });
}