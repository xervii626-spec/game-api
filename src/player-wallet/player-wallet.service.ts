import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';

@Injectable()
export class PlayerWalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: WalletBalanceService,
  ) {}

  getBalance(playerId: number) {
    return this.balances.getSnapshot(playerId);
  }

  async getTransactions(
    playerId: number,
    page = 1,
    limit = 20,
  ) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where: { playerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          rgsTransactionId: true,
          rgsRelatedTransactionId: true,
          typeId: true,
          direction: true,
          amount: true,
          currency: true,
          gameId: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.transaction.count({ where: { playerId } }),
    ]);

    return {
      page: Math.max(page, 1),
      limit: take,
      total,
      items: items.map((t) => ({
        ...t,
        rgsTransactionId: t.rgsTransactionId.toString(),
        rgsRelatedTransactionId: t.rgsRelatedTransactionId?.toString() ?? null,
        amount: t.amount.toString(),
      })),
    };
  }

  async getLedger(playerId: number, page = 1, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [items, total] = await Promise.all([
      this.prisma.walletLedger.findMany({
        where: { playerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.walletLedger.count({ where: { playerId } }),
    ]);

    return {
      page: Math.max(page, 1),
      limit: take,
      total,
      items: items.map((l) => ({
        ...l,
        amount: l.amount.toString(),
        balanceAfter: l.balanceAfter.toString(),
      })),
    };
  }
}
