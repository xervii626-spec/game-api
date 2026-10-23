import { Injectable } from '@nestjs/common';

/** Proxy/cache Provider getGames — implement later */
@Injectable()
export class GamesService {
  health() {
    return { module: 'games', status: 'ok' };
  }
}
