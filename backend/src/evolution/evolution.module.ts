import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ConfigModule } from '../config/config.module';
import { EvolutionController } from './evolution.controller';
import { EvolutionService } from './evolution.service';

@Module({
  imports: [ConfigModule, AuthModule],
  controllers: [EvolutionController],
  providers: [EvolutionService],
  exports: [EvolutionService],
})
export class EvolutionModule {}
