import { createClient } from '@supabase/supabase-js';

// Publishable key do Supabase — é PÚBLICA por design (segura no client).
// Pode ser sobrescrita por variáveis Vite (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xtprjehdxoefrpucbidi.supabase.co';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_6DQOZwcnnlUVwyat9pY_tA_m_SSzFxf';

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: false },
});

export default supabase;