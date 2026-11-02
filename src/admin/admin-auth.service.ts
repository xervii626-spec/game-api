import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminJwtPayload } from './admin-jwt.strategy';

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

    const token = await this.issueToken(admin.id, admin.username, admin.role);
    return {
      accessToken: token.accessToken,
      expiresAt: token.expiresAt,
      admin: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
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
      data: { isActive: false },
    });
    return { success: true };
  }

  private async issueToken(adminId: number, username: string, role: string) {
    const expiresHours = Number(this.config.get('jwtExpiresHours') ?? 168);
    const jti = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

    await this.prisma.adminAuthSession.create({
      data: { adminId, jti, isActive: true, expiresAt },
    });

    const payload: AdminJwtPayload = {
      sub: adminId,
      username,
      role,
      jti,
      typ: 'admin',
    };
    const accessToken = await this.jwt.signAsync(payload);
    return { accessToken, expiresAt };
  }
}
