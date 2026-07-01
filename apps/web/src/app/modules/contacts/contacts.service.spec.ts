import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { ContactsService } from './contacts.service';

describe('ContactsService', () => {
  let service: ContactsService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete', 'getText']);
    TestBed.configureTestingModule({
      providers: [ContactsService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(ContactsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('list() should apply default pagination', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.list().subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/contacts', { page: 1, pageSize: 25 });
  });

  it('list() should include search and tagId when provided', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.list({ search: 'john', tagId: 't1', page: 2, pageSize: 5 }).subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/contacts', {
      page: 2,
      pageSize: 5,
      search: 'john',
      tagId: 't1',
    });
  });

  it('create() should POST payload', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.create({ phone: '+551199999999' }).subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/contacts', { phone: '+551199999999' });
  });

  it('update() should PATCH payload', () => {
    apiSpy.patch.and.returnValue(of({} as never));
    service.update('c1', { phone: '+551199999999', name: 'John' }).subscribe();
    expect(apiSpy.patch).toHaveBeenCalledWith('/contacts/c1', {
      phone: '+551199999999',
      name: 'John',
    });
  });

  it('remove() should DELETE the contact', () => {
    apiSpy.delete.and.returnValue(of(undefined as never));
    service.remove('c1').subscribe();
    expect(apiSpy.delete).toHaveBeenCalledWith('/contacts/c1');
  });

  it('importCsv() should POST csv text', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.importCsv('a,b\n1,2').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/contacts/import', { csv: 'a,b\n1,2' });
  });

  it('validatePhones() should POST phone list', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.validatePhones(['+551199999999']).subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/contacts/validate-phones', {
      phones: ['+551199999999'],
    });
  });

  it('exportCsv() should call getText with search when provided', () => {
    apiSpy.getText.and.returnValue(of('csv'));
    service.exportCsv('john').subscribe();
    expect(apiSpy.getText).toHaveBeenCalledWith('/contacts/export', { search: 'john' });
  });

  it('exportCsv() should call getText without params when search omitted', () => {
    apiSpy.getText.and.returnValue(of('csv'));
    service.exportCsv().subscribe();
    expect(apiSpy.getText).toHaveBeenCalledWith('/contacts/export', undefined);
  });

  it('conversations() should GET with contactId and default pageSize', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.conversations('c1').subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/conversations', {
      contactId: 'c1',
      pageSize: 20,
    });
  });
});
