import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AdminEventsService } from '../admin-events/admin-events.service';
import { formatMoney, toDecimal } from '../common/utils/money.util';

export type BigWinPublicItem = {
  id: number;
  displayName: string;
  amountMmk: string;
  gameId: number | null;
  createdAt: string;
};

@Injectable()
export class BigWinService {
  private readonly log = new Logger(BigWinService.name);
  private readonly subject = new Subject<BigWinPublicItem>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly adminEvents: AdminEventsService,
  ) {}

  /** After a successful RGS win (deposit). Never throw into RGS path. */
  async maybeRecordWin(params: {
    playerId: number;
    amountUsd: string | number;
    gameId?: number | null;
  }): Promise<void> {
    try {
      const amountUsdDec = toDecimal(params.amountUsd);
      if (amountUsdDec.lte(0)) return;
      const amountUsd = formatMoney(amountUsdDec);

      const rate = await this.settings.getMmkPerUsd();
      const amountMmk = toDecimal(this.settings.usdToMmk(amountUsd, rate));
      const threshold = toDecimal(await this.settings.getBigWinThresholdMmk());
      if (amountMmk.lt(threshold)) return;

      const player = await this.prisma.player.findUnique({
        where: { id: params.playerId },
        select: {
          id: true,
          username: true,
          nickname: true,
          agentId: true,
        },
      });
      if (!player) return;

      const row = await this.prisma.bigWinEvent.create({
        data: {
          playerId: player.id,
          agentId: player.agentId,
          gameId: params.gameId ?? null,
          amountUsd: new Prisma.Decimal(amountUsd),
          amountMmk: new Prisma.Decimal(amountMmk.toFixed(2)),
          rateUsed: new Prisma.Decimal(rate),
          username: player.username,
          nickname: player.nickname,
        },
      });

      const item = this.toPublic(row);
      this.subject.next(item);
      this.adminEvents.emit('big_win', 'big_win');
    } catch (e) {
      this.log.warn(
        `Big win record failed: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  async listRecent(limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const rows = await this.prisma.bigWinEvent.findMany({
      orderBy: { id: 'desc' },
      take,
    });
    const threshold = await this.settings.getBigWinThresholdMmk();
    return {
      thresholdMmk: threshold,
      items: rows.map((r) => this.toPublic(r)),
    };
  }

  async listForAgentIds(agentIds: number[], limit = 30) {
    const take = Math.min(Math.max(limit, 1), 50);
    const rows = await this.prisma.bigWinEvent.findMany({
      where: { agentId: { in: agentIds } },
      orderBy: { id: 'desc' },
      take,
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        playerId: r.playerId,
        username: r.username,
        nickname: r.nickname,
        amountUsd: r.amountUsd.toString(),
        amountMmk: r.amountMmk.toString(),
        gameId: r.gameId,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  stream(): Observable<MessageEvent> {
    return this.subject.asObservable().pipe(
      filter(Boolean),
      map((payload) => ({ data: payload }) as MessageEvent),
    );
  }

  private toPublic(row: {
    id: number;
    username: string;
    nickname: string;
    amountMmk: Prisma.Decimal | string;
    gameId: number | null;
    createdAt: Date;
  }): BigWinPublicItem {
    return {
      id: row.id,
      displayName: this.maskName(row.nickname || row.username),
      amountMmk: row.amountMmk.toString(),
      gameId: row.gameId,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private maskName(name: string): string {
    const s = (name || 'Player').trim();
    if (s.length <= 2) return `${s}*`;
    return `${s.slice(0, 2)}***${s.slice(-1)}`;
  }
}
