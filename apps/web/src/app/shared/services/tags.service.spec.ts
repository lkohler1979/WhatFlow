import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { TagsService } from './tags.service';

describe('TagsService', () => {
  let service: TagsService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [TagsService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(TagsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('list() should GET without query when q omitted', () => {
    apiSpy.get.and.returnValue(of([]));
    service.list().subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/tags', undefined);
  });

  it('list() should GET with q when provided', () => {
    apiSpy.get.and.returnValue(of([]));
    service.list('vip').subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/tags', { q: 'vip' });
  });

  it('create() should POST payload', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.create({ name: 'VIP', color: '#fff' }).subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/tags', { name: 'VIP', color: '#fff' });
  });

  it('update() should PATCH payload', () => {
    apiSpy.patch.and.returnValue(of({} as never));
    service.update('t1', { name: 'New' }).subscribe();
    expect(apiSpy.patch).toHaveBeenCalledWith('/tags/t1', { name: 'New' });
  });

  it('remove() should DELETE tag', () => {
    apiSpy.delete.and.returnValue(of(undefined as never));
    service.remove('t1').subscribe();
    expect(apiSpy.delete).toHaveBeenCalledWith('/tags/t1');
  });

  it('attachToContact() should POST tagId', () => {
    apiSpy.post.and.returnValue(of(undefined as never));
    service.attachToContact('c1', 't1').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/contacts/c1/tags', { tagId: 't1' });
  });

  it('detachFromContact() should DELETE tag from contact', () => {
    apiSpy.delete.and.returnValue(of(undefined as never));
    service.detachFromContact('c1', 't1').subscribe();
    expect(apiSpy.delete).toHaveBeenCalledWith('/contacts/c1/tags/t1');
  });
});
