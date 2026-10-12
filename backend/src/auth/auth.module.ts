import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { BillingController } from './billing.controller';
import { AuthService } from './auth.service';
import { BillingGuard } from './billing.guard';
import { JwtAuthGuard } from './jwt-auth.guard';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'atendeae-secret-change-in-production',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController, BillingController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, BillingGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, BillingGuard],
})
export class AuthModule {}
