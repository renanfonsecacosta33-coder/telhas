import React, { useState, useEffect } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

/**
 * Botão flutuante ergonômico para Subir e Descer a tela com 1 clique.
 * Útil para operadores em terminais industriais e telas de fábrica.
 */
export default function ScrollNavigationFab() {
  const [showSubir, setShowSubir] = useState(false);
  const [showDescer, setShowDescer] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;

      // Mostra o botão de subir se rolou mais de 250px
      setShowSubir(scrollY > 250);

      // Mostra o botão de descer se ainda faltam mais de 250px para o final
      setShowDescer(scrollY + windowHeight < fullHeight - 250);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const rolarParaTopo = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const rolarParaFim = () => {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
  };

  if (!showSubir && !showDescer) return null;

  return (
    <div className="fixed right-4 bottom-24 z-40 flex flex-col gap-1.5 pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-200">
      {showSubir && (
        <button
          onClick={rolarParaTopo}
          title="Subir ao topo"
          aria-label="Subir ao topo"
          className="w-9 h-9 rounded-xl bg-card/90 hover:bg-primary hover:text-primary-foreground text-foreground border border-border shadow-md flex items-center justify-center transition-all cursor-pointer backdrop-blur hover:scale-105 active:scale-95"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}

      {showDescer && (
        <button
          onClick={rolarParaFim}
          title="Descer ao final"
          aria-label="Descer ao final"
          className="w-9 h-9 rounded-xl bg-card/90 hover:bg-primary hover:text-primary-foreground text-foreground border border-border shadow-md flex items-center justify-center transition-all cursor-pointer backdrop-blur hover:scale-105 active:scale-95"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
