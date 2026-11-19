import { Module } from '@nestjs/common';
import { AgentAuthController } from './agent-auth.controller';
import { AgentController } from './agent.controller';
import { AdminAgentsController } from './admin-agents.controller';
import { AgentAuthService } from './agent-auth.service';
import { AgentService } from './agent.service';
import { AgentScopeService } from './agent-scope.service';
import { AgentRolesGuard } from './agent-roles.guard';
import { AdminModule } from '../admin/admin.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { BigWinModule } from '../big-win/big-win.module';

@Module({
  imports: [
    AdminModule,
    WalletModule,
    AuditModule,
    SettingsModule,
    BigWinModule,
  ],
  controllers: [
    AgentAuthController,
    AgentController,
    AdminAgentsController,
  ],
  providers: [
    AgentAuthService,
    AgentService,
    AgentScopeService,
    AgentRolesGuard,
  ],
  exports: [AgentService, AgentScopeService],
})
export class AgentModule {}
