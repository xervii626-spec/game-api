import { Injectable } from '@nestjs/common';

/** Create player launch token + build RGS URL — implement later */
@Injectable()
export class LaunchService {
  health() {
    return { module: 'launch', status: 'ok' };
  }
}
