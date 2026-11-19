import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthService } from '../admin/admin-auth.service';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';
import { AgentLoginDto } from './dto/agent-login.dto';
import { hashToken } from '../common/utils/token-hash.util';

const AGENT_ROLES = new Set(['master_agent', 'sub_agent']);

@Injectable()
export class AgentAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminAuth: AdminAuthService,
  ) {}

  async login(dto: AgentLoginDto) {
    const user = await this.prisma.adminUser.findUnique({
      where: { username: dto.username },
    });
    if (!user || !user.isActive || !AGENT_ROLES.has(user.role)) {
      throw new UnauthorizedException('Invalid agent credentials');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid agent credentials');
    }

    const token = await this.adminAuth.issueTokenPair(
      user.id,
      user.username,
      user.role,
    );
    return {
      accessToken: token.accessToken,
      refreshToken: token.refreshToken,
      expiresAt: token.expiresAt,
      refreshExpiresAt: token.refreshExpiresAt,
      agent: this.serializeAgent(user),
    };
  }

  async refresh(refreshToken: string) {
    const hash = hashToken(refreshToken);
    const session = await this.prisma.adminAuthSession.findFirst({
      where: { refreshTokenHash: hash, isActive: true },
      include: { admin: true },
    });
    if (!session?.refreshExpiresAt || !session.admin) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.refreshExpiresAt.getTime() < Date.now()) {
      await this.prisma.adminAuthSession.update({
        where: { id: session.id },
        data: { isActive: false, refreshTokenHash: null },
      });
      throw new UnauthorizedException('Refresh token expired');
    }
    if (!session.admin.isActive || !AGENT_ROLES.has(session.admin.role)) {
      await this.prisma.adminAuthSession.update({
        where: { id: session.id },
        data: { isActive: false, refreshTokenHash: null },
      });
      throw new UnauthorizedException('Agent inactive');
    }

    await this.prisma.adminAuthSession.update({
      where: { id: session.id },
      data: { isActive: false, refreshTokenHash: null },
    });

    const pair = await this.adminAuth.issueTokenPair(
      session.adminId,
      session.admin.username,
      session.admin.role,
    );
    return {
      accessToken: pair.accessToken,
      refreshToken: pair.refreshToken,
      expiresAt: pair.expiresAt,
      refreshExpiresAt: pair.refreshExpiresAt,
      agent: this.serializeAgent(session.admin),
    };
  }

  async me(user: AdminJwtPayload) {
    const agent = await this.prisma.adminUser.findUnique({
      where: { id: user.sub },
    });
    if (!agent || !agent.isActive || !AGENT_ROLES.has(agent.role)) {
      throw new UnauthorizedException('Agent not found');
    }
    return this.serializeAgent(agent);
  }

  async logout(user: AdminJwtPayload) {
    return this.adminAuth.logout(user);
  }

  private serializeAgent(agent: {
    id: number;
    username: string;
    displayName: string;
    role: string;
    parentId: number | null;
    isActive: boolean;
  }) {
    return {
      id: agent.id,
      username: agent.username,
      displayName: agent.displayName,
      role: agent.role,
      parentId: agent.parentId,
      isActive: agent.isActive,
    };
  }
}
