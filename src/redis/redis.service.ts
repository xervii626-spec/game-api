import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis | null = null;

  constructor(private readonly config: ConfigService) {
    const url = this.config.get<string>('redisUrl');
    if (url) {
      this.client = new Redis(url, { maxRetriesPerRequest: 1, lazyConnect: true });
    }
  }

  getClient(): Redis | null {
    return this.client;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
