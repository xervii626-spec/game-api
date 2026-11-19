import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { BonusService } from './bonus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator';

@ApiTags('bonus')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('bonus')
export class BonusController {
  constructor(private readonly bonus: BonusService) {}

  @Get('daily-login')
  dailyStatus(@CurrentUser() user: JwtPayload) {
    return this.bonus.dailyLoginStatus(user.sub);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('daily-login/claim')
  claimDaily(@CurrentUser() user: JwtPayload) {
    return this.bonus.claimDailyLogin(user.sub);
  }
}
