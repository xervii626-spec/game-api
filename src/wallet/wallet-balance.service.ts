import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Wallet } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import {
  add,
  formatMoney,
  isEnough,
  sub,
  toDecimal,
} from '../common/utils/money.util';

export type BalanceSnapshot = {
  realBalance: string;
  bonusWin: string;
  frozenMoney: string;
  bonusMoney: string;
  totalBalance: string;
  bonusTotalBalance: string;
};

type LockedWalletRow = {
  player_id: number;
  real_balance: Prisma.Decimal;
  bonus_win: Prisma.Decimal;
  frozen_money: Prisma.Decimal;
  bonus_money: Prisma.Decimal;
};

type DbClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class WalletBalanceService {
  constructor(private readonly prisma: PrismaService) {}

  toSnapshot(wallet: Wallet): BalanceSnapshot {
    const real = formatMoney(wallet.realBalance.toString());
    const bonusWin = formatMoney(wallet.bonusWin.toString());
    const frozen = formatMoney(wallet.frozenMoney.toString());
    const bonusMoney = formatMoney(wallet.bonusMoney.toString());
    const bonusTotal = formatMoney(add(add(bonusWin, frozen), bonusMoney));

    return {
      realBalance: real,
      bonusWin,
      frozenMoney: frozen,
      bonusMoney,
      totalBalance: real,
      bonusTotalBalance: bonusTotal,
    };
  }

  /** For RGS: bonus mode uses bonus wallets sum, else real balance. */
  resolveTotal(snapshot: BalanceSnapshot, bonusMode: boolean): number {
    return Number(bonusMode ? snapshot.bonusTotalBalance : snapshot.totalBalance);
  }

  async getWalletOrThrow(playerId: number, db: DbClient = this.prisma): Promise<Wallet> {
    const wallet = await db.wallet.findUnique({ where: { playerId } });
    if (!wallet) {
      throw new NotFoundException(`Wallet not found for player ${playerId}`);
    }
    return wallet;
  }

  async getSnapshot(
    playerId: number,
    db: DbClient = this.prisma,
  ): Promise<BalanceSnapshot> {
    const wallet = await this.getWalletOrThrow(playerId, db);
    return this.toSnapshot(wallet);
  }

  async lockWallet(
    tx: Prisma.TransactionClient,
    playerId: number,
  ): Promise<LockedWalletRow> {
    const rows = await tx.$queryRaw<LockedWalletRow[]>`
      SELECT player_id, real_balance, bonus_win, frozen_money, bonus_money
      FROM wallets
      WHERE player_id = ${playerId}
      FOR UPDATE
    `;
    const row = rows[0];
    if (!row) {
      throw new NotFoundException(`Wallet not found for player ${playerId}`);
    }
    return row;
  }

  async creditReal(
    playerId: number,
    amount: string | number,
    db?: Prisma.TransactionClient,
  ): Promise<BalanceSnapshot> {
    const value = toDecimal(amount);
    if (value.lt(0)) {
      throw new BadRequestException('Credit amount cannot be negative');
    }
    if (value.eq(0)) {
      return this.getSnapshot(playerId, db ?? this.prisma);
    }

    const run = async (tx: Prisma.TransactionClient) => {
      const row = await this.lockWallet(tx, playerId);
      const next = formatMoney(add(row.real_balance.toString(), value));
      const updated = await tx.wallet.update({
        where: { playerId },
        data: { realBalance: new Prisma.Decimal(next) },
      });
      return this.toSnapshot(updated);
    };

    if (db) return run(db);
    return this.prisma.$transaction(run);
  }

  async debitReal(
    playerId: number,
    amount: string | number,
    db?: Prisma.TransactionClient,
  ): Promise<BalanceSnapshot> {
    const value = toDecimal(amount);
    if (value.lt(0)) {
      throw new BadRequestException('Debit amount cannot be negative');
    }
    if (value.eq(0)) {
      return this.getSnapshot(playerId, db ?? this.prisma);
    }

    const run = async (tx: Prisma.TransactionClient) => {
      const row = await this.lockWallet(tx, playerId);
      const current = row.real_balance.toString();
      if (!isEnough(current, value)) {
        throw new BadRequestException({
          code: 'NOT_ENOUGH_BALANCE',
          message: 'Not enough balance',
        });
      }
      const updated = await tx.wallet.update({
        where: { playerId },
        data: {
          realBalance: new Prisma.Decimal(formatMoney(sub(current, value))),
        },
      });
      return this.toSnapshot(updated);
    };

    if (db) return run(db);
    return this.prisma.$transaction(run);
  }

  async debitBonusWallets(
    playerId: number,
    amount: string | number,
    db?: Prisma.TransactionClient,
  ): Promise<BalanceSnapshot> {
    let remaining = toDecimal(amount);
    if (remaining.lt(0)) {
      throw new BadRequestException('Debit amount cannot be negative');
    }
    if (remaining.eq(0)) {
      return this.getSnapshot(playerId, db ?? this.prisma);
    }

    const run = async (tx: Prisma.TransactionClient) => {
      const row = await this.lockWallet(tx, playerId);
      let bonusWin = toDecimal(row.bonus_win.toString());
      let frozen = toDecimal(row.frozen_money.toString());
      let bonusMoney = toDecimal(row.bonus_money.toString());
      const total = bonusWin.plus(frozen).plus(bonusMoney);

      if (!isEnough(total, remaining)) {
        throw new BadRequestException({
          code: 'NOT_ENOUGH_BALANCE',
          message: 'Not enough bonus balance',
        });
      }

      const takeFrom = (bucket: Decimal): Decimal => {
        if (remaining.lte(0) || bucket.lte(0)) return bucket;
        if (bucket.gte(remaining)) {
          const left = bucket.minus(remaining);
          remaining = toDecimal(0);
          return left;
        }
        remaining = remaining.minus(bucket);
        return toDecimal(0);
      };

      bonusWin = takeFrom(bonusWin);
      frozen = takeFrom(frozen);
      bonusMoney = takeFrom(bonusMoney);

      const updated = await tx.wallet.update({
        where: { playerId },
        data: {
          bonusWin: new Prisma.Decimal(formatMoney(bonusWin)),
          frozenMoney: new Prisma.Decimal(formatMoney(frozen)),
          bonusMoney: new Prisma.Decimal(formatMoney(bonusMoney)),
        },
      });
      return this.toSnapshot(updated);
    };

    if (db) return run(db);
    return this.prisma.$transaction(run);
  }

  async creditBonusWin(
    playerId: number,
    amount: string | number,
    db?: Prisma.TransactionClient,
  ): Promise<BalanceSnapshot> {
    const value = toDecimal(amount);
    if (value.lt(0)) {
      throw new BadRequestException('Credit amount cannot be negative');
    }
    if (value.eq(0)) {
      return this.getSnapshot(playerId, db ?? this.prisma);
    }

    const run = async (tx: Prisma.TransactionClient) => {
      const row = await this.lockWallet(tx, playerId);
      const next = formatMoney(add(row.bonus_win.toString(), value));
      const updated = await tx.wallet.update({
        where: { playerId },
        data: { bonusWin: new Prisma.Decimal(next) },
      });
      return this.toSnapshot(updated);
    };

    if (db) return run(db);
    return this.prisma.$transaction(run);
  }
}
