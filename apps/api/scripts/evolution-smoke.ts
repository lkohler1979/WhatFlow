/**
 * Smoke read-only da integração Evolution API.
 * Uso: npx tsx scripts/evolution-smoke.ts [instanceName]
 * Lê o connectionState de uma instância existente (default: TrilhaDBV).
 */
import 'dotenv/config';
import { evolutionApiService } from '../src/integrations/evolution-api/evolution-api.service.js';

const key = process.argv[2] ?? 'TrilhaDBV';

evolutionApiService
  .getConnectionState(key)
  .then((r) => {
    console.log(`✅ connectionState(${key}) =`, JSON.stringify(r));
  })
  .catch((e: { message?: string }) => {
    console.error('❌ erro:', e?.message ?? e);
    process.exit(1);
  });
