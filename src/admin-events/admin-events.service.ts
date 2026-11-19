import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { createOpaqueToken, hashToken } from '../common/utils/token-hash.util';

export type AdminRealtimeEvent = {
  type: 'activity' | 'payment' | 'rate' | 'big_win';
  action?: string;
  at: string;
};

type SseTicket = {
  hash: string;
  adminId: number;
  expiresAt: number;
};

@Injectable()
export class AdminEventsService {
  private readonly subject = new Subject<AdminRealtimeEvent>();
  private readonly tickets = new Map<string, SseTicket>();
  private activityTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingActivityAction: string | null = null;

  /** Short-lived one-time-ish ticket for EventSource (no access JWT in URL). */
  issueSseTicket(adminId: number, ttlSec = 60): { ticket: string; expiresAt: string } {
    this.pruneTickets();
    const ticket = createOpaqueToken(32);
    const expiresAtMs = Date.now() + ttlSec * 1000;
    this.tickets.set(hashToken(ticket), {
      hash: hashToken(ticket),
      adminId,
      expiresAt: expiresAtMs,
    });
    return { ticket, expiresAt: new Date(expiresAtMs).toISOString() };
  }

  consumeSseTicket(ticket: string): { adminId: number } | null {
    this.pruneTickets();
    const key = hashToken(ticket);
    const row = this.tickets.get(key);
    if (!row) return null;
    if (row.expiresAt < Date.now()) {
      this.tickets.delete(key);
      return null;
    }
    // Allow reconnects within TTL — do not delete immediately (EventSource retries)
    return { adminId: row.adminId };
  }

  private pruneTickets() {
    const now = Date.now();
    for (const [k, v] of this.tickets) {
      if (v.expiresAt < now) this.tickets.delete(k);
    }
  }

  emit(type: AdminRealtimeEvent['type'], action?: string) {
    this.subject.next({
      type,
      action,
      at: new Date().toISOString(),
    });
  }

  emitActivity(action = 'transaction') {
    this.pendingActivityAction = action;
    if (this.activityTimer) return;
    this.activityTimer = setTimeout(() => {
      const a = this.pendingActivityAction ?? 'transaction';
      this.pendingActivityAction = null;
      this.activityTimer = null;
      this.emit('activity', a);
    }, 1500);
  }

  emitPayment(action = 'payment') {
    this.emit('payment', action);
  }

  emitRate() {
    this.emit('rate', 'rate.updated');
  }

  stream(): Observable<MessageEvent> {
    return this.subject.asObservable().pipe(
      filter(Boolean),
      map(
        (payload) =>
          ({
            data: payload,
          }) as MessageEvent,
      ),
    );
  }
}
