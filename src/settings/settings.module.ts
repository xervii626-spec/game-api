import { Module } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { AdminSettingsController } from './admin-settings.controller';
import { AdminRolesGuard } from '../admin/admin-roles.guard';

@Module({
  controllers: [SettingsController, AdminSettingsController],
  providers: [SettingsService, AdminRolesGuard],
  exports: [SettingsService],
})
export class SettingsModule {}
