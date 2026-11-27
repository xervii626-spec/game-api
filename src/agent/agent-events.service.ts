import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { createOpaqueToken, hashToken } from '../common/utils/token-hash.util';

export type AgentRealtimeEvent = {
  type: 'payment' | 'activity';
  action?: string;
  at: string;
  audienceAgentIds: number[];
};

type SseTicket = {
  hash: string;
  agentId: number;
  expiresAt: number;
};

@Injectable()
export class AgentEventsService {
  private readonly subject = new Subject<AgentRealtimeEvent>();
  private readonly tickets = new Map<string, SseTicket>();

  issueSseTicket(agentId: number, ttlSec = 60): { ticket: string; expiresAt: string } {
    this.pruneTickets();
    const ticket = createOpaqueToken(32);
    const expiresAtMs = Date.now() + ttlSec * 1000;
    this.tickets.set(hashToken(ticket), {
      hash: hashToken(ticket),
      agentId,
      expiresAt: expiresAtMs,
    });
    return { ticket, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  consumeSseTicket(ticket: string): { agentId: number } | null {
    this.pruneTickets();
    const key = hashToken(ticket);
    const row = this.tickets.get(key);
    if (!row) return null;
    if (row.expiresAt < Date.now()) {
      this.tickets.delete(key);
      return null;
    }
    return { agentId: row.agentId };
  }

  private pruneTickets() {
    const now = Date.now();
    for (const [k, v] of this.tickets) {
      if (v.expiresAt < now) this.tickets.delete(k);
    }
  }

  /** Instant payment push to master + requester. */
  emitPayment(audienceAgentIds: number[], action = 'payment') {
    const unique = [...new Set(audienceAgentIds.filter((id) => id > 0))];
    if (!unique.length) return;
    this.subject.next({
      type: 'payment',
      action,
      at: new Date().toISOString(),
      audienceAgentIds: unique,
    });
  }

  streamForAgent(agentId: number): Observable<MessageEvent> {
    return this.subject.asObservable().pipe(
      filter((ev) => ev.audienceAgentIds.includes(agentId)),
      map(
        (payload) =>
          ({
            data: {
              type: payload.type,
              action: payload.action,
              at: payload.at,
            },
          }) as MessageEvent,
      ),
    );
  }
}
