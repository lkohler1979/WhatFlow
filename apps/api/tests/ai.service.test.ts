import axios from 'axios';

// Mocka o axios: cada adapter chama axios.create() e usa o client.post().
jest.mock('axios');

const post = jest.fn();
const mockedAxios = axios as jest.Mocked<typeof axios>;

// erro estilo-axios: com response (status) ou sem response (rede)
function axiosError(status?: number) {
  return status ? { response: { status, data: {} } } : { request: {}, message: 'network' };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  mockedAxios.create.mockReturnValue({
    post,
    interceptors: { response: { use: jest.fn() } },
  } as unknown as ReturnType<typeof axios.create>);
});

// Os adapters cacheiam o client axios por módulo; resetamos os módulos e
// recarregamos via require (CJS sob ts-jest) para o mock valer a cada teste.
// Após resetModules, o mock de axios é recriado — reaplicamos create.
function loadFresh() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const freshAxios = require('axios') as jest.Mocked<typeof axios>;
  freshAxios.create.mockReturnValue({
    post,
    interceptors: { response: { use: jest.fn() } },
  } as unknown as ReturnType<typeof axios.create>);
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const svc = require('@integrations/ai/ai.service.js');
  return svc.aiService as typeof import('@integrations/ai/ai.service.js').aiService;
}

const messages = [
  { role: 'system' as const, content: 'Você é um bot' },
  { role: 'user' as const, content: 'Olá' },
];

describe('GroqAdapter', () => {
  it('gera resposta lendo choices[0].message.content', async () => {
    post.mockResolvedValueOnce({
      data: {
        choices: [{ message: { content: 'Oi, tudo bem?' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    });
    const ai = loadFresh();
    const res = await ai.generate(messages, { provider: 'groq' });
    expect(post).toHaveBeenCalledWith(
      '/chat/completions',
      expect.objectContaining({ messages, model: expect.any(String) }),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(res.content).toBe('Oi, tudo bem?');
    expect(res.tokens).toBe(15);
    expect(res.usage?.totalTokens).toBe(15);
  });

  it('429 vira AppError AI_RATE_LIMIT sem retry', async () => {
    post.mockRejectedValue(axiosError(429));
    const ai = loadFresh();
    await expect(ai.generate(messages, { provider: 'groq' })).rejects.toMatchObject({
      code: 'AI_RATE_LIMIT',
      statusCode: 429,
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('401 vira AppError AI_PROVIDER_ERROR sem retry', async () => {
    post.mockRejectedValue(axiosError(401));
    const ai = loadFresh();
    await expect(ai.generate(messages, { provider: 'groq' })).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
      statusCode: 401,
    });
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('repete em 5xx e sucede', async () => {
    post
      .mockRejectedValueOnce(axiosError(503))
      .mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ok' } }] } });
    const ai = loadFresh();
    const res = await ai.generate(messages, { provider: 'groq' });
    expect(res.content).toBe('ok');
    expect(post).toHaveBeenCalledTimes(2);
  });

  it('repete em erro de rede e desiste após 3 tentativas', async () => {
    post.mockRejectedValue(axiosError());
    const ai = loadFresh();
    await expect(ai.generate(messages, { provider: 'groq' })).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
    });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('respeita override de timeout por chamada', async () => {
    post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'x' } }] } });
    const ai = loadFresh();
    await ai.generate(messages, { provider: 'groq', timeoutMs: 1234 });
    expect(post).toHaveBeenCalledWith(
      '/chat/completions',
      expect.any(Object),
      expect.objectContaining({ timeout: 1234 }),
    );
  });
});

describe('OllamaAdapter', () => {
  it('gera resposta lendo message.content e envia stream:false', async () => {
    post.mockResolvedValueOnce({
      data: { message: { content: 'Olá do Ollama' }, prompt_eval_count: 8, eval_count: 4 },
    });
    const ai = loadFresh();
    const res = await ai.generate(messages, { provider: 'ollama' });
    expect(post).toHaveBeenCalledWith(
      '/api/chat',
      expect.objectContaining({ messages, stream: false }),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
    expect(res.content).toBe('Olá do Ollama');
    expect(res.tokens).toBe(12);
    expect(res.usage?.totalTokens).toBe(12);
  });

  it('4xx vira AppError AI_PROVIDER_ERROR sem retry', async () => {
    post.mockRejectedValue(axiosError(400));
    const ai = loadFresh();
    await expect(ai.generate(messages, { provider: 'ollama' })).rejects.toMatchObject({
      code: 'AI_PROVIDER_ERROR',
      statusCode: 400,
    });
    expect(post).toHaveBeenCalledTimes(1);
  });
});

describe('AiService — switch de provedor', () => {
  it('default usa o provedor do config (groq) quando não há override', async () => {
    post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'via default' } }] } });
    const ai = loadFresh();
    expect(ai.defaultProvider).toBe('groq');
    const res = await ai.generate(messages);
    // chamou o endpoint da Groq, não o do Ollama
    expect(post).toHaveBeenCalledWith('/chat/completions', expect.any(Object), expect.any(Object));
    expect(res.content).toBe('via default');
  });

  it('opts.provider sobrescreve transparentemente para ollama', async () => {
    post.mockResolvedValueOnce({ data: { message: { content: 'via ollama' } } });
    const ai = loadFresh();
    const res = await ai.generate(messages, { provider: 'ollama' });
    expect(post).toHaveBeenCalledWith('/api/chat', expect.any(Object), expect.any(Object));
    expect(res.content).toBe('via ollama');
  });

  it('provedor desconhecido lança AppError', async () => {
    const ai = loadFresh();
    await expect(
      ai.generate(messages, { provider: 'foo' as unknown as 'groq' }),
    ).rejects.toMatchObject({ code: 'AI_PROVIDER_ERROR', statusCode: 400 });
  });
});
