import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LaunchService } from './launch.service';
import { LaunchGameDto } from './dto/launch-game.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator';

@ApiTags('launch')
@Controller('launch')
export class LaunchController {
  constructor(private readonly launchService: LaunchService) {}

  @Get('health')
  health() {
    return this.launchService.health();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('game')
  launch(@CurrentUser() user: JwtPayload, @Body() dto: LaunchGameDto) {
    return this.launchService.launch(user.sub, dto);
  }
}
