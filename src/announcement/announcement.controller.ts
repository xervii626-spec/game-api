import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnnouncementService } from './announcement.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator';

@ApiTags('announcements')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get('inbox')
  inbox(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    return this.announcements.listInbox(
      user.sub,
      limit ? Number(limit) : 20,
    );
  }

  @Post('read-all')
  readAll(@CurrentUser() user: JwtPayload) {
    return this.announcements.markAllRead(user.sub);
  }

  @Post(':id/read')
  read(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.announcements.markRead(user.sub, id);
  }
}
