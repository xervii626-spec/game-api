import { Module } from '@nestjs/common';
import { FaqService } from './faq.service';
import { ChatService } from './chat.service';
import { FaqController } from './faq.controller';
import { ChatController } from './chat.controller';
import { AdminFaqsController } from './admin-faqs.controller';
import { AdminRolesGuard } from '../admin/admin-roles.guard';

@Module({
  controllers: [FaqController, ChatController, AdminFaqsController],
  providers: [FaqService, ChatService, AdminRolesGuard],
  exports: [FaqService, ChatService],
})
export class FaqModule {}
