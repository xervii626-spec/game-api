import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import {
  GOAL_BET_AMOUNT_USD,
  GOAL_BET_COUNT,
} from './quest-progress.service';
import { formatMoney, toDecimal } from '../common/utils/money.util';

@Injectable()
export class QuestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balances: WalletBalanceService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  // ─── Admin ─────────────────────────────────────────────────

  async create(dto: CreateQuestDto) {
    const target = toDecimal(dto.targetValue);
    const reward = toDecimal(dto.rewardUsd);
    if (target.lte(0) || reward.lte(0)) {
      throw new BadRequestException('Target and reward must be > 0');
    }

    const row = await this.prisma.quest.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        goalType: dto.goalType,
        targetValue: new Prisma.Decimal(formatMoney(target)),
        rewardUsd: new Prisma.Decimal(formatMoney(reward)),
        isActive: true,
      },
    });
    return this.serializeQuest(row);
  }

  async listAdmin() {
    const rows = await this.prisma.quest.findMany({
      orderBy: { id: 'desc' },
      include: {
        _count: { select: { progress: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        ...this.serializeQuest(r),
        playerCount: r._count.progress,
      })),
    };
  }

  async setActive(id: number, isActive: boolean) {
    const row = await this.prisma.quest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Quest not found');
    const updated = await this.prisma.quest.update({
      where: { id },
      data: { isActive },
    });
    return this.serializeQuest(updated);
  }

  // ─── Player ────────────────────────────────────────────────

  async listForPlayer(playerId: number) {
    const mmkPerUsd = await this.settings.getMmkPerUsd();
    const quests = await this.prisma.quest.findMany({
      where: { isActive: true },
      orderBy: { id: 'desc' },
    });

    const progressRows = await this.prisma.questProgress.findMany({
      where: {
        playerId,
        questId: { in: quests.map((q) => q.id) },
      },
    });
    const byQuest = new Map(progressRows.map((p) => [p.questId, p]));

    // Ensure progress rows exist for active quests (lazy start)
    for (const q of quests) {
      if (!byQuest.has(q.id)) {
        const created = await this.prisma.questProgress.upsert({
          where: { playerId_questId: { playerId, questId: q.id } },
          create: {
            playerId,
            questId: q.id,
            progressValue: new Prisma.Decimal(0),
            status: 'active',
          },
          update: {},
        });
        byQuest.set(q.id, created);
      }
    }

    const items = quests.map((q) => {
      const p = byQuest.get(q.id)!;
      const target = q.targetValue.toString();
      const progress = p.progressValue.toString();
      const rewardUsd = q.rewardUsd.toString();
      return {
        id: q.id,
        title: q.title,
        description: q.description,
        goalType: q.goalType,
        goalLabel: this.goalLabel(q.goalType),
        targetValue: formatMoney(target),
        progressValue: formatMoney(progress),
        percent: this.percent(progress, target),
        rewardUsd: formatMoney(rewardUsd),
        rewardMmk: this.settings.usdToMmk(rewardUsd, mmkPerUsd),
        status: p.status,
        canClaim: p.status === 'claimable',
        playOnly: true,
        claimedAt: p.claimedAt?.toISOString() ?? null,
      };
    });

    return { mmkPerUsd, items };
  }

  async claim(playerId: number, questId: number) {
    const quest = await this.prisma.quest.findUnique({ where: { id: questId } });
    if (!quest || !quest.isActive) {
      throw new NotFoundException('Quest not found');
    }

    const progress = await this.prisma.questProgress.findUnique({
      where: { playerId_questId: { playerId, questId } },
    });
    if (!progress) {
      throw new BadRequestException('Quest not started');
    }
    if (progress.status === 'claimed') {
      throw new ConflictException('Already claimed');
    }
    if (
      progress.status !== 'claimable' &&
      toDecimal(progress.progressValue.toString()).lt(
        toDecimal(quest.targetValue.toString()),
      )
    ) {
      throw new BadRequestException('Quest not complete yet');
    }

    const rewardUsd = formatMoney(quest.rewardUsd.toString());

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const locked = await tx.questProgress.findUnique({
          where: { id: progress.id },
        });
        if (!locked || locked.status === 'claimed') {
          throw new ConflictException('Already claimed');
        }

        const snap = await this.balances.creditBonusMoney(
          playerId,
          rewardUsd,
          tx,
        );
        const ledger = await tx.walletLedger.create({
          data: {
            playerId,
            type: 'quest_bonus',
            amount: new Prisma.Decimal(rewardUsd),
            balanceAfter: new Prisma.Decimal(snap.bonusMoney),
            currency: 'USD',
            note: `Quest #${questId}: ${quest.title} (play-only)`,
          },
        });
        const updated = await tx.questProgress.update({
          where: { id: locked.id },
          data: {
            status: 'claimed',
            claimedAt: new Date(),
            ledgerId: ledger.id,
          },
        });
        return { snap, updated };
      });

      await this.audit.log({
        action: 'QuestClaim',
        playerId,
        request: { questId, rewardUsd },
        response: { bonusMoney: result.snap.bonusMoney },
      });

      const mmkPerUsd = await this.settings.getMmkPerUsd();
      return {
        questId,
        rewardUsd,
        rewardMmk: this.settings.usdToMmk(rewardUsd, mmkPerUsd),
        playOnly: true,
        balance: result.snap,
        claimedAt: result.updated.claimedAt!.toISOString(),
      };
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      throw err;
    }
  }

  private goalLabel(goalType: string): string {
    if (goalType === GOAL_BET_COUNT) return 'Place bets';
    if (goalType === GOAL_BET_AMOUNT_USD) return 'Bet amount (USD)';
    return goalType;
  }

  private percent(progress: string, target: string): number {
    const t = Number(target);
    if (!t || !Number.isFinite(t) || t <= 0) return 0;
    return Math.min(100, Math.round((Number(progress) / t) * 100));
  }

  private serializeQuest(row: {
    id: number;
    title: string;
    description: string | null;
    goalType: string;
    targetValue: Prisma.Decimal | string;
    rewardUsd: Prisma.Decimal | string;
    isActive: boolean;
    createdAt: Date;
  }) {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      goalType: row.goalType,
      goalLabel: this.goalLabel(row.goalType),
      targetValue: formatMoney(row.targetValue.toString()),
      rewardUsd: formatMoney(row.rewardUsd.toString()),
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
