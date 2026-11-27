import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const BATCH_SIZE = 500;

@Injectable()
export class AnnouncementWorkerService implements OnModuleInit {
  private readonly log = new Logger(AnnouncementWorkerService.name);
  private readonly running = new Set<number>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    try {
      const pending = await this.prisma.announcement.findMany({
        where: { status: { in: ['queued', 'sending'] } },
        select: { id: true },
        orderBy: { id: 'asc' },
        take: 50,
      });
      for (const row of pending) {
        this.enqueue(row.id);
      }
    } catch (e) {
      this.log.warn(
        `Resume pending announcements skipped: ${
          e instanceof Error ? e.message : String(e)
        }`,
      );
    }
  }

  enqueue(announcementId: number) {
    if (this.running.has(announcementId)) return;
    this.running.add(announcementId);
    void this.run(announcementId).finally(() => {
      this.running.delete(announcementId);
    });
  }

  private async run(announcementId: number) {
    try {
      const totalTargets = await this.prisma.player.count({
        where: { isBlocked: false },
      });

      await this.prisma.announcement.update({
        where: { id: announcementId },
        data: {
          status: 'sending',
          totalTargets,
          lastError: null,
        },
      });

      // Cursor-based batches — no N+1 player lookups
      for (;;) {
        const row = await this.prisma.announcement.findUnique({
          where: { id: announcementId },
          select: { id: true, status: true, cursorPlayerId: true },
        });
        if (!row || row.status === 'failed') return;

        const players = await this.prisma.player.findMany({
          where: {
            isBlocked: false,
            id: { gt: row.cursorPlayerId },
          },
          select: { id: true },
          orderBy: { id: 'asc' },
          take: BATCH_SIZE,
        });

        if (players.length === 0) break;

        await this.prisma.announcementDelivery.createMany({
          data: players.map((p) => ({
            announcementId,
            playerId: p.id,
          })),
          skipDuplicates: true,
        });

        const lastId = players[players.length - 1]!.id;
        const deliveredCount = await this.prisma.announcementDelivery.count({
          where: { announcementId },
        });

        await this.prisma.announcement.update({
          where: { id: announcementId },
          data: {
            cursorPlayerId: lastId,
            deliveredCount,
          },
        });
      }

      const deliveredCount = await this.prisma.announcementDelivery.count({
        where: { announcementId },
      });

      await this.prisma.announcement.update({
        where: { id: announcementId },
        data: {
          status: 'done',
          deliveredCount,
          sentAt: new Date(),
          lastError: null,
        },
      });

      this.log.log(
        `Announcement #${announcementId} done · delivered=${deliveredCount}`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.log.error(`Announcement #${announcementId} failed: ${msg}`);
      try {
        await this.prisma.announcement.update({
          where: { id: announcementId },
          data: {
            status: 'failed',
            lastError: msg.slice(0, 255),
          },
        });
      } catch {
        // ignore secondary failure
      }
    }
  }
}
