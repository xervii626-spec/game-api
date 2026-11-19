import { Module, forwardRef } from '@nestjs/common';
import { QuestService } from './quest.service';
import { QuestProgressService } from './quest-progress.service';
import { QuestController } from './quest.controller';
import { AdminQuestsController } from './admin-quests.controller';
import { WalletModule } from '../wallet/wallet.module';
import { SettingsModule } from '../settings/settings.module';
import { AuditModule } from '../audit/audit.module';
import { AdminRolesGuard } from '../admin/admin-roles.guard';

@Module({
  imports: [forwardRef(() => WalletModule), SettingsModule, AuditModule],
  controllers: [QuestController, AdminQuestsController],
  providers: [QuestService, QuestProgressService, AdminRolesGuard],
  exports: [QuestService, QuestProgressService],
})
export class QuestModule {}
