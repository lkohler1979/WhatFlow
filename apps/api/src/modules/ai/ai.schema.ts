import { z } from 'zod';

/** Provedores aceitos na config de IA (espelha o enum AiProvider do Prisma). */
const AiProviderEnum = z.enum(['GROQ', 'OLLAMA', 'OPENAI_COMPATIBLE']);

/**
 * Upsert da configuração de IA do tenant.
 *
 * `apiKey` é opcional: quando ausente em um update, a credencial já gravada é
 * preservada (não re-cifra). String vazia limpa a credencial.
 */
export const UpsertAiConfigSchema = z.object({
  provider: AiProviderEnum,
  model: z.string().min(1).max(100),
  apiKey: z.string().max(500).optional(),
  baseUrl: z.string().url().max(300).optional().or(z.literal('')),
  systemPrompt: z.string().max(8000).optional(),
  maxTokens: z.number().int().min(1).max(8000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  historyWindow: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

/** Mensagem de exemplo para o botão "Testar". */
export const TestAiConfigSchema = z.object({
  message: z.string().min(1).max(2000).optional(),
});

export type UpsertAiConfigDto = z.infer<typeof UpsertAiConfigSchema>;
export type TestAiConfigDto = z.infer<typeof TestAiConfigSchema>;
