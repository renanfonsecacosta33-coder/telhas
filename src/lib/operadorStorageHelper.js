/**
 * Helper centralizado para fixação e persistência do operador por máquina/tablet.
 * Garante que o operador selecionado permaneça fixo em todas as ordens e turnos.
 */

export function getChaveOperadorMaquina(maquina) {
  const norm = String(maquina || "").toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return `operador_fixo_${norm}`;
}

export function obterOperadorFixoMaquina(maquina) {
  if (!maquina) return "";
  try {
    const key = getChaveOperadorMaquina(maquina);
    const salvo = localStorage.getItem(key);
    if (salvo && typeof salvo === "string" && salvo.trim()) {
      return salvo.trim();
    }

    // Fallback para chave legado se houver
    const legacyKey = `ultimo_operador_${String(maquina).toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
    const legacy = localStorage.getItem(legacyKey);
    if (legacy) {
      try {
        const parsed = JSON.parse(legacy);
        return parsed?.nome || (typeof parsed === "string" ? parsed : "");
      } catch {
        return legacy;
      }
    }
  } catch {}
  return "";
}

export function salvarOperadorFixoMaquina(maquina, nome) {
  if (!maquina) return;
  const nomeLimpo = String(nome || "").trim();
  try {
    const key = getChaveOperadorMaquina(maquina);
    if (nomeLimpo) {
      localStorage.setItem(key, nomeLimpo);
      // Salva também no formato legado para compatibilidade
      const legacyKey = `ultimo_operador_${String(maquina).toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
      localStorage.setItem(legacyKey, JSON.stringify({ id: `op_${Date.now()}`, nome: nomeLimpo, role: "operador" }));
    } else {
      localStorage.removeItem(key);
    }

    // Dispara evento para sincronizar todos os cards e o topo da máquina em tempo real
    window.dispatchEvent(new CustomEvent("operador_fixo_alterado", { detail: { maquina, nome: nomeLimpo } }));
  } catch {}
}
