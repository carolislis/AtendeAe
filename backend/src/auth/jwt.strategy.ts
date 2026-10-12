import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

export interface JwtPayload {
  sub: string;
  email: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'atendeae-secret-change-in-production',
    });
  }

  async validate(payload: JwtPayload): Promise<{ establishmentId: string; email: string }> {
    const establishment = this.auth.findById(payload.sub);
    if (!establishment) throw new UnauthorizedException('Estabelecimento não encontrado');
    return { establishmentId: payload.sub, email: payload.email };
  }
}
