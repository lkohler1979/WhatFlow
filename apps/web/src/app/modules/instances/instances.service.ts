import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export type InstanceStatus = 'PENDING' | 'QR_PENDING' | 'CONNECTED' | 'DISCONNECTED' | 'BANNED';

export interface Instance {
  id: string;
  name: string;
  phone: string | null;
  status: InstanceStatus;
  qrCode: string | null;
  connectedAt: string | null;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class InstancesService {
  private api = inject(ApiService);

  list(): Observable<{ data: Instance[] }> {
    return this.api.get<{ data: Instance[] }>('/instances');
  }

  create(name: string): Observable<Instance> {
    return this.api.post<Instance>('/instances', { name });
  }

  get(id: string): Observable<Instance> {
    return this.api.get<Instance>(`/instances/${id}`);
  }

  qrCode(id: string): Observable<{ qrCode: string | null; status: InstanceStatus }> {
    return this.api.get<{ qrCode: string | null; status: InstanceStatus }>(
      `/instances/${id}/qrcode`,
    );
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/instances/${id}`);
  }

  sendMessage(
    id: string,
    number: string,
    text: string,
  ): Observable<{ messageId: string; status: string }> {
    return this.api.post<{ messageId: string; status: string }>(`/instances/${id}/send`, {
      number,
      text,
    });
  }
}
