import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from './config/config.module';
import { EvolutionModule } from './evolution/evolution.module';
import { MenuModule } from './menu/menu.module';
import { OrdersModule } from './orders/orders.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [AuthModule, WebhookModule, MenuModule, ConfigModule, EvolutionModule, OrdersModule],
})
export class AppModule {}
