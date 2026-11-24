import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";

export function useUnreadCount(currentUser, tipo, canal_id) {
  const [count, setCount] = useState(0);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (!currentUser?.id) return;
    let active = true;
    const fetchCount = async () => {
      try {
        const filter = { lido: false };
        if (tipo) filter.canal_tipo = tipo;
        if (canal_id) filter.canal_id = canal_id;
        const msgs = await base44.entities.MensagemChat.filter(filter, "-data_hora", 500);
        if (!active) return;
        const filtered = msgs.filter(m => m.remetente_id !== currentUser.id);
        setCount(filtered.length);
      } catch {}
    };
    fetchCount();
    // 20s + limite no evento: consultar a cada 5s em vários pontos da tela
    // estourava o teto de requisições por minuto (rate limit 429).
    const interval = setInterval(fetchCount, 20000);
    let ultimoEvento = 0;
    const unsubscribe = base44.entities.MensagemChat.subscribe(() => {
      if (Date.now() - ultimoEvento < 15000) return;
      ultimoEvento = Date.now();
      fetchCount();
    });
    return () => { active = false; clearInterval(interval); unsubscribe(); };
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
      try {
        const msgs = await base44.entities.MensagemChat.filter({ lido: false }, "-data_hora", 500);
        if (!active) return;
        const filtered = msgs.filter(m => m.remetente_id !== currentUser.id);
        const newCount = filtered.length;
        if (newCount > prevCountRef.current) {
          setCount(newCount);
        } else {
          setCount(newCount);
        }
        prevCountRef.current = newCount;
      } catch {}
    };
    fetchCount();
    // 20s + limite no evento: consultar a cada 5s em vários pontos da tela
    // estourava o teto de requisições por minuto (rate limit 429).
    const interval = setInterval(fetchCount, 20000);
    let ultimoEvento = 0;
    const unsubscribe = base44.entities.MensagemChat.subscribe(() => {
      if (Date.now() - ultimoEvento < 15000) return;
      ultimoEvento = Date.now();
      fetchCount();
    });
    return () => { active = false; clearInterval(interval); unsubscribe(); };
  }, [currentUser?.id]);

  return count;
}