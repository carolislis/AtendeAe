/**
 * Estrutura típica do payload enviado pela Evolution API nos webhooks.
 * A API pode enviar variações; este DTO cobre os campos mais comuns para MESSAGES_UPSERT.
 * Ref: https://doc.evolution-api.com/v2/en/configuration/webhooks
 */
export interface EvolutionMessageKey {
  remoteJid: string;
  fromMe?: boolean;
  id?: string;
  participant?: string; // em grupos
}

export interface EvolutionTextContent {
  text?: string;
}

export interface EvolutionMessageContent {
  conversation?: string;
  extendedTextMessage?: EvolutionTextContent;
  imageMessage?: { caption?: string };
  audioMessage?: Record<string, unknown>;
  videoMessage?: { caption?: string };
  documentMessage?: { caption?: string };
  buttonsResponseMessage?: { selectedButtonId?: string; selectedDisplayText?: string };
  listResponseMessage?: { title?: string; singleSelectReply?: { selectedRowId?: string } };
  [key: string]: unknown;
}

export interface EvolutionMessageData {
  key: EvolutionMessageKey;
  message?: EvolutionMessageContent;
  messageTimestamp?: number | string;
  pushName?: string;
  participant?: string;
  [key: string]: unknown;
}

/**
 * Payload raiz do webhook (estrutura comum).
 * Com webhook_by_events: true, o path pode ser /messages-upsert e o body pode ser direto o array/objeto de mensagens.
 */
export interface EvolutionWebhookPayload {
  event?: string;
  instance?: string;
  data?: EvolutionMessageData | EvolutionMessageData[];
  [key: string]: unknown;
}
