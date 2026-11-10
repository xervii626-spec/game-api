import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /**
   * Lightweight dashboard header stats — DB aggregates only (no row fetch + JS count).
   */
  async summary() {
    const now = new Date();

    const [
      liveRows,
      pendingDeposits,
      pendingWithdrawals,
      mmkPerUsd,
    ] = await Promise.all([
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT COUNT(DISTINCT player_id)::bigint AS count
        FROM auth_sessions
        WHERE is_active = true AND expires_at > ${now}
      `,
      this.prisma.paymentRequest.count({
        where: { status: 'pending', type: 'deposit' },
      }),
      this.prisma.paymentRequest.count({
        where: { status: 'pending', type: 'withdraw' },
      }),
      this.settings.getMmkPerUsd(),
    ]);

    return {
      liveUsers: Number(liveRows[0]?.count ?? 0),
      pendingDeposits,
      pendingWithdrawals,
      mmkPerUsd,
      walletCurrency: 'USD',
      displayCurrency: 'MMK',
    };
  }
}
