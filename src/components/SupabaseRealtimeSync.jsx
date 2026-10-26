import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { base44 } from '@/api/base44Client';

/**
 * Sincronização em tempo real unificada (Supabase + Base44 Nativo).
 * Escuta alterações com debounce inteligente e throttling para proteger
 * tablets do chão de fábrica contra sobrecarga de memória ou tela congelada.
 */
const TABELAS_SUPABASE = ['pedidos_odoo', 'ordens_producao', 'bobinas_estoque'];
const ENTIDADES_BASE44 = [
  'OrdemDesbobinadeira',
  'OrdemMaquinaCD',
  'Pedido',
  'PedidoOdoo',
  'Bobina',
  'ChapaCD',
  'Carga'
];

export default function SupabaseRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer = null;
    let ultimoDisparo = 0;

    const dispararRefresh = () => {
      if (timer) clearTimeout(timer);
      const agora = Date.now();
      const tempoDecorrido = agora - ultimoDisparo;

      const executar = () => {
        ultimoDisparo = Date.now();
        // Invalidação suave apenas para consultas ativas na tela do usuário
        const refetchOpt = { refetchType: 'active' };
        queryClient.invalidateQueries({ queryKey: ['ordens-desbobinadeira'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['ordens-desb-todas'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['ordens-maquina-cd'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['ordens-maquina-cd-todas'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['pedidos-odoo-pcp'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['pedidos-odoo-cd'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['pedidos-odoo-desbobinadeira'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['pedidos-producao-todos'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['pedidos'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['bobinas-cd-ativas'], ...refetchOpt });
        queryClient.invalidateQueries({ queryKey: ['chapas-cd'], ...refetchOpt });
      };

      // Throttle de 2.5s se já disparou recentemente, ou debounce de 1000ms
      if (tempoDecorrido < 2500) {
        timer = setTimeout(executar, 2500 - tempoDecorrido);
      } else {
        timer = setTimeout(executar, 1000);
      }
    };

    // 1. Supabase Postgres Realtime (se configurado)
    let channel = null;
    try {
      if (supabase && typeof supabase.channel === 'function') {
        channel = supabase.channel('realtime-sync-global');
        TABELAS_SUPABASE.forEach((tabela) => {
          channel = channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: tabela },
            dispararRefresh
          );
        });
        channel.subscribe();
      }
    } catch (e) {
      console.warn('[Realtime] Supabase channel warning:', e);
    }

    // 2. Base44 Realtime Nativo em todas as entidades fabris
    const unsubsBase44 = [];
    ENTIDADES_BASE44.forEach((entidade) => {
      try {
        if (base44?.entities?.[entidade]?.subscribe) {
          const unsub = base44.entities[entidade].subscribe(() => {
            dispararRefresh();
          });
          if (typeof unsub === 'function') {
            unsubsBase44.push(unsub);
          }
        }
      } catch (err) {
        console.warn(`[Realtime] Base44 subscribe falhou para ${entidade}:`, err);
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      if (channel && supabase && typeof supabase.removeChannel === 'function') {
        try {
          supabase.removeChannel(channel);
        } catch (_) {}
      }
      unsubsBase44.forEach(fn => {
        try { fn(); } catch (_) {}
      });
    };
  }, [queryClient]);

  return null;
}
