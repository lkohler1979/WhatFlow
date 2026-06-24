import { evolutionApiService } from '@integrations/evolution-api/evolution-api.service.js';
import { getEvolutionClient } from '@integrations/evolution-api/evolution-api.client.js';

jest.mock('@integrations/evolution-api/evolution-api.client.js');

const get = jest.fn();
const post = jest.fn();
const mockedGetClient = getEvolutionClient as jest.MockedFunction<typeof getEvolutionClient>;

// erro estilo-axios: com response (status) ou sem response (rede)
function axiosError(status?: number) {
  return status ? { response: { status, data: {} } } : { request: {}, message: 'network' };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockedGetClient.mockReturnValue({ get, post } as unknown as ReturnType<typeof getEvolutionClient>);
});

describe('evolutionApiService — métodos', () => {
  it('createInstance chama POST /instance/create', async () => {
    post.mockResolvedValueOnce({ data: { instanceName: 'x', status: 'connecting' } });
    const res = await evolutionApiService.createInstance('x', { qrcode: true });
    expect(post).toHaveBeenCalledWith('/instance/create', expect.objectContaining({ instanceName: 'x', qrcode: true }));
    expect(res).toEqual({ instanceName: 'x', status: 'connecting' });
  });

  it('createInstance inclui webhook qudo informado', async () => {
    post.mockResolvedValueOnce({ data: {} });
    await evolutionApiService.createInstance('x', { webhookUrl: 'http://h/cb', webhookEvents: ['messages.upsert'] });
    expect(post).toHaveBeenCalledWith(
      '/instance/create',
      expect.objectContaining({ webhook: { url: 'http://h/cb', events: ['messages.upsert'] } }),
    );
  });

  it('getConnectionState chama GET /instance/connectionState/{key}', async () => {
    get.mockResolvedValueOnce({ data: { instanceName: 'k', status: 'open' } });
    const res = await evolutionApiService.getConnectionState('k');
    expect(get).toHaveBeenCalledWith('/instance/connectionState/k');
    expect(res).toEqual({ instanceName: 'k', status: 'open' });
  });

  it('connect chama GET /instance/connect/{key}', async () => {
    get.mockResolvedValueOnce({ data: { instanceName: 'k', status: 'connecting', qrcode: { base64: 'b', code: 'c' } } });
    const res = await evolutionApiService.connect('k');
    expect(get).toHaveBeenCalledWith('/instance/connect/k');
    expect(res).toHaveProperty('qrcode');
  });

  it('sendText chama POST /message/sendText/{key} com payload', async () => {
    post.mockResolvedValueOnce({ data: { ok: true } });
    const payload = { number: '5511999999999', text: 'oi' };
    const res = await evolutionApiService.sendText('k', payload);
    expect(post).toHaveBeenCalledWith('/message/sendText/k', payload);
    expect(res).toEqual({ ok: true });
  });

  it('sendMedia chama POST /message/sendMedia/{key} com payload', async () => {
    post.mockResolvedValueOnce({ data: { ok: true } });
    const payload = { number: '5511999999999', mediatype: 'image' as const, media: 'http://img' };
    await evolutionApiService.sendMedia('k', payload);
    expect(post).toHaveBeenCalledWith('/message/sendMedia/k', payload);
  });

  it('setWebhook chama POST /webhook/set/{key}', async () => {
    post.mockResolvedValueOnce({ data: { ok: true } });
    await evolutionApiService.setWebhook('k', 'http://h/cb', ['messages.upsert']);
    expect(post).toHaveBeenCalledWith('/webhook/set/k', {
      webhook: { enabled: true, url: 'http://h/cb', events: ['messages.upsert'] },
    });
  });
});

describe('evolutionApiService — retry', () => {
  it('repete em falha temporária (503) e sucede', async () => {
    get.mockRejectedValueOnce(axiosError(503)).mockResolvedValueOnce({ data: { status: 'open' } });
    const res = await evolutionApiService.getConnectionState('k');
    expect(get).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ status: 'open' });
  });

  it('repete em erro de rede e sucede', async () => {
    get.mockRejectedValueOnce(axiosError()).mockResolvedValueOnce({ data: { status: 'open' } });
    const res = await evolutionApiService.getConnectionState('k');
    expect(get).toHaveBeenCalledTimes(2);
    expect(res).toEqual({ status: 'open' });
  });

  it('desiste após MAX_ATTEMPTS em 503 persistente', async () => {
    get.mockRejectedValue(axiosError(503));
    await expect(evolutionApiService.getConnectionState('k')).rejects.toMatchObject({
      code: 'EVOLUTION_API_ERROR',
    });
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('NÃO repete em 4xx (400) — falha imediata', async () => {
    post.mockRejectedValue(axiosError(400));
    await expect(evolutionApiService.sendText('k', { number: '1', text: 'x' })).rejects.toMatchObject({
      code: 'EVOLUTION_API_ERROR',
      statusCode: 400,
    });
    expect(post).toHaveBeenCalledTimes(1);
  });
});
