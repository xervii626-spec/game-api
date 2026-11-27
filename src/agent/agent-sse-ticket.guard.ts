import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AgentEventsService } from './agent-events.service';

/** SSE routes: authenticate via short-lived ?ticket= (not access JWT). */
@Injectable()
export class AgentSseTicketGuard implements CanActivate {
  constructor(private readonly events: AgentEventsService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<
      Request & { user?: { sub: number; username?: string; role?: string } }
    >();
    const raw = req.query?.ticket;
    const ticket = Array.isArray(raw) ? raw[0] : raw;
    if (typeof ticket !== 'string' || !ticket.trim()) {
      throw new UnauthorizedException('SSE ticket required');
    }
    const ok = this.events.consumeSseTicket(ticket.trim());
    if (!ok) {
      throw new UnauthorizedException('Invalid or expired SSE ticket');
    }
    req.user = { sub: ok.agentId };
    return true;
  }
}
