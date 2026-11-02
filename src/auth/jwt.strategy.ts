import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwtSecret') || 'dev_jwt_secret_change_me',
    });
  }

  async validate(payload: JwtPayload & { typ?: string }): Promise<JwtPayload> {
    if (!payload?.sub || !payload?.jti || payload.typ === 'admin') {
      throw new UnauthorizedException('Invalid token');
    }

    const session = await this.prisma.authSession.findUnique({
      where: { jti: payload.jti },
    });
    if (!session || !session.isActive) {
      throw new UnauthorizedException('Session expired or logged out');
    }
    if (session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Session expired');
    }

    const player = await this.prisma.player.findUnique({
      where: { id: payload.sub },
    });
    if (!player || player.isBlocked) {
      throw new UnauthorizedException('Player not found or blocked');
    }

    return {
      sub: payload.sub,
      username: payload.username,
      jti: payload.jti,
    };
  }
}
