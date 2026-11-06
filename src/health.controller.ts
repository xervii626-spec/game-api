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
        Authentication: 'POST /wallet/Authentication',
        GetBalance: 'POST /wallet/GetBalance',
        Withdraw: 'POST /wallet/Withdraw',
        Deposit: 'POST /wallet/Deposit',
        Rollback: 'POST /wallet/Rollback',
      },
    };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
