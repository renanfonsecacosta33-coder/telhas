import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

/**
 * Sincronização em tempo real com o Supabase.
 * Escuta alterações nas tabelas pedidos_odoo, ordens_producao e bobinas_estoque
 * e invalida o cache do React Query para que as páginas (Central PCP, Galpões
 * de Produção, etc.) se atualizem instantaneamente sem F5.
 */
const TABELAS = ['pedidos_odoo', 'ordens_producao', 'bobinas_estoque'];

export default function SupabaseRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer = null;

    const dispararRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries();
      }, 400);
    };

    let channel = supabase.channel('realtime-sync-global');
    TABELAS.forEach((tabela) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tabela },
        dispararRefresh
      );
    });
    channel.subscribe();

    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}