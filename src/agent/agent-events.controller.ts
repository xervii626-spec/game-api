import { Controller, Post, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AgentEventsService } from './agent-events.service';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AgentRolesGuard } from './agent-roles.guard';
import { AgentSseTicketGuard } from './agent-sse-ticket.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';

@ApiTags('agent-events')
@Controller('agent')
export class AgentEventsController {
  constructor(private readonly events: AgentEventsService) {}

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AgentRolesGuard)
  @Post('events/ticket')
  ticket(@CurrentAdmin() agent: AdminJwtPayload) {
    return this.events.issueSseTicket(agent.sub);
  }

  @UseGuards(AgentSseTicketGuard)
  @Sse('events')
  stream(@CurrentAdmin() agent: AdminJwtPayload): Observable<MessageEvent> {
    return this.events.streamForAgent(agent.sub);
  }
}
