import { Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { EvolutionService, type BotStatusDto, type BotQrCodeDto } from './evolution.service';
import { BillingGuard } from '../auth/billing.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('bot')
@UseGuards(JwtAuthGuard, BillingGuard)
export class EvolutionController {
  constructor(private readonly evolution: EvolutionService) {}

  @Get('status')
  async status(@Request() req: { user: { establishmentId: string } }): Promise<BotStatusDto> {
    return this.evolution.getStatus(req.user.establishmentId);
  }

  @Post('connect')
  async connect(@Request() req: { user: { establishmentId: string } }): Promise<BotQrCodeDto & { ok: boolean }> {
    const result = await this.evolution.connectAndGetQr(req.user.establishmentId);
    return { ...result, ok: true };
  }

  @Get('qrcode')
  async qrcode(@Request() req: { user: { establishmentId: string } }): Promise<BotQrCodeDto> {
    return this.evolution.getQrCode(req.user.establishmentId);
  }

  @Post('disconnect')
  async disconnect(@Request() req: { user: { establishmentId: string } }): Promise<{ ok: boolean }> {
    await this.evolution.disconnect(req.user.establishmentId);
    return { ok: true };
  }
}
