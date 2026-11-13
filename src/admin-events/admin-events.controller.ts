import { Controller, Post, Sse, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { AdminEventsService } from './admin-events.service';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AdminSseTicketGuard } from './admin-sse-ticket.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';

@ApiTags('admin-events')
@Controller('admin')
export class AdminEventsController {
  constructor(private readonly events: AdminEventsService) {}

  /** Bearer access → short ticket for EventSource */
  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @Post('events/ticket')
  ticket(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.events.issueSseTicket(admin.sub);
  }

  /** Live admin push — ?ticket= only (no access_token in URL) */
  @UseGuards(AdminSseTicketGuard)
  @Sse('events')
  stream(): Observable<MessageEvent> {
    return this.events.stream();
  }
}
