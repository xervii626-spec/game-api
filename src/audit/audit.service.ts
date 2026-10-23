import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    action: string;
    playerId?: number;
    request?: unknown;
    response?: unknown;
    ip?: string;
  }) {
    return this.prisma.auditLog.create({
      data: {
        action: params.action,
        playerId: params.playerId,
        request: params.request as object | undefined,
        response: params.response as object | undefined,
        ip: params.ip,
      },
    });
  }
}
