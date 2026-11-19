import { Controller, Get, Query, Sse } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { BigWinService } from './big-win.service';

@ApiTags('big-wins')
@Controller('big-wins')
export class BigWinController {
  constructor(private readonly bigWins: BigWinService) {}

  @Get('recent')
  recent(@Query('limit') limit?: string) {
    return this.bigWins.listRecent(limit ? Number(limit) : 20);
  }

  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.bigWins.stream();
  }
}
