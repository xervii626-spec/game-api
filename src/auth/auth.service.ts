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
import {
  createOpaqueToken,
  hashToken,
} from '../common/utils/token-hash.util';

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
    });

    const auth = await this.issueTokenPair(player.id, player.username);
    return {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresAt: auth.expiresAt,
      refreshExpiresAt: auth.refreshExpiresAt,
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

    const auth = await this.issueTokenPair(player.id, player.username);
    return {
      accessToken: auth.accessToken,
      refreshToken: auth.refreshToken,
      expiresAt: auth.expiresAt,
      refreshExpiresAt: auth.refreshExpiresAt,
      player: this.sanitizePlayer(player),
    };
  }

  async refresh(refreshToken: string) {
    const hash = hashToken(refreshToken);
    const session = await this.prisma.authSession.findFirst({
      where: { refreshTokenHash: hash, isActive: true },
      include: { player: true },
    });

    if (!session?.refreshExpiresAt) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (session.refreshExpiresAt.getTime() < Date.now()) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { isActive: false, refreshTokenHash: null },
      });
      throw new UnauthorizedException('Refresh token expired');
    }
    if (session.player.isBlocked) {
      await this.prisma.authSession.update({
        where: { id: session.id },
        data: { isActive: false, refreshTokenHash: null },
      });
      throw new UnauthorizedException('Player is blocked');
    }

    // Rotate: invalidate current refresh immediately
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { isActive: false, refreshTokenHash: null },
    });

    return this.issueTokenPair(session.playerId, session.player.username);
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
      data: { isActive: false, refreshTokenHash: null },
    });
    return { success: true };
  }

  private accessMinutes() {
    const m = Number(this.config.get('jwtAccessMinutes') ?? 15);
    if (m <= 0) throw new BadRequestException('Invalid JWT access expiry');
    return m;
  }

  private refreshDays() {
    const d = Number(this.config.get('jwtRefreshDays') ?? 7);
    if (d <= 0) throw new BadRequestException('Invalid JWT refresh expiry');
    return d;
  }

  private async issueTokenPair(playerId: number, username: string) {
    const accessMin = this.accessMinutes();
    const refreshDay = this.refreshDays();
    const jti = randomBytes(24).toString('hex');
    const refreshToken = createOpaqueToken();
    const refreshTokenHash = hashToken(refreshToken);
    const refreshExpiresAt = new Date(
      Date.now() + refreshDay * 24 * 60 * 60 * 1000,
    );
    const accessExpiresAt = new Date(Date.now() + accessMin * 60 * 1000);

    await this.prisma.authSession.create({
      data: {
        playerId,
        jti,
        isActive: true,
        expiresAt: refreshExpiresAt,
        refreshTokenHash,
        refreshExpiresAt,
      },
    });

    const payload: JwtPayload = { sub: playerId, username, jti };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: `${accessMin}m`,
    });

    return {
      accessToken,
      refreshToken,
      expiresAt: accessExpiresAt,
      refreshExpiresAt,
    };
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
