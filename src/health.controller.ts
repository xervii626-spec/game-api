import { Controller, Get } from '@nestjs/common';

@Controller()
export class HealthController {
  @Get()
  root() {
    return {
      status: 'ok',
      service: 'game-api',
      docs: '/docs',
      wallet: {
        authenticate: 'POST /wallet/authenticate',
        getBalance: 'POST /wallet/get-balance',
        withdraw: 'POST /wallet/withdraw',
        deposit: 'POST /wallet/deposit',
        rollback: 'POST /wallet/rollback',
      },
    };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
