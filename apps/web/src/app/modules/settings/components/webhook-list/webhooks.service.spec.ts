import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { WebhooksService, WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS } from './webhooks.service';

describe('WebhooksService', () => {
  let service: WebhooksService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [WebhooksService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(WebhooksService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('WEBHOOK_EVENTS should have a label for every event', () => {
    WEBHOOK_EVENTS.forEach(evt => {
      expect(WEBHOOK_EVENT_LABELS[evt]).toBeTruthy();
    });
  });

  it('list() should apply default pagination', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.list().subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/webhooks', { page: 1, pageSize: 50 });
  });

  it('list() should accept custom pagination', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.list(2, 5).subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/webhooks', { page: 2, pageSize: 5 });
  });

  it('get() should GET by id', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.get('w1').subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/webhooks/w1');
  });

  it('create() should POST payload', () => {
    apiSpy.post.and.returnValue(of({} as never));
    const payload = { name: 'Hook', url: 'https://x.com', events: ['MESSAGE_RECEIVED'] as const };
    service.create(payload as never).subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/webhooks', payload);
  });

  it('update() should PATCH payload', () => {
    apiSpy.patch.and.returnValue(of({} as never));
    service.update('w1', { isActive: false }).subscribe();
    expect(apiSpy.patch).toHaveBeenCalledWith('/webhooks/w1', { isActive: false });
  });

  it('remove() should DELETE webhook', () => {
    apiSpy.delete.and.returnValue(of(undefined as never));
    service.remove('w1').subscribe();
    expect(apiSpy.delete).toHaveBeenCalledWith('/webhooks/w1');
  });

  it('test() should POST to test endpoint', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.test('w1').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/webhooks/w1/test', {});
  });

  it('deliveries() should GET with default pagination', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.deliveries('w1').subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/webhooks/w1/deliveries', { page: 1, pageSize: 10 });
  });

  it('deliveries() should accept custom pagination', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.deliveries('w1', 3, 20).subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/webhooks/w1/deliveries', {
      page: 3,
      pageSize: 20,
    });
  });
});
