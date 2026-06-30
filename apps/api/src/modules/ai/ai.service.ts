import { aiRepository } from './ai.repository.js';
import { decrypt, encrypt, maskApiKey } from './ai.crypto.js';
import { AppError } from '@core/errors.js';
import { logger } from '@core/logger.js';
import { aiService as aiFacade, type AiProviderName } from '@integrations/ai/ai.service.js';
import type { AiMessage } from '@integrations/ai/ai.interface.js';
import type { UpsertAiConfigDto, TestAiConfigDto } from './ai.schema.js';
import type { AiConfig, AiProvider } from '@prisma/client';

/** Mensagem de exemplo default do botão "Testar". */
const DEFAULT_TEST_MESSAGE = 'Olá! Responda em uma frase curta para validar a configuração.';

/** Config exposta na API — apiKey sempre mascarada, nunca em claro. */
export interface AiConfigView {
  id: string | null;
  provider: AiProvider;
  model: string;
  apiKeyMask: string | null;
  hasApiKey: boolean;
  baseUrl: string | null;
  systemPrompt: string | null;
  maxTokens: number;
  temperature: number;
  historyWindow: number;
  isActive: boolean;
  updatedAt: Date | null;
}

/** Config default para tenant que ainda não configurou IA. */
function defaultView(): AiConfigView {
  return {
    id: null,
    provider: 'GROQ',
    model: 'llama-3.1-70b-versatile',
    apiKeyMask: null,
    hasApiKey: false,
    baseUrl: null,
    systemPrompt: null,
    maxTokens: 500,
    temperature: 0.7,
    historyWindow: 10,
    isActive: true,
    updatedAt: null,
  };
}

function toView(cfg: AiConfig): AiConfigView {
  const plainKey = cfg.apiKeyEnc ? safeDecrypt(cfg.apiKeyEnc) : null;
  return {
    id: cfg.id,
    provider: cfg.provider,
    model: cfg.model,
    apiKeyMask: maskApiKey(plainKey),
    hasApiKey: !!cfg.apiKeyEnc,
    baseUrl: cfg.baseUrl,
    systemPrompt: cfg.systemPrompt,
    maxTokens: cfg.maxTokens,
    temperature: cfg.temperature,
    historyWindow: cfg.historyWindow,
    isActive: cfg.isActive,
    updatedAt: cfg.updatedAt,
  };
}

/** Decifra sem derrubar o GET caso a credencial antiga esteja corrompida. */
function safeDecrypt(enc: string): string | null {
  try {
    return decrypt(enc);
  } catch {
    return null;
  }
}

/** Mapeia o enum do Prisma → provedor do facade de IA (groq/ollama). */
function providerName(provider: AiProvider): AiProviderName {
  // OPENAI_COMPATIBLE usa o formato OpenAI (mesmo do adaptador Groq), com
  // baseUrl/apiKey do tenant sobrescrevendo o endpoint da Groq.
  return provider === 'OLLAMA' ? 'ollama' : 'groq';
}

export const aiConfigService = {
  /** GET — config do tenant (apiKey mascarada) ou defaults se inexistente. */
  async getConfig(tenantId: string): Promise<AiConfigView> {
    const cfg = await aiRepository.findByTenant(tenantId);
    return cfg ? toView(cfg) : defaultView();
  },

  /**
   * PUT — upsert da config do tenant.
   * - apiKey ausente: preserva a credencial atual (não re-cifra).
   * - apiKey === '' : limpa a credencial.
   * - apiKey com valor: cifra e grava.
   */
  async upsertConfig(tenantId: string, dto: UpsertAiConfigDto): Promise<AiConfigView> {
    const existing = await aiRepository.findByTenant(tenantId);

    // Resolve a credencial cifrada conforme o que veio no payload.
    let apiKeyEnc: string | null | undefined;
    if (dto.apiKey === undefined) {
      apiKeyEnc = undefined; // mantém o que já está gravado
    } else if (dto.apiKey === '') {
      apiKeyEnc = null; // limpa
    } else {
      apiKeyEnc = encrypt(dto.apiKey);
    }

    const baseUrl = dto.baseUrl === '' ? null : (dto.baseUrl ?? null);

    if (!existing) {
      const created = await aiRepository.create(tenantId, {
        provider: dto.provider,
        model: dto.model,
        apiKeyEnc: apiKeyEnc ?? null,
        baseUrl,
        systemPrompt: dto.systemPrompt ?? null,
        ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
        ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
        ...(dto.historyWindow !== undefined ? { historyWindow: dto.historyWindow } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      });
      logger.info({ tenantId, action: 'ai.config.create' }, 'Config de IA criada');
      return toView(created);
    }

    const updated = await aiRepository.update(existing.id, tenantId, {
      provider: dto.provider,
      model: dto.model,
      baseUrl,
      systemPrompt: dto.systemPrompt ?? null,
      ...(apiKeyEnc !== undefined ? { apiKeyEnc } : {}),
      ...(dto.maxTokens !== undefined ? { maxTokens: dto.maxTokens } : {}),
      ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
      ...(dto.historyWindow !== undefined ? { historyWindow: dto.historyWindow } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });
    if (!updated) throw new AppError('Config de IA não encontrada', 404, 'NOT_FOUND');
    logger.info({ tenantId, action: 'ai.config.update' }, 'Config de IA atualizada');
    return toView(updated);
  },

  /**
   * POST /test — usa a config do tenant para gerar uma resposta de exemplo.
   * Override por tenant (provider/model/apiKey decifrada/baseUrl/temperature) é
   * passado ao facade; o systemPrompt vira a mensagem `system`.
   */
  async test(
    tenantId: string,
    dto: TestAiConfigDto,
  ): Promise<{ content: string; latencyMs: number; provider: AiProvider; model: string }> {
    const cfg = await aiRepository.findByTenant(tenantId);
    if (!cfg) {
      throw new AppError('Configure a IA antes de testar', 400, 'AI_CONFIG_MISSING');
    }

    const apiKey = cfg.apiKeyEnc ? decrypt(cfg.apiKeyEnc) : undefined;
    const userMessage = dto.message?.trim() || DEFAULT_TEST_MESSAGE;

    const messages: AiMessage[] = [];
    if (cfg.systemPrompt) messages.push({ role: 'system', content: cfg.systemPrompt });
    messages.push({ role: 'user', content: userMessage });

    const res = await aiFacade.generate(messages, {
      provider: providerName(cfg.provider),
      model: cfg.model,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      tenantId,
      ...(apiKey ? { apiKey } : {}),
      ...(cfg.baseUrl ? { baseUrl: cfg.baseUrl } : {}),
    });

    return {
      content: res.content,
      latencyMs: res.latencyMs,
      provider: cfg.provider,
      model: cfg.model,
    };
  },
};
