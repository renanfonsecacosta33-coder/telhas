/**
 * Helper para gestão e sincronização de fluxo paralelo de Telha Bandeja
 * - Telha Superior perfila na máquina da telha (ex: TP - 40, COLONIAL, TP - 25)
 * - Bandeja Inferior perfila na máquina BANDEJA
 * - Ambas rodam em paralelo com bobinas e etiquetas próprias
 * - A máquina de COLAGEM exibe a ordem porém BLOQUEADA até que ambas as metades estejam finalizadas
 */

export function isTelhaBandeja(pedido) {
  if (!pedido) return false;
  const prod = String(pedido.produto || "").toUpperCase().trim();
  return prod === "TELHA BANDEJA" || prod.includes("BANDEJA");
}

export function gerarIdentificadorGrupoBandeja(numeroPedido, opId = "") {
  const ped = String(numeroPedido || "AVULSO").replace(/\D+/g, "") || Date.now();
  return `BANDEJA_PED_${ped}_${opId || Date.now()}`;
}

/**
 * Monta as 3 ordens necessárias para uma Telha Bandeja:
 * 1. Telha Superior (máquina da telha: TP - 40, etc.)
 * 2. Bandeja Inferior (máquina BANDEJA)
 * 3. Colagem Final (máquina COLAGEM - bloqueada até as anteriores terminarem)
 */
export function montarTriadeTelhaBandeja(dataPrincipal) {
  const grupoId = dataPrincipal.grupo_bandeja_id || gerarIdentificadorGrupoBandeja(dataPrincipal.numero_pedido);
  const maquinaTelha = dataPrincipal.maquina && dataPrincipal.maquina !== "BANDEJA" && dataPrincipal.maquina !== "COLAGEM"
    ? dataPrincipal.maquina
    : "TP - 40";

  // 1. Ordem da Telha Superior (perfiladeira normal)
  const ordemTelha = {
    ...dataPrincipal,
    maquina: maquinaTelha,
    maquina_origem: maquinaTelha,
    tipo_componente_bandeja: "telha_superior",
    nome_componente: `TELHA SUPERIOR (${maquinaTelha})`,
    etiqueta_identificacao: `TELHA SUPERIOR (${maquinaTelha}) - BANDEJA`,
    status: dataPrincipal.status || "pendente",
    grupo_bandeja_id: grupoId,
    // Bobina da chapa superior
    bobina_superior_id: dataPrincipal.bobina_superior_id || "",
    bobina_superior: dataPrincipal.bobina_superior || "",
    kg_superior: dataPrincipal.kg_superior || "",
    // Não precisa de bobina inferior nesta máquina
    bobina_inferior_id: "",
    bobina_inferior: "",
    kg_inferior: "",
  };

  // 2. Ordem da Bandeja Inferior (máquina BANDEJA)
  const ordemBandeja = {
    ...dataPrincipal,
    maquina: "BANDEJA",
    maquina_origem: "BANDEJA",
    tipo_componente_bandeja: "bandeja_inferior",
    nome_componente: "BANDEJA INFERIOR",
    etiqueta_identificacao: "BANDEJA INFERIOR - COMPONENTE",
    status: dataPrincipal.status || "pendente",
    grupo_bandeja_id: grupoId,
    // A bobina da bandeja usa a bobina_inferior selecionada no formulário
    bobina_superior_id: dataPrincipal.bobina_inferior_id || dataPrincipal.bobina_superior_id || "",
    bobina_superior: dataPrincipal.bobina_inferior || dataPrincipal.bobina_superior || "",
    kg_superior: dataPrincipal.kg_inferior || dataPrincipal.kg_superior || "",
    bobina_inferior_id: "",
    bobina_inferior: "",
    kg_inferior: "",
  };

  // 3. Ordem da Colagem (máquina COLAGEM)
  const ordemColagem = {
    ...dataPrincipal,
    maquina: "COLAGEM",
    maquina_origem: maquinaTelha,
    tipo_componente_bandeja: "colagem_final",
    nome_componente: "TELHA BANDEJA COMPLETA",
    etiqueta_identificacao: "TELHA BANDEJA COMPLETA [TELHA + EPS + BANDEJA]",
    status: "aguardando_colagem",
    bloqueado_colagem: true,
    grupo_bandeja_id: grupoId,
    eps: dataPrincipal.eps || "EPS - TP 40 BANDEJA",
  };

  return { ordemTelha, ordemBandeja, ordemColagem, grupoId };
}

/**
 * Avalia o status dos componentes de uma Telha Bandeja
 * Retorna se a Colagem está liberada e os status detalhados de cada metade
 */
export function verificarStatusComponentesBandeja(pedido, todosPedidos = []) {
  if (!isTelhaBandeja(pedido)) {
    return { isBandeja: false, liberadoColagem: true };
  }

  const grupoId = pedido.grupo_bandeja_id;
  const numPed = pedido.numero_pedido ? String(pedido.numero_pedido).trim().toUpperCase() : null;

  // Busca ordens irmãs
  const ordensDoGrupo = todosPedidos.filter(o => {
    if (o.status === "cancelado") return false;
    if (grupoId && o.grupo_bandeja_id) {
      return o.grupo_bandeja_id === grupoId;
    }
    if (numPed && o.numero_pedido) {
      return String(o.numero_pedido).trim().toUpperCase() === numPed && isTelhaBandeja(o);
    }
    return false;
  });

  const opTelha = ordensDoGrupo.find(o => o.tipo_componente_bandeja === "telha_superior" || (o.maquina !== "BANDEJA" && o.maquina !== "COLAGEM"));
  const opBandeja = ordensDoGrupo.find(o => o.tipo_componente_bandeja === "bandeja_inferior" || o.maquina === "BANDEJA");

  const telhaFinalizada = opTelha ? opTelha.status === "finalizado" : false;
  const bandejaFinalizada = opBandeja ? opBandeja.status === "finalizado" : false;

  // Se ambas as partes terminaram, a colagem está 100% liberada
  const liberadoColagem = telhaFinalizada && bandejaFinalizada;

  let mensagemBloqueio = "";
  if (!telhaFinalizada && !bandejaFinalizada) {
    mensagemBloqueio = "Aguardando perfilação da Telha Superior e da Bandeja";
  } else if (!telhaFinalizada) {
    mensagemBloqueio = "Aguardando perfilação da Telha Superior (Bandeja já concluída)";
  } else if (!bandejaFinalizada) {
    mensagemBloqueio = "Aguardando perfilação da Bandeja (Telha Superior já concluída)";
  }

  return {
    isBandeja: true,
    grupoId,
    opTelha,
    opBandeja,
    telhaFinalizada,
    bandejaFinalizada,
    liberadoColagem,
    mensagemBloqueio,
    statusTelha: opTelha?.status || "pendente",
    statusBandeja: opBandeja?.status || "pendente",
    maquinaTelha: opTelha?.maquina || "TP - 40",
  };
}
