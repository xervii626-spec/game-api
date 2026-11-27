import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnnouncementWorkerService } from './announcement-worker.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly worker: AnnouncementWorkerService,
  ) {}

  async create(dto: CreateAnnouncementDto, adminId?: number) {
    const name = dto.name.trim();
    const description = dto.description.trim();
    if (!name || !description) {
      throw new BadRequestException('Name and description are required');
    }

    const row = await this.prisma.announcement.create({
      data: {
        name,
        description,
        status: 'queued',
        createdByAdminId: adminId ?? null,
      },
    });

    this.worker.enqueue(row.id);
    return this.serializeAdmin(row);
  }

  async listAdmin() {
    const rows = await this.prisma.announcement.findMany({
      orderBy: { id: 'desc' },
      take: 100,
    });
    return { items: rows.map((r) => this.serializeAdmin(r)) };
  }

  async getAdmin(id: number) {
    const row = await this.prisma.announcement.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Announcement not found');
    return this.serializeAdmin(row);
  }

  /** Player inbox — single query with announcement join (no N+1). */
  async listInbox(playerId: number, limit = 20) {
    const take = Math.min(Math.max(limit, 1), 50);
    const rows = await this.prisma.announcementDelivery.findMany({
      where: { playerId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        announcement: {
          select: {
            id: true,
            name: true,
            description: true,
            createdAt: true,
            sentAt: true,
          },
        },
      },
    });

    const unreadCount = await this.prisma.announcementDelivery.count({
      where: { playerId, readAt: null },
    });

    return {
      unreadCount,
      items: rows.map((r) => ({
        id: r.id,
        announcementId: r.announcementId,
        name: r.announcement.name,
        description: r.announcement.description,
        readAt: r.readAt,
        createdAt: r.createdAt,
        sentAt: r.announcement.sentAt,
      })),
    };
  }

  async markRead(playerId: number, announcementId: number) {
    const row = await this.prisma.announcementDelivery.findUnique({
      where: {
        announcementId_playerId: { announcementId, playerId },
      },
    });
    if (!row) throw new NotFoundException('Announcement not found');

    if (!row.readAt) {
      await this.prisma.announcementDelivery.update({
        where: { id: row.id },
        data: { readAt: new Date() },
      });
    }

    return { ok: true, announcementId };
  }

  async markAllRead(playerId: number) {
    const result = await this.prisma.announcementDelivery.updateMany({
      where: { playerId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true, updated: result.count };
  }

  private serializeAdmin(row: {
    id: number;
    name: string;
    description: string;
    status: string;
    createdByAdminId: number | null;
    totalTargets: number;
    deliveredCount: number;
    cursorPlayerId: number;
    lastError: string | null;
    sentAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      status: row.status,
      createdByAdminId: row.createdByAdminId,
      totalTargets: row.totalTargets,
      deliveredCount: row.deliveredCount,
      cursorPlayerId: row.cursorPlayerId,
      lastError: row.lastError,
      sentAt: row.sentAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
