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
        Authentication: 'POST /Authentication or /wallet/Authentication',
        GetBalance: 'POST /GetBalance or /wallet/GetBalance',
        Withdraw: 'POST /Withdraw or /wallet/Withdraw',
        Deposit: 'POST /Deposit or /wallet/Deposit',
        WithdrawAndDeposit:
          'POST /WithdrawAndDeposit or /wallet/WithdrawAndDeposit',
        Rollback: 'POST /Rollback or /wallet/Rollback',
      },
      rgsEndPointHint:
        'Test tool EndPoint = https://<host> OR https://<host>/wallet (no method name)',
    };
  }

  @Get('health')
  health() {
    return { status: 'ok' };
  }
}
