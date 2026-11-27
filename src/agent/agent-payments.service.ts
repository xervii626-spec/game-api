import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';
import { AuditService } from '../audit/audit.service';
import { AgentEventsService } from './agent-events.service';
import { CreateAgentPaymentDto } from './dto/create-agent-payment.dto';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';
import { toDecimal } from '../common/utils/money.util';

@Injectable()
export class AgentPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly balances: WalletBalanceService,
    private readonly audit: AuditService,
    private readonly events: AgentEventsService,
  ) {}

  async getRate() {
    const mmkPerUsd = await this.settings.getMmkPerUsd();
    return {
      mmkPerUsd,
      walletCurrency: 'USD',
      displayCurrency: 'MMK',
    };
  }

  /** Sub-agent only: request deposit/withdraw for own player → master. */
  async create(agent: AdminJwtPayload, dto: CreateAgentPaymentDto) {
    if (agent.role !== 'sub_agent') {
      throw new ForbiddenException(
        'Only sub-agents can request payments from a master',
      );
    }

    const requester = await this.prisma.adminUser.findUnique({
      where: { id: agent.sub },
      select: { id: true, parentId: true, role: true, isActive: true },
    });
    if (!requester?.isActive || !requester.parentId) {
      throw new BadRequestException('Sub-agent has no master');
    }

    const player = await this.prisma.player.findUnique({
      where: { id: dto.playerId },
    });
    if (!player) throw new NotFoundException('Player not found');
    if (player.agentId !== agent.sub) {
      throw new ForbiddenException('Player is not in your downline');
    }
    if (player.isBlocked) {
      throw new BadRequestException('Player is blocked');
    }

    if (toDecimal(dto.amountMmk).lte(0)) {
      throw new BadRequestException('amountMmk must be greater than 0');
    }

    const rateUsed = await this.settings.getMmkPerUsd();
    const amountUsd = this.settings.mmkToUsd(dto.amountMmk, rateUsed);
    if (toDecimal(amountUsd).lte(0)) {
      throw new BadRequestException('Converted USD amount must be > 0');
    }

    if (dto.type === 'withdraw') {
      const snap = await this.balances.getSnapshot(dto.playerId);
      if (toDecimal(snap.realBalance).lt(toDecimal(amountUsd))) {
        throw new BadRequestException({
          code: 'NOT_ENOUGH_BALANCE',
          message: 'Not enough USD balance for this withdraw request',
          requiredUsd: amountUsd,
          balanceUsd: snap.realBalance,
        });
      }
    }

    const row = await this.prisma.agentPaymentRequest.create({
      data: {
        requesterId: agent.sub,
        masterId: requester.parentId,
        playerId: dto.playerId,
        type: dto.type,
        status: 'pending',
        amountMmk: dto.amountMmk,
        amountUsd,
        rateUsed,
        method: dto.method,
        reference: dto.reference,
        requesterNote: dto.note,
      },
      include: this.include(),
    });

    await this.audit.log({
      action:
        dto.type === 'deposit'
          ? 'AgentPaymentDepositRequest'
          : 'AgentPaymentWithdrawRequest',
      adminId: agent.sub,
      playerId: dto.playerId,
      request: dto,
      response: { id: row.id, amountUsd, masterId: requester.parentId },
    });

    this.events.emitPayment(
      [requester.parentId, agent.sub],
      `${dto.type}.created`,
    );
    return this.serialize(row);
  }

  async list(
    agent: AdminJwtPayload,
    params: { status?: string; page?: number; limit?: number },
  ) {
    const page = Math.max(params.page ?? 1, 1);
    const take = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const skip = (page - 1) * take;

    const where: Prisma.AgentPaymentRequestWhereInput = {};
    if (agent.role === 'master_agent') {
      where.masterId = agent.sub;
    } else if (agent.role === 'sub_agent') {
      where.requesterId = agent.sub;
    } else {
      throw new ForbiddenException('Agents only');
    }
    if (params.status) where.status = params.status;

    const [rows, total] = await Promise.all([
      this.prisma.agentPaymentRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: this.include(),
      }),
      this.prisma.agentPaymentRequest.count({ where }),
    ]);

    return {
      page,
      limit: take,
      total,
      items: rows.map((r) => this.serialize(r)),
    };
  }

  async approve(agent: AdminJwtPayload, id: number, note?: string) {
    if (agent.role !== 'master_agent') {
      throw new ForbiddenException('Only master agents can approve');
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const row = await tx.agentPaymentRequest.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Request not found');
      if (row.masterId !== agent.sub) {
        throw new ForbiddenException('Not your sub-agent request');
      }
      if (row.status !== 'pending') {
        throw new BadRequestException('Request is not pending');
      }

      const player = await tx.player.findUnique({ where: { id: row.playerId } });
      if (!player) throw new NotFoundException('Player not found');
      if (player.isBlocked) {
        throw new BadRequestException('Player is blocked');
      }

      let snap;
      if (row.type === 'deposit') {
        snap = await this.balances.creditReal(
          row.playerId,
          row.amountUsd.toString(),
          tx,
        );
      } else if (row.type === 'withdraw') {
        snap = await this.balances.debitReal(
          row.playerId,
          row.amountUsd.toString(),
          tx,
        );
      } else {
        throw new BadRequestException('Unknown payment type');
      }

      const ledger = await tx.walletLedger.create({
        data: {
          playerId: row.playerId,
          adminId: agent.sub,
          type:
            row.type === 'deposit'
              ? 'agent_payment_deposit'
              : 'agent_payment_withdraw',
          amount: row.amountUsd,
          balanceAfter: snap.realBalance,
          currency: 'USD',
          note: note ?? `agent ${row.type} #${row.id} approved`,
        },
      });

      const updated = await tx.agentPaymentRequest.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedById: agent.sub,
          reviewerNote: note,
          reviewedAt: new Date(),
          ledgerId: ledger.id,
        },
        include: this.include(),
      });

      await this.audit.log({
        action: 'AgentPaymentApprove',
        adminId: agent.sub,
        playerId: row.playerId,
        request: { paymentId: id, note },
        response: { balance: snap.realBalance, ledgerId: ledger.id },
      });

      return {
        payment: this.serialize(updated),
        balance: snap,
        ledgerId: ledger.id,
        audience: [row.masterId, row.requesterId],
      };
    });

    this.events.emitPayment(result.audience, 'approved');
    return {
      payment: result.payment,
      balance: result.balance,
      ledgerId: result.ledgerId,
    };
  }

  async reject(agent: AdminJwtPayload, id: number, note?: string) {
    if (agent.role !== 'master_agent') {
      throw new ForbiddenException('Only master agents can reject');
    }

    const row = await this.prisma.agentPaymentRequest.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Request not found');
    if (row.masterId !== agent.sub) {
      throw new ForbiddenException('Not your sub-agent request');
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const updated = await this.prisma.agentPaymentRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        reviewedById: agent.sub,
        reviewerNote: note,
        reviewedAt: new Date(),
      },
      include: this.include(),
    });

    await this.audit.log({
      action: 'AgentPaymentReject',
      adminId: agent.sub,
      playerId: row.playerId,
      request: { paymentId: id, note },
      response: { ok: true },
    });

    this.events.emitPayment([row.masterId, row.requesterId], 'rejected');
    return this.serialize(updated);
  }

  async cancel(agent: AdminJwtPayload, id: number) {
    if (agent.role !== 'sub_agent') {
      throw new ForbiddenException('Only the requesting sub-agent can cancel');
    }

    const row = await this.prisma.agentPaymentRequest.findUnique({
      where: { id },
    });
    if (!row) throw new NotFoundException('Request not found');
    if (row.requesterId !== agent.sub) {
      throw new ForbiddenException('Not your request');
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const updated = await this.prisma.agentPaymentRequest.update({
      where: { id },
      data: { status: 'cancelled' },
      include: this.include(),
    });

    await this.audit.log({
      action: 'AgentPaymentCancel',
      adminId: agent.sub,
      playerId: row.playerId,
      request: { paymentId: id },
      response: { ok: true },
    });

    this.events.emitPayment([row.masterId, row.requesterId], 'cancelled');
    return this.serialize(updated);
  }

  private include() {
    return {
      player: { select: { id: true, username: true, nickname: true } },
      requester: {
        select: { id: true, username: true, displayName: true },
      },
    } as const;
  }

  private serialize(
    row: {
      id: number;
      requesterId: number;
      masterId: number;
      playerId: number;
      type: string;
      status: string;
      amountMmk: Prisma.Decimal | string;
      amountUsd: Prisma.Decimal | string;
      rateUsed: Prisma.Decimal | string;
      method: string | null;
      reference: string | null;
      requesterNote: string | null;
      reviewerNote: string | null;
      reviewedById: number | null;
      reviewedAt: Date | null;
      ledgerId: number | null;
      createdAt: Date;
      updatedAt?: Date;
      player?: { id: number; username: string; nickname: string };
      requester?: { id: number; username: string; displayName: string };
    },
  ) {
    return {
      id: row.id,
      requesterId: row.requesterId,
      masterId: row.masterId,
      playerId: row.playerId,
      type: row.type,
      status: row.status,
      amountMmk: row.amountMmk.toString(),
      amountUsd: row.amountUsd.toString(),
      rateUsed: row.rateUsed.toString(),
      method: row.method,
      reference: row.reference,
      requesterNote: row.requesterNote,
      reviewerNote: row.reviewerNote,
      reviewedById: row.reviewedById,
      reviewedAt: row.reviewedAt,
      ledgerId: row.ledgerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      player: row.player,
      requester: row.requester,
    };
  }
}
