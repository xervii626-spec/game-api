import { Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SessionsService } from './sessions.service';

@ApiTags('sessions')
@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('player/:playerId')
  createForPlayer(@Param('playerId', ParseIntPipe) playerId: number) {
    return this.sessionsService.create(playerId);
  }

  @Get('token/:token')
  findByToken(@Param('token') token: string) {
    return this.sessionsService.findByTokenOrThrow(token);
  }
}
