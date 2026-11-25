import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

export function useUnreadCount(currentUser, tipo, canal_id) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    const fetchCount = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const filter = { lido: false };
        if (tipo) filter.canal_tipo = tipo;
        if (canal_id) filter.canal_id = canal_id;
        const msgs = await base44.entities.MensagemChat.filter(filter, "-data_hora", 100);
        if (!active) return;
        const filtered = msgs.filter(m => m.remetente_id !== currentUser.id);
        setCount(filtered.length);
      } catch {}
    };
    fetchCount();

    // 60s de intervalo para não estourar o limite de requisições por minuto do servidor
    const interval = setInterval(fetchCount, 60000);
    const handleVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchCount();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    let ultimoEvento = 0;
    const unsubscribe = base44.entities.MensagemChat.subscribe(() => {
      if (Date.now() - ultimoEvento < 30000) return;
      ultimoEvento = Date.now();
      fetchCount();
    });
    return () => {
      active = false;
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      unsubscribe();
    };
  }, [currentUser?.id, tipo, canal_id]);

  return count;
}

export function useAllUnreadCount(currentUser) {
  const [count, setCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    const fetchCount = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const msgs = await base44.entities.MensagemChat.filter({ lido: false }, "-data_hora", 100);
        if (!active) return;
        const filtered = msgs.filter(m => m.remetente_id !== currentUser.id);
        const newCount = filtered.length;
        setCount(newCount);
        prevCountRef.current = newCount;
      } catch {}
    };
    fetchCount();

    // 60s de intervalo para não estourar o limite de requisições por minuto do servidor
    const interval = setInterval(fetchCount, 60000);
    const handleVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchCount();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibility);
    }

    let ultimoEvento = 0;
    const unsubscribe = base44.entities.MensagemChat.subscribe(() => {
      if (Date.now() - ultimoEvento < 30000) return;
      ultimoEvento = Date.now();
      fetchCount();
    });
    return () => {
      active = false;
      clearInterval(interval);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", handleVisibility);
      }
      unsubscribe();
    };
  }, [currentUser?.id]);

  return count;
}