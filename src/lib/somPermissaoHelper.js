/**
 * Helper de permissão para sinais e alertas sonoros das máquinas na AJL.
 *
 * REGRA DO CHÃO DE FÁBRICA:
 * "Os sinais das máquinas têm que chegar só para quem no cadastro está como OPERADOR
 * e com a MÁQUINA SELECIONADA!"
 *
 * Administradores, gerentes, PCP, vendedores e operadores de outras máquinas
 * vêem os dados na tela mas NUNCA escutam beeps, sirenes ou vozes das máquinas.
 */

export function isOperadorDestaMaquina(usuario, maquinaNome = "") {
  if (!usuario) return false;
  
  // Apenas operadores escutam sinais sonoros da máquina
  if (usuario.role !== "operador") return false;

  const maqNorm = String(maquinaNome || "").toUpperCase().replace(/[\s\-_]/g, "");
  if (!maqNorm) return false;

  let maquinasDoUser = [];
  try {
    if (Array.isArray(usuario.maquinas)) {
      maquinasDoUser = usuario.maquinas;
    } else if (typeof usuario.maquina === "string") {
      try {
        const parsed = JSON.parse(usuario.maquina);
        if (Array.isArray(parsed)) maquinasDoUser = parsed;
        else maquinasDoUser = [usuario.maquina];
      } catch {
        maquinasDoUser = [usuario.maquina];
      }
    }
  } catch {
    maquinasDoUser = usuario.maquina ? [usuario.maquina] : [];
  }

  return maquinasDoUser.some((m) => {
    const uNorm = String(m || "").toUpperCase().replace(/[\s\-_]/g, "");
    if (!uNorm) return false;
    return uNorm === maqNorm || maqNorm.includes(uNorm) || uNorm.includes(maqNorm);
  });
}
