export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiResponse {
  content: string;
  tokens: number;
  latencyMs: number;
}

export interface AiAdapter {
  chat(messages: AiMessage[], maxTokens?: number, temperature?: number): Promise<AiResponse>;
}
