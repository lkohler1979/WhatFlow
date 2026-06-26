import { flowsService } from '@modules/flows/flows.service.js';
import { flowsRepository as repo } from '@modules/flows/flows.repository.js';

jest.mock('@modules/flows/flows.repository.js');
const mockRepo = repo as jest.Mocked<typeof repo>;

const flow = (over: Record<string, unknown> = {}) =>
  ({
    id: 'f1',
    tenantId: 't1',
    name: 'Atendimento',
    description: null,
    instanceId: null,
    triggerType: 'KEYWORD',
    triggerValue: 'oi',
    nodesJson: [],
    edgesJson: [],
    status: 'DRAFT',
    version: 1,
    publishedAt: null,
    isActive: true,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }) as never;

beforeEach(() => {
  jest.clearAllMocks();
  mockRepo.update.mockResolvedValue(1);
  mockRepo.archivePublishedWithTrigger.mockResolvedValue(undefined);
  mockRepo.create.mockImplementation((data) => Promise.resolve(flow(data as object)));
});

describe('flowsService', () => {
  it('create → DRAFT version 1', async () => {
    await flowsService.create('t1', {
      name: 'Bot',
      triggerType: 'KEYWORD',
      triggerValue: 'oi',
      nodesJson: [],
      edgesJson: [],
    });
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', status: 'DRAFT', version: 1 }),
    );
  });

  it('update em fluxo PUBLICADO → 409 imutável', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(flow({ status: 'PUBLISHED' }));
    await expect(flowsService.update('t1', 'f1', { name: 'x' })).rejects.toMatchObject({
      statusCode: 409,
      code: 'FLOW_IMMUTABLE',
    });
    expect(mockRepo.update).not.toHaveBeenCalled();
  });

  it('update em RASCUNHO aplica e retorna', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(flow({ status: 'DRAFT' }))
      .mockResolvedValueOnce(flow({ status: 'DRAFT', name: 'Novo' }));
    const r = await flowsService.update('t1', 'f1', { name: 'Novo' });
    expect(mockRepo.update).toHaveBeenCalled();
    expect(r.name).toBe('Novo');
  });

  it('publish → PUBLISHED e arquiva concorrentes do mesmo gatilho', async () => {
    mockRepo.findByIdInTenant
      .mockResolvedValueOnce(flow({ status: 'DRAFT' }))
      .mockResolvedValueOnce(flow({ status: 'PUBLISHED', publishedAt: new Date() }));
    const r = await flowsService.publish('t1', 'f1');
    expect(mockRepo.update).toHaveBeenCalledWith(
      'f1',
      't1',
      expect.objectContaining({ status: 'PUBLISHED' }),
    );
    expect(mockRepo.archivePublishedWithTrigger).toHaveBeenCalled();
    expect(r.status).toBe('PUBLISHED');
  });

  it('duplicate → novo RASCUNHO com version+1 e nome "(cópia)"', async () => {
    mockRepo.findByIdInTenant.mockResolvedValue(flow({ version: 2, name: 'Bot' }));
    const r = await flowsService.duplicate('t1', 'f1');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'DRAFT', version: 3, name: 'Bot (cópia)' }),
    );
    expect(r.status).toBe('DRAFT');
  });
});
