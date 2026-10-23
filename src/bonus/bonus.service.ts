import { Injectable } from '@nestjs/common';

/** Bonus Management API — later / optional */
@Injectable()
export class BonusService {
  health() {
    return { module: 'bonus', status: 'ok' };
  }
}
