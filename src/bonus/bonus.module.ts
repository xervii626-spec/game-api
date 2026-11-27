import { Module } from '@nestjs/common';
import { BonusService } from './bonus.service';
import { DailyLoginCacheService } from './daily-login-cache.service';
import { BonusController } from './bonus.controller';
import { WalletModule } from '../wallet/wallet.module';
import { SettingsModule } from '../settings/settings.module';
import { AuditModule } from '../audit/audit.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [WalletModule, SettingsModule, AuditModule, RedisModule],
  controllers: [BonusController],
  providers: [BonusService, DailyLoginCacheService],
  exports: [BonusService],
})
export class BonusModule {}
