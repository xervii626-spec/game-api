import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';
import { AuditService } from '../audit/audit.service';
import { SettingsService } from '../settings/settings.service';
import { AgentScopeService } from './agent-scope.service';
import { CreateSubAgentDto } from './dto/create-sub-agent.dto';
import { CreateAgentPlayerDto } from './dto/create-agent-player.dto';
import { CreateMasterAgentDto } from './dto/create-master-agent.dto';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';
import { BigWinService } from '../big-win/big-win.service';
import { formatMoney, toDecimal } from '../common/utils/money.util';

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: AgentScopeService,
    private readonly balances: WalletBalanceService,
    private readonly audit: AuditService,
    private readonly settings: SettingsService,
    private readonly bigWins: BigWinService,
  ) {}

  // ─── Platform admin: master agents ─────────────────────────

  async createMasterAgent(dto: CreateMasterAgentDto) {
    const username = dto.username.trim();
    const exists = await this.prisma.adminUser.findUnique({
      where: { username },
    });
    if (exists) throw new ConflictException('Username already exists');

    const row = await this.prisma.adminUser.create({
      data: {
        username,
        displayName: dto.displayName.trim(),
        role: 'master_agent',
        passwordHash: await bcrypt.hash(dto.password, 10),
        parentId: null,
      },
    });

    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      isActive: row.isActive,
      createdAt: row.createdAt,
    };
  }

  async listMasterAgents() {
    const rows = await this.prisma.adminUser.findMany({
      where: { role: 'master_agent' },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { children: true, players: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.displayName,
        role: r.role,
        isActive: r.isActive,
        createdAt: r.createdAt,
        subAgentCount: r._count.children,
        directPlayerCount: r._count.players,
      })),
    };
  }

  async setMasterActive(id: number, isActive: boolean) {
    const row = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!row || row.role !== 'master_agent') {
      throw new NotFoundException('Master agent not found');
    }
    const updated = await this.prisma.adminUser.update({
      where: { id },
      data: { isActive },
    });
    return {
      id: updated.id,
      username: updated.username,
      isActive: updated.isActive,
    };
  }

  // ─── Master: sub-agents ────────────────────────────────────

  async createSubAgent(master: AdminJwtPayload, dto: CreateSubAgentDto) {
    if (master.role !== 'master_agent') {
      throw new ForbiddenException('Only master agents can create sub-agents');
    }
    const username = dto.username.trim();
    const exists = await this.prisma.adminUser.findUnique({
      where: { username },
    });
    if (exists) throw new ConflictException('Username already exists');

    const row = await this.prisma.adminUser.create({
      data: {
        username,
        displayName: dto.displayName.trim(),
        role: 'sub_agent',
        parentId: master.sub,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });

    await this.audit.log({
      action: 'AgentCreateSub',
      adminId: master.sub,
      request: { username, displayName: dto.displayName },
      response: { id: row.id },
    });

    return {
      id: row.id,
      username: row.username,
      displayName: row.displayName,
      role: row.role,
      parentId: row.parentId,
      isActive: row.isActive,
    };
  }

  async listSubAgents(master: AdminJwtPayload) {
    if (master.role !== 'master_agent') {
      throw new ForbiddenException('Only master agents can list sub-agents');
    }
    const rows = await this.prisma.adminUser.findMany({
      where: { parentId: master.sub, role: 'sub_agent' },
      orderBy: { id: 'desc' },
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { players: true } },
      },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        username: r.username,
        displayName: r.displayName,
        role: r.role,
        isActive: r.isActive,
        createdAt: r.createdAt,
        playerCount: r._count.players,
      })),
    };
  }

  // ─── Agents: players ───────────────────────────────────────

  async createPlayer(agent: AdminJwtPayload, dto: CreateAgentPlayerDto) {
    if (agent.role !== 'master_agent' && agent.role !== 'sub_agent') {
      throw new ForbiddenException('Agents only');
    }
    const username = dto.username.trim();
    const nickname = dto.nickname.trim();
    const taken = await this.prisma.player.findFirst({
      where: { OR: [{ username }, { nickname }] },
    });
    if (taken) {
      throw new ConflictException('Username or nickname already exists');
    }

    const player = await this.prisma.player.create({
      data: {
        username,
        nickname,
        passwordHash: await bcrypt.hash(dto.password, 10),
        currency: 'USD',
        country: dto.country?.toUpperCase() ?? null,
        agentId: agent.sub,
        wallet: { create: { realBalance: new Prisma.Decimal(0) } },
      },
      include: { wallet: true },
    });

    await this.audit.log({
      action: 'AgentCreatePlayer',
      adminId: agent.sub,
      playerId: player.id,
      request: { username, nickname },
      response: { id: player.id },
    });

    return this.serializePlayer(player);
  }

  async listPlayers(agent: AdminJwtPayload, page = 1, limit = 50) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const agentIds =
      agent.role === 'master_agent'
        ? await this.scope.agentIdsInTree(agent.sub)
        : [agent.sub];

    const where = { agentId: { in: agentIds } };
    const [items, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        skip,
        take,
        orderBy: { id: 'desc' },
        include: { wallet: true },
      }),
      this.prisma.player.count({ where }),
    ]);

    return {
      page,
      limit: take,
      total,
      items: items.map((p) => this.serializePlayer(p)),
    };
  }

  async adjustPlayerBalance(
    agent: AdminJwtPayload,
    playerId: number,
    direction: 'credit' | 'debit',
    amount: string,
    note?: string,
  ) {
    const owned = await this.scope.assertPlayerOwned(
      agent.sub,
      agent.role,
      playerId,
    );
    if (!owned) throw new ForbiddenException('Player not in your downline');

    const value = toDecimal(amount);
    if (value.lte(0)) {
      throw new BadRequestException('Amount must be greater than 0');
    }

    const snap =
      direction === 'credit'
        ? await this.balances.creditReal(playerId, amount)
        : await this.balances.debitReal(playerId, amount);

    await this.prisma.walletLedger.create({
      data: {
        playerId,
        adminId: agent.sub,
        type: direction === 'credit' ? 'agent_credit' : 'agent_debit',
        amount: new Prisma.Decimal(formatMoney(value)),
        balanceAfter: new Prisma.Decimal(snap.realBalance),
        currency: 'USD',
        note: note ?? `agent ${direction}`,
      },
    });

    await this.audit.log({
      action: direction === 'credit' ? 'AgentCredit' : 'AgentDebit',
      adminId: agent.sub,
      playerId,
      request: { amount, note },
      response: { balance: snap.realBalance },
    });

    return { playerId, direction, amount: formatMoney(value), balance: snap };
  }

  // ─── Win / Lose dashboard ──────────────────────────────────

  async winLoseSummary(agent: AdminJwtPayload) {
    const playerIds = await this.scope.playerIdsForAgent(
      agent.sub,
      agent.role,
    );
    const mmkPerUsd = await this.settings.getMmkPerUsd();

    if (playerIds.length === 0) {
      return {
        playerCount: 0,
        totalBetUsd: '0',
        totalWinUsd: '0',
        totalBetMmk: '0.00',
        totalWinMmk: '0.00',
        netUsd: '0',
        netMmk: '0.00',
        mmkPerUsd,
      };
    }

    const [betAgg, winAgg] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: {
          playerId: { in: playerIds },
          direction: 'withdraw',
          status: { not: 'rolled_back' },
        },
        _sum: { amount: true },
      }),
      this.prisma.transaction.aggregate({
        where: {
          playerId: { in: playerIds },
          direction: 'deposit',
          status: { not: 'rolled_back' },
        },
        _sum: { amount: true },
      }),
    ]);

    const totalBetUsd = (betAgg._sum.amount ?? new Prisma.Decimal(0)).toString();
    const totalWinUsd = (winAgg._sum.amount ?? new Prisma.Decimal(0)).toString();
    const net = toDecimal(totalWinUsd).minus(toDecimal(totalBetUsd));

    return {
      playerCount: playerIds.length,
      totalBetUsd,
      totalWinUsd,
      totalBetMmk: this.settings.usdToMmk(totalBetUsd, mmkPerUsd),
      totalWinMmk: this.settings.usdToMmk(totalWinUsd, mmkPerUsd),
      netUsd: formatMoney(net),
      netMmk: this.settings.usdToMmk(formatMoney(net), mmkPerUsd),
      mmkPerUsd,
    };
  }

  async winLoseActivity(
    agent: AdminJwtPayload,
    page = 1,
    limit = 20,
  ) {
    const playerIds = await this.scope.playerIdsForAgent(
      agent.sub,
      agent.role,
    );
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const mmkPerUsd = await this.settings.getMmkPerUsd();

    if (playerIds.length === 0) {
      return { page, limit: take, total: 0, mmkPerUsd, items: [] };
    }

    const where: Prisma.TransactionWhereInput = {
      playerId: { in: playerIds },
      direction: { in: ['withdraw', 'deposit'] },
    };

    const [rows, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          player: { select: { id: true, username: true, nickname: true } },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      page,
      limit: take,
      total,
      mmkPerUsd,
      items: rows.map((t) => {
        const amountUsd = t.amount.toString();
        const kind = t.direction === 'withdraw' ? 'Lose' : 'Win';
        return {
          id: t.id,
          createdAt: t.createdAt.toISOString(),
          playerId: t.playerId,
          username: t.player.username,
          nickname: t.player.nickname,
          kind,
          amountUsd,
          amountMmk: this.settings.usdToMmk(amountUsd, mmkPerUsd),
          gameId: t.gameId,
          status: t.status,
        };
      }),
    };
  }

  async listBigWins(agent: AdminJwtPayload, limit = 30) {
    const agentIds =
      agent.role === 'master_agent'
        ? await this.scope.agentIdsInTree(agent.sub)
        : [agent.sub];
    return this.bigWins.listForAgentIds(agentIds, limit);
  }

  private serializePlayer(p: {
    id: number;
    username: string;
    nickname: string;
    currency: string;
    country: string | null;
    isBlocked: boolean;
    agentId: number | null;
    createdAt: Date;
    wallet: {
      realBalance: Prisma.Decimal;
      bonusMoney: Prisma.Decimal;
    } | null;
  }) {
    return {
      id: p.id,
      username: p.username,
      nickname: p.nickname,
      currency: p.currency,
      country: p.country,
      isBlocked: p.isBlocked,
      agentId: p.agentId,
      createdAt: p.createdAt,
      wallet: p.wallet
        ? {
            realBalance: p.wallet.realBalance.toString(),
            bonusMoney: p.wallet.bonusMoney.toString(),
          }
        : null,
    };
  }
}
