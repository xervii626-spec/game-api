import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatMoney, toDecimal } from '../common/utils/money.util';

export const GOAL_BET_COUNT = 'bet_count';
export const GOAL_BET_AMOUNT_USD = 'bet_amount_usd';

/** Prisma-only bet progress updates (no wallet import — avoids cycles). */
@Injectable()
export class QuestProgressService {
  private readonly log = new Logger(QuestProgressService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Call after a successful RGS bet (withdraw). Never throw into RGS path. */
  async onBet(playerId: number, amountUsd: string | number): Promise<void> {
    try {
      const amount = toDecimal(amountUsd);
      if (amount.lte(0)) return;

      const quests = await this.prisma.quest.findMany({
        where: {
          isActive: true,
          goalType: { in: [GOAL_BET_COUNT, GOAL_BET_AMOUNT_USD] },
        },
        select: {
          id: true,
          goalType: true,
          targetValue: true,
        },
      });
      if (!quests.length) return;

      for (const q of quests) {
        const delta =
          q.goalType === GOAL_BET_COUNT ? toDecimal(1) : amount;

        await this.prisma.$transaction(async (tx) => {
          const existing = await tx.questProgress.findUnique({
            where: {
              playerId_questId: { playerId, questId: q.id },
            },
          });

          if (existing?.status === 'claimed') return;

          const next = toDecimal(existing?.progressValue?.toString() ?? '0').plus(
            delta,
          );
          const target = toDecimal(q.targetValue.toString());
          const status = next.gte(target) ? 'claimable' : 'active';

          if (existing) {
            if (existing.status === 'claimable' && status === 'claimable') {
              // already claimable — still bump progress for display
            }
            await tx.questProgress.update({
              where: { id: existing.id },
              data: {
                progressValue: new Prisma.Decimal(formatMoney(next)),
                status:
                  existing.status === 'claimed' ? 'claimed' : status,
              },
            });
          } else {
            await tx.questProgress.create({
              data: {
                playerId,
                questId: q.id,
                progressValue: new Prisma.Decimal(formatMoney(next)),
                status,
              },
            });
          }
        });
      }
    } catch (e) {
      this.log.warn(
        `Quest progress failed for player ${playerId}: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }
}
