import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChatService } from './chat.service';
import { AskFaqDto } from './dto/ask-faq.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator';

@ApiTags('chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('thread')
  thread(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.chat.listMessages(user.sub, limit ? Number(limit) : 50);
  }

  @Post('faq-ask')
  ask(@CurrentUser() user: JwtPayload, @Body() dto: AskFaqDto) {
    return this.chat.askFaq(user.sub, dto.faqId);
  }
}
