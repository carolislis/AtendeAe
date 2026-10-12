import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import type { CreateOrderDto, OrderStatus } from './orders.service';
import { OrdersService } from './orders.service';
import { BillingGuard } from '../auth/billing.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() body: CreateOrderDto) {
    return this.orders.create(body);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Get()
  list(@Request() req: { user: { establishmentId: string } }) {
    return this.orders.list(req.user.establishmentId);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Patch(':id/status')
  updateStatus(
    @Request() req: { user: { establishmentId: string } },
    @Param('id') id: string,
    @Body() body: { status: OrderStatus },
  ) {
    return this.orders.updateStatus(req.user.establishmentId, id, body.status);
  }

  @Get('track/:token')
  track(@Param('token') token: string) {
    return this.orders.getForTracking(token);
  }

  @Get('delivery/:token')
  delivery(@Param('token') token: string) {
    return this.orders.getForDelivery(token);
  }

  @Post('delivery/:token/confirm')
  confirmDelivery(@Param('token') token: string, @Body() body: { code: string }) {
    return this.orders.confirmDelivery(token, body?.code ?? '');
  }

  @Post('cancel/:token')
  cancelByClient(@Param('token') token: string) {
    return this.orders.cancelByClient(token);
  }

  @Post('rate/:token')
  rateOrder(
    @Param('token') token: string,
    @Body()
    body: {
      establishmentRating?: number;
      establishmentComment?: string;
      deliveryRating?: number;
      deliveryComment?: string;
    },
  ) {
    return this.orders.rateOrder(token, body);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Get('ratings-summary')
  ratingsSummary(@Request() req: { user: { establishmentId: string } }) {
    return this.orders.getRatingsSummary(req.user.establishmentId);
  }

  @UseGuards(JwtAuthGuard, BillingGuard)
  @Get('dashboard-stats')
  dashboardStats(@Request() req: { user: { establishmentId: string } }) {
    const establishmentId = req.user.establishmentId;
    return {
      ...this.orders.getDashboardStats(establishmentId),
      ratings: this.orders.getRatingsSummary(establishmentId),
    };
  }
}
