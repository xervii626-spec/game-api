import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

type CacheEntry = { expiresAt: number; data: unknown };

@Injectable()
export class GamesService {
  private readonly logger = new Logger(GamesService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfigService) {}

  health() {
    return { module: 'games', status: 'ok' };
  }

  async getGames(query: Record<string, string | undefined>) {
    const partnerId = String(this.config.get<number>('operatorId') ?? '');
    const base =
      this.config.get<string>('cmsGamesUrl') ??
      'https://www.cmsbetconstruct.com/casino/getGames';

    // CMS getGames often fails (status -1, empty games) when limit is too high.
    const rawLimit = Number(query.limit ?? 30);
    const limit = String(
      Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.trunc(rawLimit), 1), 30)
        : 30,
    );

    const params: Record<string, string> = {
      partner_id: query.partner_id || partnerId,
      offset: query.offset ?? '0',
      limit,
    };
    if (query.category) params.category = query.category;
    if (query.provider) params.Provider = query.provider;
    if (query.search) params.search = query.search;
    if (query.count) params.count = query.count;
    if (query.is_mobile) params.is_mobile = query.is_mobile;
    if (query.game_id) params.game_id = query.game_id;

    const cacheKey = `games:${JSON.stringify(params)}`;
    return this.cached(cacheKey, () => this.fetchJson(base, params));
  }

  async getOptions(query: Record<string, string | undefined>) {
    const partnerId = String(this.config.get<number>('operatorId') ?? '');
    const base =
      this.config.get<string>('cmsOptionsUrl') ??
      'https://www.cmsbetconstruct.com/casino/getOptions';

    const params: Record<string, string> = {
      partner_id: query.partner_id || partnerId,
    };
    if (query.is_mobile) params.is_mobile = query.is_mobile;

    const cacheKey = `options:${JSON.stringify(params)}`;
    return this.cached(cacheKey, () => this.fetchJson(base, params));
  }

  private async cached(key: string, loader: () => Promise<unknown>) {
    const ttl = (this.config.get<number>('gamesCacheTtlSec') ?? 300) * 1000;
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return { cached: true, data: hit.data };
    }
    const data = await loader();
    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
    return { cached: false, data };
  }

  private async fetchJson(url: string, params: Record<string, string>) {
    try {
      const res = await axios.get(url, { params, timeout: 15000 });
      return res.data;
    } catch (e) {
      this.logger.warn(`CMS fetch failed: ${url}`);
      throw e;
    }
  }
}
