import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * FAQ chat now; thread/message model is ready for later realtime (role=agent, mode=live).
 */
@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateFaqThread(playerId: number) {
    const existing = await this.prisma.chatThread.findFirst({
      where: { playerId, mode: 'faq', status: 'open' },
      orderBy: { updatedAt: 'desc' },
    });
    if (existing) return existing;
    return this.prisma.chatThread.create({
      data: { playerId, mode: 'faq', status: 'open' },
    });
  }

  async listMessages(playerId: number, limit = 50) {
    const thread = await this.getOrCreateFaqThread(playerId);
    const take = Math.min(Math.max(limit, 1), 100);
    const rows = await this.prisma.chatMessage.findMany({
      where: { threadId: thread.id },
      orderBy: { createdAt: 'asc' },
      take,
    });
    return {
      threadId: thread.id,
      mode: thread.mode,
      // text input disabled until realtime live mode
      inputEnabled: false,
      items: rows.map((r) => ({
        id: r.id,
        role: r.role as 'user' | 'bot' | 'agent',
        kind: r.kind,
        faqId: r.faqId,
        body: r.body,
        createdAt: r.createdAt,
      })),
    };
  }

  async askFaq(playerId: number, faqId: number) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, isActive: true },
    });
    if (!faq) throw new NotFoundException('FAQ not found');

    const thread = await this.getOrCreateFaqThread(playerId);

    const created = await this.prisma.$transaction(async (tx) => {
      const userMsg = await tx.chatMessage.create({
        data: {
          threadId: thread.id,
          role: 'user',
          kind: 'faq',
          faqId: faq.id,
          body: faq.question,
        },
      });
      const botMsg = await tx.chatMessage.create({
        data: {
          threadId: thread.id,
          role: 'bot',
          kind: 'faq',
          faqId: faq.id,
          body: faq.answer,
        },
      });
      await tx.chatThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });
      return { userMsg, botMsg };
    });

    return {
      threadId: thread.id,
      inputEnabled: false,
      messages: [created.userMsg, created.botMsg].map((r) => ({
        id: r.id,
        role: r.role as 'user' | 'bot' | 'agent',
        kind: r.kind,
        faqId: r.faqId,
        body: r.body,
        createdAt: r.createdAt,
      })),
    };
  }
}
