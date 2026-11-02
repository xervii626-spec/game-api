import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { AdminPaymentsController } from './admin-payments.controller';
import { PaymentsService } from './payments.service';
import { SettingsModule } from '../settings/settings.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { AdminRolesGuard } from '../admin/admin-roles.guard';

@Module({
  imports: [SettingsModule, WalletModule, AuditModule, AuthModule],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [PaymentsService, AdminRolesGuard],
  exports: [PaymentsService],
})
export class PaymentsModule {}

