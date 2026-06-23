import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './config.js';

/**
 * Cliente admin (service role) — usado para operações privilegiadas:
 * criar usuários, definir app_metadata, etc. NUNCA expor ao frontend.
 */
export const supabaseAdmin: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);

/**
 * Cliente de autenticação (anon key quando disponível, senão service role).
 * Usado para grant de senha / refresh de sessão, devolvendo tokens do usuário.
 * Cada chamada é stateless (persistSession: false) para evitar contaminação
 * de sessão entre requests concorrentes.
 */
export const supabaseAuth: SupabaseClient = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_ANON_KEY ?? config.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { autoRefreshToken: false, persistSession: false },
  },
);
