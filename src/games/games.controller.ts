import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GamesService } from './games.service';

@ApiTags('games')
@Controller('games')
export class GamesController {
  constructor(private readonly gamesService: GamesService) {}

  @Get('health')
  health() {
    return this.gamesService.health();
  }

  /** Proxy Provider getGames (cached) */
  @Get()
  list(
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('provider') provider?: string,
    @Query('search') search?: string,
    @Query('count') count?: string,
    @Query('is_mobile') is_mobile?: string,
    @Query('game_id') game_id?: string,
  ) {
    return this.gamesService.getGames({
      offset,
      limit,
      category,
      provider,
      search,
      count,
      is_mobile,
      game_id,
    });
  }

  /** Proxy Provider getOptions — categories & providers */
  @Get('options')
  options(@Query('is_mobile') is_mobile?: string) {
    return this.gamesService.getOptions({ is_mobile });
  }
}
