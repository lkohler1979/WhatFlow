import axios from 'axios';

// Mocka o axios: o groq adapter chama axios.create() e usa client.post().
jest.mock('axios');

const post = jest.fn();

// Envs de IA fixos p/ este suite (cache ligado, TTL e limite previsíveis).
process.env.AI_PROVIDER = 'groq';
process.env.AI_CACHE_ENABLED = 'true';
process.env.AI_CACHE_TTL_MS = '1000';
process.env.AI_RATE_LIMIT_PER_MIN = '3';

function freshGroqResponse(content: string, totalTokens = 15) {
  return {
    data: {
      choices: [{ message: { content } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: totalTokens },
    },
  };
}

// Recarrega o serviço com o mock de axios reaplicado (os módulos cacheiam estado).
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
const other = [
  { role: 'system' as const, content: 'Você é um bot' },
  { role: 'user' as const, content: 'Tchau' },
];

describe('AiService — cache de respostas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('segunda chamada com as MESMAS mensagens vem do cache (adapter chamado 1x)', async () => {
    const ai = loadFresh();
    ai.resetUsage();
    post.mockResolvedValue(freshGroqResponse('resposta cacheável'));

    const r1 = await ai.generate(messages);
    const r2 = await ai.generate(messages);

    expect(r1.content).toBe('resposta cacheável');
    expect(r2.content).toBe('resposta cacheável');
    expect(post).toHaveBeenCalledTimes(1);

    const usage = ai.getUsage();
    expect(usage.totalCalls).toBe(2);
    expect(usage.cacheHits).toBe(1);
    expect(usage.cacheMisses).toBe(1);
  });

  it('mensagens diferentes não colidem no cache (2 chamadas ao adapter)', async () => {
    const ai = loadFresh();
    ai.resetUsage();
    post.mockResolvedValue(freshGroqResponse('x'));

    await ai.generate(messages);
    await ai.generate(other);

    expect(post).toHaveBeenCalledTimes(2);
  });

  it('cache expira após o TTL (fake timers) e chama o provedor de novo', async () => {
    jest.useFakeTimers();
    try {
      const ai = loadFresh();
      ai.resetUsage();
      post.mockResolvedValue(freshGroqResponse('expira'));

      await ai.generate(messages);
      expect(post).toHaveBeenCalledTimes(1);

      // ainda dentro do TTL (1000ms): hit de cache
      jest.advanceTimersByTime(500);
      await ai.generate(messages);
      expect(post).toHaveBeenCalledTimes(1);

      // passou do TTL: miss → vai ao provedor de novo
      jest.advanceTimersByTime(600);
      await ai.generate(messages);
      expect(post).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it('cache desligado (AI_CACHE_ENABLED=false) sempre chama o provedor', async () => {
    process.env.AI_CACHE_ENABLED = 'false';
    try {
      const ai = loadFresh();
      ai.resetUsage();
      post.mockResolvedValue(freshGroqResponse('sem cache'));

      await ai.generate(messages);
      await ai.generate(messages);

      expect(post).toHaveBeenCalledTimes(2);
      expect(ai.getUsage().cacheHits).toBe(0);
    } finally {
      process.env.AI_CACHE_ENABLED = 'true';
    }
  });
});

describe('AiService — rate limiting', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ao exceder AI_RATE_LIMIT_PER_MIN lança AppError 429 / AI_RATE_LIMIT', async () => {
    const ai = loadFresh();
    ai.resetUsage();
    // mensagens distintas p/ forçar miss em todas (cada uma vai ao provedor).
    post.mockResolvedValue(freshGroqResponse('y'));

    const mk = (n: number) => [{ role: 'user' as const, content: `msg-${n}` }];

    await ai.generate(mk(1));
    await ai.generate(mk(2));
    await ai.generate(mk(3)); // limite = 3, ainda ok

    await expect(ai.generate(mk(4))).rejects.toMatchObject({
      code: 'AI_RATE_LIMIT',
      statusCode: 429,
    });
    expect(post).toHaveBeenCalledTimes(3);
  });

  it('hit de cache NÃO consome cota de rate limit', async () => {
    const ai = loadFresh();
    ai.resetUsage();
    post.mockResolvedValue(freshGroqResponse('cacheada'));

    // 1 miss (consome 1 de cota) + 5 hits (não consomem). Limite é 3.
    await ai.generate(messages);
    for (let i = 0; i < 5; i += 1) await ai.generate(messages);

    expect(post).toHaveBeenCalledTimes(1);
    expect(ai.getUsage().currentMinute.groq).toBe(1);
  });

  it('a janela reseta após 60s (fake timers)', async () => {
    jest.useFakeTimers();
    try {
      const ai = loadFresh();
      ai.resetUsage();
      post.mockResolvedValue(freshGroqResponse('z'));
      const mk = (n: number) => [{ role: 'user' as const, content: `win-${n}` }];

      await ai.generate(mk(1));
      await ai.generate(mk(2));
      await ai.generate(mk(3));
      await expect(ai.generate(mk(4))).rejects.toMatchObject({ code: 'AI_RATE_LIMIT' });

      // após a janela de 60s, a cota reseta
      jest.advanceTimersByTime(60_001);
      await expect(ai.generate(mk(5))).resolves.toMatchObject({ content: 'z' });
      expect(post).toHaveBeenCalledTimes(4);
    } finally {
      jest.useRealTimers();
    }
  });

  it('cota é isolada por tenant quando tenantId é informado', async () => {
    const ai = loadFresh();
    ai.resetUsage();
    post.mockResolvedValue(freshGroqResponse('t'));
    const mk = (n: number) => [{ role: 'user' as const, content: `t-${n}` }];

    // tenant A esgota a cota (3)
    await ai.generate(mk(1), { tenantId: 'A' });
    await ai.generate(mk(2), { tenantId: 'A' });
    await ai.generate(mk(3), { tenantId: 'A' });
    await expect(ai.generate(mk(4), { tenantId: 'A' })).rejects.toMatchObject({
      code: 'AI_RATE_LIMIT',
    });

    // tenant B tem cota própria, intacta
    await expect(ai.generate(mk(5), { tenantId: 'B' })).resolves.toMatchObject({ content: 't' });
  });
});

describe('AiService — consumo (getUsage)', () => {
  it('reflete chamadas, hits, misses e tokens acumulados', async () => {
    const ai = loadFresh();
    ai.resetUsage();
    post.mockResolvedValue(freshGroqResponse('u', 20));

    await ai.generate(messages); // miss, +20 tokens
    await ai.generate(messages); // hit
    await ai.generate(other); // miss, +20 tokens

    const usage = ai.getUsage();
    expect(usage.totalCalls).toBe(3);
    expect(usage.cacheHits).toBe(1);
    expect(usage.cacheMisses).toBe(2);
    expect(usage.totalTokens).toBe(40);
  });
});
