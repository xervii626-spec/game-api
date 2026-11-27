import { Module } from '@nestjs/common';
import { AgentAuthController } from './agent-auth.controller';
import { AgentController } from './agent.controller';
import { AdminAgentsController } from './admin-agents.controller';
import { AgentEventsController } from './agent-events.controller';
import { AgentAuthService } from './agent-auth.service';
import { AgentService } from './agent.service';
import { AgentScopeService } from './agent-scope.service';
import { AgentPaymentsService } from './agent-payments.service';
import { AgentEventsService } from './agent-events.service';
import { AgentRolesGuard } from './agent-roles.guard';
import { AgentSseTicketGuard } from './agent-sse-ticket.guard';
import { AdminModule } from '../admin/admin.module';
import { WalletModule } from '../wallet/wallet.module';
import { AuditModule } from '../audit/audit.module';
import { SettingsModule } from '../settings/settings.module';
import { BigWinModule } from '../big-win/big-win.module';
import { LeaderboardModule } from '../leaderboard/leaderboard.module';

@Module({
  imports: [
    AdminModule,
    WalletModule,
    AuditModule,
    SettingsModule,
    BigWinModule,
    LeaderboardModule,
  ],
  controllers: [
    AgentAuthController,
    AgentController,
    AdminAgentsController,
    AgentEventsController,
  ],
  providers: [
    AgentAuthService,
    AgentService,
    AgentScopeService,
    AgentPaymentsService,
    AgentEventsService,
    AgentRolesGuard,
    AgentSseTicketGuard,
  ],
  exports: [AgentService, AgentScopeService, AgentEventsService],
})
export class AgentModule {}
