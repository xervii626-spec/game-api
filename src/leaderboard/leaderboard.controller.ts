import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { LeaderboardService, LeaderboardMetric } from './leaderboard.service';
import { LeaderboardPeriod } from './leaderboard-period';

@ApiTags('leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly boards: LeaderboardService) {}

  /** Public global board — names masked */
  @Get()
  list(
    @Query('metric') metric?: string,
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ) {
    return this.boards.list({
      metric: (metric as LeaderboardMetric) || 'win',
      period: (period as LeaderboardPeriod) || 'day',
      limit: limit ? Number(limit) : 50,
      maskNames: true,
    });
  }
}
