/**
 * Smoke test de isolamento multi-tenant (RLS) — T-006.
 *
 * Registra dois tenants (A e B) via a API e, usando o PostgREST do Supabase
 * com o JWT de cada um, confirma que cada tenant só enxerga os próprios dados
 * na tabela `users`.
 *
 * Pré-requisitos: API rodando (npm run dev) e SUPABASE_URL/SUPABASE_ANON_KEY
 * no .env. Uso: `npx tsx scripts/rls-smoke.ts`
 */
import 'dotenv/config';

const API = process.env.SMOKE_API_URL ?? 'http://localhost:3000/v1';
const SUPABASE_URL = (process.env.SUPABASE_URL ?? '').replace(/\/+$/, '');
const ANON = process.env.SUPABASE_ANON_KEY ?? '';
const REST = `${SUPABASE_URL}/rest/v1`;

if (!SUPABASE_URL || !ANON) {
  console.error('❌ SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios no .env');
  process.exit(1);
}

async function register(email: string, company: string) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'segredo123', fullName: 'Smoke', companyName: company }),
  });
  if (!res.ok) throw new Error(`register falhou (${res.status}): ${await res.text()}`);
  const data = (await res.json()) as { user: { tenantId: string }; session: { accessToken: string } };
  return { tenantId: data.user.tenantId, token: data.session.accessToken };
}

async function listUsersAs(token: string): Promise<Array<{ tenant_id: string }>> {
  const res = await fetch(`${REST}/users?select=email,tenant_id`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`PostgREST falhou (${res.status}): ${await res.text()}`);
  return (await res.json()) as Array<{ tenant_id: string }>;
}

async function main() {
  const ts = Date.now();
  const a = await register(`tenantA+${ts}@smoke.test`, `Tenant A ${ts}`);
  const b = await register(`tenantB+${ts}@smoke.test`, `Tenant B ${ts}`);
  console.log(`Tenant A = ${a.tenantId}`);
  console.log(`Tenant B = ${b.tenantId}`);

  const seenByA = await listUsersAs(a.token);
  const seenByB = await listUsersAs(b.token);

  const aLeaksB = seenByA.some((r) => r.tenant_id === b.tenantId);
  const bLeaksA = seenByB.some((r) => r.tenant_id === a.tenantId);
  const aSeesSelf = seenByA.some((r) => r.tenant_id === a.tenantId);

  console.log(aLeaksB ? '❌ A enxergou dados de B' : '✅ A NÃO vê o tenant B');
  console.log(bLeaksA ? '❌ B enxergou dados de A' : '✅ B NÃO vê o tenant A');
  console.log(aSeesSelf ? '✅ A vê o próprio tenant' : '⚠️ A não vê nem o próprio tenant');

  if (aLeaksB || bLeaksA || !aSeesSelf) {
    console.error('\n❌ Isolamento RLS FALHOU');
    process.exit(1);
  }
  console.log('\n✅ Isolamento RLS OK (T-006)');
}

main().catch((err) => {
  console.error('❌ Erro no smoke test:', err instanceof Error ? err.message : err);
  process.exit(1);
});
