import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminJwtPayload } from './admin-jwt.strategy';
import {
  createOpaqueToken,
  hashToken,
} from '../common/utils/token-hash.util';

@Injectable()
export class AdminAuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureDefaultAdmin();
  }

  private async ensureDefaultAdmin() {
    const username = this.config.get<string>('adminUsername') ?? 'admin';
    const password = this.config.get<string>('adminPassword') ?? 'admin123456';
    const displayName =
      this.config.get<string>('adminDisplayName') ?? 'Super Admin';

    // Production must set ADMIN_PASSWORD via env (validated at boot)
    if (this.config.get<boolean>('isProd') && password === 'admin123456') {
      return;
    }

    const existing = await this.prisma.adminUser.findUnique({
      where: { username },
    });
    if (existing) return;

    await this.prisma.adminUser.create({
      data: {
        username,
        displayName,
        role: 'admin',
        passwordHash: await bcrypt.hash(password, 10),
      },
    });
  }

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { username: dto.username },
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException('Invalid admin credentials');
    }
    const ok = await bcrypt.compare(dto.password, admin.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid admin credentials');
    }

    const token = await this.issueTokenPair(
      admin.id,
      admin.username,
      admin.role,
    );
    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      refreshExpiresAt: token.refreshExpiresAt,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
      },
    };
  }

  async refresh(refreshToken: string) {
    const hash = hashToken(refreshToken);
    const session = await this.prisma.adminAuthSession.findFirst({
      where: { refreshTokenHash: hash, isActive: true },
      include: { admin: true },
    });

    if (!session?.refreshExpiresAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.refreshExpiresAt.getTime() < Date.now()) {
      await this.prisma.adminAuthSession.update({
        where: { id: session.id },
        data: { isActive: false, refreshTokenHash: null },
      });
      throw new UnauthorizedException('Refresh token expired');
    }
    if (!session.admin.isActive) {
      await this.prisma.adminAuthSession.update({
        where: { id: session.id },
        data: { isActive: false, refreshTokenHash: null },
      });
      throw new UnauthorizedException('Admin inactive');
    }

    await this.prisma.adminAuthSession.update({
      where: { id: session.id },
      data: { isActive: false, refreshTokenHash: null },
    });

    const pair = await this.issueTokenPair(
      session.adminId,
      session.admin.username,
      session.admin.role,
    );
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresAt: pair.expiresAt,
      refreshExpiresAt: pair.refreshExpiresAt,
      admin: {
        id: session.admin.id,
        username: session.admin.username,
        displayName: session.admin.displayName,
        role: session.admin.role,
      },
    };
  }

  async me(user: AdminJwtPayload) {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id: user.sub },
    });
    if (!admin) throw new UnauthorizedException('Admin not found');
    return {
      id: admin.id,
      username: admin.username,
      displayName: admin.displayName,
      role: admin.role,
      isActive: admin.isActive,
    };
  }

  async logout(user: AdminJwtPayload) {
    await this.prisma.adminAuthSession.updateMany({
      where: { jti: user.jti, isActive: true },
      data: { isActive: false, refreshTokenHash: null },
    });
    return { success: true };
  }

  private accessMinutes() {
    const m = Number(this.config.get('jwtAccessMinutes') ?? 15);
    if (m <= 0) throw new BadRequestException('Invalid JWT access expiry');
    return m;
  }

  private refreshDays() {
    const d = Number(this.config.get('jwtRefreshDays') ?? 7);
    if (d <= 0) throw new BadRequestException('Invalid JWT refresh expiry');
    return d;
  }

  private async issueTokenPair(
    adminId: number,
    username: string,
    role: string,
  ) {
    const accessMin = this.accessMinutes();
    const refreshDay = this.refreshDays();
    const jti = randomBytes(24).toString('hex');
    const refreshToken = createOpaqueToken();
    const refreshTokenHash = hashToken(refreshToken);
    const refreshExpiresAt = new Date(
      Date.now() + refreshDay * 24 * 60 * 60 * 1000,
    );
    const accessExpiresAt = new Date(Date.now() + accessMin * 60 * 1000);

    await this.prisma.adminAuthSession.create({
      data: {
        adminId,
        jti,
        isActive: true,
        expiresAt: refreshExpiresAt,
        refreshTokenHash,
        refreshExpiresAt,
      },
    });

    const payload: AdminJwtPayload = {
      sub: adminId,
      username,
      role,
      jti,
      typ: 'admin',
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: `${accessMin}m`,
    });

    return {
      accessToken,
      refreshToken,
      expiresAt: accessExpiresAt,
      refreshExpiresAt,
    };
  }
}
