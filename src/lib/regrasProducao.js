import { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";

/**
 * Regras Gerais de Produção e Parâmetros das Fábricas (Telhas e Corte & Dobra).
 * Sincronizadas entre dispositivos e persistidas localmente para máxima performance offline.
 * 
 * Regras principais:
 * - permitirPularFotoEtiqueta: permite ao operador pular a captura/validação da etiqueta da bobina/chapa
 * - exigirEtiquetaBobina: obriga validação da etiqueta da bobina antes de iniciar OP em Telhas/Desbobinadeira
 * - exigirEtiquetaChapa: obriga validação da etiqueta de chapa na guilhotina em Corte e Dobra
 * - permitirPularFotoBalanca: permite confirmar peso teórico ou manual sem foto da balança
 * - exigirFotoPesagem: exige foto da pesagem de sobras e retalhos
 * - exigirOperadorInicio: exige seleção obrigatória de operadores ao iniciar OP
 * - permitirIniciarSemMaterial: permite ligar máquinas mesmo com alerta de saldo insuficiente
 * - exigirSenhaPrioridadeAlta: exige autorização do gestor para OPs urgentes (P1/P2)
 */
const STORAGE_KEY = "ajl_regras_producao";
const EVENTO = "ajl-regras-producao-change";
const CONFIG_PATH_REMOTO = "__config_fabrica__";

export const REGRAS_PADRAO = {
  // 📸 Etiquetas de Matéria-Prima
  permitirPularFotoEtiqueta: true,
  exigirEtiquetaBobina: false,
  exigirEtiquetaChapa: false,

  // ⚖️ Balança e Pesagens
  permitirPularFotoBalanca: true,
  exigirFotoPesagem: false,

  // 👷 Equipe e Apontamentos
  exigirOperadorInicio: false,

  // ⚡ Bloqueios e PCP
  permitirIniciarSemMaterial: false,
  exigirSenhaPrioridadeAlta: true,
};

export const getRegrasProducao = () => {
  try {
    const salvas = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return { ...REGRAS_PADRAO, ...salvas };
  } catch {
    return { ...REGRAS_PADRAO };
  }
};

// Sincronização remota em background sem travar UI
let syncTimeout = null;
const sincronizarRemoto = (regras) => {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(async () => {
    try {
      const lista = await base44.entities.Categoria.filter({ path: CONFIG_PATH_REMOTO });
      const payloadStr = JSON.stringify(regras);
      if (lista && lista.length > 0) {
        await base44.entities.Categoria.update(lista[0].id, {
          nome: payloadStr,
          path: CONFIG_PATH_REMOTO,
          ativa: false
        });
      } else {
        await base44.entities.Categoria.create({
          nome: payloadStr,
          path: CONFIG_PATH_REMOTO,
          icone: "Settings",
          cor: "#64748b",
          ordem: 9999,
          ativa: false
        });
      }
    } catch (err) {
      console.warn("[regrasProducao] Sincronização remota em background indisponível:", err?.message || err);
    }
  }, 1000);
};

export const setRegraProducao = (chave, valor) => {
  const atuais = getRegrasProducao();
  const novas = { ...atuais, [chave]: valor };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(novas));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
  sincronizarRemoto(novas);
  return novas;
};

export const setTodasRegrasProducao = (novasRegras) => {
  const combinadas = { ...REGRAS_PADRAO, ...novasRegras };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(combinadas));
  } catch {}
  window.dispatchEvent(new Event(EVENTO));
  sincronizarRemoto(combinadas);
  return combinadas;
};

export const useRegrasProducao = () => {
  const [regras, setRegras] = useState(getRegrasProducao);

  useEffect(() => {
    const atualizar = () => setRegras(getRegrasProducao());
    window.addEventListener(EVENTO, atualizar);
    window.addEventListener("storage", atualizar);

    // Carrega configuração remota da nuvem para atualizar outras máquinas
    base44.entities.Categoria.filter({ path: CONFIG_PATH_REMOTO })
      .then((lista) => {
        if (lista && lista.length > 0 && lista[0].nome) {
          try {
            const remoto = JSON.parse(lista[0].nome);
            if (remoto && typeof remoto === "object") {
              const mesclado = { ...REGRAS_PADRAO, ...remoto };
              const atualLocal = localStorage.getItem(STORAGE_KEY);
              const atualStr = JSON.stringify(mesclado);
              if (atualLocal !== atualStr) {
                localStorage.setItem(STORAGE_KEY, atualStr);
                setRegras(mesclado);
                window.dispatchEvent(new Event(EVENTO));
              }
            }
          } catch {}
        }
      })
      .catch(() => {});

    return () => {
      window.removeEventListener(EVENTO, atualizar);
      window.removeEventListener("storage", atualizar);
    };
  }, []);

  return regras;
};