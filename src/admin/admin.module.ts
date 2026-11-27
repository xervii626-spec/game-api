import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminPlayersController } from './admin-players.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminEventsController } from '../admin-events/admin-events.controller';
import { AdminSseTicketGuard } from '../admin-events/admin-sse-ticket.guard';
import { AdminAuthService } from './admin-auth.service';
import { AdminPlayersService } from './admin-players.service';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { AdminRolesGuard } from './admin-roles.guard';
import { WalletModule } from '../wallet/wallet.module';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { AgentScopeService } from '../agent/agent-scope.service';

@Module({
  imports: [
    WalletModule,
    AuditModule,
    SettingsModule,
    PassportModule.register({ defaultStrategy: 'admin-jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwtSecret') || 'dev_jwt_secret_change_me',
        signOptions: {
          expiresIn: `${config.get<number>('jwtAccessMinutes') ?? 15}m`,
        },
      }),
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminPlayersController,
    AdminTransactionsController,
    AdminDashboardController,
    AdminEventsController,
  ],
  providers: [
    AdminAuthService,
    AdminPlayersService,
    AdminTransactionsService,
    AdminDashboardService,
    AdminJwtStrategy,
    AdminJwtAuthGuard,
    AdminRolesGuard,
    AdminSseTicketGuard,
    AgentScopeService,
  ],
  exports: [
    AdminAuthService,
    AdminJwtStrategy,
    AdminJwtAuthGuard,
    AdminRolesGuard,
    JwtModule,
    PassportModule,
  ],
})
export class AdminModule {}
