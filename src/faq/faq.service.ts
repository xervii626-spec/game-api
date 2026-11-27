import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';

@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  async listAdmin() {
    const rows = await this.prisma.faq.findMany({
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return { items: rows.map((r) => this.serialize(r)) };
  }

  async listActive() {
    const rows = await this.prisma.faq.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        question: true,
        answer: true,
        sortOrder: true,
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        question: r.question,
        answer: r.answer,
        sortOrder: r.sortOrder,
      })),
    };
  }

  async create(dto: CreateFaqDto) {
    const question = dto.question.trim();
    const answer = dto.answer.trim();
    if (!question || !answer) {
      throw new BadRequestException('Question and answer are required');
    }
    const row = await this.prisma.faq.create({
      data: {
        question,
        answer,
        sortOrder: dto.sortOrder ?? 0,
        isActive: true,
      },
    });
    return this.serialize(row);
  }

  async setActive(id: number, isActive: boolean) {
    const existing = await this.prisma.faq.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ not found');
    const row = await this.prisma.faq.update({
      where: { id },
      data: { isActive },
    });
    return this.serialize(row);
  }

  private serialize(row: {
    id: number;
    question: string;
    answer: string;
    sortOrder: number;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      question: row.question,
      answer: row.answer,
      sortOrder: row.sortOrder,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
