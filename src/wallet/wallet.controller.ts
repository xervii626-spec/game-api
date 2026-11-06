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
 *
 * BetConstruct test tool EndPoint is the BASE only (no method name).
 * It appends /Authentication, /GetBalance, … itself.
 *
 * Support both:
 * - EndPoint = https://host          → POST /Authentication
 * - EndPoint = https://host/wallet   → POST /wallet/Authentication
 */
@ApiTags('wallet')
@Controller()
@UseGuards(IpWhitelistGuard, PublicKeyGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post([
    'Authentication',
    'authenticate',
    'wallet/Authentication',
    'wallet/authenticate',
  ])
  @HttpCode(200)
  authenticate(@Body() dto: AuthenticateDto) {
    return this.walletService.authenticate(dto);
  }

  @Post([
    'GetBalance',
    'get-balance',
    'getBalance',
    'wallet/GetBalance',
    'wallet/get-balance',
    'wallet/getBalance',
  ])
  @HttpCode(200)
  getBalance(@Body() dto: GetBalanceDto) {
    return this.walletService.getBalance(dto);
  }

  @Post([
    'Withdraw',
    'withdraw',
    'wallet/Withdraw',
    'wallet/withdraw',
  ])
  @HttpCode(200)
  withdraw(@Body() dto: WithdrawDto) {
    return this.walletService.withdraw(dto);
  }

  @Post([
    'Deposit',
    'deposit',
    'wallet/Deposit',
    'wallet/deposit',
  ])
  @HttpCode(200)
  deposit(@Body() dto: DepositDto) {
    return this.walletService.deposit(dto);
  }

  @Post([
    'Rollback',
    'rollback',
    'wallet/Rollback',
    'wallet/rollback',
  ])
  @HttpCode(200)
  rollback(@Body() dto: RollbackDto) {
    return this.walletService.rollback(dto);
  }
}
