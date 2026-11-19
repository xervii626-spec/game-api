import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { formatMoney, toDecimal } from '../common/utils/money.util';

export const BONUS_KIND_DAILY_LOGIN = 'daily_login';

@Injectable()
export class BonusService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: WalletBalanceService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  /** Calendar day key in Asia/Yangon (YYYY-MM-DD). */
  yangonDateKey(d = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Yangon',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }

  async dailyLoginStatus(playerId: number) {
    const claimDate = this.yangonDateKey();
    const amountUsd = await this.settings.getDailyLoginBonusUsd();
    const mmkPerUsd = await this.settings.getMmkPerUsd();
    const existing = await this.prisma.bonusClaim.findUnique({
      where: {
        playerId_kind_claimDate: {
          playerId,
          kind: BONUS_KIND_DAILY_LOGIN,
          claimDate,
        },
      },
    });

    return {
      kind: BONUS_KIND_DAILY_LOGIN,
      claimDate,
      timezone: 'Asia/Yangon',
      canClaim: !existing,
      claimedToday: Boolean(existing),
      amountUsd,
      amountMmk: this.settings.usdToMmk(amountUsd, mmkPerUsd),
      mmkPerUsd,
      playOnly: true,
      claimedAt: existing?.createdAt?.toISOString() ?? null,
    };
  }

  async claimDailyLogin(playerId: number) {
    const claimDate = this.yangonDateKey();
    const amountUsd = await this.settings.getDailyLoginBonusUsd();
    if (toDecimal(amountUsd).lte(0)) {
      throw new BadRequestException('Daily login bonus is not configured');
    }

    const already = await this.prisma.bonusClaim.findUnique({
      where: {
        playerId_kind_claimDate: {
          playerId,
          kind: BONUS_KIND_DAILY_LOGIN,
          claimDate,
        },
      },
    });
    if (already) {
      throw new ConflictException('Already claimed today');
    }

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const snap = await this.balances.creditBonusMoney(
          playerId,
          amountUsd,
          tx,
        );
        const ledger = await tx.walletLedger.create({
          data: {
            playerId,
            type: 'daily_login_bonus',
            amount: new Prisma.Decimal(formatMoney(amountUsd)),
            balanceAfter: new Prisma.Decimal(snap.bonusMoney),
            currency: 'USD',
            note: `Daily login ${claimDate} (play-only)`,
          },
        });
        const claim = await tx.bonusClaim.create({
          data: {
            playerId,
            kind: BONUS_KIND_DAILY_LOGIN,
            claimDate,
            amountUsd: new Prisma.Decimal(formatMoney(amountUsd)),
            ledgerId: ledger.id,
          },
        });
        return { snap, claim, ledgerId: ledger.id };
      });

      await this.audit.log({
        action: 'DailyLoginClaim',
        playerId,
        request: { claimDate, amountUsd },
        response: {
          claimId: result.claim.id,
          bonusMoney: result.snap.bonusMoney,
        },
      });

      const mmkPerUsd = await this.settings.getMmkPerUsd();
      return {
        kind: BONUS_KIND_DAILY_LOGIN,
        claimDate,
        amountUsd: formatMoney(amountUsd),
        amountMmk: this.settings.usdToMmk(amountUsd, mmkPerUsd),
        playOnly: true,
        balance: result.snap,
        claimedAt: result.claim.createdAt.toISOString(),
      };
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException('Already claimed today');
      }
      throw err;
    }
  }
}
