import { Module } from '@nestjs/common';
import { AnnouncementService } from './announcement.service';
import { AnnouncementWorkerService } from './announcement-worker.service';
import { AnnouncementController } from './announcement.controller';
import { AdminAnnouncementsController } from './admin-announcements.controller';
import { AdminRolesGuard } from '../admin/admin-roles.guard';

@Module({
  controllers: [AnnouncementController, AdminAnnouncementsController],
  providers: [
    AnnouncementService,
    AnnouncementWorkerService,
    AdminRolesGuard,
  ],
  exports: [AnnouncementService],
})
export class AnnouncementModule {}
