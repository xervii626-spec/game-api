import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';
import { AuditService } from '../audit/audit.service';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';
import { formatMoney } from '../common/utils/money.util';

@Injectable()
export class AdminPlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: WalletBalanceService,
    private readonly audit: AuditService,
  ) {}

  async list(params: {
    search?: string;
    blocked?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PlayerWhereInput = {};
    if (params.search) {
      where.OR = [
        { username: { contains: params.search, mode: 'insensitive' } },
        { nickname: { contains: params.search, mode: 'insensitive' } },
      ];
    }
    if (params.blocked === 'true') where.isBlocked = true;
    if (params.blocked === 'false') where.isBlocked = false;

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
