import React, { createContext, useContext, useState, useEffect, useMemo } from "react";
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
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Filiais autorizadas para este usuário
  const filiaisPermitidas = useMemo(() => {
    if (!user) return FILIAIS;

    // Se o usuário tem filiais_permitidas configurado explicitamente
    if (Array.isArray(user.filiais_permitidas) && user.filiais_permitidas.length > 0) {
      return FILIAIS.filter(f => user.filiais_permitidas.includes(f));
    }

    // Se for admin ou super_admin sem restrição: acesso global
    if (user.role === "admin" || user.role === "super_admin") {
      return FILIAIS;
    }

    // Se tiver unidade fixa associada
    if (user.unidade && FILIAIS.includes(user.unidade)) {
      return [user.unidade];
    }

    return FILIAIS;
  }, [user]);

  // Sincroniza filialAtiva para garantir que seja válida dentro de filiaisPermitidas
  useEffect(() => {
    if (loading) return;

    const saved = localStorage.getItem("filial_ativa");
    if (saved && filiaisPermitidas.includes(saved)) {
      setFilialAtiva(saved);
    } else if (filiaisPermitidas.length > 0 && !filiaisPermitidas.includes(filialAtiva)) {
      setFilialAtiva(filiaisPermitidas[0]);
    }
  }, [loading, filiaisPermitidas]);

  const trocarFilial = (filial) => {
    if (!filiaisPermitidas.includes(filial)) return;
    setFilialAtiva(filial);
    localStorage.setItem("filial_ativa", filial);
  };

  const podeTrocarFilial = filiaisPermitidas.length > 1;

  return (
    <FilialContext.Provider value={{ filialAtiva, trocarFilial, podeTrocarFilial, filiaisPermitidas, user, loading, FILIAIS }}>
      {children}
    </FilialContext.Provider>
  );
}