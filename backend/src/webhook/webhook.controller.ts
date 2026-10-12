import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { EvolutionService } from '../evolution/evolution.service';
import { WebhookFilterService } from './webhook-filter.service';
import type { IncomingMessageDto } from './dtos/incoming-message.dto';
import type { EvolutionWebhookPayload } from './dtos/evolution-raw.dto';

/**
 * Recebe webhooks da Evolution API.
 *
 * Configuração recomendada na Evolution:
 * - webhook_by_events: true
 * - URL: https://seu-dominio.com/api/webhook/messages-upsert
 *
 * O middleware filtra apenas mensagens de texto de clientes reais (fromMe === false)
 * e repassa o payload normalizado.
 */
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookFilter: WebhookFilterService,
    private readonly evolution: EvolutionService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Endpoint único para MESSAGES_UPSERT (recomendado quando webhook_by_events = true).
   * Evolution chama: POST /api/webhook/messages-upsert
   */
  @Post('messages-upsert')
  @HttpCode(HttpStatus.OK)
  handleMessagesUpsert(
    @Body() payload: EvolutionWebhookPayload,
  ): { received: boolean; processed: number; messages?: IncomingMessageDto[] } {
    const incoming = this.webhookFilter.filterIncomingMessages(payload);
    this.logger.log(`MESSAGES_UPSERT: ${incoming.length} mensagem(ns) de cliente(s) processada(s).`);

    if (incoming.length > 0) {
      this.forwardToAutomation(incoming);
      this.replyWithCardapioLink(incoming).catch((err) =>
        this.logger.warn('Falha ao enviar link do cardápio: ' + (err?.message ?? err)),
      );
    }

    return {
      received: true,
      processed: incoming.length,
      ...(incoming.length > 0 && { messages: incoming }),
    };
  }

  /**
   * Endpoint genérico caso a Evolution envie todos os eventos para a mesma URL.
   * Só processa se o evento for MESSAGES_UPSERT.
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  handleGeneric(
    @Body() payload: EvolutionWebhookPayload,
  ): { received: boolean; event?: string; processed?: number; messages?: IncomingMessageDto[] } {
    const isUpsert = this.webhookFilter.isMessagesUpsert(payload);
    if (!isUpsert) {
      const ev = payload.event ?? payload.type ?? 'unknown';
      this.logger.debug(`Webhook ignorado (evento não é MESSAGES_UPSERT): ${ev}`);
      return { received: true, event: String(payload.event ?? payload.type ?? 'unknown') };
    }

    const incoming = this.webhookFilter.filterIncomingMessages(payload);
    this.logger.log(`Webhook genérico MESSAGES_UPSERT: ${incoming.length} mensagem(ns) de cliente(s).`);

    if (incoming.length > 0) {
      this.forwardToAutomation(incoming);
      this.replyWithCardapioLink(incoming).catch((err) =>
        this.logger.warn('Falha ao enviar link do cardápio: ' + (err?.message ?? err)),
      );
    }

    return {
      received: true,
      event: 'MESSAGES_UPSERT',
      processed: incoming.length,
      ...(incoming.length > 0 && { messages: incoming }),
    };
  }

  /**
   * Responde ao cliente com o link do cardápio quando ele envia qualquer mensagem.
   * Só envia em conversas diretas (não em grupo) e quando o estabelecimento está identificado.
   */
  private async replyWithCardapioLink(messages: IncomingMessageDto[]): Promise<void> {
    const baseUrlFallback = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    for (const msg of messages) {
      if (msg.isGroup) continue;
      const establishmentId = this.config.getEstablishmentIdByInstanceName(msg.instance);
      if (!establishmentId) continue;
      const baseUrl = this.config.getPublicBaseUrl(establishmentId) || baseUrlFallback;
      const text = baseUrl
        ? this.config.getCardapioMessageWithLink(establishmentId, baseUrl, msg.clientPhone)
        : 'Olá! Nosso cardápio digital está em manutenção. Configure a URL do site no dashboard do Atendeaê.';
      await this.evolution.sendTextMessage(establishmentId, msg.clientPhone, text);
    }
  }

  /**
   * Evolution envia o QR code por webhook (evento QRCODE_UPDATED).
   * Armazenamos aqui para o GET /api/bot/qrcode retornar.
   */
  @Post('qrcode-updated')
  @HttpCode(HttpStatus.OK)
  handleQrcodeUpdated(@Body() payload: Record<string, unknown>): { received: boolean } {
    return this.processQrcodePayload(payload);
  }

  /** Rota alternativa (Evolution pode usar ponto em vez de hífen). */
  @Post('qrcode.updated')
  @HttpCode(HttpStatus.OK)
  handleQrcodeUpdatedAlt(@Body() payload: Record<string, unknown>): { received: boolean } {
    return this.processQrcodePayload(payload);
  }

  private processQrcodePayload(payload: Record<string, unknown>): { received: boolean } {
    const base64 = this.extractBase64FromPayload(payload);
    const instance = (payload?.instance ?? (payload?.data as Record<string, unknown>)?.instance) as string | undefined;
    const establishmentId = instance ? this.config.getEstablishmentIdByInstanceName(instance) : undefined;
    if (base64 && base64.length > 100 && establishmentId) {
      this.evolution.setStoredQr(establishmentId, base64);
      this.logger.log('QR code recebido via webhook.');
    } else if (base64 && base64.length > 100) {
      this.logger.log('QR code recebido mas estabelecimento não identificado (instance não encontrado).');
    } else {
      this.logger.log(
        'Webhook QR: chaves recebidas: ' + JSON.stringify(Object.keys(payload)) + (payload.data ? ' (data: ' + typeof payload.data + ')' : ''),
      );
    }
    return { received: true };
  }

  private extractBase64FromPayload(obj: unknown): string | null {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === 'string' && obj.length > 100) return obj;
    if (typeof obj !== 'object') return null;
    const o = obj as Record<string, unknown>;
    const keys = ['base64', 'qrcode', 'code', 'image', 'pairingCode'];
    for (const k of keys) {
      const v = o[k];
      if (typeof v === 'string' && v.length > 100) return v;
      if (v && typeof v === 'object') {
        const nested = this.extractBase64FromPayload(v);
        if (nested) return nested;
      }
    }
    if (o.data) {
      const fromData = this.extractBase64FromPayload(o.data);
      if (fromData) return fromData;
    }
    for (const v of Object.values(o)) {
      const found = this.extractBase64FromPayload(v);
      if (found) return found;
    }
    return null;
  }

  /**
   * Encaminha mensagens normalizadas para o cérebro de automação (n8n/Typebot).
   * Configure WEBHOOK_FORWARD_URL no .env para ativar.
   */
  private forwardToAutomation(messages: IncomingMessageDto[]): void {
    const forwardUrl = process.env.WEBHOOK_FORWARD_URL;
    if (!forwardUrl) {
      this.logger.debug('WEBHOOK_FORWARD_URL não configurado; mensagens apenas logadas.');
      messages.forEach((m) => this.logger.debug(JSON.stringify(m)));
      return;
    }
    // Implementação assíncrona (fire-and-forget) para não bloquear a resposta à Evolution.
    fetch(forwardUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, source: 'atendeae-webhook' }),
    }).catch((err) => this.logger.warn('Falha ao encaminhar para automação: ' + (err?.message ?? err)));
  }
}
