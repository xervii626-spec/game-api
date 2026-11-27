import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';
import { AuditService } from '../audit/audit.service';
import { AgentScopeService } from '../agent/agent-scope.service';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { AdminCreatePlayerDto } from './dto/admin-create-player.dto';
import { AdminUpdatePlayerDto } from './dto/admin-update-player.dto';
import { formatMoney } from '../common/utils/money.util';

@Injectable()
export class AdminPlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: WalletBalanceService,
    private readonly audit: AuditService,
    private readonly agentScope: AgentScopeService,
  ) {}

  async list(params: {
    search?: string;
    blocked?: string;
    masterAgentId?: number;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PlayerWhereInput = {};
    if (params.search) {
      const q = params.search.trim();
      const asId = /^\d+$/.test(q) ? Number(q) : null;
      where.OR = [
        { username: { contains: q, mode: 'insensitive' } },
        { nickname: { contains: q, mode: 'insensitive' } },
        ...(asId != null ? [{ id: asId }] : []),
      ];
    }
    if (params.blocked === 'true') where.isBlocked = true;
    if (params.blocked === 'false') where.isBlocked = false;

    if (params.masterAgentId != null && Number.isFinite(params.masterAgentId)) {
      const master = await this.prisma.adminUser.findFirst({
        where: {
          id: params.masterAgentId,
          role: 'master_agent',
        },
        select: { id: true },
      });
      if (!master) {
        throw new BadRequestException('Master agent not found');
      }
      const agentIds = await this.agentScope.agentIdsInTree(master.id);
      where.agentId = { in: agentIds };
    }

    const [items, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip,
        take: limit,
        orderBy: { id: 'desc' },
        include: { wallet: true },
      }),
      this.prisma.player.count({ where }),
    ]);

    return {
      page,
      limit,
      total,
      items: items.map((p) => ({
        id: p.id,
        username: p.username,
        nickname: p.nickname,
        currency: p.currency,
        country: p.country,
        isBlocked: p.isBlocked,
        createdAt: p.createdAt,
        wallet: p.wallet
          ? {
              realBalance: p.wallet.realBalance.toString(),
              bonusMoney: p.wallet.bonusMoney.toString(),
              frozenMoney: p.wallet.frozenMoney.toString(),
              bonusWin: p.wallet.bonusWin.toString(),
            }
          : null,
      })),
    };
  }

  async detail(playerId: number) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      include: {
        wallet: true,
        sessions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        authSessions: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            jti: true,
            isActive: true,
            expiresAt: true,
            createdAt: true,
          },
        },
      },
    });
    if (!player) throw new NotFoundException('Player not found');

    const { passwordHash: _, ...rest } = player;
    return {
      ...rest,
      wallet: player.wallet
        ? {
            ...player.wallet,
            realBalance: player.wallet.realBalance.toString(),
            bonusMoney: player.wallet.bonusMoney.toString(),
            frozenMoney: player.wallet.frozenMoney.toString(),
            bonusWin: player.wallet.bonusWin.toString(),
          }
        : null,
    };
  }

  async create(adminId: number, dto: AdminCreatePlayerDto) {
    const username = dto.username.trim();
    const nickname = dto.nickname.trim();
    const currency = (dto.currency ?? 'USD').toUpperCase();

    const exists = await this.prisma.player.findFirst({
      where: {
        OR: [{ username }, { nickname }],
      },
    });
    if (exists) {
      throw new ConflictException('Username or nickname already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const player = await this.prisma.player.create({
      data: {
        username,
        nickname,
        passwordHash,
        currency,
        country: dto.country?.toUpperCase() ?? null,
        wallet: { create: { realBalance: new Prisma.Decimal(0) } },
      },
      include: { wallet: true },
    });

    await this.audit.log({
      action: 'AdminCreatePlayer',
      playerId: player.id,
      adminId,
      request: { username, nickname, currency, country: dto.country },
      response: { id: player.id },
    });

    return this.toListItem(player);
  }

  async update(playerId: number, adminId: number, dto: AdminUpdatePlayerDto) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) throw new NotFoundException('Player not found');

    if (dto.nickname && dto.nickname.trim() !== player.nickname) {
      const taken = await this.prisma.player.findFirst({
        where: { nickname: dto.nickname.trim(), NOT: { id: playerId } },
      });
      if (taken) throw new ConflictException('Nickname already exists');
    }

    const data: Prisma.PlayerUpdateInput = {};
    if (dto.nickname != null) data.nickname = dto.nickname.trim();
    if (dto.country !== undefined) {
      data.country =
        dto.country === null || dto.country === ''
          ? null
          : dto.country.toUpperCase();
    }
    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.player.update({
      where: { id: playerId },
      data,
      include: { wallet: true },
    });

    await this.audit.log({
      action: 'AdminUpdatePlayer',
      playerId,
      adminId,
      request: {
        nickname: dto.nickname,
        country: dto.country,
        passwordChanged: Boolean(dto.password),
      },
      response: { id: updated.id },
    });

    return this.toListItem(updated);
  }

  async remove(playerId: number, adminId: number) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) throw new NotFoundException('Player not found');

    const [txCount, payCount] = await Promise.all([
      this.prisma.transaction.count({ where: { playerId } }),
      this.prisma.paymentRequest.count({ where: { playerId } }),
    ]);
    if (txCount > 0 || payCount > 0) {
      throw new BadRequestException(
        'Cannot delete player with bet/win or payment history. Block the player instead.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.walletLedger.deleteMany({ where: { playerId } });
      await tx.session.deleteMany({ where: { playerId } });
      await tx.authSession.deleteMany({ where: { playerId } });
      await tx.wallet.deleteMany({ where: { playerId } });
      await tx.player.delete({ where: { id: playerId } });
    });

    await this.audit.log({
      action: 'AdminDeletePlayer',
      playerId,
      adminId,
      request: { playerId, username: player.username },
      response: { ok: true },
    });

    return { ok: true, id: playerId };
  }

  async setBlocked(playerId: number, isBlocked: boolean, adminId: number) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) throw new NotFoundException('Player not found');

    const updated = await this.prisma.player.update({
      where: { id: playerId },
      data: { isBlocked },
    });

    await this.audit.log({
      action: isBlocked ? 'AdminBlockPlayer' : 'AdminUnblockPlayer',
      playerId,
      adminId,
      request: { isBlocked },
      response: { ok: true },
    });

    return {
      id: updated.id,
      username: updated.username,
      isBlocked: updated.isBlocked,
    };
  }

  private toListItem(p: {
    id: number;
    username: string;
    nickname: string;
    currency: string;
    country: string | null;
    isBlocked: boolean;
    createdAt: Date;
    wallet: {
      realBalance: Prisma.Decimal;
      bonusMoney: Prisma.Decimal;
      frozenMoney: Prisma.Decimal;
      bonusWin: Prisma.Decimal;
    } | null;
  }) {
    return {
      id: p.id,
      username: p.username,
      nickname: p.nickname,
      currency: p.currency,
      country: p.country,
      isBlocked: p.isBlocked,
      createdAt: p.createdAt,
      wallet: p.wallet
        ? {
            realBalance: p.wallet.realBalance.toString(),
            bonusMoney: p.wallet.bonusMoney.toString(),
            frozenMoney: p.wallet.frozenMoney.toString(),
            bonusWin: p.wallet.bonusWin.toString(),
          }
        : null,
    };
  }

  async adjustBalance(
    playerId: number,
    adminId: number,
    dto: AdjustBalanceDto,
  ) {
    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
    });
    if (!player) throw new NotFoundException('Player not found');

    let snap;
    try {
      snap =
        dto.direction === 'credit'
          ? await this.balances.creditReal(playerId, dto.amount)
          : await this.balances.debitReal(playerId, dto.amount);
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw e;
    }

    const ledger = await this.prisma.walletLedger.create({
      data: {
        playerId,
        adminId,
        type: dto.direction === 'credit' ? 'admin_credit' : 'admin_debit',
        amount: dto.amount,
        balanceAfter: snap.realBalance,
        currency: player.currency,
        note: dto.note,
      },
    });

    await this.audit.log({
      action: 'AdminAdjustBalance',
      playerId,
      adminId,
      request: { ...dto },
      response: { balance: snap.realBalance, ledgerId: ledger.id },
    });

    return {
      playerId,
      direction: dto.direction,
      amount: formatMoney(dto.amount),
      balance: snap,
      ledgerId: ledger.id,
    };
  }
}
