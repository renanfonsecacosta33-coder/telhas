import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const ThemeContext = createContext({
  tema: "claro",
  setTema: () => {},
  isDark: false,
  toggleTema: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function applyThemeToDOM(tema) {
  const root = document.documentElement;
  if (tema === "sistema") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    return prefersDark;
  }
  const isDark = tema === "escuro";
  root.classList.toggle("dark", isDark);
  return isDark;
}

export function ThemeProvider({ children }) {
  const [tema, setTemaState] = useState(() => {
    // Ler do localStorage para aplicação instantânea (sem flash branco)
    try {
      return localStorage.getItem("ajl_tema") || "claro";
    } catch {
      return "claro";
    }
  });

  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem("ajl_tema") || "claro";
      return applyThemeToDOM(saved);
    } catch {
      return false;
    }
  });

  // Aplica o tema sempre que mudar
  useEffect(() => {
    const dark = applyThemeToDOM(tema);
    setIsDark(dark);
  }, [tema]);

  // Listener para mudanças no sistema (quando tema = "sistema")
  useEffect(() => {
    if (tema !== "sistema") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      document.documentElement.classList.toggle("dark", e.matches);
      setIsDark(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [tema]);

  const setTema = useCallback(async (novoTema) => {
    setTemaState(novoTema);
    try {
      localStorage.setItem("ajl_tema", novoTema);
    } catch {}
    // Persistir no Base44 em background (sync entre dispositivos)
    try {
      await base44.auth.updateMe({ tema: novoTema });
    } catch {}
  }, []);

  const toggleTema = useCallback(() => {
    setTema(isDark ? "claro" : "escuro");
  }, [isDark, setTema]);

  // Na montagem, sincronizar com o tema do usuário no Base44
  useEffect(() => {
    const syncFromServer = async () => {
      try {
        const user = await base44.auth.me();
        if (user?.tema && user.tema !== tema) {
          setTemaState(user.tema);
          localStorage.setItem("ajl_tema", user.tema);
        }
      } catch {}
    };
    syncFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ThemeContext.Provider value={{ tema, setTema, isDark, toggleTema }}>
      {children}
    </ThemeContext.Provider>
  );
}
