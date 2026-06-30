import { encrypt, decrypt, maskApiKey } from '@modules/ai/ai.crypto.js';

describe('ai.crypto — encrypt/decrypt (AES-256-GCM)', () => {
  it('round-trip preserva o texto puro', () => {
    const plain = 'gsk_super_secret_key_1234567890';
    const enc = encrypt(plain);
    expect(enc).not.toBe(plain);
    expect(decrypt(enc)).toBe(plain);
  });

  it('cada cifra usa IV aleatório (ciphertexts diferentes p/ mesmo input)', () => {
    const plain = 'mesma-chave';
    expect(encrypt(plain)).not.toBe(encrypt(plain));
    expect(decrypt(encrypt(plain))).toBe(plain);
  });

  it('cifra com caracteres unicode/vazio', () => {
    expect(decrypt(encrypt(''))).toBe('');
    expect(decrypt(encrypt('chave-com-acento-çãé'))).toBe('chave-com-acento-çãé');
  });

  it('payload corrompido lança AppError AI_DECRYPT_ERROR', () => {
    expect(() => decrypt('not-a-valid-payload')).toThrow();
    try {
      decrypt('not-a-valid-payload');
    } catch (err) {
      expect((err as { code: string }).code).toBe('AI_DECRYPT_ERROR');
    }
  });
});

describe('ai.crypto — maskApiKey', () => {
  it('mostra apenas os 4 últimos caracteres', () => {
    expect(maskApiKey('gsk_abcdef1234')).toBe('••••••1234');
  });

  it('null/undefined/vazio → null', () => {
    expect(maskApiKey(null)).toBeNull();
    expect(maskApiKey(undefined)).toBeNull();
    expect(maskApiKey('')).toBeNull();
  });

  it('nunca devolve a chave em claro', () => {
    const key = 'gsk_topsecret_value_9999';
    const masked = maskApiKey(key);
    expect(masked).not.toContain('topsecret');
    expect(masked).toBe('••••••9999');
  });
});
