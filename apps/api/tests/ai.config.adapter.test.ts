import axios from 'axios';

// Mocka o axios: cada adapter chama axios.create() e usa o client.post().
jest.mock('axios');

const post = jest.fn();
const create = jest.fn();
const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
  create.mockReturnValue({
    post,
    interceptors: { response: { use: jest.fn() } },
  } as unknown as ReturnType<typeof axios.create>);
  mockedAxios.create = create;
});

function loadFresh() {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const freshAxios = require('axios') as jest.Mocked<typeof axios>;
  freshAxios.create = create;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const svc = require('@integrations/ai/ai.service.js');
  return svc.aiService as typeof import('@integrations/ai/ai.service.js').aiService;
}

const messages = [{ role: 'user' as const, content: 'Olá' }];

describe('Override de credencial por tenant (T-029)', () => {
  it('Groq usa apiKey/baseUrl do tenant quando passados em opts', async () => {
    post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ok' } }] } });
    const ai = loadFresh();
    await ai.generate(messages, {
      provider: 'groq',
      apiKey: 'gsk_tenant_key',
      baseUrl: 'https://tenant.example/v1',
    });
    // axios.create chamado com a baseURL e Authorization do tenant
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'https://tenant.example/v1',
        headers: expect.objectContaining({ Authorization: 'Bearer gsk_tenant_key' }),
      }),
    );
  });

  it('Groq cai no config global quando não há override', async () => {
    post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'ok' } }] } });
    const ai = loadFresh();
    await ai.generate(messages, { provider: 'groq' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'https://api.groq.com/openai/v1' }),
    );
  });

  it('Ollama usa baseUrl do tenant quando passado em opts', async () => {
    post.mockResolvedValueOnce({ data: { message: { content: 'ok' } } });
    const ai = loadFresh();
    await ai.generate(messages, { provider: 'ollama', baseUrl: 'http://tenant-ollama:11434' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: 'http://tenant-ollama:11434' }),
    );
  });
});
