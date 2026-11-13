import { Global, Module } from '@nestjs/common';
import { AdminEventsService } from './admin-events.service';

/** Service only — HTTP SSE route lives on AdminModule (JWT strategy). */
@Global()
@Module({
  providers: [AdminEventsService],
  exports: [AdminEventsService],
})
export class AdminEventsModule {}
