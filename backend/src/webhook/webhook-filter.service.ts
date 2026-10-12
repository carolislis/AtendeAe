import { Injectable } from '@nestjs/common';
import type {
  EvolutionWebhookPayload,
  EvolutionMessageData,
  EvolutionMessageContent,
} from './dtos/evolution-raw.dto';
import type { IncomingMessageDto } from './dtos/incoming-message.dto';

/**
 * Middleware de filtro: processa o payload da Evolution API e retorna apenas
 * mensagens de texto de clientes reais (fromMe === false), normalizadas.
 */
@Injectable()
export class WebhookFilterService {
  /**
   * Extrai texto da mensagem conforme os formatos comuns da Evolution API.
   */
  private extractText(message: EvolutionMessageContent | undefined): string {
    if (!message) return '';
    if (typeof message.conversation === 'string') return message.conversation.trim();
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text.trim();
    if (message.imageMessage?.caption) return message.imageMessage.caption.trim();
    if (message.videoMessage?.caption) return message.videoMessage.caption.trim();
    if (message.documentMessage?.caption) return message.documentMessage.caption.trim();
    if (message.buttonsResponseMessage?.selectedDisplayText)
      return message.buttonsResponseMessage.selectedDisplayText.trim();
    if (message.buttonsResponseMessage?.selectedButtonId)
      return message.buttonsResponseMessage.selectedButtonId.trim();
    if (message.listResponseMessage?.singleSelectReply?.selectedRowId)
      return message.listResponseMessage.singleSelectReply.selectedRowId.trim();
    return '';
  }

  private getContentType(message: EvolutionMessageContent | undefined): IncomingMessageDto['contentType'] {
    if (!message) return 'other';
    if (message.conversation || message.extendedTextMessage) return 'text';
    if (message.buttonsResponseMessage) return 'button';
    if (message.listResponseMessage) return 'list';
    if (message.audioMessage) return 'audio';
    if (message.imageMessage) return 'image';
    return 'other';
  }

  /**
   * Normaliza um item de mensagem da Evolution para IncomingMessageDto.
   * Retorna null se for mensagem enviada por nós (fromMe) ou se não for mensagem útil.
   */
  normalizeMessage(
    instance: string,
    data: EvolutionMessageData,
  ): IncomingMessageDto | null {
    const key = data.key;
    if (!key) return null;

    const fromMe = key.fromMe === true;
    if (fromMe) return null; // Ignora mensagens enviadas pelo próprio bot/loja

    const remoteJid = key.remoteJid ?? '';
    const isGroup = remoteJid.endsWith('@g.us');
    const clientPhone = remoteJid.replace(/@(s\.whatsapp\.net|g\.us)$/, '');

    const message = data.message;
    const text = this.extractText(message);
    const contentType = this.getContentType(message);

    // Ignora apenas mensagens totalmente vazias que não sejam botão, lista ou áudio (transcrição futura)
    if (!text && !['button', 'list', 'audio'].includes(contentType)) {
      return null;
    }

    const messageTimestamp =
      typeof data.messageTimestamp === 'string'
        ? parseInt(data.messageTimestamp, 10)
        : (data.messageTimestamp as number | undefined);

    return {
      instance,
      remoteJid,
      clientPhone,
      pushName: data.pushName,
      text: text || (contentType === 'audio' ? '(áudio)' : '(sem texto)'),
      contentType,
      messageId: key.id,
      messageTimestamp,
      isGroup,
    };
  }

  /**
   * Processa o payload bruto do webhook e retorna apenas mensagens de clientes reais.
   * Suporta payload com event/data (global) ou apenas data (webhook por evento).
   */
  filterIncomingMessages(payload: EvolutionWebhookPayload): IncomingMessageDto[] {
    const instance = (payload.instance ?? payload.instanceName ?? 'default') as string;
    const rawData = payload.data;

    if (rawData == null) return [];

    const items: EvolutionMessageData[] = Array.isArray(rawData) ? rawData : [rawData];
    const result: IncomingMessageDto[] = [];

    for (const item of items) {
      const normalized = this.normalizeMessage(instance, item);
      if (normalized) result.push(normalized);
    }

    return result;
  }

  /**
   * Indica se este payload é de mensagens recebidas (MESSAGES_UPSERT).
   * Útil para ignorar outros eventos no mesmo controller.
   */
  isMessagesUpsert(payload: EvolutionWebhookPayload): boolean {
    const event = String(payload.event ?? payload.type ?? '').toLowerCase();
    return (
      event === 'messages.upsert' ||
      event === 'messages_upsert' ||
      event === 'messages-upsert'
    );
  }
}
