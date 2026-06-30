import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export interface ContactTag {
  id: string;
  name: string;
  color: string;
}

export interface Contact {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  customFields: Record<string, unknown>;
  isBlocked: boolean;
  isOptedOut: boolean;
  optedOutAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: ContactTag[];
}

export interface ContactListResponse {
  data: Contact[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ContactPayload {
  phone: string;
  name?: string | null;
  email?: string | null;
  customFields?: Record<string, unknown>;
  isBlocked?: boolean;
  isOptedOut?: boolean;
  tagIds?: string[];
}

export interface ContactImportResult {
  total: number;
  imported: number;
  created: number;
  updated: number;
  failed: number;
  errors: { line: number; message: string }[];
}

export interface PhoneValidationResult {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
}

@Injectable({ providedIn: 'root' })
export class ContactsService {
  private api = inject(ApiService);

  list(
    params: {
      search?: string;
      page?: number;
      pageSize?: number;
    } = {},
  ): Observable<ContactListResponse> {
    return this.api.get<ContactListResponse>('/contacts', {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 25,
      ...(params.search ? { search: params.search } : {}),
    });
  }

  create(payload: ContactPayload): Observable<Contact> {
    return this.api.post<Contact>('/contacts', payload);
  }

  update(id: string, payload: ContactPayload): Observable<Contact> {
    return this.api.patch<Contact>(`/contacts/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/contacts/${id}`);
  }

  importCsv(csv: string): Observable<ContactImportResult> {
    return this.api.post<ContactImportResult>('/contacts/import', { csv });
  }

  validatePhones(phones: string[]): Observable<PhoneValidationResult> {
    return this.api.post<PhoneValidationResult>('/contacts/validate-phones', { phones });
  }

  exportCsv(search?: string): Observable<string> {
    return this.api.getText('/contacts/export', search ? { search } : undefined);
  }
}
