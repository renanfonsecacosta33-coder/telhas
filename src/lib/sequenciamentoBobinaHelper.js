import { extrairInfoBobinasPedido, normalizarEspessura } from "@/lib/bobinaStatusHelper";

/**
 * Retorna a chave padronizada do material da ordem para agrupamento inteligente de setup
 * Ex: "NATURAL_0,43", "NATURAL_0,50", "COR_PRETA_0,43", "COR_BRANCA_0,43"
 */
export function getChaveMaterialOrdem(pedido) {
  if (!pedido) return "INDEFINIDO";
  const info = extrairInfoBobinasPedido(pedido);

  // Espessura principal
  let esp = "0,43"; // fallback mais comum na fábrica
  if (info.espessurasNaturais && info.espessurasNaturais.size > 0) {
    esp = Array.from(info.espessurasNaturais)[0];
  } else if (pedido.espessura) {
    esp = normalizarEspessura(pedido.espessura) || "0,43";
  } else if (pedido.chapa) {
    esp = normalizarEspessura(pedido.chapa) || "0,43";
  }

  if (info.isNatural) {
    return `NATURAL_${esp}`;
  }

  // Se for pré-pintada
  let corNome = "COR";
  if (info.isPreta) corNome = "PRETA";
  else if (info.isBranca) corNome = "BRANCA";
  else if (info.isAzul) corNome = "AZUL";
  else if (info.isCinza) corNome = "CINZA";
  else if (info.isCeramica) corNome = "CERAMICA";
  else if (info.isBege) corNome = "BEGE";
  else if (info.isVermelha) corNome = "VERMELHA";
  else if (info.isVerde) corNome = "VERDE";
  else if (info.isMarrom) corNome = "MARROM";

  return `COR_${corNome}_${esp}`;
}

/**
 * Retorna um nome legível para exibição ao operador da chave do material
 * Ex: "Natural 0,43", "Preta 0,43", "Branca 0,50"
 */
export function formatNomeMaterial(chaveMaterial = "") {
  if (!chaveMaterial || chaveMaterial === "INDEFINIDO") return "Material Padrão";
  if (chaveMaterial.startsWith("NATURAL_")) {
    const esp = chaveMaterial.replace("NATURAL_", "");
    return `Natural (Galvalume) ${esp}`;
  }
  if (chaveMaterial.startsWith("COR_")) {
    const partes = chaveMaterial.replace("COR_", "").split("_");
    const cor = partes[0] || "Cor";
    const esp = partes[1] || "0,43";
    const corFormatada = cor.charAt(0).toUpperCase() + cor.slice(1).toLowerCase();
    return `Pré-Pintada ${corFormatada} ${esp}`;
  }
  return chaveMaterial;
}

/**
 * Identifica a bobina/material atualmente instalado na máquina
 */
export function detectarBobinaInstaladaNaMaquina(maquinaNome, pedidos = [], todasBobinas = []) {
  const storageKey = `ajl_bobina_instalada_${maquinaNome}`;
  let manual = null;
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) manual = JSON.parse(saved);
  } catch {}

  // 1. Se o operador fixou manualmente uma bobina e ela ainda é válida
  if (manual && (manual.codigo || manual.chaveMaterial)) {
    return manual;
  }

  // 2. Se há pedido atualmente rodando (em_producao)
  const opRodando = pedidos.find(p => p.status === "em_producao");
  if (opRodando) {
    const chave = getChaveMaterialOrdem(opRodando);
    const bobCod = opRodando.bobina_superior || opRodando.bobina_codigo || opRodando.bobina_superior_id || "";
    return {
      codigo: bobCod || "Bobina em Produção",
      chaveMaterial: chave,
      nomeMaterial: formatNomeMaterial(chave),
      origem: "producao_ativa"
    };
  }

  // 3. Se há pedido recentemente finalizado
  const opFinalizada = pedidos.find(p => p.status === "finalizado" && (p.data_finalizacao || p.hora_perfilacao));
  if (opFinalizada) {
    const chave = getChaveMaterialOrdem(opFinalizada);
    const bobCod = opFinalizada.bobina_superior || opFinalizada.bobina_codigo || opFinalizada.bobina_superior_id || "";
    return {
      codigo: bobCod || "Última Bobina Utilizada",
      chaveMaterial: chave,
      nomeMaterial: formatNomeMaterial(chave),
      origem: "ultimo_finalizado"
    };
  }

  // 4. Fallback padrão: assume o material do primeiro pedido pendente da máquina
  const primeiroPendente = pedidos.find(p => p.status === "pendente");
  if (primeiroPendente) {
    const chave = getChaveMaterialOrdem(primeiroPendente);
    return {
      codigo: primeiroPendente.bobina_superior || "Aguardando Início",
      chaveMaterial: chave,
      nomeMaterial: formatNomeMaterial(chave),
      origem: "fila_inicial"
    };
  }

  return {
    codigo: "Nenhuma bobina definida",
    chaveMaterial: "NATURAL_0,43",
    nomeMaterial: "Natural (Galvalume) 0,43",
    origem: "padrao"
  };
}

/**
 * Algoritmo de Sequenciamento Inteligente para Redução de Setup:
 * 1º: Em Produção e Pausados no topo absoluto
 * 2º: P1 Urgência Máxima (nunca ultrapassados)
 * 3º: Mesma Bobina Instalada (Campanha sem troca de setup)
 * 4º: Agrupamento em blocos das próximas bobinas/materiais (mesma cor e espessura juntas)
 * 5º: Desempate por Rota, Atrasados e FIFO
 */
export function sequenciarFilaPorSetupBobina(pedidosAFazer = [], bobinaInstalada = null, hojeStr = "") {
  if (!pedidosAFazer || pedidosAFazer.length === 0) return [];

  const chaveInstalada = bobinaInstalada?.chaveMaterial || "NATURAL_0,43";

  // Identifica e marca cada pedido com sua chave de material e se bate com a bobina instalada
  const pedidosEnriquecidos = pedidosAFazer.map(p => {
    const chave = getChaveMaterialOrdem(p);
    const mesmaBobina = chave === chaveInstalada;
    return {
      ...p,
      _chaveMaterial: chave,
      _nomeMaterial: formatNomeMaterial(chave),
      _mesmaBobinaInstalada: mesmaBobina
    };
  });

  // Separação em grupos estratégicos:
  // Grupo A: Em produção ou pausados (não podem ser reordenados)
  const ativos = pedidosEnriquecidos.filter(p => p.status === "em_producao" || p.status === "pausado");

  // Grupo B: P1 Urgências Máximas pendentes (soberania absoluta)
  const p1Urgentes = pedidosEnriquecidos.filter(p =>
    p.status !== "em_producao" && p.status !== "pausado" && (p.prioridade || p.prioridade_nivel === 1)
  );

  // Grupo C: Pedidos normais pendentes (onde o sequenciamento inteligente atua)
  const pendentesNormais = pedidosEnriquecidos.filter(p =>
    p.status !== "em_producao" && p.status !== "pausado" && !p.prioridade && p.prioridade_nivel !== 1
  );

  // Subgrupo C1: Mesma bobina instalada
  const mesmaBobinaPendentes = pendentesNormais.filter(p => p._mesmaBobinaInstalada);

  // Subgrupo C2: Outras bobinas pendentes, agrupadas por chave de material
  const outrasBobinasPendentes = pendentesNormais.filter(p => !p._mesmaBobinaInstalada);

  // Agrupa as outras bobinas por bloco de material
  const blocosOutrasBobinas = new Map();
  outrasBobinasPendentes.forEach(p => {
    if (!blocosOutrasBobinas.has(p._chaveMaterial)) {
      blocosOutrasBobinas.set(p._chaveMaterial, []);
    }
    blocosOutrasBobinas.get(p._chaveMaterial).push(p);
  });

  // Ordena os blocos pelo tamanho da campanha (maior volume primeiro) ou ordem de entrada
  const blocosOrdenados = Array.from(blocosOutrasBobinas.entries()).sort((a, b) => {
    // Bloco com mais pedidos vem primeiro para consolidar volume
    return b[1].length - a[1].length;
  });

  // Função interna de desempate de pedidos dentro do mesmo bloco: Rota -> Atrasados -> FIFO -> Metros
  const ordenarDentroDoBloco = (arr) => {
    return arr.sort((a, b) => {
      // 1. Rota primeiro
      const aRota = a.rota ? 0 : 1;
      const bRota = b.rota ? 0 : 1;
      if (aRota !== bRota) return aRota - bRota;

      // 2. Atrasados
      const aAtrasado = (a.data && a.data < hojeStr) ? 0 : 1;
      const bAtrasado = (b.data && b.data < hojeStr) ? 0 : 1;
      if (aAtrasado !== bAtrasado) return aAtrasado - bAtrasado;

      // 3. FIFO
      const dataDiff = String(a.data || "").localeCompare(String(b.data || ""));
      if (dataDiff !== 0) return dataDiff;

      // 4. Metros decrescente
      return (b.metros || 0) - (a.metros || 0);
    });
  };

  const ativosOrdenados = ativos.sort((a, b) => (a.status === "em_producao" ? -1 : 1));
  const p1Ordenados = ordenarDentroDoBloco([...p1Urgentes]);
  const mesmaBobinaOrdenados = ordenarDentroDoBloco([...mesmaBobinaPendentes]);

  const outrosBlocosOrdenados = [];
  blocosOrdenados.forEach(([chave, lista]) => {
    outrosBlocosOrdenados.push(...ordenarDentroDoBloco(lista));
  });

  // Fila consolidada final
  return [
    ...ativosOrdenados,
    ...p1Ordenados,
    ...mesmaBobinaOrdenados,
    ...outrosBlocosOrdenados
  ];
}

/**
 * Insere divisores visuais na fila entre trocas de material para alertar o operador
 */
export function inserirDivisoresTrocaSetup(filaOrdenada = []) {
  if (!filaOrdenada || filaOrdenada.length <= 1) return filaOrdenada;

  const resultado = [];
  let ultimoMaterial = null;

  filaOrdenada.forEach((p, idx) => {
    // Não insere divisor antes do primeiro item ou antes de itens em produção ativa
    if (idx > 0 && p.status !== "em_producao" && p.status !== "pausado") {
      const materialAtual = p._chaveMaterial;
      if (ultimoMaterial && materialAtual && materialAtual !== ultimoMaterial) {
        // Encontra quantos pedidos seguintes pertencem a esse novo material
        let qtd = 0;
        let metros = 0;
        for (let j = idx; j < filaOrdenada.length; j++) {
          if (filaOrdenada[j]._chaveMaterial === materialAtual) {
            qtd++;
            metros += Number(filaOrdenada[j].metros || 0);
          } else {
            break;
          }
        }

        resultado.push({
          _isDivisorTrocaBobina: true,
          _idDivisor: `divisor_${idx}_${materialAtual}`,
          materialAnteriorNome: formatNomeMaterial(ultimoMaterial),
          proximoMaterialNome: formatNomeMaterial(materialAtual),
          chaveMaterial: materialAtual,
          qtdPedidos: qtd,
          metrosTotal: metros
        });
      }
    }

    resultado.push(p);
    if (p._chaveMaterial) {
      ultimoMaterial = p._chaveMaterial;
    }
  });

  return resultado;
}
