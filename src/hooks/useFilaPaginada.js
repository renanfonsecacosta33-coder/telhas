import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { obterCacheLocal, salvarCacheLocal } from "@/lib/offlineStorage";

export default function useFilaPaginada({ entidade, query, prefixo, sort = "data_recebimento", limit = 100 }) {
  const client = useQueryClient();
  const signature = JSON.stringify(query);
  const queryKey = [prefixo, signature];
  const cacheKey = `${prefixo}:${signature}`;
  const ref = useRef(null);
  if (ref.current?.signature !== signature) ref.current = { signature, cursors: [undefined], next: null };
  const [carregandoMais, setCarregandoMais] = useState(false);
  const estado = ref.current;
  const consulta = useQuery({
    queryKey,
    queryFn: async () => {
      if (!navigator.onLine) return (await obterCacheLocal(cacheKey)) || [];
      const records = [];
      let cursor;
      const cursors = [];
      for (let i = 0; i < estado.cursors.length; i++) {
        cursors.push(cursor);
        const page = await base44.entities[entidade].filter(query, { sort, limit, ...(cursor ? { cursor } : {}) });
        records.push(...page.items);
        cursor = page.has_more ? page.next_cursor : null;
        if (!cursor) break;
      }
      estado.cursors = cursors;
      estado.next = cursor;
      salvarCacheLocal(cacheKey, records);
      return records;
    },
    staleTime: 60000, refetchOnWindowFocus: false, retry: false
  });
  const total = useQuery({ queryKey: [...queryKey, "total"], queryFn: () => base44.entities[entidade].count(query), staleTime: 60000, retry: false });
  const carregarMais = async () => {
    if (!estado.next || carregandoMais) return;
    setCarregandoMais(true);
    try {
      const cursor = estado.next;
      const page = await base44.entities[entidade].filter(query, { sort, limit, cursor });
      estado.cursors.push(cursor);
      estado.next = page.has_more ? page.next_cursor : null;
      client.setQueryData(queryKey, (old = []) => [...new Map([...old, ...page.items].map(record => [record.id, record])).values()]);
    } finally { setCarregandoMais(false); }
  };
  return { ...consulta, queryKey, total: total.data, temMais: Boolean(estado.next), carregandoMais, carregarMais };
}