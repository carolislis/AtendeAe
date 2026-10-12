import { Body, Controller, Delete, Get, Param, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { ConfigService, type Motoboy, type OrderStatus } from './config.service';
import { BillingGuard } from '../auth/billing.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('config')
@UseGuards(JwtAuthGuard, BillingGuard)
export class ConfigController {
  constructor(private readonly config: ConfigService) {}

  @Get('bot')
  getBot(@Request() req: { user: { establishmentId: string } }) {
    return this.config.getBot(req.user.establishmentId);
  }

  @Put('bot')
  updateBot(
    @Request() req: { user: { establishmentId: string } },
    @Body()
    body: {
      evolutionBaseUrl?: string;
      evolutionApiKey?: string;
      instanceName?: string;
      webhookUrl?: string;
      publicBaseUrl?: string;
    },
  ) {
    return this.config.updateBot(req.user.establishmentId, body);
  }

  @Get('cardapio')
  getCardapio(@Request() req: { user: { establishmentId: string } }) {
    return { cardapioId: this.config.getCardapioId(req.user.establishmentId) };
  }

  @Put('cardapio')
  updateCardapio(
    @Request() req: { user: { establishmentId: string } },
    @Body() body: { cardapioId?: string },
  ) {
    return { cardapioId: this.config.setCardapioId(req.user.establishmentId, body?.cardapioId ?? '') };
  }

  @Get('bot-messages')
  getBotMessages(@Request() req: { user: { establishmentId: string } }) {
    return this.config.getBotMessages(req.user.establishmentId);
  }

  @Put('bot-messages')
  updateBotMessages(
    @Request() req: { user: { establishmentId: string } },
    @Body()
    body: {
      welcomeMessage?: string;
      cardapioMessageTemplate?: string;
      statusMessages?: Partial<Record<OrderStatus, string>>;
    },
  ) {
    return this.config.setBotMessages(req.user.establishmentId, body);
  }

  @Get('bot-cardapio-preview')
  getBotCardapioPreview(
    @Request() req: { user: { establishmentId: string } },
    @Query('baseUrl') baseUrl: string,
  ) {
    const url = (baseUrl || '').toString().replace(/\/$/, '');
    const link = url ? `${url}/c?id=${this.config.getCardapioId(req.user.establishmentId)}` : '';
    const message = url ? this.config.getCardapioMessageWithLink(req.user.establishmentId, url) : '';
    return { link, message };
  }

  @Get('cardapio-theme')
  getCardapioTheme(@Request() req: { user: { establishmentId: string } }) {
    return this.config.getCardapioTheme(req.user.establishmentId);
  }

  @Put('cardapio-theme')
  updateCardapioTheme(
    @Request() req: { user: { establishmentId: string } },
    @Body() body: { backgroundColor?: string; menuColor?: string },
  ) {
    return this.config.setCardapioTheme(req.user.establishmentId, body ?? {});
  }

  @Get('motoboys')
  getMotoboys(@Request() req: { user: { establishmentId: string } }): Motoboy[] {
    return this.config.getMotoboys(req.user.establishmentId);
  }

  @Post('motoboys')
  addMotoboy(
    @Request() req: { user: { establishmentId: string } },
    @Body() body: { name: string; phone: string },
  ): Motoboy {
    return this.config.addMotoboy(req.user.establishmentId, body);
  }

  @Put('motoboys/:id')
  updateMotoboy(
    @Request() req: { user: { establishmentId: string } },
    @Param('id') id: string,
    @Body() body: { name?: string; phone?: string },
  ): Motoboy {
    return this.config.updateMotoboy(req.user.establishmentId, id, body);
  }

  @Delete('motoboys/:id')
  removeMotoboy(
    @Request() req: { user: { establishmentId: string } },
    @Param('id') id: string,
  ): void {
    return this.config.removeMotoboy(req.user.establishmentId, id);
  }
}
