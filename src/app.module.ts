import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlayersModule } from './players/players.module';
import { WalletModule } from './wallet/wallet.module';
import { GamesModule } from './games/games.module';
import { LaunchModule } from './launch/launch.module';
import { BonusModule } from './bonus/bonus.module';
import { QuestModule } from './quest/quest.module';
import { BigWinModule } from './big-win/big-win.module';
import { AuditModule } from './audit/audit.module';
import { SessionsModule } from './sessions/sessions.module';
import { PlayerWalletModule } from './player-wallet/player-wallet.module';
import { AdminModule } from './admin/admin.module';
import { AdminEventsModule } from './admin-events/admin-events.module';
import { AgentModule } from './agent/agent.module';
import { SettingsModule } from './settings/settings.module';
import { PaymentsModule } from './payments/payments.module';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
      {
        name: 'auth',
        ttl: 60_000,
        limit: 20,
      },
    ]),
    PrismaModule,
    AdminEventsModule,
    AuthModule,
    PlayersModule,
    SessionsModule,
    WalletModule,
    PlayerWalletModule,
    GamesModule,
    LaunchModule,
    BonusModule,
    QuestModule,
    BigWinModule,
    AuditModule,
    SettingsModule,
    PaymentsModule,
    AdminModule,
    AgentModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}

