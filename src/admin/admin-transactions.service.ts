import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AdminTransactionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async list(params: {
    page?: number;
    limit?: number;
    direction?: string;
    playerId?: number;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const take = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const skip = (page - 1) * take;

    const where: Prisma.TransactionWhereInput = {};
    if (params.playerId) {
      where.playerId = params.playerId;
    }
    if (params.direction) {
      where.direction = params.direction;
    } else {
      // Game play activity only (RGS bet / win)
      where.direction = { in: ['withdraw', 'deposit'] };
    }

    const [rows, total, mmkPerUsd] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          player: {
            select: { id: true, username: true, nickname: true },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
      this.settings.getMmkPerUsd(),
    ]);

    return {
      page,
      limit: take,
      total,
      mmkPerUsd,
      items: rows.map((t) => {
        const amountUsd = t.amount.toString();
        const activity =
          t.direction === 'withdraw'
            ? 'Bet'
            : t.direction === 'deposit'
              ? 'Win'
              : t.direction;
        const statusLabel =
          t.status === 'rolled_back'
            ? 'Rolled back'
            : t.direction === 'deposit'
              ? 'Paid'
              : 'Settled';

        return {
          id: t.id,
          createdAt: t.createdAt.toISOString(),
          playerId: t.playerId,
          username: t.player.username,
          nickname: t.player.nickname,
          activity,
          direction: t.direction,
          gameId: t.gameId,
          amountUsd,
          amountMmk: this.settings.usdToMmk(amountUsd, mmkPerUsd),
          currency: t.currency,
          status: t.status,
          statusLabel,
          rgsTransactionId: t.rgsTransactionId.toString(),
        };
      }),
    };
  }
}
