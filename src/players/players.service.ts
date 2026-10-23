import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma, Player } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { formatMoney, toDecimal } from '../common/utils/money.util';

export type PlayerWithWallet = Player & {
  wallet: {
    id: number;
    playerId: number;
    realBalance: Prisma.Decimal;
    bonusMoney: Prisma.Decimal;
    frozenMoney: Prisma.Decimal;
    bonusWin: Prisma.Decimal;
  } | null;
};

@Injectable()
export class PlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly walletBalance: WalletBalanceService,
  ) {}

  async create(dto: CreatePlayerDto): Promise<PlayerWithWallet> {
    const existing = await this.prisma.player.findFirst({
      where: {
        OR: [{ username: dto.username }, { nickname: dto.nickname }],
      },
    });
    if (existing) {
      throw new ConflictException('Username or nickname already exists');
    }

    let initial = '0.0000';
    if (dto.initialBalance != null && dto.initialBalance !== '') {
      const parsed = toDecimal(dto.initialBalance);
      if (parsed.lt(0)) {
        throw new BadRequestException('initialBalance cannot be negative');
      }
      initial = formatMoney(parsed);
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, 10)
      : null;

    const player = await this.prisma.player.create({
      data: {
        username: dto.username,
        nickname: dto.nickname,
        passwordHash,
        currency: dto.currency.toUpperCase(),
        country: dto.country?.toUpperCase(),
        gender: dto.gender,
        wallet: {
          create: {
            realBalance: new Prisma.Decimal(initial),
          },
        },
      },
      include: { wallet: true },
    });

    return player;
  }

  async findById(id: number): Promise<PlayerWithWallet> {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: { wallet: true },
    });
    if (!player) {
      throw new NotFoundException(`Player ${id} not found`);
    }
    return player;
  }

  async findByUsername(username: string): Promise<PlayerWithWallet | null> {
    return this.prisma.player.findUnique({
      where: { username },
      include: { wallet: true },
    });
  }

  async setBlocked(playerId: number, isBlocked: boolean): Promise<Player> {
    await this.findById(playerId);
    return this.prisma.player.update({
      where: { id: playerId },
      data: { isBlocked },
    });
  }

  async getBalance(playerId: number) {
    await this.findById(playerId);
    return this.walletBalance.getSnapshot(playerId);
  }

  async creditRealBalance(playerId: number, amount: string) {
    await this.findById(playerId);
    return this.walletBalance.creditReal(playerId, amount);
  }
}
