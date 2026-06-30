import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '@core/config.js';
import { AppError } from '@core/errors.js';

/**
 * Criptografia simétrica da apiKey de IA em repouso (AES-256-GCM).
 *
 * Formato do ciphertext (string única, base64): iv(12) | tag(16) | data(N).
 * A chave de 32 bytes vem de `AI_ENCRYPTION_KEY` — se a env tiver mais/menos
 * que 32 bytes, derivamos via SHA-256 para garantir o tamanho correto do AES-256.
 */
const ALGO = 'aes-256-gcm';
const IV_LEN = 12; // recomendado p/ GCM
const TAG_LEN = 16;

function key(): Buffer {
  // SHA-256 normaliza qualquer string de >=32 chars para exatamente 32 bytes.
  return createHash('sha256').update(config.AI_ENCRYPTION_KEY, 'utf8').digest();
}

/** Cifra um texto puro → base64 (iv|tag|ciphertext). */
export function encrypt(plain: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

/** Decifra base64 (iv|tag|ciphertext) → texto puro. Lança AppError se corrompido. */
export function decrypt(payload: string): string {
  try {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGO, key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new AppError('Falha ao decifrar a credencial de IA', 500, 'AI_DECRYPT_ERROR');
  }
}

/**
 * Máscara para exibição: nunca devolve a apiKey em claro.
 * Mostra apenas os 4 últimos caracteres (`••••••1234`).
 */
export function maskApiKey(plain: string | null | undefined): string | null {
  if (!plain) return null;
  const last4 = plain.slice(-4);
  return `••••••${last4}`;
}
