import { Module } from '@nestjs/common';
import { BigWinService } from './big-win.service';
import { BigWinController } from './big-win.controller';
import { SettingsModule } from '../settings/settings.module';
import { AdminEventsModule } from '../admin-events/admin-events.module';

@Module({
  imports: [SettingsModule, AdminEventsModule],
  controllers: [BigWinController],
  providers: [BigWinService],
  exports: [BigWinService],
})
export class BigWinModule {}
