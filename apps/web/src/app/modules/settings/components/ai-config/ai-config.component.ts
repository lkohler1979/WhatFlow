import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AiConfigService, type AiConfigView, type AiTestResult } from './ai-config.service';

@Component({
  selector: 'wf-ai-config',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="ai-config">
      <header class="head">
        <div>
          <h2>Configuração de IA</h2>
          <p class="muted">Provedor, modelo e credencial usados pelo bot ao responder com IA.</p>
        </div>
        @if (current()?.updatedAt) {
          <span class="muted">Atualizado em {{ formatDate(current()!.updatedAt!) }}</span>
        }
      </header>

      @if (error()) {
        <p class="error">{{ error() }}</p>
      }
      @if (saved()) {
        <p class="ok">Configurações salvas.</p>
      }

      @if (loading()) {
        <p class="muted">Carregando...</p>
      } @else {
        <form class="card" [formGroup]="form" (ngSubmit)="save()">
          <label>
            <span>Provedor</span>
            <select class="wf-input" formControlName="provider">
              <option value="GROQ">Groq</option>
              <option value="OLLAMA">Ollama (local)</option>
              <option value="OPENAI_COMPATIBLE">OpenAI-compatible</option>
            </select>
          </label>

          <label>
            <span>Modelo</span>
            <input class="wf-input" formControlName="model" placeholder="llama-3.1-70b-versatile" />
          </label>

          <label>
            <span>API Key</span>
            <input
              class="wf-input"
              type="password"
              formControlName="apiKey"
              [placeholder]="apiKeyPlaceholder()"
              autocomplete="off"
            />
            @if (current()?.hasApiKey) {
              <small class="muted">
                Credencial salva ({{ current()?.apiKeyMask }}). Deixe em branco para manter.
              </small>
            }
          </label>

          <label>
            <span>Base URL (Ollama / OpenAI-compatible)</span>
            <input
              class="wf-input"
              formControlName="baseUrl"
              placeholder="http://localhost:11434"
            />
          </label>

          <label>
            <span>Temperatura</span>
            <input
              class="wf-input"
              type="number"
              formControlName="temperature"
              min="0"
              max="2"
              step="0.1"
            />
          </label>

          <label>
            <span>Máx. tokens</span>
            <input class="wf-input" type="number" formControlName="maxTokens" min="1" max="8000" />
          </label>

          <label class="full">
            <span>System prompt</span>
            <textarea
              class="wf-input"
              formControlName="systemPrompt"
              rows="4"
              placeholder="Você é um assistente prestativo..."
            ></textarea>
          </label>

          <div class="actions">
            <button
              class="wf-btn wf-btn--primary"
              type="submit"
              [disabled]="form.invalid || saving()"
            >
              {{ saving() ? 'Salvando...' : 'Salvar' }}
            </button>
            <button
              type="button"
              class="wf-btn"
              (click)="test()"
              [disabled]="testing() || !current()?.id"
              title="Salve a configuração antes de testar"
            >
              {{ testing() ? 'Testando...' : 'Testar' }}
            </button>
          </div>
        </form>

        @if (testResult()) {
          <div class="test-result">
            <div class="test-meta">
              <strong>Resposta de exemplo</strong>
              <span class="muted">
                {{ testResult()?.provider }} · {{ testResult()?.model }} ·
                {{ testResult()?.latencyMs }} ms
              </span>
            </div>
            <p class="test-content">{{ testResult()?.content }}</p>
          </div>
        }
        @if (testError()) {
          <div class="test-result test-result--error">
            <strong>Falha no teste</strong>
            <p>{{ testError() }}</p>
          </div>
        }
      }
    </section>
  `,
  styles: [
    `
      .ai-config {
        padding: 1.5rem 2rem;
        max-width: 760px;
      }
      .head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 1rem;
        margin-bottom: 1rem;
      }
      h2 {
        font-size: 1.35rem;
      }
      .muted {
        opacity: 0.7;
        font-size: 0.85rem;
      }
      .error {
        color: #b42318;
        margin-bottom: 0.75rem;
      }
      .ok {
        color: #065f46;
        margin-bottom: 0.75rem;
      }
      .card {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.25rem;
      }
      label {
        display: grid;
        gap: 0.35rem;
        font-size: 0.85rem;
        font-weight: 600;
      }
      label.full {
        grid-column: 1 / -1;
      }
      small {
        font-weight: 400;
      }
      .actions {
        grid-column: 1 / -1;
        display: flex;
        gap: 0.75rem;
      }
      .test-result {
        margin-top: 1rem;
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 8px;
        padding: 1rem;
      }
      .test-result--error {
        background: #fef2f2;
        border-color: #fecaca;
        color: #991b1b;
      }
      .test-meta {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 0.75rem;
        margin-bottom: 0.5rem;
      }
      .test-content {
        white-space: pre-wrap;
      }
      @media (max-width: 720px) {
        .card {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class AiConfigComponent implements OnInit {
  private svc = inject(AiConfigService);
  private fb = inject(FormBuilder);

  current = signal<AiConfigView | null>(null);
  loading = signal(true);
  saving = signal(false);
  testing = signal(false);
  saved = signal(false);
  error = signal<string | null>(null);
  testResult = signal<AiTestResult | null>(null);
  testError = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    provider: ['GROQ' as AiConfigView['provider'], Validators.required],
    model: ['', [Validators.required, Validators.minLength(1)]],
    apiKey: [''],
    baseUrl: [''],
    temperature: [0.7, [Validators.min(0), Validators.max(2)]],
    maxTokens: [500, [Validators.min(1), Validators.max(8000)]],
    systemPrompt: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  apiKeyPlaceholder(): string {
    return this.current()?.hasApiKey ? 'Manter credencial atual' : 'Cole sua chave de API';
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.svc.get().subscribe({
      next: cfg => {
        this.current.set(cfg);
        this.form.reset({
          provider: cfg.provider,
          model: cfg.model,
          apiKey: '',
          baseUrl: cfg.baseUrl ?? '',
          temperature: cfg.temperature,
          maxTokens: cfg.maxTokens,
          systemPrompt: cfg.systemPrompt ?? '',
        });
        this.loading.set(false);
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao carregar configuração de IA');
        this.loading.set(false);
      },
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.saved.set(false);
    this.error.set(null);
    const raw = this.form.getRawValue();
    const payload = {
      provider: raw.provider,
      model: raw.model.trim(),
      // apiKey só vai no payload se o usuário digitou algo (preserva a atual quando vazio).
      ...(raw.apiKey.trim() ? { apiKey: raw.apiKey.trim() } : {}),
      baseUrl: raw.baseUrl.trim(),
      temperature: raw.temperature,
      maxTokens: raw.maxTokens,
      systemPrompt: raw.systemPrompt,
    };
    this.svc.save(payload).subscribe({
      next: cfg => {
        this.current.set(cfg);
        this.form.controls.apiKey.reset('');
        this.saving.set(false);
        this.saved.set(true);
      },
      error: (e: { error?: { message?: string } }) => {
        this.error.set(e?.error?.message ?? 'Falha ao salvar configuração de IA');
        this.saving.set(false);
      },
    });
  }

  test(): void {
    this.testing.set(true);
    this.testResult.set(null);
    this.testError.set(null);
    this.svc.test().subscribe({
      next: res => {
        this.testResult.set(res);
        this.testing.set(false);
      },
      error: (e: { error?: { message?: string } }) => {
        this.testError.set(e?.error?.message ?? 'Falha ao chamar a IA');
        this.testing.set(false);
      },
    });
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
}
