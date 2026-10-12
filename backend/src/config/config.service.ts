import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';

export interface BotConfig {
  evolutionBaseUrl: string;
  evolutionApiKey: string;
  instanceName: string;
  webhookUrl: string;
  publicBaseUrl?: string;
}

export type OrderStatus = 'recebido' | 'preparando' | 'saiu_entrega' | 'entregue' | 'cancelado';

export interface BotMessagesConfig {
  welcomeMessage: string;
  cardapioMessageTemplate: string;
  statusMessages?: Partial<Record<OrderStatus, string>>;
}

const DEFAULT_WELCOME = 'Olá! Bem-vindo(a). Digite *cardápio* para receber o link e fazer seu pedido.';
const DEFAULT_CARDAPIO_TEMPLATE = 'Acesse nosso cardápio e faça seu pedido: {link}';

const DEFAULT_STATUS_MESSAGES: Record<OrderStatus, string> = {
  recebido: 'Olá, *{customerName}*! Recebemos seu pedido *#{orderId}*. Em breve você receberá mais atualizações.',
  preparando: '*{customerName}*, seu pedido #{orderId} está sendo preparado! 🍳',
  saiu_entrega: 'Seu pedido #{orderId} saiu para entrega! Acompanhe: {link}',
  entregue: 'Pedido #{orderId} entregue! Obrigado, *{customerName}*. Até a próxima! 🙏',
  cancelado: 'Seu pedido #{orderId} foi cancelado.',
};

export interface Motoboy {
  id: string;
  name: string;
  phone: string;
}

interface EstablishmentConfigState {
  bot: BotConfig;
  cardapioId: string;
  botMessages: BotMessagesConfig;
  cardapioTheme: { backgroundColor: string; menuColor: string };
  motoboys: Motoboy[];
}

@Injectable()
export class ConfigService {
  private byEstablishment = new Map<string, EstablishmentConfigState>();
  private cardapioIdToEstablishmentId = new Map<string, string>();
  private instanceNameToEstablishmentId = new Map<string, string>();

  private ensure(establishmentId: string): EstablishmentConfigState {
    let state = this.byEstablishment.get(establishmentId);
    if (!state) {
      const instanceName = `atendeae-${establishmentId.replace(/[^a-z0-9]/gi, '-').slice(0, 20)}`;
      state = {
        bot: {
          evolutionBaseUrl: '',
          evolutionApiKey: '',
          instanceName,
          webhookUrl: '',
          publicBaseUrl: process.env.APP_PUBLIC_URL || '',
        },
        cardapioId: '',
        botMessages: {
          welcomeMessage: DEFAULT_WELCOME,
          cardapioMessageTemplate: DEFAULT_CARDAPIO_TEMPLATE,
          statusMessages: { ...DEFAULT_STATUS_MESSAGES },
        },
        cardapioTheme: { backgroundColor: '#f5f5f5', menuColor: '#ffffff' },
        motoboys: [],
      };
      this.byEstablishment.set(establishmentId, state);
      this.instanceNameToEstablishmentId.set(instanceName, establishmentId);
    }
    return state;
  }

  getEstablishmentIdByInstanceName(instanceName: string): string | undefined {
    return this.instanceNameToEstablishmentId.get(instanceName || '');
  }

  getBot(establishmentId: string): BotConfig {
    return { ...this.ensure(establishmentId).bot };
  }

  updateBot(establishmentId: string, partial: Partial<BotConfig>): BotConfig {
    const state = this.ensure(establishmentId);
    const oldName = state.bot.instanceName;
    state.bot = { ...state.bot, ...partial };
    if (state.bot.instanceName !== oldName && oldName) {
      this.instanceNameToEstablishmentId.delete(oldName);
    }
    this.instanceNameToEstablishmentId.set(state.bot.instanceName, establishmentId);
    return this.getBot(establishmentId);
  }

  getCardapioId(establishmentId: string): string {
    const state = this.ensure(establishmentId);
    if (!state.cardapioId) {
      state.cardapioId = randomBytes(8).toString('base64url');
      this.cardapioIdToEstablishmentId.set(state.cardapioId, establishmentId);
    }
    return state.cardapioId;
  }

  setCardapioId(establishmentId: string, id: string): string {
    const state = this.ensure(establishmentId);
    const oldId = state.cardapioId;
    if (oldId) this.cardapioIdToEstablishmentId.delete(oldId);
    state.cardapioId = (id || '').trim() || randomBytes(8).toString('base64url');
    this.cardapioIdToEstablishmentId.set(state.cardapioId, establishmentId);
    return state.cardapioId;
  }

  getEstablishmentIdByCardapioId(cardapioId: string): string | undefined {
    return this.cardapioIdToEstablishmentId.get(cardapioId || '');
  }

  isCardapioIdValidForEstablishment(establishmentId: string, id: string): boolean {
    return id !== '' && id === this.getCardapioId(establishmentId);
  }

  isCardapioIdValid(cardapioId: string): boolean {
    return !!this.getEstablishmentIdByCardapioId(cardapioId);
  }

  getBotMessages(establishmentId: string): BotMessagesConfig {
    const state = this.ensure(establishmentId);
    return {
      ...state.botMessages,
      statusMessages: state.botMessages.statusMessages
        ? { ...state.botMessages.statusMessages }
        : undefined,
    };
  }

  setBotMessages(establishmentId: string, partial: Partial<BotMessagesConfig>): BotMessagesConfig {
    const state = this.ensure(establishmentId);
    state.botMessages = {
      welcomeMessage: partial.welcomeMessage ?? state.botMessages.welcomeMessage,
      cardapioMessageTemplate: partial.cardapioMessageTemplate ?? state.botMessages.cardapioMessageTemplate,
      statusMessages: partial.statusMessages
        ? { ...DEFAULT_STATUS_MESSAGES, ...state.botMessages.statusMessages, ...partial.statusMessages }
        : state.botMessages.statusMessages,
    };
    return this.getBotMessages(establishmentId);
  }

  getStatusMessage(
    establishmentId: string,
    status: OrderStatus,
    vars: { customerName: string; orderId: string; trackingToken?: string },
  ): string {
    const state = this.ensure(establishmentId);
    const template =
      state.botMessages.statusMessages?.[status] ?? DEFAULT_STATUS_MESSAGES[status];
    const baseUrl = (state.bot.publicBaseUrl || process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    const link = baseUrl && vars.trackingToken
      ? `${baseUrl}/r/${vars.trackingToken}`
      : '(acompanhe pelo link que enviamos)';
    return template
      .replace(/\{customerName\}/g, vars.customerName)
      .replace(/\{orderId\}/g, vars.orderId)
      .replace(/\{link\}/g, link);
  }

  getPublicBaseUrl(establishmentId: string): string {
    return this.ensure(establishmentId).bot.publicBaseUrl || process.env.APP_PUBLIC_URL || '';
  }

  setPublicBaseUrl(establishmentId: string, url: string): void {
    this.ensure(establishmentId).bot.publicBaseUrl = (url || '').trim();
  }

  getCardapioMessageWithLink(establishmentId: string, baseUrl: string, clientPhone?: string): string {
    const state = this.ensure(establishmentId);
    const link = this.getCardapioLink(establishmentId, baseUrl, clientPhone);
    return state.botMessages.cardapioMessageTemplate.replace(/\{link\}/g, link);
  }

  /** Link do cardápio; se clientPhone for informado, adiciona &wa= para notificar esse número nos status. */
  getCardapioLink(establishmentId: string, baseUrl: string, clientPhone?: string): string {
    const base = baseUrl.replace(/\/$/, '');
    const cardapioId = this.getCardapioId(establishmentId);
    let link = `${base}/c?id=${cardapioId}`;
    if (clientPhone?.trim()) link += `&wa=${encodeURIComponent(clientPhone.trim())}`;
    return link;
  }

  getCardapioTheme(establishmentId: string): { backgroundColor: string; menuColor: string } {
    return { ...this.ensure(establishmentId).cardapioTheme };
  }

  setCardapioTheme(
    establishmentId: string,
    partial: { backgroundColor?: string; menuColor?: string },
  ): { backgroundColor: string; menuColor: string } {
    const state = this.ensure(establishmentId);
    if (partial.backgroundColor) state.cardapioTheme.backgroundColor = partial.backgroundColor;
    if (partial.menuColor) state.cardapioTheme.menuColor = partial.menuColor;
    return this.getCardapioTheme(establishmentId);
  }

  getMotoboys(establishmentId: string): Motoboy[] {
    const state = this.ensure(establishmentId);
    if (!state.motoboys) state.motoboys = [];
    return [...state.motoboys];
  }

  addMotoboy(establishmentId: string, data: { name: string; phone: string }): Motoboy {
    const state = this.ensure(establishmentId);
    if (!state.motoboys) state.motoboys = [];
    const name = (data.name || '').trim();
    const phone = (data.phone || '').trim();
    if (!name || !phone) throw new BadRequestException('Nome e WhatsApp são obrigatórios.');
    const id = randomBytes(8).toString('base64url');
    const motoboy: Motoboy = { id, name, phone };
    state.motoboys.push(motoboy);
    return { ...motoboy };
  }

  updateMotoboy(establishmentId: string, id: string, data: { name?: string; phone?: string }): Motoboy {
    const state = this.ensure(establishmentId);
    if (!state.motoboys) state.motoboys = [];
    const idx = state.motoboys.findIndex((m) => m.id === id);
    if (idx < 0) throw new NotFoundException('Motoboy não encontrado.');
    if (data.name !== undefined) state.motoboys[idx].name = (data.name || '').trim();
    if (data.phone !== undefined) state.motoboys[idx].phone = (data.phone || '').trim();
    return { ...state.motoboys[idx] };
  }

  removeMotoboy(establishmentId: string, id: string): void {
    const state = this.ensure(establishmentId);
    if (!state.motoboys) state.motoboys = [];
    const idx = state.motoboys.findIndex((m) => m.id === id);
    if (idx >= 0) state.motoboys.splice(idx, 1);
  }
}
