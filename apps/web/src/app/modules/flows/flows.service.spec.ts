import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { FlowsService } from './flows.service';

describe('FlowsService', () => {
  let service: FlowsService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch']);
    TestBed.configureTestingModule({
      providers: [FlowsService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(FlowsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('list() should GET /flows', () => {
    apiSpy.get.and.returnValue(of({ data: [] }));
    service.list().subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/flows');
  });

  it('get() should GET /flows/:id', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.get('f1').subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/flows/f1');
  });

  it('create() should POST body', () => {
    apiSpy.post.and.returnValue(of({} as never));
    const body = {
      name: 'Flow 1',
      triggerType: 'ANY_MESSAGE' as const,
      nodesJson: [],
      edgesJson: [],
    };
    service.create(body).subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/flows', body);
  });

  it('update() should PATCH body', () => {
    apiSpy.patch.and.returnValue(of({} as never));
    service.update('f1', { name: 'New name' }).subscribe();
    expect(apiSpy.patch).toHaveBeenCalledWith('/flows/f1', { name: 'New name' });
  });

  it('publish() should POST to publish endpoint', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.publish('f1').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/flows/f1/publish', {});
  });

  it('duplicate() should POST to duplicate endpoint', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.duplicate('f1').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/flows/f1/duplicate', {});
  });
});
