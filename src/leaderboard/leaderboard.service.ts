import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import {
  LeaderboardPeriod,
  currentPeriodKeys,
  resolvePeriodKey,
} from './leaderboard-period';
import { formatMoney, toDecimal } from '../common/utils/money.util';

export type LeaderboardMetric = 'win' | 'bet' | 'net' | 'biggest';

@Injectable()
export class LeaderboardService {
  private readonly log = new Logger(LeaderboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  /** After successful RGS bet. Never throw into RGS path. */
  async onBet(playerId: number, amountUsd: string | number): Promise<void> {
    await this.bump(playerId, amountUsd, 'bet');
  }

  /** After successful RGS win (real money). Never throw into RGS path. */
  async onWin(playerId: number, amountUsd: string | number): Promise<void> {
    await this.bump(playerId, amountUsd, 'win');
  }

  private async bump(
    playerId: number,
    amountUsd: string | number,
    kind: 'bet' | 'win',
  ) {
    try {
      const amt = toDecimal(amountUsd);
      if (amt.lte(0)) return;
      const amount = formatMoney(amt);

      const player = await this.prisma.player.findUnique({
        where: { id: playerId },
        select: {
          id: true,
          username: true,
          nickname: true,
          agentId: true,
        },
      });
      if (!player) return;

      for (const { period, periodKey } of currentPeriodKeys()) {
        if (kind === 'bet') {
          await this.prisma.$executeRaw`
            INSERT INTO leaderboard_stats (
              player_id, agent_id, period, period_key,
              total_win_usd, total_bet_usd, net_usd, biggest_win_usd,
              username, nickname, updated_at, created_at
            ) VALUES (
              ${player.id}, ${player.agentId}, ${period}, ${periodKey},
              0, ${amount}::decimal, ${`-${amount}`}::decimal, 0,
              ${player.username}, ${player.nickname}, NOW(), NOW()
            )
            ON CONFLICT (player_id, period, period_key)
            DO UPDATE SET
              total_bet_usd = leaderboard_stats.total_bet_usd + EXCLUDED.total_bet_usd,
              net_usd = leaderboard_stats.total_win_usd - (leaderboard_stats.total_bet_usd + EXCLUDED.total_bet_usd),
              agent_id = COALESCE(EXCLUDED.agent_id, leaderboard_stats.agent_id),
              username = EXCLUDED.username,
              nickname = EXCLUDED.nickname,
              updated_at = NOW()
          `;
        } else {
          await this.prisma.$executeRaw`
            INSERT INTO leaderboard_stats (
              player_id, agent_id, period, period_key,
              total_win_usd, total_bet_usd, net_usd, biggest_win_usd,
              username, nickname, updated_at, created_at
            ) VALUES (
              ${player.id}, ${player.agentId}, ${period}, ${periodKey},
              ${amount}::decimal, 0, ${amount}::decimal, ${amount}::decimal,
              ${player.username}, ${player.nickname}, NOW(), NOW()
            )
            ON CONFLICT (player_id, period, period_key)
            DO UPDATE SET
              total_win_usd = leaderboard_stats.total_win_usd + EXCLUDED.total_win_usd,
              net_usd = (leaderboard_stats.total_win_usd + EXCLUDED.total_win_usd) - leaderboard_stats.total_bet_usd,
              biggest_win_usd = GREATEST(leaderboard_stats.biggest_win_usd, EXCLUDED.biggest_win_usd),
              agent_id = COALESCE(EXCLUDED.agent_id, leaderboard_stats.agent_id),
              username = EXCLUDED.username,
              nickname = EXCLUDED.nickname,
              updated_at = NOW()
          `;
        }
      }
    } catch (e) {
      this.log.warn(
        `Leaderboard bump failed (${kind}) player=${playerId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  async list(params: {
    metric: LeaderboardMetric;
    period: LeaderboardPeriod;
    limit?: number;
    agentIds?: number[] | null;
    maskNames?: boolean;
  }) {
    const metric = params.metric;
    const period = params.period;
    if (!['win', 'bet', 'net', 'biggest'].includes(metric)) {
      throw new BadRequestException('Invalid metric');
    }
    if (!['day', 'week', 'all'].includes(period)) {
      throw new BadRequestException('Invalid period');
    }

    const take = Math.min(Math.max(params.limit ?? 50, 1), 100);
    const periodKey = resolvePeriodKey(period);
    const mmkPerUsd = await this.settings.getMmkPerUsd();

    const orderField =
      metric === 'win'
        ? 'totalWinUsd'
        : metric === 'bet'
          ? 'totalBetUsd'
          : metric === 'net'
            ? 'netUsd'
            : 'biggestWinUsd';

    const where: Prisma.LeaderboardStatWhereInput = {
      period,
      periodKey,
      ...(params.agentIds
        ? { agentId: { in: params.agentIds } }
        : {}),
    };

    const rows = await this.prisma.leaderboardStat.findMany({
      where,
      orderBy: { [orderField]: 'desc' },
      take,
    });

    return {
      metric,
      period,
      periodKey,
      timezone: 'Asia/Yangon',
      mmkPerUsd,
      items: rows.map((r, idx) => {
        const valueUsd =
          metric === 'win'
            ? r.totalWinUsd.toString()
            : metric === 'bet'
              ? r.totalBetUsd.toString()
              : metric === 'net'
                ? r.netUsd.toString()
                : r.biggestWinUsd.toString();
        return {
          rank: idx + 1,
          playerId: params.maskNames ? undefined : r.playerId,
          displayName: params.maskNames
            ? this.maskName(r.nickname || r.username)
            : r.nickname || r.username,
          username: params.maskNames ? undefined : r.username,
          valueUsd: formatMoney(valueUsd),
          valueMmk: this.settings.usdToMmk(valueUsd, mmkPerUsd),
          totalWinUsd: formatMoney(r.totalWinUsd.toString()),
          totalBetUsd: formatMoney(r.totalBetUsd.toString()),
          netUsd: formatMoney(r.netUsd.toString()),
          biggestWinUsd: formatMoney(r.biggestWinUsd.toString()),
        };
      }),
    };
  }

  private maskName(name: string): string {
    const s = (name || 'Player').trim();
    if (s.length <= 2) return `${s}*`;
    return `${s.slice(0, 2)}***${s.slice(-1)}`;
  }
}
