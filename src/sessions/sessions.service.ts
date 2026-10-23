import { Injectable, NotFoundException } from '@nestjs/common';
import { Session } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(playerId: number, expiresInHours = 24): Promise<Session> {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) {
      throw new NotFoundException(`Player ${playerId} not found`);
    }

    const token = this.generateToken();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

    return this.prisma.session.create({
      data: {
        playerId,
        token,
        isActive: true,
        expiresAt,
      },
    });
  }

  async findByToken(token: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { token } });
  }

  async findByTokenOrThrow(token: string): Promise<Session> {
    const session = await this.findByToken(token);
    if (!session) {
      throw new NotFoundException('Session token not found');
    }
    return session;
  }

  /** Active + not expired — Authenticate / GetBalance / Withdraw */
  async findValidSession(token: string): Promise<Session | null> {
    const session = await this.findByToken(token);
    if (!session || !session.isActive) {
      return null;
    }
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      return null;
    }
    return session;
  }

  /** Deposit/Rollback — token may be expired; existence only */
  async findExistingSession(token: string): Promise<Session | null> {
    return this.findByToken(token);
  }

  async deactivate(token: string): Promise<Session> {
    const session = await this.findByTokenOrThrow(token);
    return this.prisma.session.update({
      where: { id: session.id },
      data: { isActive: false },
    });
  }

  private generateToken(): string {
    return randomBytes(20).toString('hex');
  }
}
