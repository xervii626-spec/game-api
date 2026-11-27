import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../admin/admin-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';

@ApiTags('admin-announcements')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Roles('admin')
@Controller('admin/announcements')
export class AdminAnnouncementsController {
  constructor(private readonly announcements: AnnouncementService) {}

  @Get()
  list() {
    return this.announcements.listAdmin();
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.announcements.getAdmin(id);
  }

  @Post()
  create(
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() dto: CreateAnnouncementDto,
  ) {
    return this.announcements.create(dto, admin.sub);
  }
}
