export type AiProvider = 'GROQ' | 'OLLAMA' | 'OPENAI_COMPATIBLE';

export interface AiConfig {
  provider: AiProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  systemPrompt?: string;
  maxTokens: number;
  temperature: number;
  historyWindow: number;
}
