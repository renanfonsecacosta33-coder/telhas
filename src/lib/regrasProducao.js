import { useEffect, useState } from "react";

/**
 * Regras de Produção configuráveis (persistidas no dispositivo).
 * Permite ligar/desligar exigências do fluxo de início de OP sem alterar código:
 * - exigirEtiquetaBobina: exigir foto/validação da etiqueta da bobina antes de iniciar
 * - exigirOperadorInicio: exigir seleção de operador(es) antes de iniciar
 * Gerencie pelos switches da página Configurações.
 */
const STORAGE_KEY = "ajl_regras_producao";
const EVENTO = "ajl-regras-producao-change";
const PADRAO = {
  exigirEtiquetaBobina: false,
  exigirOperadorInicio: false,
};

export const getRegrasProducao = () => {
  try {
    const salvas = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...PADRAO, ...salvas };
  } catch {
    return { ...PADRAO };
  }
};

export const setRegraProducao = (chave, valor) => {
  const atuais = getRegrasProducao();
  const novas = { ...atuais, [chave]: valor };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(novas));
  window.dispatchEvent(new Event(EVENTO));
  return novas;
};

export const useRegrasProducao = () => {
  const [regras, setRegras] = useState(getRegrasProducao);
  useEffect(() => {
    const atualizar = () => setRegras(getRegrasProducao());
    window.addEventListener(EVENTO, atualizar);
    window.addEventListener("storage", atualizar);
    return () => {
      window.removeEventListener(EVENTO, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);
  return regras;
};