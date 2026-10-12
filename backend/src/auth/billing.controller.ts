import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthService, type BillingStatusDto } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

/** Rotas de billing: só JwtAuthGuard (sem BillingGuard) para o cliente poder ver status e assinar mesmo com trial/assinatura expirados. */
@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingController {
  constructor(private readonly auth: AuthService) {}

  @Get('status')
  getStatus(@Request() req: { user: { establishmentId: string } }): BillingStatusDto {
    return this.auth.getBillingStatus(req.user.establishmentId);
  }

  @Post('subscribe')
  subscribe(@Request() req: { user: { establishmentId: string } }): BillingStatusDto {
    return this.auth.subscribeMonthly(req.user.establishmentId);
  }
}
