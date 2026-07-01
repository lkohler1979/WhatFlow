import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { InboxService } from './inbox.service';

describe('InboxService', () => {
  let service: InboxService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'post', 'patch', 'delete']);
    TestBed.configureTestingModule({
      providers: [InboxService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(InboxService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('listConversations() should apply default pagination', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.listConversations({}).subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/conversations', { page: 1, pageSize: 20 });
  });

  it('listConversations() should include status/search/tagId', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service
      .listConversations({ status: 'OPEN', search: 'john', tagId: 't1', page: 2, pageSize: 10 })
      .subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/conversations', {
      page: 2,
      pageSize: 10,
      status: 'OPEN',
      search: 'john',
      tagId: 't1',
    });
  });

  it('getConversation() should GET by id', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.getConversation('c1').subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/conversations/c1');
  });

  it('listMessages() should GET with default limit', () => {
    apiSpy.get.and.returnValue(of({ data: [], nextCursor: null }));
    service.listMessages('c1').subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/conversations/c1/messages', { limit: 30 });
  });

  it('listMessages() should include cursor when provided', () => {
    apiSpy.get.and.returnValue(of({ data: [], nextCursor: null }));
    service.listMessages('c1', 'cur1', 10).subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/conversations/c1/messages', {
      limit: 10,
      cursor: 'cur1',
    });
  });

  it('sendMessage() should POST text', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.sendMessage('c1', 'hi').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/conversations/c1/messages', { text: 'hi' });
  });

  it('addNote() should POST to notes endpoint', () => {
    apiSpy.post.and.returnValue(of({} as never));
    service.addNote('c1', 'note').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/conversations/c1/notes', { text: 'note' });
  });

  it('attachTag() should POST tagId', () => {
    apiSpy.post.and.returnValue(of(undefined as never));
    service.attachTag('c1', 'tag1').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/conversations/c1/tags', { tagId: 'tag1' });
  });

  it('detachTag() should DELETE tag', () => {
    apiSpy.delete.and.returnValue(of(undefined as never));
    service.detachTag('c1', 'tag1').subscribe();
    expect(apiSpy.delete).toHaveBeenCalledWith('/conversations/c1/tags/tag1');
  });

  it('markRead() should POST to read endpoint', () => {
    apiSpy.post.and.returnValue(of(undefined as never));
    service.markRead('c1').subscribe();
    expect(apiSpy.post).toHaveBeenCalledWith('/conversations/c1/read', {});
  });

  it('setBotActive() should PATCH botActive', () => {
    apiSpy.patch.and.returnValue(of({} as never));
    service.setBotActive('c1', true).subscribe();
    expect(apiSpy.patch).toHaveBeenCalledWith('/conversations/c1', { botActive: true });
  });

  it('setStatus() should PATCH status', () => {
    apiSpy.patch.and.returnValue(of({} as never));
    service.setStatus('c1', 'RESOLVED').subscribe();
    expect(apiSpy.patch).toHaveBeenCalledWith('/conversations/c1', { status: 'RESOLVED' });
  });
});
