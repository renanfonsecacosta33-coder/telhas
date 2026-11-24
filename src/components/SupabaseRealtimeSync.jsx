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

const PREFIXOS_POR_ENTIDADE = {
  PedidoOdoo: ['pedidos-odoo', 'resumo-pcp'],
  Pedido: ['pedidos', 'pre-baixa-bobinas-v2'],
  OrdemDesbobinadeira: ['ordens-desb', 'ordens-cd', 'pre-baixa-bobinas-v2'],
  OrdemMaquinaCD: ['ordens-maquina', 'ordens-maquinas-cd', 'ordens-cd', 'pre-baixa-bobinas-v2'],
  Bobina: ['bobinas', 'pre-baixa-bobinas-v2'],
  ChapaCD: ['chapas'],
  Carga: ['cargas', 'rotas']
};
const ENTIDADE_POR_TABELA = {
  pedidos_odoo: ['PedidoOdoo'],
  ordens_producao: ['Pedido', 'OrdemDesbobinadeira', 'OrdemMaquinaCD'],
  bobinas_estoque: ['Bobina']
};

export default function SupabaseRealtimeSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let timer = null;
    let ultimoDisparo = 0;
    let ocultoDesde = 0;

    const pendentes = new Set();
    const dispararRefresh = (entidades = ENTIDADES_BASE44) => {
      for (const entidade of entidades) {
        for (const prefixo of PREFIXOS_POR_ENTIDADE[entidade] || []) pendentes.add(prefixo);
      }
      if (timer) return;
      const executar = () => {
        timer = null;
        ultimoDisparo = Date.now();
        const prefixos = [...pendentes];
        pendentes.clear();
        // Uma alteração de estoque não recarrega a produção, e uma alteração
        // de OP não refaz todas as consultas de bobinas e chapas.
        queryClient.invalidateQueries({
          predicate: query => prefixos.some(prefixo => {
            const key = String(query.queryKey[0] || '');
            return key === prefixo || key.startsWith(`${prefixo}-`);
          }),
          refetchType: document.hidden ? 'none' : 'active'
        });
      };
      timer = setTimeout(executar, Math.max(1200, 8000 - (Date.now() - ultimoDisparo)));
    };

    // Ao voltar para a aba, atualiza o que ficou pendente enquanto ela estava oculta.
    const aoTrocarVisibilidade = () => {
      if (document.hidden) {
        ocultoDesde = Date.now();
        return;
      }
      const ficouOculta = ocultoDesde && Date.now() - ocultoDesde > 10000;
      ocultoDesde = 0;
      if (ficouOculta) dispararRefresh();
    };
    document.addEventListener('visibilitychange', aoTrocarVisibilidade);

    // 1. Supabase Postgres Realtime (se configurado)
    let channel = null;
    try {
      if (supabase && typeof supabase.channel === 'function') {
        channel = supabase.channel('realtime-sync-global');
        TABELAS_SUPABASE.forEach((tabela) => {
          channel = channel.on(
            'postgres_changes',
            { event: '*', schema: 'public', table: tabela },
            () => dispararRefresh(ENTIDADE_POR_TABELA[tabela])
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
            dispararRefresh([entidade]);
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
      document.removeEventListener('visibilitychange', aoTrocarVisibilidade);
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