import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { InstancesService } from './instances.service';

describe('InstancesService', () => {
  let service: InstancesService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'delete']);
    TestBed.configureTestingModule({
      providers: [InstancesService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(InstancesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('list() should call api.get', () => {
    apiSpy.get.and.returnValue(of({ data: [] }));
    service.list().subscribe(res => expect(res).toEqual({ data: [] }));
    expect(apiSpy.get).toHaveBeenCalledWith('/instances');
  });

  it('create() should POST with name', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.create('My Instance').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/instances', { name: 'My Instance' });
  });

  it('get() should call api.get with id', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.get('i1').subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/instances/i1');
  });

  it('qrCode() should call api.get on qrcode endpoint', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.qrCode('i1').subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/instances/i1/qrcode');
  });

  it('remove() should DELETE the instance', () => {
    apiSpy.delete.and.returnValue(of(undefined as never));
    service.remove('i1').subscribe();
    expect(apiSpy.delete).toHaveBeenCalledWith('/instances/i1');
  });

  it('sendMessage() should POST number and text', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.sendMessage('i1', '5511999999999', 'hello').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/instances/i1/send', {
      number: '5511999999999',
      text: 'hello',
    });
  });
});
