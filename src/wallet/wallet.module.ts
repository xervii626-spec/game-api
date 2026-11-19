import { Module, forwardRef } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletBalanceService } from './wallet-balance.service';
import { RgsCurrencyService } from './rgs-currency';
import { AuditModule } from '../audit/audit.module';
import { SessionsModule } from '../sessions/sessions.module';
import { SettingsModule } from '../settings/settings.module';
import { QuestModule } from '../quest/quest.module';

@Module({
  imports: [
    AuditModule,
    SessionsModule,
    SettingsModule,
    forwardRef(() => QuestModule),
  ],
  controllers: [WalletController],
  providers: [WalletService, WalletBalanceService, RgsCurrencyService],
  exports: [WalletService, WalletBalanceService],
})
export class WalletModule {}
