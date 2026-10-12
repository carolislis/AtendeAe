import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { ConfigService } from '../config/config.service';
import { EvolutionService } from '../evolution/evolution.service';

export type OrderStatus = 'recebido' | 'preparando' | 'saiu_entrega' | 'entregue' | 'cancelado';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  recebido: 'Recebido',
  preparando: 'Preparando',
  saiu_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface OrderCustomer {
  name: string;
  address: string;
  phone: string;
}

export interface CreateOrderDto {
  cardapioId: string;
  items: OrderItem[];
  customer: OrderCustomer;
  /** WhatsApp que recebeu o link (quem mandou mensagem); usado para enviar as atualizações de status. */
  waNotifyPhone?: string;
}

export interface Order extends CreateOrderDto {
  id: string;
  establishmentId: string;
  trackingToken?: string;
  deliveryCode?: string;
  status?: OrderStatus;
  createdAt: string;
  total: number;
  /** Número WhatsApp para enviar status (quem recebeu o link); se não vier, usa customer.phone */
  waNotifyPhone?: string;
  /** Avaliação do estabelecimento (1-5) e comentário opcional */
  establishmentRating?: number;
  establishmentComment?: string;
  /** Avaliação do motoboy/entrega (1-5) e comentário opcional */
  deliveryRating?: number;
  deliveryComment?: string;
}

export interface OrderTrackingDto {
  id: string;
  status: OrderStatus;
  statusLabel: string;
  deliveryCode: string;
  createdAt: string;
  items: { name: string; quantity: number; subtotal: number }[];
  total: number;
  customerName: string;
  establishmentRating?: number;
  establishmentComment?: string;
  deliveryRating?: number;
  deliveryComment?: string;
}

export interface OrderDeliveryDto {
  id: string;
  customerName: string;
  address: string;
  phone: string;
  status: OrderStatus;
  statusLabel: string;
}

@Injectable()
export class OrdersService {
  private byEstablishment = new Map<string, { orders: Order[]; idSeq: number }>();
  private trackingTokenToEstablishmentId = new Map<string, string>();

  constructor(
    private readonly config: ConfigService,
    private readonly evolution: EvolutionService,
  ) {}

  private ensure(establishmentId: string): { orders: Order[]; idSeq: number } {
    let state = this.byEstablishment.get(establishmentId);
    if (!state) {
      state = { orders: [], idSeq: 0 };
      this.byEstablishment.set(establishmentId, state);
    }
    return state;
  }

  create(dto: CreateOrderDto): Order {
    const establishmentId = this.config.getEstablishmentIdByCardapioId(dto.cardapioId);
    if (!establishmentId) {
      throw new BadRequestException('Cardápio inválido');
    }
    if (!Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Pedido deve ter pelo menos um item');
    }
    const customer = dto.customer;
    if (!customer?.name?.trim()) throw new BadRequestException('Nome do cliente é obrigatório');
    if (!customer?.address?.trim()) throw new BadRequestException('Endereço é obrigatório');
    if (!customer?.phone?.trim()) throw new BadRequestException('Celular de contato é obrigatório');

    const state = this.ensure(establishmentId);
    const total = dto.items.reduce((s, i) => s + Number(i.price) * Math.max(1, i.quantity || 1), 0);
    const trackingToken = randomBytes(12).toString('base64url');
    const order: Order = {
      ...dto,
      id: `ped-${++state.idSeq}-${Date.now()}`,
      establishmentId,
      trackingToken,
      deliveryCode: String(Math.floor(1000 + Math.random() * 9000)),
      status: 'recebido' as OrderStatus,
      createdAt: new Date().toISOString(),
      total,
      waNotifyPhone: dto.waNotifyPhone?.trim() || undefined,
    };
    state.orders.push(order);
    this.trackingTokenToEstablishmentId.set(trackingToken, establishmentId);
    this.notifyStatusWhatsApp(order, 'recebido').catch(() => {});
    this.notifyMotoboys(order, 'new').catch(() => {});
    return order;
  }

  list(establishmentId: string): Order[] {
    const state = this.ensure(establishmentId);
    return [...state.orders].reverse();
  }

  updateStatus(establishmentId: string, orderId: string, status: OrderStatus): Order {
    if (status === 'cancelado') {
      throw new BadRequestException('Use o link do cliente para cancelar (primeiros 5 min).');
    }
    const state = this.ensure(establishmentId);
    const order = state.orders.find((o) => o.id === orderId);
    if (!order) throw new NotFoundException('Pedido não encontrado');
    order.status = status;
    this.notifyStatusWhatsApp(order, status).catch(() => {});
    if (status === 'preparando') this.notifyOrderApprovedWhatsApp(order).catch(() => {});
    if (status === 'saiu_entrega') this.notifyMotoboys(order, 'saiu_entrega').catch(() => {});
    return order;
  }

  private buildOrderDescriptionMessage(order: Order): string {
    const lines: string[] = [];
    lines.push('✅ *Pedido aprovado!* Estamos preparando.');
    lines.push('');
    lines.push(`📋 *Pedido #${order.id}*`);
    lines.push('');
    for (const item of order.items) {
      const qty = Math.max(1, Number(item.quantity) || 1);
      const price = Number(item.price) || 0;
      const subtotal = qty * price;
      lines.push(`• ${qty}× ${item.name} — R$ ${subtotal.toFixed(2).replace('.', ',')}`);
    }
    lines.push('');
    lines.push(`💰 *Total: R$ ${(Number(order.total) || 0).toFixed(2).replace('.', ',')}*`);
    lines.push('');
    const customerName = order.customer?.name || 'Cliente';
    const address = order.customer?.address || '—';
    lines.push(`📌 *Entregar para:* ${customerName}`);
    lines.push(`📍 *Endereço:* ${address}`);
    const baseUrl = (this.config.getPublicBaseUrl(order.establishmentId) || process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    if (baseUrl && order.trackingToken) {
      lines.push('');
      lines.push(`Acompanhe seu pedido: ${baseUrl}/r/${order.trackingToken}`);
    }
    return lines.join('\n');
  }

  private async notifyOrderApprovedWhatsApp(order: Order): Promise<void> {
    const phone = (order.waNotifyPhone || order.customer?.phone)?.trim();
    if (!phone) return;
    const text = this.buildOrderDescriptionMessage(order);
    await this.evolution.sendTextMessage(order.establishmentId, phone, text);
  }

  private async notifyStatusWhatsApp(order: Order, status: OrderStatus): Promise<void> {
    const phone = (order.waNotifyPhone || order.customer?.phone)?.trim();
    if (!phone) return;
    const text = this.config.getStatusMessage(order.establishmentId, status, {
      customerName: order.customer.name || 'Cliente',
      orderId: order.id,
      trackingToken: order.trackingToken,
    });
    await this.evolution.sendTextMessage(order.establishmentId, phone, text);
  }

  private async notifyMotoboys(order: Order, kind: 'new' | 'saiu_entrega'): Promise<void> {
    const motoboys = this.config.getMotoboys(order.establishmentId);
    if (motoboys.length === 0) return;
    const baseUrl = (this.config.getPublicBaseUrl(order.establishmentId) || process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');
    const link = baseUrl && order.trackingToken ? `${baseUrl}/e/${order.trackingToken}` : '(link de entrega)';
    const customerName = order.customer?.name || 'Cliente';
    const address = order.customer?.address || '—';
    const totalStr = typeof order.total === 'number' ? `R$ ${order.total.toFixed(2).replace('.', ',')}` : '—';
    const text =
      kind === 'new'
        ? `🛵 *Novo pedido* #${order.id}\nCliente: *${customerName}*\nEndereço: ${address}\nTotal: ${totalStr}\n\nLink para entrega: ${link}`
        : `🛵 Pedido #${order.id} *saiu para entrega*\nCliente: *${customerName}*\nEndereço: ${address}\n\nLink: ${link}`;
    for (const m of motoboys) {
      const phone = m.phone?.trim();
      if (phone) this.evolution.sendTextMessage(order.establishmentId, phone, text).catch(() => {});
    }
  }

  private findByToken(token: string): { order: Order; establishmentId: string } | undefined {
    const establishmentId = this.trackingTokenToEstablishmentId.get(token);
    if (!establishmentId) return undefined;
    const state = this.ensure(establishmentId);
    const order = state.orders.find((o) => o.trackingToken === token);
    return order ? { order, establishmentId } : undefined;
  }

  getForTracking(token: string): OrderTrackingDto {
    const found = this.findByToken(token);
    if (!found) throw new NotFoundException('Pedido não encontrado');
    const { order } = found;
    if (!order.deliveryCode) order.deliveryCode = String(Math.floor(1000 + Math.random() * 9000));
    const status = order.status ?? 'recebido';
    return {
      id: order.id,
      status,
      statusLabel: ORDER_STATUS_LABELS[status],
      deliveryCode: order.deliveryCode,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        subtotal: i.price * i.quantity,
      })),
      total: order.total,
      customerName: order.customer.name,
      establishmentRating: order.establishmentRating,
      establishmentComment: order.establishmentComment,
      deliveryRating: order.deliveryRating,
      deliveryComment: order.deliveryComment,
    };
  }

  rateOrder(
    token: string,
    dto: {
      establishmentRating?: number;
      establishmentComment?: string;
      deliveryRating?: number;
      deliveryComment?: string;
    },
  ): OrderTrackingDto {
    const found = this.findByToken(token);
    if (!found) throw new NotFoundException('Pedido não encontrado');
    const { order } = found;
    if (order.status !== 'entregue') {
      throw new BadRequestException('Só é possível avaliar pedidos já entregues.');
    }
    const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(Number(n))));
    if (dto.establishmentRating !== undefined) order.establishmentRating = clamp(dto.establishmentRating);
    if (dto.establishmentComment !== undefined) order.establishmentComment = String(dto.establishmentComment).trim().slice(0, 500) || undefined;
    if (dto.deliveryRating !== undefined) order.deliveryRating = clamp(dto.deliveryRating);
    if (dto.deliveryComment !== undefined) order.deliveryComment = String(dto.deliveryComment).trim().slice(0, 500) || undefined;
    return this.getForTracking(token);
  }

  getRatingsSummary(establishmentId: string): {
    establishment: { average: number; count: number };
    delivery: { average: number; count: number };
  } {
    const state = this.ensure(establishmentId);
    let establishmentSum = 0;
    let establishmentCount = 0;
    let deliverySum = 0;
    let deliveryCount = 0;
    for (const o of state.orders) {
      if (o.establishmentRating != null && !Number.isNaN(o.establishmentRating)) {
        establishmentSum += o.establishmentRating;
        establishmentCount += 1;
      }
      if (o.deliveryRating != null && !Number.isNaN(o.deliveryRating)) {
        deliverySum += o.deliveryRating;
        deliveryCount += 1;
      }
    }
    return {
      establishment: {
        average: establishmentCount > 0 ? Math.round((establishmentSum / establishmentCount) * 10) / 10 : 0,
        count: establishmentCount,
      },
      delivery: {
        average: deliveryCount > 0 ? Math.round((deliverySum / deliveryCount) * 10) / 10 : 0,
        count: deliveryCount,
      },
    };
  }

  confirmDelivery(token: string, code: string): Order {
    const found = this.findByToken(token);
    if (!found) throw new NotFoundException('Pedido não encontrado');
    const { order, establishmentId } = found;
    if (!order.deliveryCode) order.deliveryCode = String(Math.floor(1000 + Math.random() * 9000));
    const normalized = String(code).trim();
    if (normalized !== order.deliveryCode) {
      throw new BadRequestException('Código incorreto. Peça o código ao cliente.');
    }
    return this.updateStatus(establishmentId, order.id, 'entregue');
  }

  cancelByClient(token: string): Order {
    const found = this.findByToken(token);
    if (!found) throw new NotFoundException('Pedido não encontrado');
    const { order, establishmentId } = found;
    if (order.status === 'cancelado') {
      throw new BadRequestException('Este pedido já foi cancelado.');
    }
    if (order.status === 'entregue') {
      throw new BadRequestException('Não é possível cancelar um pedido já entregue.');
    }
    const createdAt = new Date(order.createdAt).getTime();
    const fiveMinutesMs = 5 * 60 * 1000;
    if (Date.now() - createdAt > fiveMinutesMs) {
      throw new BadRequestException('Só é possível cancelar nos primeiros 5 minutos após o pedido.');
    }
    order.status = 'cancelado';
    this.notifyStatusWhatsApp(order, 'cancelado').catch(() => {});
    return order;
  }

  getForDelivery(token: string): OrderDeliveryDto {
    const found = this.findByToken(token);
    if (!found) throw new NotFoundException('Pedido não encontrado');
    const { order } = found;
    const status = order.status ?? 'recebido';
    return {
      id: order.id,
      customerName: order.customer.name,
      address: order.customer.address,
      phone: order.customer.phone,
      status,
      statusLabel: ORDER_STATUS_LABELS[status],
    };
  }

  getDashboardStats(establishmentId: string): {
    ordersToday: number;
    ordersThisWeek: number;
    revenueToday: number;
    revenueThisWeek: number;
    byStatus: Record<OrderStatus, number>;
    pendingCount: number;
  } {
    const orders = this.list(establishmentId);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfWeekMs = startOfWeek.getTime();

    let ordersToday = 0;
    let ordersThisWeek = 0;
    let revenueToday = 0;
    let revenueThisWeek = 0;
    const byStatus: Record<OrderStatus, number> = {
      recebido: 0,
      preparando: 0,
      saiu_entrega: 0,
      entregue: 0,
      cancelado: 0,
    };

    for (const o of orders) {
      const created = new Date(o.createdAt).getTime();
      const status = (o.status ?? 'recebido') as OrderStatus;
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      if (o.status === 'cancelado') continue;
      const total = Number(o.total) || 0;
      if (created >= startOfToday) {
        ordersToday += 1;
        revenueToday += total;
      }
      if (created >= startOfWeekMs) {
        ordersThisWeek += 1;
        revenueThisWeek += total;
      }
    }

    const pendingCount = (byStatus.recebido ?? 0) + (byStatus.preparando ?? 0) + (byStatus.saiu_entrega ?? 0);

    return {
      ordersToday,
      ordersThisWeek,
      revenueToday,
      revenueThisWeek,
      byStatus,
      pendingCount,
    };
  }
}
