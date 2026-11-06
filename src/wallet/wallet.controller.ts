import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IpWhitelistGuard } from '../common/guards/ip-whitelist.guard';
import { PublicKeyGuard } from '../common/guards/public-key.guard';
import { WalletService } from './wallet.service';
import { AuthenticateDto } from './dto/authenticate.dto';
import { GetBalanceDto } from './dto/get-balance.dto';
import { WithdrawDto } from './dto/withdraw.dto';
import { DepositDto } from './dto/deposit.dto';
import { RollbackDto } from './dto/rollback.dto';

/**
 * RGS → Partner wallet callbacks.
 * Primary paths match Casino Integration API method names (PascalCase),
 * e.g. POST /wallet/Authentication — as required by BetConstruct.
 * Lowercase aliases kept for older clients/docs.
 */
@ApiTags('wallet')
@Controller('wallet')
@UseGuards(IpWhitelistGuard, PublicKeyGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post(['Authentication', 'authenticate'])
  @HttpCode(200)
  authenticate(@Body() dto: AuthenticateDto) {
    return this.walletService.authenticate(dto);
  }

  @Post(['GetBalance', 'get-balance', 'getBalance'])
  @HttpCode(200)
  getBalance(@Body() dto: GetBalanceDto) {
    return this.walletService.getBalance(dto);
  }

  @Post(['Withdraw', 'withdraw'])
  @HttpCode(200)
  withdraw(@Body() dto: WithdrawDto) {
    return this.walletService.withdraw(dto);
  }

  @Post(['Deposit', 'deposit'])
  @HttpCode(200)
  deposit(@Body() dto: DepositDto) {
    return this.walletService.deposit(dto);
  }

  @Post(['Rollback', 'rollback'])
  @HttpCode(200)
  rollback(@Body() dto: RollbackDto) {
    return this.walletService.rollback(dto);
  }
}
