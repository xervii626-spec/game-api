import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PlayersService } from '../players/players.service';
import { PrismaService } from '../prisma/prisma.service';
import { WalletBalanceService } from '../wallet/wallet-balance.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from '../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly players: PlayersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly balances: WalletBalanceService,
  ) {}

  health() {
    return { module: 'auth', status: 'ok' };
  }

  async register(dto: RegisterDto) {
    const player = await this.players.create({
      username: dto.username,
      nickname: dto.nickname,
      password: dto.password,
      currency: dto.currency.toUpperCase(),
      country: dto.country?.toUpperCase(),
      // public register: no free balance
    });

    const auth = await this.issueToken(player.id, player.username);
    return {
      accessToken: auth.accessToken,
      expiresAt: auth.expiresAt,
      player: this.sanitizePlayer(player),
    };
  }

  async login(dto: LoginDto) {
    const player = await this.players.findByUsername(dto.username);
    if (!player?.passwordHash) {
      throw new UnauthorizedException('Invalid username or password');
    }
    if (player.isBlocked) {
      throw new UnauthorizedException('Player is blocked');
    }

    const ok = await bcrypt.compare(dto.password, player.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const auth = await this.issueToken(player.id, player.username);
    return {
      accessToken: auth.accessToken,
      expiresAt: auth.expiresAt,
      player: this.sanitizePlayer(player),
    };
  }

  async me(user: JwtPayload) {
    const player = await this.players.findById(user.sub);
    const balance = await this.balances.getSnapshot(user.sub);
    return {
      player: this.sanitizePlayer(player),
      balance,
    };
  }

  async logout(user: JwtPayload) {
    await this.prisma.authSession.updateMany({
      where: { jti: user.jti, isActive: true },
      data: { isActive: false },
    });
    return { success: true };
  }

  private async issueToken(playerId: number, username: string) {
    const expiresHours = Number(this.config.get('jwtExpiresHours') ?? 168); // 7 days
    if (expiresHours <= 0) {
      throw new BadRequestException('Invalid JWT expiry config');
    }

    const jti = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

    await this.prisma.authSession.create({
      data: {
        playerId,
        jti,
        isActive: true,
        expiresAt,
      },
    });

    const payload: JwtPayload = { sub: playerId, username, jti };
    const accessToken = await this.jwt.signAsync(payload);

    return { accessToken, expiresAt };
  }

  private sanitizePlayer(player: {
    id: number;
    username: string;
    nickname: string;
    currency: string;
    country: string | null;
    gender: boolean | null;
    isBlocked: boolean;
    passwordHash?: string | null;
    wallet?: unknown;
    createdAt?: Date;
  }) {
    return {
      id: player.id,
      username: player.username,
      nickname: player.nickname,
      currency: player.currency,
      country: player.country,
      gender: player.gender,
      isBlocked: player.isBlocked,
      wallet: player.wallet ?? undefined,
      createdAt: player.createdAt,
    };
  }
}
