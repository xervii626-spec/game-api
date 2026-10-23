import { Module } from '@nestjs/common';
import { WalletController } from './wallet.controller';
import { WalletService } from './wallet.service';
import { WalletBalanceService } from './wallet-balance.service';
import { AuditModule } from '../audit/audit.module';
import { SessionsModule } from '../sessions/sessions.module';

@Module({
  imports: [AuditModule, SessionsModule],
  controllers: [WalletController],
  providers: [WalletService, WalletBalanceService],
  exports: [WalletService, WalletBalanceService],
})
export class WalletModule {}
