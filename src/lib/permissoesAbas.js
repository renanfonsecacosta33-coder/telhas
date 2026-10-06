/**
 * Sistema de Controle Granular de Abas e Menus por Usuário.
 * Permite aos administradores definirem exatamente quais abas/rotas
 * cada usuário pode visualizar e acessar dentro dos aplicativos AJL (Telhas, Corte & Dobra, Expedição).
 */

export const ESTRUTURA_ABAS_APLICATIVOS = [
  {
    appId: "telhas",
    appNome: "🏗️ Barracão Telhas",
    abas: [
      { id: "telhas_dashboard", label: "Dashboard / Início", path: "/" },
      { id: "telhas_producao", label: "Produção Geral", path: "/producao" },
      { id: "telhas_estoque_dashboard", label: "Estoque por Espessura", path: "/estoque-dashboard" },
      { id: "telhas_bobinas", label: "Bobinas", path: "/bobinas" },
      { id: "telhas_isopor", label: "Estoque Isopor (EPS)", path: "/isopor" },
      { id: "telhas_corte_eps", label: "Corte de EPS", path: "/maquina/corte-eps" },
      { id: "telhas_cola", label: "Cola", path: "/cola" },
      { id: "telhas_estoque", label: "Outros Produtos", path: "/estoque" },
      { id: "telhas_mapa", label: "Mapa do Barracão", path: "/mapa-barracao" },
      { id: "telhas_logistica", label: "Logística Telhas", path: "/telhas/logistica" },
      { id: "telhas_configuracoes", label: "Configurações da Fábrica", path: "/configuracoes" },
    ]
  },
  {
    appId: "corte_dobra",
    appNome: "✂️ Barracão Corte & Dobra",
    abas: [
      { id: "cd_dashboard", label: "Dashboard", path: "/corte-dobra" },
      { id: "cd_catalogo", label: "Catálogo", path: "/corte-dobra/catalogo" },
      { id: "cd_desenvolvimento", label: "Desenvolvimento", path: "/corte-dobra/desenvolvimento" },
      { id: "cd_producao", label: "Produção Geral", path: "/corte-dobra/producao" },
      { id: "cd_estoque_dashboard", label: "Estoque por Espessura", path: "/corte-dobra/estoque-dashboard" },
      { id: "cd_retalhos", label: "Retalhos", path: "/corte-dobra/retalhos" },
      { id: "cd_calculos", label: "Cálculos", path: "/corte-dobra/calculos" },
      { id: "cd_bobinas", label: "Bobinas", path: "/corte-dobra/bobinas" },
      { id: "cd_chaparia", label: "Chaparia", path: "/corte-dobra/chaparia" },
      { id: "cd_slitter", label: "Slitter", path: "/corte-dobra/slitter" },
      { id: "cd_epi", label: "EPI", path: "/corte-dobra/epi" },
      { id: "cd_mapa", label: "Mapa do Barracão", path: "/corte-dobra/mapa" },
      { id: "cd_logistica", label: "Logística", path: "/corte-dobra/logistica" },
      { id: "cd_configuracoes", label: "Configurações da Fábrica", path: "/corte-dobra/configuracoes" },
    ]
  },
  {
    appId: "expedicao",
    appNome: "📦 Expedição",
    abas: [
      { id: "exp_dashboard", label: "Dashboard", path: "/expedicao" },
      { id: "exp_recebimento", label: "Recebimento", path: "/expedicao/recebimento" },
      { id: "exp_saida", label: "Saída de Material", path: "/expedicao/saida" },
      { id: "exp_reservas", label: "Reservas", path: "/expedicao/reservas" },
      { id: "exp_devolucoes", label: "Devoluções", path: "/expedicao/devolucoes" },
      { id: "exp_estoque", label: "Estoque Acabado", path: "/expedicao/estoque" },
      { id: "exp_mapa", label: "Mapa Armazenagem", path: "/expedicao/mapa" },
      { id: "exp_frisada", label: "Frisada", path: "/expedicao/frisada" },
      { id: "exp_historico", label: "Histórico", path: "/expedicao/historico" },
      { id: "exp_logistica", label: "Logística", path: "/expedicao/logistica" },
    ]
  }
];

/**
 * Retorna uma lista com todos os IDs de abas disponíveis no ecossistema
 */
export function getTodasAbasIds() {
  const ids = [];
  ESTRUTURA_ABAS_APLICATIVOS.forEach(app => {
    app.abas.forEach(aba => ids.push(aba.id));
  });
  return ids;
}

/**
 * Normaliza a lista de abas permitidas do usuário
 */
export function extrairAbasPermitidas(user) {
  if (!user) return null;
  let abas = user.abas_permitidas;
  if (!abas && user.permissions && user.permissions.abas_permitidas) {
    abas = user.permissions.abas_permitidas;
  }
  if (typeof abas === "string") {
    try {
      abas = JSON.parse(abas);
    } catch {
      abas = abas.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  if (Array.isArray(abas)) {
    return abas;
  }
  return null;
}

/**
 * Verifica se o usuário tem permissão para uma aba ou caminho específico.
 * - Administradores e Super Admins SEMPRE têm acesso a tudo.
 * - Se o usuário não tiver restrições configuradas (null ou undefined), tem acesso liberado por padrão.
 * - Se tiver restrições configuradas (array), verifica se a aba ou rota está contida no array.
 */
export function usuarioTemPermissaoAba(user, abaIdOuPath) {
  if (!user) return true;
  if (user.role === "super_admin" || user.role === "admin" || user.email === "renanfonsecacosta33@gmail.com") {
    return true;
  }

  const permitidas = extrairAbasPermitidas(user);
  if (!permitidas || permitidas.length === 0) {
    // Padrão permissivo se o gestor ainda não restringiu nada
    return true;
  }

  // Se passou o ID da aba diretamente
  if (permitidas.includes(abaIdOuPath)) {
    return true;
  }

  // Se passou a rota (path), busca se a rota bate com alguma aba autorizada
  for (const app of ESTRUTURA_ABAS_APLICATIVOS) {
    for (const aba of app.abas) {
      if (aba.path === abaIdOuPath || aba.id === abaIdOuPath) {
        return permitidas.includes(aba.id) || permitidas.includes(aba.path);
      }
    }
  }

  return false;
}
