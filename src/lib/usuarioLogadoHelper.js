import { base44 } from "@/api/base44Client";

/**
 * Helper unificado para capturar o nome do funcionário autenticado no sistema.
 * Prioridade:
 * 1. Nome passado explicitamente (se válido e diferente de 'PCP')
 * 2. full_name do usuário autenticado no Base44
 * 3. name do usuário
 * 4. Parte antes do @ do e-mail formatada
 * 5. Fallback para "Operador do PCP"
 */
export async function obterNomeUsuarioLogado(usuarioParam = null) {
  if (usuarioParam && typeof usuarioParam === "string" && usuarioParam.trim() && usuarioParam.trim().toUpperCase() !== "PCP") {
    return usuarioParam.trim();
  }
  try {
    const me = await base44.auth.me().catch(() => null);
    if (me?.full_name && me.full_name.trim()) return me.full_name.trim();
    if (me?.name && me.name.trim()) return me.name.trim();
    if (me?.email) {
      const parte = me.email.split("@")[0].replace(/[._-]/g, " ").trim();
      return parte.split(" ").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
    }
  } catch {
    // ignora falha de rede
  }
  return "Operador do PCP";
}

/**
 * Versão síncrona para usar direto em componentes React quando já temos o user do contexto
 */
export function extrairNomeUsuario(user) {
  if (!user) return "Operador do PCP";
  if (user.full_name && user.full_name.trim()) return user.full_name.trim();
  if (user.name && user.name.trim()) return user.name.trim();
  if (user.email) {
    const parte = user.email.split("@")[0].replace(/[._-]/g, " ").trim();
    return parte.split(" ").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" ");
  }
  return "Operador do PCP";
}
