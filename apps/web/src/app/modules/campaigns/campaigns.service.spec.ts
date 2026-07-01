import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { CampaignsService } from './campaigns.service';

describe('CampaignsService', () => {
  let service: CampaignsService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'delete']);
    TestBed.configureTestingModule({
      providers: [CampaignsService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(CampaignsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('list() should apply default pagination', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.list().subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/campaigns', { page: 1, pageSize: 20 });
  });

  it('list() should include status when provided', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.list({ status: 'RUNNING', page: 2, pageSize: 10 }).subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/campaigns', {
      page: 2,
      pageSize: 10,
      status: 'RUNNING',
    });
  });

  it('create() should POST payload', () => {
    apiSpy.post.and.returnValue(of({} as never));
    const payload = {
      name: 'x',
      instanceId: 'i1',
      messageType: 'TEXT' as const,
      delayMinMs: 1000,
      delayMaxMs: 2000,
    };
    service.create(payload).subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/campaigns', payload);
  });

  it('start() should POST to start endpoint', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.start('c1').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/campaigns/c1/start', {});
  });

  it('pause() should POST to pause endpoint', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.pause('c1').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/campaigns/c1/pause', {});
  });

  it('cancel() should POST to cancel endpoint', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.cancel('c1').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/campaigns/c1/cancel', {});
  });

  it('remove() should DELETE the campaign', () => {
    apiSpy.delete.and.returnValue(of(undefined as never));
    service.remove('c1').subscribe();
    expect(apiSpy.delete).toHaveBeenCalledWith('/campaigns/c1');
  });
});
