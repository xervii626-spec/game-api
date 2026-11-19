import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { QuestService } from './quest.service';
import { CreateQuestDto } from './dto/create-quest.dto';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../admin/admin-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin-quests')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Roles('admin')
@Controller('admin/quests')
export class AdminQuestsController {
  constructor(private readonly quests: QuestService) {}

  @Get()
  list() {
    return this.quests.listAdmin();
  }

  @Post()
  create(@Body() dto: CreateQuestDto) {
    return this.quests.create(dto);
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.quests.setActive(id, true);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.quests.setActive(id, false);
  }
}
