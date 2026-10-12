import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export type BillingPlan = 'trial' | 'monthly';

export interface Establishment {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: string;
  /** Fim do período de teste (7 dias a partir do cadastro) */
  trialEndsAt: string;
  /** Fim da assinatura paga; null = nunca assinou */
  subscriptionEndsAt: string | null;
  plan: BillingPlan;
}

export interface BillingStatusDto {
  trialEndsAt: string;
  subscriptionEndsAt: string | null;
  plan: BillingPlan;
  canUsePlatform: boolean;
  daysLeftInTrial: number;
  subscriptionActive: boolean;
}

const SALT_LEN = 16;
const KEY_LEN = 64;

@Injectable()
export class AuthService {
  private establishments: Establishment[] = [];
  private idSeq = 0;

  constructor(private readonly jwt: JwtService) {}

  private nextId(): string {
    this.idSeq += 1;
    return `est-${this.idSeq}-${Date.now()}`;
  }

  private hashPassword(password: string): string {
    const salt = randomBytes(SALT_LEN).toString('hex');
    const hash = scryptSync(password, salt, KEY_LEN).toString('hex');
    return `${salt}:${hash}`;
  }

  private verifyPassword(password: string, stored: string): boolean {
    const [salt, hash] = stored.split(':');
    if (!salt || !hash) return false;
    const derived = scryptSync(password, salt, KEY_LEN);
    const hashBuf = Buffer.from(hash, 'hex');
    return derived.length === hashBuf.length && timingSafeEqual(derived, hashBuf);
  }

  register(email: string, password: string, name: string): { access_token: string; establishment: { id: string; email: string; name: string } } {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) throw new BadRequestException('E-mail é obrigatório');
    if (!password || password.length < 6) {
      throw new BadRequestException('Senha deve ter no mínimo 6 caracteres');
    }
    if (!name?.trim()) throw new BadRequestException('Nome do estabelecimento é obrigatório');

    const existing = this.establishments.find((e) => e.email === normalizedEmail);
    if (existing) throw new BadRequestException('Este e-mail já está cadastrado');

    const id = this.nextId();
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const establishment: Establishment = {
      id,
      email: normalizedEmail,
      passwordHash: this.hashPassword(password),
      name: name.trim(),
      createdAt: now.toISOString(),
      trialEndsAt,
      subscriptionEndsAt: null,
      plan: 'trial',
    };
    this.establishments.push(establishment);

    const payload = { sub: id, email: normalizedEmail };
    const access_token = this.jwt.sign(payload);
    return {
      access_token,
      establishment: { id, email: establishment.email, name: establishment.name },
    };
  }

  login(email: string, password: string): { access_token: string; establishment: { id: string; email: string; name: string } } {
    const normalizedEmail = email.trim().toLowerCase();
    const establishment = this.establishments.find((e) => e.email === normalizedEmail);
    if (!establishment) throw new UnauthorizedException('E-mail ou senha incorretos');
    if (!this.verifyPassword(password, establishment.passwordHash)) {
      throw new UnauthorizedException('E-mail ou senha incorretos');
    }
    const payload = { sub: establishment.id, email: establishment.email };
    const access_token = this.jwt.sign(payload);
    return {
      access_token,
      establishment: { id: establishment.id, email: establishment.email, name: establishment.name },
    };
  }

  findById(id: string): Establishment | undefined {
    return this.establishments.find((e) => e.id === id);
  }

  private ensureEstablishment(id: string): Establishment {
    const e = this.findById(id);
    if (!e) throw new UnauthorizedException('Estabelecimento não encontrado');
    return e;
  }

  canUsePlatform(establishmentId: string): boolean {
    const e = this.ensureEstablishment(establishmentId);
    if (!e.trialEndsAt) return true;
    const now = Date.now();
    const trialActive = new Date(e.trialEndsAt).getTime() > now;
    const subActive = !!(e.subscriptionEndsAt && new Date(e.subscriptionEndsAt).getTime() > now);
    return trialActive || subActive;
  }

  getBillingStatus(establishmentId: string): BillingStatusDto {
    const e = this.ensureEstablishment(establishmentId);
    if (!e.trialEndsAt) {
      return {
        trialEndsAt: new Date(0).toISOString(),
        subscriptionEndsAt: e.subscriptionEndsAt ?? null,
        plan: (e as Establishment).plan ?? 'trial',
        canUsePlatform: true,
        daysLeftInTrial: 0,
        subscriptionActive: !!(e.subscriptionEndsAt && new Date(e.subscriptionEndsAt).getTime() > Date.now()),
      };
    }
    const now = Date.now();
    const trialEnd = new Date(e.trialEndsAt).getTime();
    const subEnd = e.subscriptionEndsAt ? new Date(e.subscriptionEndsAt).getTime() : 0;
    const trialActive = trialEnd > now;
    const subscriptionActive = subEnd > now;
    const canUsePlatform = trialActive || subscriptionActive;
    const daysLeftInTrial = trialActive ? Math.max(0, Math.ceil((trialEnd - now) / (24 * 60 * 60 * 1000))) : 0;
    return {
      trialEndsAt: e.trialEndsAt,
      subscriptionEndsAt: e.subscriptionEndsAt ?? null,
      plan: e.plan,
      canUsePlatform,
      daysLeftInTrial,
      subscriptionActive,
    };
  }

  /** Ativa ou estende assinatura (chamado após pagamento ou por admin). */
  setSubscription(establishmentId: string, endsAt: Date): void {
    const e = this.ensureEstablishment(establishmentId);
    e.subscriptionEndsAt = endsAt.toISOString();
    e.plan = 'monthly';
  }

  /** Simula assinatura de 30 dias (para teste ou integração com gateway). */
  subscribeMonthly(establishmentId: string): BillingStatusDto {
    const e = this.ensureEstablishment(establishmentId);
    const now = new Date();
    const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    e.subscriptionEndsAt = end.toISOString();
    e.plan = 'monthly';
    return this.getBillingStatus(establishmentId);
  }
}
