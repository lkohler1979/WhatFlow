export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** Uso de tokens reportado pelo provedor (quando disponível). */
export interface AiUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface AiResponse {
  content: string;
  tokens: number;
  latencyMs: number;
  usage?: AiUsage;
}

/** Opções de geração comuns a todos os adaptadores. */
export interface AiChatOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  /** Timeout (ms) específico desta chamada — sobrescreve o default do config. */
  timeoutMs?: number;
  /**
   * Override da credencial por chamada (config de IA por tenant — T-029).
   * Quando ausente, o adaptador cai no `config` global.
   */
  apiKey?: string;
  /**
   * Override da base URL por chamada (Ollama/OpenAI-compatible por tenant).
   * Quando ausente, o adaptador cai no `config` global.
   */
  baseUrl?: string;
}

export interface AiAdapter {
  /** Nome do provedor, p/ logs e diagnóstico. */
  readonly provider: string;
  chat(messages: AiMessage[], opts?: AiChatOptions): Promise<AiResponse>;
}
