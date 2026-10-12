import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { EvolutionModule } from '../evolution/evolution.module';
import { WebhookController } from './webhook.controller';
import { WebhookFilterService } from './webhook-filter.service';

@Module({
  imports: [EvolutionModule, ConfigModule],
  controllers: [WebhookController],
  providers: [WebhookFilterService],
  exports: [WebhookFilterService],
})
export class WebhookModule {}
