// Preferência de visibilidade do IA AJL Copilot (por dispositivo)
const KEY = "ajl_copilot_oculto";
export const COPILOT_TOGGLE_EVENT = "ajl:copilot-toggle";
export const COPILOT_OPEN_EVENT = "ajl:copilot-open";

export const isCopilotOculto = () => {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
};

export const setCopilotOculto = (oculto) => {
  try {
    localStorage.setItem(KEY, oculto ? "true" : "false");
  } catch {
    /* storage indisponível */
  }
  window.dispatchEvent(new Event(COPILOT_TOGGLE_EVENT));
};

export const abrirCopilot = () => {
  window.dispatchEvent(new Event(COPILOT_OPEN_EVENT));
};
