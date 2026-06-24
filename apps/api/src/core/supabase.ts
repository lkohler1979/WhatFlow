import { createClient, SupabaseClient } from '@supabase/supabase-js';
import WebSocketImpl from 'ws';
import { config } from './config.js';

// Node < 22 não expõe `WebSocket` global, exigido pelo supabase-js (realtime).
// Fornecemos o polyfill via "ws" para rodar em containers Node 20.
const globalWithWs = globalThis as { WebSocket?: unknown };
if (typeof globalWithWs.WebSocket === 'undefined') {
  globalWithWs.WebSocket = WebSocketImpl;
}

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
