import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

export interface CreateTagPayload {
  name: string;
  color?: string;
}

export interface UpdateTagPayload {
  name?: string;
  color?: string;
}

/**
 * Serviço reutilizável de tags (T-043). Alimenta o autocomplete (`list` com
 * `?q=`), permite CRUD e anexar/remover tags de contatos.
 */
@Injectable({ providedIn: 'root' })
export class TagsService {
  private api = inject(ApiService);

  /** Lista tags; `q` filtra por prefixo do nome (autocomplete). */
  list(q?: string): Observable<Tag[]> {
    return this.api.get<Tag[]>('/tags', q ? { q } : undefined);
  }

  create(payload: CreateTagPayload): Observable<Tag> {
    return this.api.post<Tag>('/tags', payload);
  }

  update(id: string, payload: UpdateTagPayload): Observable<Tag> {
    return this.api.patch<Tag>(`/tags/${id}`, payload);
  }

  remove(id: string): Observable<void> {
    return this.api.delete<void>(`/tags/${id}`);
  }

  /** Anexa uma tag a um contato. */
  attachToContact(contactId: string, tagId: string): Observable<void> {
    return this.api.post<void>(`/contacts/${contactId}/tags`, { tagId });
  }

  /** Remove uma tag de um contato. */
  detachFromContact(contactId: string, tagId: string): Observable<void> {
    return this.api.delete<void>(`/contacts/${contactId}/tags/${tagId}`);
  }
}
