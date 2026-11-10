import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminAuthController } from './admin-auth.controller';
import { AdminPlayersController } from './admin-players.controller';
import { AdminTransactionsController } from './admin-transactions.controller';
import { AdminAuthService } from './admin-auth.service';
import { AdminPlayersService } from './admin-players.service';
import { AdminTransactionsService } from './admin-transactions.service';
import { AdminJwtStrategy } from './admin-jwt.strategy';
import { AdminRolesGuard } from './admin-roles.guard';
import { WalletModule } from '../wallet/wallet.module';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';

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
          expiresIn: `${config.get<number>('jwtExpiresHours') ?? 168}h`,
        },
      }),
    }),
  ],
  controllers: [
    AdminAuthController,
    AdminPlayersController,
    AdminTransactionsController,
  ],
  providers: [
    AdminAuthService,
    AdminPlayersService,
    AdminTransactionsService,
    AdminJwtStrategy,
    AdminRolesGuard,
  ],
})
export class AdminModule {}
