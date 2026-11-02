import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

export type AdminJwtPayload = {
  sub: number;
  username: string;
  role: string;
  jti: string;
  typ: 'admin';
};

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
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

  async validate(payload: AdminJwtPayload): Promise<AdminJwtPayload> {
    if (!payload?.sub || !payload?.jti || payload.typ !== 'admin') {
      throw new UnauthorizedException('Invalid admin token');
    }

    const session = await this.prisma.adminAuthSession.findUnique({
      where: { jti: payload.jti },
    });
    if (!session || !session.isActive || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Admin session expired or logged out');
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Admin not found or inactive');
    }

    return {
      sub: admin.id,
      username: admin.username,
      role: admin.role,
      jti: payload.jti,
      typ: 'admin',
    };
  }
}
