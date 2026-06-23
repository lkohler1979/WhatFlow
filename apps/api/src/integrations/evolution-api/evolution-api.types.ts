export interface EvolutionInstance {
  instanceName: string;
  status: 'open' | 'close' | 'connecting';
  qrcode?: { base64: string; code: string };
}

export interface EvolutionSendTextPayload {
  number: string;
  text: string;
  delay?: number;
}

export interface EvolutionSendMediaPayload {
  number: string;
  mediatype: 'image' | 'video' | 'audio' | 'document';
  media: string; // URL
  caption?: string;
  fileName?: string;
  delay?: number;
}

export interface EvolutionWebhookEvent {
  event: string;
  instance: string;
  data: Record<string, unknown>;
  date_time: string;
  sender: string;
  server_url: string;
  apikey: string;
}

export interface EvolutionMessage {
  key: { remoteJid: string; fromMe: boolean; id: string };
  message: { conversation?: string; imageMessage?: unknown; [key: string]: unknown };
  messageType: string;
  messageTimestamp: number;
  pushName?: string;
}
