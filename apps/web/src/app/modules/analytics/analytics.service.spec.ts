import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj('ApiService', ['get', 'getText']);
    TestBed.configureTestingModule({
      providers: [AnalyticsService, { provide: ApiService, useValue: apiSpy }],
    });
    service = TestBed.inject(AnalyticsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('overview() should call api.get with period params', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.overview({ from: '2026-01-01', to: '2026-01-31', granularity: 'day' }).subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/analytics/overview', {
      from: '2026-01-01',
      to: '2026-01-31',
      granularity: 'day',
    });
  });

  it('overview() should work without query', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.overview().subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/analytics/overview', {});
  });

  it('messages() should call api.get with params', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.messages({ from: '2026-01-01' }).subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/analytics/messages', { from: '2026-01-01' });
  });

  it('campaigns() should call api.get with params', () => {
    apiSpy.get.and.returnValue(of({} as never));
    service.campaigns({ to: '2026-01-31' }).subscribe();
    expect(apiSpy.get).toHaveBeenCalledWith('/analytics/campaigns', { to: '2026-01-31' });
  });

  it('exportCsv() should call api.getText with report and params', () => {
    apiSpy.getText.and.returnValue(of('csv'));
    service.exportCsv('messages', { granularity: 'week' }).subscribe(res => {
      expect(res).toBe('csv');
    });
    expect(apiSpy.getText).toHaveBeenCalledWith('/analytics/export', {
      report: 'messages',
      granularity: 'week',
    });
  });
});
