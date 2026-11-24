import React, { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

export default function DeferredQueueItem({ children, eager = false, label }) {
  const target = useRef(null);
  const [revealed, setRevealed] = useState(eager);
  useEffect(() => {
    if (revealed) return;
    if (!("IntersectionObserver" in window)) {
      setRevealed(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        setRevealed(true);
        observer.disconnect();
      }
    }, { rootMargin: "700px 0px" });
    if (target.current) observer.observe(target.current);
    const revealForPrint = () => flushSync(() => setRevealed(true));
    window.addEventListener("beforeprint", revealForPrint);
    return () => {
      observer.disconnect();
      window.removeEventListener("beforeprint", revealForPrint);
    };
  }, [revealed]);
  return (
    <div ref={target} style={{ contentVisibility: "auto", containIntrinsicSize: "auto 150px" }}>
      {revealed ? children : (
        <div className="min-h-36 rounded-2xl border border-border bg-card p-4 text-card-foreground" aria-busy="true">
          <p className="text-sm font-semibold">{label}</p>
          <div aria-hidden="true" className="mt-3 h-3 w-1/2 rounded bg-muted" />
          <span className="sr-only">Carregando informações do pedido</span>
        </div>
      )}
    </div>
  );
}