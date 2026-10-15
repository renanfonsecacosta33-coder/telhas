import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { base44 } from '@/api/base44Client';

/**
 * Sincronização em tempo real unificada (Supabase + Base44 Nativo).
 * Escuta alterações instantâneas em pedidos e ordens de fabricação para
 * atualizar as telas dos galpões e PCP com latência de milissegundos.
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

    const dispararRefresh = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // Invalida consultas das filas e máquinas para atualização imediata
        queryClient.invalidateQueries({ queryKey: ['ordens-desbobinadeira'] });
        queryClient.invalidateQueries({ queryKey: ['ordens-desb-todas'] });
        queryClient.invalidateQueries({ queryKey: ['ordens-maquina-cd'] });
        queryClient.invalidateQueries({ queryKey: ['ordens-maquina-cd-todas'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-odoo-pcp'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-odoo-cd'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-odoo-desbobinadeira'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos-producao-todos'] });
        queryClient.invalidateQueries({ queryKey: ['pedidos'] });
        queryClient.invalidateQueries({ queryKey: ['bobinas-cd-ativas'] });
        queryClient.invalidateQueries({ queryKey: ['chapas-cd'] });
      }, 250);
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