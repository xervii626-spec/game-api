import { Module } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Optional — enable later for session / rate-limit / locks.
 * Not imported in AppModule yet.
 */
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
