import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { SessionsService } from '../sessions/sessions.service';
import { AuditService } from '../audit/audit.service';
import { WalletBalanceService } from './wallet-balance.service';
import { AuthenticateDto } from './dto/authenticate.dto';
import { GetBalanceDto } from './dto/get-balance.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { DepositDto } from './dto/deposit.dto';
import { WithdrawAndDepositDto } from './dto/withdraw-and-deposit.dto';
import { RollbackDto } from './dto/rollback.dto';
import { RgsError, rgsFail, rgsOk } from './rgs-response';
import { RgsCurrencyService } from './rgs-currency';
import { toDecimal } from '../common/utils/money.util';

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sessions: SessionsService,
    private readonly balances: WalletBalanceService,
    private readonly audit: AuditService,
    private readonly rgsFx: RgsCurrencyService,
  ) {}

  private operatorOk(operatorId: number): boolean {
    const expected = this.config.get<number>('operatorId') ?? 0;
    if (!expected) return true; // not configured yet
    return operatorId === expected;
  }

  private async auditSafe(
    action: string,
    playerId: number | undefined,
    request: unknown,
    response: unknown,
  ) {
    try {
      await this.audit.log({ action, playerId, request, response });
    } catch {
      // never fail RGS call because audit failed
    }
  }

  // ─── Authenticate ───────────────────────────────────────────
  async authenticate(dto: AuthenticateDto) {
    if (!this.operatorOk(dto.OperatorId)) {
      const res = rgsFail(RgsError.GENERAL_ERROR, 'Wrong OperatorId');
      await this.auditSafe('Authenticate', undefined, dto, res);
      return res;
    }

    try {
      let playerId: number | null = null;
      let sessionToken = dto.Token;

      if (dto.Token) {
        const session = await this.sessions.findValidSession(dto.Token);
        if (!session) {
          const res = rgsFail(RgsError.INVALID_TOKEN, 'Invalid Token');
          await this.auditSafe('Authenticate', undefined, dto, res);
          return res;
        }
        playerId = session.playerId;
        sessionToken = session.token;
      } else if (dto.UserName && dto.Password) {
        const player = await this.prisma.player.findUnique({
          where: { username: dto.UserName },
        });
        if (!player?.passwordHash) {
          const res = rgsFail(RgsError.INVALID_TOKEN, 'Invalid credentials');
          await this.auditSafe('Authenticate', undefined, dto, res);
          return res;
        }
        const ok = await bcrypt.compare(dto.Password, player.passwordHash);
        if (!ok) {
          const res = rgsFail(RgsError.INVALID_TOKEN, 'Invalid credentials');
          await this.auditSafe('Authenticate', player.id, dto, res);
          return res;
        }
        playerId = player.id;
        const session = await this.sessions.create(player.id);
        sessionToken = session.token;
      } else {
        const res = rgsFail(RgsError.INVALID_TOKEN, 'Token or UserName/Password required');
        await this.auditSafe('Authenticate', undefined, dto, res);
        return res;
      }

      const player = await this.prisma.player.findUnique({
        where: { id: playerId },
        include: { wallet: true },
      });
      if (!player) {
        const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id');
        await this.auditSafe('Authenticate', playerId, dto, res);
        return res;
      }
      if (player.isBlocked) {
        const res = rgsFail(RgsError.PLAYER_BLOCKED, 'Player Is Blocked');
        await this.auditSafe('Authenticate', player.id, dto, res);
        return res;
      }

      const snap = player.wallet
        ? this.balances.toSnapshot(player.wallet)
        : await this.balances.getSnapshot(player.id);

      const res = rgsOk({
        OperatorId: dto.OperatorId,
        Name: player.nickname,
        NickName: player.nickname,
        UserName: player.username,
        Token: sessionToken!,
        TotalBalance: await this.rgsFx.toRgsAmount(snap.totalBalance),
        Gender: player.gender ?? false,
        // Provider: game UI shows this currency (MMK when RGS_DISPLAY_CURRENCY=MMK)
        Currency: this.rgsFx.displayCurrency(),
        Country: player.country ?? '',
        PlayerId: player.id,
        UserIP: '',
      });
      await this.auditSafe('Authenticate', player.id, dto, res);
      return res;
    } catch (e) {
      const res = rgsFail(
        RgsError.GENERAL_ERROR,
        e instanceof Error ? e.message : 'General Error',
      );
      await this.auditSafe('Authenticate', undefined, dto, res);
      return res;
    }
  }

  // ─── GetBalance ─────────────────────────────────────────────
  async getBalance(dto: GetBalanceDto) {
    if (!this.operatorOk(dto.OperatorId)) {
      return rgsFail(RgsError.GENERAL_ERROR, 'Wrong OperatorId');
    }

    const session = await this.sessions.findValidSession(dto.Token);
    if (!session) {
      const res = rgsFail(RgsError.INVALID_TOKEN, 'Invalid Token', {
        PlayerId: dto.PlayerId,
        Token: dto.Token,
      });
      await this.auditSafe('GetBalance', dto.PlayerId, dto, res);
      return res;
    }
    if (session.playerId !== dto.PlayerId) {
      const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('GetBalance', dto.PlayerId, dto, res);
      return res;
    }

    const player = await this.prisma.player.findUnique({
      where: { id: dto.PlayerId },
    });
    if (!player) {
      const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('GetBalance', dto.PlayerId, dto, res);
      return res;
    }
    if (player.isBlocked) {
      const res = rgsFail(RgsError.PLAYER_BLOCKED, 'Player Is Blocked');
      await this.auditSafe('GetBalance', dto.PlayerId, dto, res);
      return res;
    }

    try {
      const snap = await this.balances.getSnapshot(dto.PlayerId);
      const res = rgsOk({
        PlayerId: dto.PlayerId,
        TotalBalance: await this.rgsFx.toRgsAmount(snap.totalBalance),
        BonusWin: await this.rgsFx.toRgsAmount(snap.bonusWin),
        BonusMoney: await this.rgsFx.toRgsAmount(snap.bonusMoney),
        FrozenMoney: await this.rgsFx.toRgsAmount(snap.frozenMoney),
        Token: dto.Token,
      });
      await this.auditSafe('GetBalance', dto.PlayerId, dto, res);
      return res;
    } catch (e) {
      const res = rgsFail(
        RgsError.GENERAL_ERROR,
        e instanceof Error ? e.message : 'General Error',
      );
      await this.auditSafe('GetBalance', dto.PlayerId, dto, res);
      return res;
    }
  }

  // ─── Withdraw (Bet) ─────────────────────────────────────────
  async withdraw(dto: WithdrawDto) {
    if (!this.operatorOk(dto.OperatorId)) {
      return rgsFail(RgsError.GENERAL_ERROR, 'Wrong OperatorId');
    }

    const session = await this.sessions.findValidSession(dto.Token);
    if (!session) {
      const res = rgsFail(RgsError.INVALID_TOKEN, 'Invalid Token', {
        PlatformTransactionId: 0,
        PlayerId: dto.PlayerId,
        Token: dto.Token,
      });
      await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
      return res;
    }
    if (session.playerId !== dto.PlayerId) {
      const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
      return res;
    }

    const player = await this.prisma.player.findUnique({
      where: { id: dto.PlayerId },
    });
    if (!player) {
      const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
      return res;
    }
    if (player.isBlocked) {
      const res = rgsFail(RgsError.PLAYER_BLOCKED, 'Player Is Blocked');
      await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
      return res;
    }
    if (!this.rgsFx.accepts(dto.Currency, player.currency)) {
      const res = rgsFail(RgsError.WRONG_AMOUNT, 'Wrong Transaction Amount', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
      return res;
    }
    if (dto.WithdrawAmount < 0) {
      const res = rgsFail(RgsError.WRONG_AMOUNT, 'Wrong Transaction Amount', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
      return res;
    }

    const amountUsd = await this.rgsFx.toWalletUsd(
      dto.WithdrawAmount,
      dto.Currency,
      player.currency,
    );
    const rgsId = BigInt(dto.RGSTransactionId);
    const bonusMode = dto.BonusDefId != null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.transaction.findUnique({
          where: { rgsTransactionId: rgsId },
        });
        if (existing) {
          return {
            kind: 'dup' as const,
          };
        }

        const snap = bonusMode
          ? await this.balances.debitBonusWallets(dto.PlayerId, amountUsd, tx)
          : await this.balances.debitReal(dto.PlayerId, amountUsd, tx);

        const created = await tx.transaction.create({
          data: {
            playerId: dto.PlayerId,
            rgsTransactionId: rgsId,
            typeId: dto.TypeId,
            direction: 'withdraw',
            amount: new Prisma.Decimal(amountUsd),
            currency: player.currency,
            gameId: dto.GameId,
            bonusDefId: dto.BonusDefId ?? null,
            status: 'completed',
          },
        });

        await tx.transaction.update({
          where: { id: created.id },
          data: { platformTransactionId: BigInt(created.id) },
        });

        return {
          kind: 'ok' as const,
          snap,
          platformTransactionId: created.id,
        };
      });

      if (result.kind === 'dup') {
        const res = rgsFail(
          RgsError.TRANSACTION_ALREADY_COMPLETE,
          'Transaction Already Complete',
          { PlayerId: dto.PlayerId, Token: dto.Token },
        );
        await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
        return res;
      }

      const total = this.balances.resolveTotal(result.snap, bonusMode);
      const res = rgsOk({
        PlayerId: dto.PlayerId,
        Token: dto.Token,
        TotalBalance: await this.rgsFx.toRgsAmount(total),
        PlatformTransactionId: Number(result.platformTransactionId),
      });
      await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
      return res;
    } catch (e) {
      if (this.isNotEnough(e)) {
        // Test tool expected shape: Token "" / PlayerId 0 on insufficient funds
        const res = rgsFail(RgsError.NOT_ENOUGH_BALANCE, 'Not Enough Balance', {
          PlatformTransactionId: 0,
          PlayerId: 0,
          Token: '',
        });
        await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
        return res;
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const res = rgsFail(
          RgsError.TRANSACTION_ALREADY_COMPLETE,
          'Transaction Already Complete',
          { PlayerId: dto.PlayerId, Token: dto.Token },
        );
        await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
        return res;
      }
      const res = rgsFail(
        RgsError.GENERAL_ERROR,
        e instanceof Error ? e.message : 'General Error',
      );
      await this.auditSafe('Withdraw', dto.PlayerId, dto, res);
      return res;
    }
  }

  // ─── Deposit (Win) ──────────────────────────────────────────
  async deposit(dto: DepositDto) {
    if (!this.operatorOk(dto.OperatorId)) {
      return rgsFail(RgsError.GENERAL_ERROR, 'Wrong OperatorId');
    }

    // Docs: process even with expired token — only check token exists
    const session = await this.sessions.findExistingSession(dto.Token);
    if (!session) {
      const res = rgsFail(RgsError.INVALID_TOKEN, 'Invalid Token', {
        PlatformTransactionId: 0,
        PlayerId: dto.PlayerId,
        Token: dto.Token,
      });
      await this.auditSafe('Deposit', dto.PlayerId, dto, res);
      return res;
    }
    if (session.playerId !== dto.PlayerId) {
      const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('Deposit', dto.PlayerId, dto, res);
      return res;
    }

    const player = await this.prisma.player.findUnique({
      where: { id: dto.PlayerId },
    });
    if (!player) {
      const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('Deposit', dto.PlayerId, dto, res);
      return res;
    }
    if (!this.rgsFx.accepts(dto.Currency, player.currency)) {
      const res = rgsFail(RgsError.WRONG_AMOUNT, 'Wrong Transaction Amount', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('Deposit', dto.PlayerId, dto, res);
      return res;
    }
    if (dto.DepositAmount < 0) {
      const res = rgsFail(RgsError.WRONG_AMOUNT, 'Wrong Transaction Amount', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('Deposit', dto.PlayerId, dto, res);
      return res;
    }

    const amountUsd = await this.rgsFx.toWalletUsd(
      dto.DepositAmount,
      dto.Currency,
      player.currency,
    );
    const rgsId = BigInt(dto.RGSTransactionId);
    const bonusMode = dto.BonusDefId != null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.transaction.findUnique({
          where: { rgsTransactionId: rgsId },
        });
        if (existing) {
          return { kind: 'dup' as const };
        }

        const snap = bonusMode
          ? await this.balances.creditBonusWin(dto.PlayerId, amountUsd, tx)
          : await this.balances.creditReal(dto.PlayerId, amountUsd, tx);

        const created = await tx.transaction.create({
          data: {
            playerId: dto.PlayerId,
            rgsTransactionId: rgsId,
            rgsRelatedTransactionId:
              dto.RGSRelatedTransactionId != null
                ? BigInt(dto.RGSRelatedTransactionId)
                : null,
            typeId: dto.TypeId,
            direction: 'deposit',
            amount: new Prisma.Decimal(amountUsd),
            currency: player.currency,
            gameId: dto.GameId ?? null,
            bonusDefId: dto.BonusDefId ?? null,
            status: 'completed',
          },
        });

        await tx.transaction.update({
          where: { id: created.id },
          data: { platformTransactionId: BigInt(created.id) },
        });

        return {
          kind: 'ok' as const,
          snap,
          platformTransactionId: created.id,
        };
      });

      if (result.kind === 'dup') {
        const res = rgsFail(
          RgsError.DEPOSIT_ALREADY_RECEIVED,
          'The Deposit Transaction Already Received',
          { PlayerId: dto.PlayerId, Token: dto.Token },
        );
        await this.auditSafe('Deposit', dto.PlayerId, dto, res);
        return res;
      }

      const total = this.balances.resolveTotal(result.snap, bonusMode);
      const res = rgsOk({
        PlayerId: dto.PlayerId,
        Token: dto.Token,
        TotalBalance: await this.rgsFx.toRgsAmount(total),
        PlatformTransactionId: Number(result.platformTransactionId),
      });
      await this.auditSafe('Deposit', dto.PlayerId, dto, res);
      return res;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const res = rgsFail(
          RgsError.DEPOSIT_ALREADY_RECEIVED,
          'The Deposit Transaction Already Received',
          { PlayerId: dto.PlayerId, Token: dto.Token },
        );
        await this.auditSafe('Deposit', dto.PlayerId, dto, res);
        return res;
      }
      const res = rgsFail(
        RgsError.GENERAL_ERROR,
        e instanceof Error ? e.message : 'General Error',
      );
      await this.auditSafe('Deposit', dto.PlayerId, dto, res);
      return res;
    }
  }

  // ─── WithdrawAndDeposit (bet + win in one call) ─────────────
  async withdrawAndDeposit(dto: WithdrawAndDepositDto) {
    if (!this.operatorOk(dto.OperatorId)) {
      return rgsFail(RgsError.GENERAL_ERROR, 'Wrong OperatorId');
    }

    const session = await this.sessions.findValidSession(dto.Token);
    if (!session) {
      const res = rgsFail(RgsError.INVALID_TOKEN, 'Invalid Token', {
        PlatformTransactionId: 0,
        PlayerId: dto.PlayerId,
        Token: dto.Token,
      });
      await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
      return res;
    }
    if (session.playerId !== dto.PlayerId) {
      const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
      return res;
    }

    const player = await this.prisma.player.findUnique({
      where: { id: dto.PlayerId },
    });
    if (!player) {
      const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
      return res;
    }
    if (player.isBlocked) {
      const res = rgsFail(RgsError.PLAYER_BLOCKED, 'Player Is Blocked');
      await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
      return res;
    }
    if (!this.rgsFx.accepts(dto.Currency, player.currency)) {
      const res = rgsFail(RgsError.WRONG_AMOUNT, 'Wrong Transaction Amount', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
      return res;
    }
    if (dto.WithdrawAmount < 0 || dto.DepositAmount < 0) {
      const res = rgsFail(RgsError.WRONG_AMOUNT, 'Wrong Transaction Amount', {
        PlatformTransactionId: 0,
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
      return res;
    }

    const withdrawUsd = await this.rgsFx.toWalletUsd(
      dto.WithdrawAmount,
      dto.Currency,
      player.currency,
    );
    const depositUsd = await this.rgsFx.toWalletUsd(
      dto.DepositAmount,
      dto.Currency,
      player.currency,
    );
    const rgsId = BigInt(dto.RGSTransactionId);
    const bonusMode = dto.BonusDefId != null;

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.transaction.findUnique({
          where: { rgsTransactionId: rgsId },
        });
        if (existing) {
          return { kind: 'dup' as const };
        }

        // Store as withdraw + linked deposit so Rollback can reverse both
        // (same pattern as separate Withdraw then Deposit).
        if (bonusMode) {
          await this.balances.debitBonusWallets(dto.PlayerId, withdrawUsd, tx);
          const snap = await this.balances.creditBonusWin(
            dto.PlayerId,
            depositUsd,
            tx,
          );
          const withdrawTx = await tx.transaction.create({
            data: {
              playerId: dto.PlayerId,
              rgsTransactionId: rgsId,
              typeId: dto.TypeId,
              direction: 'withdraw',
              amount: new Prisma.Decimal(withdrawUsd),
              currency: player.currency,
              gameId: dto.GameId,
              bonusDefId: dto.BonusDefId ?? null,
              status: 'completed',
            },
          });
          await tx.transaction.update({
            where: { id: withdrawTx.id },
            data: { platformTransactionId: BigInt(withdrawTx.id) },
          });
          if (toDecimal(depositUsd).gt(0)) {
            const depositTx = await tx.transaction.create({
              data: {
                playerId: dto.PlayerId,
                rgsTransactionId: -rgsId,
                rgsRelatedTransactionId: rgsId,
                typeId: dto.TypeId,
                direction: 'deposit',
                amount: new Prisma.Decimal(depositUsd),
                currency: player.currency,
                gameId: dto.GameId,
                bonusDefId: dto.BonusDefId ?? null,
                status: 'completed',
              },
            });
            await tx.transaction.update({
              where: { id: depositTx.id },
              data: { platformTransactionId: BigInt(depositTx.id) },
            });
          }
          return {
            kind: 'ok' as const,
            snap,
            platformTransactionId: withdrawTx.id,
          };
        }

        await this.balances.debitReal(dto.PlayerId, withdrawUsd, tx);
        const snap = await this.balances.creditReal(dto.PlayerId, depositUsd, tx);
        const withdrawTx = await tx.transaction.create({
          data: {
            playerId: dto.PlayerId,
            rgsTransactionId: rgsId,
            typeId: dto.TypeId,
            direction: 'withdraw',
            amount: new Prisma.Decimal(withdrawUsd),
            currency: player.currency,
            gameId: dto.GameId,
            bonusDefId: null,
            status: 'completed',
          },
        });
        await tx.transaction.update({
          where: { id: withdrawTx.id },
          data: { platformTransactionId: BigInt(withdrawTx.id) },
        });
        if (toDecimal(depositUsd).gt(0)) {
          const depositTx = await tx.transaction.create({
            data: {
              playerId: dto.PlayerId,
              rgsTransactionId: -rgsId,
              rgsRelatedTransactionId: rgsId,
              typeId: dto.TypeId,
              direction: 'deposit',
              amount: new Prisma.Decimal(depositUsd),
              currency: player.currency,
              gameId: dto.GameId,
              bonusDefId: null,
              status: 'completed',
            },
          });
          await tx.transaction.update({
            where: { id: depositTx.id },
            data: { platformTransactionId: BigInt(depositTx.id) },
          });
        }
        return {
          kind: 'ok' as const,
          snap,
          platformTransactionId: withdrawTx.id,
        };
      });

      if (result.kind === 'dup') {
        const res = rgsFail(
          RgsError.TRANSACTION_ALREADY_COMPLETE,
          'Transaction Already Complete',
          { PlayerId: dto.PlayerId, Token: dto.Token },
        );
        await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
        return res;
      }

      const total = this.balances.resolveTotal(result.snap, bonusMode);
      const res = rgsOk({
        PlayerId: dto.PlayerId,
        Token: dto.Token,
        TotalBalance: await this.rgsFx.toRgsAmount(total),
        PlatformTransactionId: Number(result.platformTransactionId),
      });
      await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
      return res;
    } catch (e) {
      if (this.isNotEnough(e)) {
        const res = rgsFail(RgsError.NOT_ENOUGH_BALANCE, 'Not Enough Balance', {
          PlatformTransactionId: 0,
          PlayerId: dto.PlayerId,
          Token: dto.Token,
        });
        await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
        return res;
      }
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const res = rgsFail(
          RgsError.TRANSACTION_ALREADY_COMPLETE,
          'Transaction Already Complete',
          { PlayerId: dto.PlayerId, Token: dto.Token },
        );
        await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
        return res;
      }
      const res = rgsFail(
        RgsError.GENERAL_ERROR,
        e instanceof Error ? e.message : 'General Error',
      );
      await this.auditSafe('WithdrawAndDeposit', dto.PlayerId, dto, res);
      return res;
    }
  }

  // ─── Rollback ───────────────────────────────────────────────
  async rollback(dto: RollbackDto) {
    if (!this.operatorOk(dto.OperatorId)) {
      return rgsFail(RgsError.GENERAL_ERROR, 'Wrong OperatorId');
    }

    // Docs: expired token OK if token exists
    const session = await this.sessions.findExistingSession(dto.Token);
    if (!session) {
      const res = rgsFail(RgsError.INVALID_TOKEN, 'Invalid Token', {
        Token: dto.Token,
      });
      await this.auditSafe('Rollback', dto.PlayerId, dto, res);
      return res;
    }
    if (session.playerId !== dto.PlayerId) {
      const res = rgsFail(RgsError.WRONG_PLAYER_ID, 'Wrong Player Id', {
        PlayerId: 0,
        Token: '',
      });
      await this.auditSafe('Rollback', dto.PlayerId, dto, res);
      return res;
    }

    const rgsId = BigInt(dto.RGSTransactionId);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const original = await tx.transaction.findUnique({
          where: { rgsTransactionId: rgsId },
        });

        if (!original || original.playerId !== dto.PlayerId) {
          return { kind: 'missing' as const };
        }

        // Idempotent success if already rolled back
        if (original.status === 'rolled_back') {
          const snap = await this.balances.getSnapshot(dto.PlayerId, tx);
          return { kind: 'ok' as const, snap, bonusMode: original.bonusDefId != null };
        }

        // Withdraw, WithdrawAndDeposit (legacy single row), or withdraw half of W+D
        const rollable =
          original.direction === 'withdraw' ||
          original.direction === 'withdraw_deposit';
        if (!rollable) {
          return { kind: 'invalid' as const };
        }

        const bonusMode = original.bonusDefId != null;
        const amount = original.amount.toString();

        // Reverse withdraw: put money back
        let snap = bonusMode
          ? await this.balances.creditBonusWin(dto.PlayerId, amount, tx)
          : await this.balances.creditReal(dto.PlayerId, amount, tx);

        // Also reverse related wins (Deposit / W+D companion with same related id)
        const relatedWins = await tx.transaction.findMany({
          where: {
            playerId: dto.PlayerId,
            rgsRelatedTransactionId: rgsId,
            direction: 'deposit',
            status: 'completed',
          },
        });

        for (const win of relatedWins) {
          const winBonus = win.bonusDefId != null;
          snap = winBonus
            ? await this.balances.debitBonusWallets(
                dto.PlayerId,
                win.amount.toString(),
                tx,
              )
            : await this.balances.debitReal(dto.PlayerId, win.amount.toString(), tx);

          await tx.transaction.update({
            where: { id: win.id },
            data: { status: 'rolled_back' },
          });
        }

        await tx.transaction.update({
          where: { id: original.id },
          data: { status: 'rolled_back' },
        });

        return { kind: 'ok' as const, snap, bonusMode };
      });

      if (result.kind === 'missing') {
        const res = rgsFail(RgsError.TRANSACTION_NOT_FOUND, 'Transaction Not Found', {
          Token: dto.Token,
        });
        await this.auditSafe('Rollback', dto.PlayerId, dto, res);
        return res;
      }
      if (result.kind === 'invalid') {
        const res = rgsFail(RgsError.GENERAL_ERROR, 'Only withdraw can be rolled back', {
          Token: dto.Token,
        });
        await this.auditSafe('Rollback', dto.PlayerId, dto, res);
        return res;
      }

      const total = this.balances.resolveTotal(result.snap, result.bonusMode);
      const res = rgsOk({
        TotalBalance: await this.rgsFx.toRgsAmount(total),
        Token: dto.Token,
      });
      await this.auditSafe('Rollback', dto.PlayerId, dto, res);
      return res;
    } catch (e) {
      if (this.isNotEnough(e)) {
        // Win reverse failed (rare) — surface as general/wrong amount
        const res = rgsFail(RgsError.WRONG_AMOUNT, 'Wrong Transaction Amount');
        await this.auditSafe('Rollback', dto.PlayerId, dto, res);
        return res;
      }
      const res = rgsFail(
        RgsError.GENERAL_ERROR,
        e instanceof Error ? e.message : 'General Error',
      );
      await this.auditSafe('Rollback', dto.PlayerId, dto, res);
      return res;
    }
  }

  private isNotEnough(e: unknown): boolean {
    if (e instanceof BadRequestException) {
      const body = e.getResponse();
      if (typeof body === 'object' && body && 'code' in body) {
        return (body as { code: string }).code === 'NOT_ENOUGH_BALANCE';
      }
      return String(e.message).includes('Not enough');
    }
    return false;
  }
}
