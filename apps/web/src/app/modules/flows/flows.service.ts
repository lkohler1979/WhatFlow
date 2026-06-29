import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';
import type { CreateFlowBody, Flow, UpdateFlowBody } from './flows.models';

@Injectable({ providedIn: 'root' })
export class FlowsService {
  private api = inject(ApiService);

  list(): Observable<{ data: Flow[] }> {
    return this.api.get<{ data: Flow[] }>('/flows');
  }

  get(id: string): Observable<Flow> {
    return this.api.get<Flow>(`/flows/${id}`);
  }

  create(body: CreateFlowBody): Observable<Flow> {
    return this.api.post<Flow>('/flows', body);
  }

  update(id: string, body: UpdateFlowBody): Observable<Flow> {
    return this.api.patch<Flow>(`/flows/${id}`, body);
  }

  publish(id: string): Observable<Flow> {
    return this.api.post<Flow>(`/flows/${id}/publish`, {});
  }

  duplicate(id: string): Observable<Flow> {
    return this.api.post<Flow>(`/flows/${id}/duplicate`, {});
  }
}
