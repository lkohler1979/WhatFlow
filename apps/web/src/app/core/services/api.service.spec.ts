import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { environment } from '@env/environment';
import { ApiService } from './api.service';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('get() should call GET with params', () => {
    service.get<{ ok: boolean }>('/foo', { page: 1, active: true }).subscribe(res => {
      expect(res).toEqual({ ok: true });
    });

    const req = httpMock.expectOne(
      r => r.url === `${environment.apiUrl}/foo` && r.method === 'GET',
    );
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('active')).toBe('true');
    req.flush({ ok: true });
  });

  it('get() should work without params', () => {
    service.get<{ ok: boolean }>('/bar').subscribe(res => {
      expect(res).toEqual({ ok: true });
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/bar`);
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true });
  });

  it('getText() should return text response', () => {
    service.getText('/export', { report: 'messages' }).subscribe(res => {
      expect(res).toBe('csv,data');
    });
    const req = httpMock.expectOne(
      r => r.url === `${environment.apiUrl}/export` && r.method === 'GET',
    );
    expect(req.request.responseType).toBe('text');
    req.flush('csv,data');
  });

  it('post() should call POST with body', () => {
    const body = { name: 'x' };
    service.post<{ id: string }>('/things', body).subscribe(res => {
      expect(res).toEqual({ id: '1' });
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/things`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush({ id: '1' });
  });

  it('put() should call PUT with body', () => {
    service.put<{ ok: boolean }>('/things/1', { a: 1 }).subscribe(res => {
      expect(res).toEqual({ ok: true });
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/things/1`);
    expect(req.request.method).toBe('PUT');
    req.flush({ ok: true });
  });

  it('patch() should call PATCH with body', () => {
    service.patch<{ ok: boolean }>('/things/1', { a: 1 }).subscribe(res => {
      expect(res).toEqual({ ok: true });
    });
    const req = httpMock.expectOne(`${environment.apiUrl}/things/1`);
    expect(req.request.method).toBe('PATCH');
    req.flush({ ok: true });
  });

  it('delete() should call DELETE', () => {
    service.delete<void>('/things/1').subscribe();
    const req = httpMock.expectOne(`${environment.apiUrl}/things/1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
  });
});
