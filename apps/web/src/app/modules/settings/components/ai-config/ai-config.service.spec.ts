import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { AiConfigService } from './ai-config.service';

describe('AiConfigService', () => {
  let service: AiConfigService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'put', 'post']);
    TestBed.configureTestingModule({
      providers: [AiConfigService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(AiConfigService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('get() should GET /ai/config', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.get().subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/ai/config');
  });

  it('save() should PUT payload', () => {
    apiSpy.put.and.returnValue(of({} as never));
    const payload = { provider: 'GROQ' as const, model: 'llama-3.3-70b-versatile' };
    service.save(payload).subscribe();
    expect(apiSpy.put).toHaveBeenCalledWith('/ai/config', payload);
  });

  it('test() should POST message when provided', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.test('hello').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/ai/test', { message: 'hello' });
  });

  it('test() should POST empty body when message omitted', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.test().subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/ai/test', {});
  });
});
