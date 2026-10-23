import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlayersModule } from './players/players.module';
import { WalletModule } from './wallet/wallet.module';
import { GamesModule } from './games/games.module';
import { LaunchModule } from './launch/launch.module';
import { BonusModule } from './bonus/bonus.module';
import { AuditModule } from './audit/audit.module';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    PrismaModule,
    AuthModule,
    PlayersModule,
    SessionsModule,
    WalletModule,
    GamesModule,
    LaunchModule,
    BonusModule,
    AuditModule,
  ],
})
export class AppModule {}
