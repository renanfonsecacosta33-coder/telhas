import React, { createContext, useContext, useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

const FilialContext = createContext(null);

export const useFilial = () => useContext(FilialContext);

export const FILIAIS = ["Matriz AJL", "Pinhais", "Ivaiporã", "Ponta Grossa"];

export function FilialProvider({ children }) {
  const [user, setUser] = useState(null);
  const [filialAtiva, setFilialAtiva] = useState("Matriz AJL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.unidade) {
        setFilialAtiva(u.unidade);
      } else {
        const saved = localStorage.getItem("filial_ativa");
        if (saved) setFilialAtiva(saved);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const trocarFilial = (filial) => {
    setFilialAtiva(filial);
    if (!user?.unidade) {
      localStorage.setItem("filial_ativa", filial);
    }
  };

  const podeTrocarFilial = !user?.unidade;

  return (
    <FilialContext.Provider value={{ filialAtiva, trocarFilial, podeTrocarFilial, user, loading, FILIAIS }}>
      {children}
    </FilialContext.Provider>
  );
}