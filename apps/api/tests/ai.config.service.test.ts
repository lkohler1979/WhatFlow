import { aiConfigService } from '@modules/ai/ai.service.js';
import { aiRepository as repo } from '@modules/ai/ai.repository.js';
import { encrypt } from '@modules/ai/ai.crypto.js';
import { aiService as facade } from '@integrations/ai/ai.service.js';
import type { AiConfig } from '@prisma/client';

jest.mock('@modules/ai/ai.repository.js');
jest.mock('@integrations/ai/ai.service.js', () => ({
  __esModule: true,
  aiService: { generate: jest.fn() },
}));

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockGenerate = facade.generate as jest.Mock;

const cfg = (over: Partial<AiConfig> = {}): AiConfig =>
  ({
    id: 'cfg1',
    tenantId: 't1',
    provider: 'GROQ',
    model: 'llama-3.1-70b-versatile',
    apiKeyEnc: encrypt('gsk_secret_abcd'),
    baseUrl: null,
    systemPrompt: 'Você é um bot educado',
    maxTokens: 500,
    temperature: 0.7,
    historyWindow: 10,
    isDefault: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as AiConfig;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('aiConfigService.getConfig', () => {
  it('retorna defaults quando o tenant não tem config', async () => {
    mockRepo.findByTenant.mockResolvedValue(null);
    const view = await aiConfigService.getConfig('t1');
    expect(view.id).toBeNull();
    expect(view.provider).toBe('GROQ');
    expect(view.hasApiKey).toBe(false);
    expect(view.apiKeyMask).toBeNull();
  });

  it('mascara a apiKey e nunca devolve em claro', async () => {
    mockRepo.findByTenant.mockResolvedValue(cfg());
    const view = await aiConfigService.getConfig('t1');
    expect(view.hasApiKey).toBe(true);
    expect(view.apiKeyMask).toBe('••••••abcd');
    expect(JSON.stringify(view)).not.toContain('gsk_secret_abcd');
  });
});

describe('aiConfigService.upsertConfig', () => {
  it('cria nova config cifrando a apiKey quando não existe', async () => {
    mockRepo.findByTenant.mockResolvedValue(null);
    mockRepo.create.mockImplementation((tenantId, data) =>
      Promise.resolve(cfg({ tenantId, ...(data as object) } as Partial<AiConfig>)),
    );
    const view = await aiConfigService.upsertConfig('t1', {
      provider: 'GROQ',
      model: 'llama-3.1-70b-versatile',
      apiKey: 'gsk_nova_chave_xyz9',
    });
    expect(mockRepo.create).toHaveBeenCalledWith(
      't1',
      expect.objectContaining({ provider: 'GROQ', apiKeyEnc: expect.any(String) }),
    );
    // apiKeyEnc passado ao repo não é a chave em claro
    const passed = (mockRepo.create.mock.calls[0][1] as { apiKeyEnc: string }).apiKeyEnc;
    expect(passed).not.toContain('gsk_nova_chave');
    expect(view.hasApiKey).toBe(true);
  });

  it('preserva a credencial atual quando apiKey ausente no update', async () => {
    mockRepo.findByTenant.mockResolvedValue(cfg());
    mockRepo.update.mockImplementation((id, tenantId, data) =>
      Promise.resolve(cfg({ id, tenantId, ...(data as object) } as Partial<AiConfig>)),
    );
    await aiConfigService.upsertConfig('t1', {
      provider: 'GROQ',
      model: 'outro-modelo',
    });
    const updateData = mockRepo.update.mock.calls[0][2] as Record<string, unknown>;
    expect(updateData).not.toHaveProperty('apiKeyEnc'); // não re-cifra
    expect(updateData.model).toBe('outro-modelo');
  });

  it('limpa a credencial quando apiKey é string vazia', async () => {
    mockRepo.findByTenant.mockResolvedValue(cfg());
    mockRepo.update.mockImplementation((id, tenantId, data) =>
      Promise.resolve(cfg({ id, tenantId, apiKeyEnc: null, ...(data as object) } as Partial<AiConfig>)),
    );
    await aiConfigService.upsertConfig('t1', {
      provider: 'GROQ',
      model: 'm',
      apiKey: '',
    });
    const updateData = mockRepo.update.mock.calls[0][2] as Record<string, unknown>;
    expect(updateData.apiKeyEnc).toBeNull();
  });
});

describe('aiConfigService.test', () => {
  it('400 quando o tenant não configurou IA', async () => {
    mockRepo.findByTenant.mockResolvedValue(null);
    await expect(aiConfigService.test('t1', {})).rejects.toMatchObject({
      statusCode: 400,
      code: 'AI_CONFIG_MISSING',
    });
  });

  it('chama o facade com provider/model/apiKey decifrada/temperature e systemPrompt', async () => {
    mockRepo.findByTenant.mockResolvedValue(cfg({ baseUrl: 'http://ollama.local', provider: 'OLLAMA' }));
    mockGenerate.mockResolvedValue({ content: 'resposta', tokens: 5, latencyMs: 42 });

    const res = await aiConfigService.test('t1', { message: 'oi' });

    expect(mockGenerate).toHaveBeenCalledTimes(1);
    const [messages, opts] = mockGenerate.mock.calls[0];
    expect(messages).toEqual([
      { role: 'system', content: 'Você é um bot educado' },
      { role: 'user', content: 'oi' },
    ]);
    expect(opts).toMatchObject({
      provider: 'ollama',
      model: 'llama-3.1-70b-versatile',
      temperature: 0.7,
      tenantId: 't1',
      apiKey: 'gsk_secret_abcd', // decifrada
      baseUrl: 'http://ollama.local',
    });
    expect(res).toMatchObject({ content: 'resposta', latencyMs: 42, provider: 'OLLAMA' });
  });

  it('usa mensagem default quando body não envia message', async () => {
    mockRepo.findByTenant.mockResolvedValue(cfg({ systemPrompt: null }));
    mockGenerate.mockResolvedValue({ content: 'ok', tokens: 1, latencyMs: 1 });
    await aiConfigService.test('t1', {});
    const [messages] = mockGenerate.mock.calls[0];
    expect(messages).toHaveLength(1); // sem system
    expect(messages[0].role).toBe('user');
    expect(messages[0].content.length).toBeGreaterThan(0);
  });

  it('propaga erro do provedor (ex.: 401)', async () => {
    mockRepo.findByTenant.mockResolvedValue(cfg());
    mockGenerate.mockRejectedValue(
      Object.assign(new Error('cred inválida'), { statusCode: 401, code: 'AI_PROVIDER_ERROR' }),
    );
    await expect(aiConfigService.test('t1', {})).rejects.toMatchObject({ statusCode: 401 });
  });
});
