import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';
import { AuditService } from '../audit/audit.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { toDecimal } from '../common/utils/money.util';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly balances: WalletBalanceService,
    private readonly audit: AuditService,
  ) {}

  async getRate() {
    const mmkPerUsd = await this.settings.getMmkPerUsd();
    return {
      mmkPerUsd,
      walletCurrency: 'USD',
      displayCurrency: 'MMK',
      example: {
        mmk: '45000',
        usd: this.settings.mmkToUsd('45000', mmkPerUsd),
      },
    };
  }

  async createDeposit(playerId: number, dto: CreatePaymentDto) {
    return this.createRequest(playerId, 'deposit', dto);
  }

  async createWithdraw(playerId: number, dto: CreatePaymentDto) {
    const rate = await this.settings.getMmkPerUsd();
    const amountUsd = this.settings.mmkToUsd(dto.amountMmk, rate);
    if (toDecimal(amountUsd).lte(0)) {
      throw new BadRequestException('Converted USD amount must be > 0');
    }

    const snap = await this.balances.getSnapshot(playerId);
    if (toDecimal(snap.realBalance).lt(toDecimal(amountUsd))) {
      throw new BadRequestException({
        code: 'NOT_ENOUGH_BALANCE',
        message: 'Not enough USD balance for this withdraw request',
        requiredUsd: amountUsd,
        balanceUsd: snap.realBalance,
      });
    }

    return this.createRequest(playerId, 'withdraw', dto, rate, amountUsd);
  }

  private async createRequest(
    playerId: number,
    type: 'deposit' | 'withdraw',
    dto: CreatePaymentDto,
    rate?: string,
    amountUsd?: string,
  ) {
    const player = await this.prisma.player.findUnique({ where: { id: playerId } });
    if (!player) throw new NotFoundException('Player not found');
    if (player.isBlocked) {
      throw new BadRequestException('Player is blocked');
    }

    if (toDecimal(dto.amountMmk).lte(0)) {
      throw new BadRequestException('amountMmk must be greater than 0');
    }

    const rateUsed = rate ?? (await this.settings.getMmkPerUsd());
    const usd =
      amountUsd ?? this.settings.mmkToUsd(dto.amountMmk, rateUsed);

    if (toDecimal(usd).lte(0)) {
      throw new BadRequestException('Converted USD amount must be > 0');
    }

    const row = await this.prisma.paymentRequest.create({
      data: {
        playerId,
        type,
        status: 'pending',
        amountMmk: dto.amountMmk,
        amountUsd: usd,
        rateUsed,
        method: dto.method,
        reference: dto.reference,
        playerNote: dto.playerNote,
      },
    });

    await this.audit.log({
      action: type === 'deposit' ? 'PaymentDepositRequest' : 'PaymentWithdrawRequest',
      playerId,
      request: dto,
      response: { id: row.id, amountUsd: usd, rateUsed },
    });

    return this.serialize(row);
  }

  async listMine(playerId: number, page = 1, limit = 20) {
    return this.list({ playerId, page, limit });
  }

  async list(params: {
    playerId?: number;
    status?: string;
    type?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: Prisma.PaymentRequestWhereInput = {};
    if (params.playerId) where.playerId = params.playerId;
    if (params.status) where.status = params.status;
    if (params.type) where.type = params.type;

    const [items, total] = await Promise.all([
      this.prisma.paymentRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          player: { select: { id: true, username: true, nickname: true } },
        },
      }),
      this.prisma.paymentRequest.count({ where }),
    ]);

    return {
      page,
      limit,
      total,
      items: items.map((r) => this.serialize(r)),
    };
  }

  async getOne(id: number, playerId?: number) {
    const row = await this.prisma.paymentRequest.findUnique({
      where: { id },
      include: {
        player: { select: { id: true, username: true, nickname: true } },
      },
    });
    if (!row) throw new NotFoundException('Payment request not found');
    if (playerId != null && row.playerId !== playerId) {
      throw new NotFoundException('Payment request not found');
    }
    return this.serialize(row);
  }

  async cancelMine(playerId: number, id: number) {
    const row = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!row || row.playerId !== playerId) {
      throw new NotFoundException('Payment request not found');
    }
    if (row.status !== 'pending') {
      throw new BadRequestException('Only pending requests can be cancelled');
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    });
    return this.serialize(updated);
  }

  async approve(id: number, adminId: number, adminNote?: string) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: number; status: string }[]>`
        SELECT id, status FROM payment_requests WHERE id = ${id} FOR UPDATE
      `;
      const locked = rows[0];
      if (!locked) throw new NotFoundException('Payment request not found');
      if (locked.status !== 'pending') {
        throw new BadRequestException('Request is not pending');
      }

      const row = await tx.paymentRequest.findUnique({ where: { id } });
      if (!row) throw new NotFoundException('Payment request not found');

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
          adminId,
          type:
            row.type === 'deposit' ? 'payment_deposit' : 'payment_withdraw',
          amount: row.amountUsd,
          balanceAfter: snap.realBalance,
          currency: 'USD',
          note: adminNote ?? `${row.type} #${row.id} approved`,
        },
      });

      const updated = await tx.paymentRequest.update({
        where: { id },
        data: {
          status: 'approved',
          adminId,
          adminNote,
          reviewedAt: new Date(),
          ledgerId: ledger.id,
        },
        include: {
          player: { select: { id: true, username: true, nickname: true } },
        },
      });

      await this.audit.log({
        action: 'PaymentApprove',
        playerId: row.playerId,
        adminId,
        request: { paymentId: id, adminNote },
        response: { balance: snap.realBalance, ledgerId: ledger.id },
      });

      return {
        payment: this.serialize(updated),
        balance: snap,
        ledgerId: ledger.id,
      };
    });
  }

  async reject(id: number, adminId: number, adminNote?: string) {
    const row = await this.prisma.paymentRequest.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Payment request not found');
    if (row.status !== 'pending') {
      throw new BadRequestException('Request is not pending');
    }

    const updated = await this.prisma.paymentRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        adminId,
        adminNote,
        reviewedAt: new Date(),
      },
      include: {
        player: { select: { id: true, username: true, nickname: true } },
      },
    });

    await this.audit.log({
      action: 'PaymentReject',
      playerId: row.playerId,
      adminId,
      request: { paymentId: id, adminNote },
      response: { ok: true },
    });

    return this.serialize(updated);
  }

  async setRate(adminId: number, mmkPerUsd: string) {
    try {
      const result = await this.settings.setMmkPerUsd(mmkPerUsd);
      await this.audit.log({
        action: 'SetFxRate',
        adminId,
        request: { mmkPerUsd },
        response: result,
      });
      return result;
    } catch {
      throw new BadRequestException('mmkPerUsd must be a positive number');
    }
  }

  private serialize(
    row: {
      id: number;
      playerId: number;
      type: string;
      status: string;
      amountMmk: Prisma.Decimal | string;
      amountUsd: Prisma.Decimal | string;
      rateUsed: Prisma.Decimal | string;
      method: string | null;
      reference: string | null;
      playerNote: string | null;
      adminId: number | null;
      adminNote: string | null;
      reviewedAt: Date | null;
      ledgerId: number | null;
      createdAt: Date;
      updatedAt?: Date;
      player?: { id: number; username: string; nickname: string };
    },
  ) {
    return {
      id: row.id,
      playerId: row.playerId,
      type: row.type,
      status: row.status,
      amountMmk: row.amountMmk.toString(),
      amountUsd: row.amountUsd.toString(),
      rateUsed: row.rateUsed.toString(),
      method: row.method,
      reference: row.reference,
      playerNote: row.playerNote,
      adminId: row.adminId,
      adminNote: row.adminNote,
      reviewedAt: row.reviewedAt,
      ledgerId: row.ledgerId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      player: row.player,
    };
  }
}
