import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class BillingGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const establishmentId = req.user?.establishmentId;
    if (!establishmentId) return false;
    if (this.auth.canUsePlatform(establishmentId)) return true;
    const status = this.auth.getBillingStatus(establishmentId);
    throw new ForbiddenException({
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'Seu período de teste acabou ou sua assinatura expirou. Renove para continuar usando a plataforma.',
      trialEndsAt: status.trialEndsAt,
      subscriptionEndsAt: status.subscriptionEndsAt,
    });
  }
}
