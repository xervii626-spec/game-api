import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { QuestService } from './quest.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator';

@ApiTags('quests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('quests')
export class QuestController {
  constructor(private readonly quests: QuestService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.quests.listForPlayer(user.sub);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/claim')
  claim(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.quests.claim(user.sub, id);
  }
}
