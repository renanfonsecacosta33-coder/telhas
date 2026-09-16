import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";

const LOCAL_STORAGE_KEY = "ajl_tema";

const ThemeContext = createContext({
  tema: "escuro",
  setTema: () => {},
  isDark: true,
  toggleTema: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function applyThemeToDOM(tema) {
  const root = document.documentElement;
  let isDark = false;
  if (tema === "sistema") {
    isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  } else {
    isDark = tema === "escuro";
  }

  root.classList.toggle("dark", isDark);
  // Garante que elementos nativos (inputs de data, selects, scrollbars) usem o esquema correto
  root.style.colorScheme = isDark ? "dark" : "light";
  return isDark;
}

export function ThemeProvider({ children }) {
  const [tema, setTemaState] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved === "claro" || saved === "escuro" || saved === "sistema") {
        return saved;
      }
      return "escuro";
    } catch {
      return "escuro";
    }
  });

  const [isDark, setIsDark] = useState(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY) || "escuro";
      return applyThemeToDOM(saved);
    } catch {
      return true;
    }
  });

  // Aplica o tema sempre que mudar o estado
  useEffect(() => {
    const dark = applyThemeToDOM(tema);
    setIsDark(dark);
  }, [tema]);

  // Sincronização entre abas do navegador (storage event)
  useEffect(() => {
    const handleStorage = (e) => {
      if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
        setTemaState(e.newValue);
        const dark = applyThemeToDOM(e.newValue);
        setIsDark(dark);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Listener para mudanças no sistema (quando tema = "sistema")
  useEffect(() => {
    if (tema !== "sistema") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => {
      document.documentElement.classList.toggle("dark", e.matches);
      document.documentElement.style.colorScheme = e.matches ? "dark" : "light";
      setIsDark(e.matches);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [tema]);

  const setTema = useCallback(async (novoTema) => {
    setTemaState(novoTema);
    applyThemeToDOM(novoTema);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, novoTema);
      localStorage.setItem("ajl_tema_user_selected", "1");
    } catch {}

    // Persistir no Base44 em background (sync com a nuvem sem travar a UI)
    try {
      await base44.auth.updateMe({ tema: novoTema });
      const me = await base44.auth.me().catch(() => null);
      if (me?.id) {
        await base44.entities.User.update(me.id, { tema: novoTema }).catch(() => {});
      }
    } catch {}
  }, []);

  const toggleTema = useCallback(() => {
    setTema(isDark ? "claro" : "escuro");
  }, [isDark, setTema]);

  // Na montagem, sincronizar de forma inteligente com o tema do usuário no Base44
  useEffect(() => {
    const syncFromServer = async () => {
      try {
        const localSaved = localStorage.getItem(LOCAL_STORAGE_KEY);
        const user = await base44.auth.me();

        // Se o usuário ainda não definiu preferência local neste navegador e o servidor possui uma salva:
        if (!localSaved && user?.tema) {
          setTemaState(user.tema);
          localStorage.setItem(LOCAL_STORAGE_KEY, user.tema);
          applyThemeToDOM(user.tema);
        } else if (localSaved && user && user.tema !== localSaved) {
          // Se o usuário já escolheu localmente, garantimos que a nuvem seja atualizada com a escolha local
          base44.auth.updateMe({ tema: localSaved }).catch(() => {});
          if (user.id) {
            base44.entities.User.update(user.id, { tema: localSaved }).catch(() => {});
          }
        }
      } catch {}
    };
    syncFromServer();
  }, []);

  return (
    <ThemeContext.Provider value={{ tema, setTema, isDark, toggleTema }}>
      {children}
    </ThemeContext.Provider>
  );
}
