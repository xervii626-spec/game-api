import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

type MemEntry = { claimed: boolean; expiresAt: number };

/**
 * Fast path for daily-login eligibility.
 * Source of truth remains bonus_claims unique (player_id, kind, claim_date).
 * Cache avoids repeat hits on the same Yangon day after we already know the answer.
 */
@Injectable()
export class DailyLoginCacheService {
  private readonly log = new Logger(DailyLoginCacheService.name);
  private readonly mem = new Map<string, MemEntry>();

  constructor(private readonly redis: RedisService) {}

  private key(playerId: number, claimDate: string) {
    return `dl:${playerId}:${claimDate}`;
  }

  /** Seconds until ~end of Yangon calendar day (UTC approx via claimDate + 1 day). */
  private ttlSec(claimDate: string): number {
    // claimDate is YYYY-MM-DD Yangon; expire after ~36h to be safe across TZ edges
    return 36 * 60 * 60;
  }

  async getClaimed(
    playerId: number,
    claimDate: string,
  ): Promise<boolean | null> {
    const k = this.key(playerId, claimDate);
    const now = Date.now();
    const local = this.mem.get(k);
    if (local && local.expiresAt > now) return local.claimed;

    const client = this.redis.getClient();
    if (client) {
      try {
        if (client.status !== 'ready') await client.connect().catch(() => null);
        const v = await client.get(k);
        if (v === '1' || v === '0') {
          const claimed = v === '1';
          this.mem.set(k, {
            claimed,
            expiresAt: now + this.ttlSec(claimDate) * 1000,
          });
          return claimed;
        }
      } catch (e) {
        this.log.debug(
          `Redis get skipped: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    return null;
  }

  async setClaimed(
    playerId: number,
    claimDate: string,
    claimed: boolean,
  ): Promise<void> {
    const k = this.key(playerId, claimDate);
    const ttl = this.ttlSec(claimDate);
    this.mem.set(k, {
      claimed,
      expiresAt: Date.now() + ttl * 1000,
    });

    const client = this.redis.getClient();
    if (client) {
      try {
        if (client.status !== 'ready') await client.connect().catch(() => null);
        await client.set(k, claimed ? '1' : '0', 'EX', ttl);
      } catch (e) {
        this.log.debug(
          `Redis set skipped: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
}
