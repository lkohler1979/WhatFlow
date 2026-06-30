import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from '@core/services/api.service';

export type AiProvider = 'GROQ' | 'OLLAMA' | 'OPENAI_COMPATIBLE';

/** Config de IA do tenant retornada pela API (apiKey sempre mascarada). */
export interface AiConfigView {
  id: string | null;
  provider: AiProvider;
  model: string;
  apiKeyMask: string | null;
  hasApiKey: boolean;
  baseUrl: string | null;
  systemPrompt: string | null;
  maxTokens: number;
  temperature: number;
  historyWindow: number;
  isActive: boolean;
  updatedAt: string | null;
}

/** Payload de upsert. apiKey omitida = preserva a atual; '' = limpa. */
export interface AiConfigPayload {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  historyWindow?: number;
  isActive?: boolean;
}

export interface AiTestResult {
  content: string;
  latencyMs: number;
  provider: AiProvider;
  model: string;
}

@Injectable({ providedIn: 'root' })
export class AiConfigService {
  private api = inject(ApiService);

  get(): Observable<AiConfigView> {
    return this.api.get<AiConfigView>('/ai/config');
  }

  save(payload: AiConfigPayload): Observable<AiConfigView> {
    return this.api.put<AiConfigView>('/ai/config', payload);
  }

  test(message?: string): Observable<AiTestResult> {
    return this.api.post<AiTestResult>('/ai/test', message ? { message } : {});
  }
}
