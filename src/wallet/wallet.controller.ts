import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
 * RGS → Partner wallet callbacks (Phase B)
 * Confirm exact path names with BetConstruct when sharing staging/prod endpoints.
 */
@ApiTags('wallet')
@Controller('wallet')
@UseGuards(IpWhitelistGuard, PublicKeyGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Post('authenticate')
  authenticate(@Body() dto: AuthenticateDto) {
    return this.walletService.authenticate(dto);
  }

  @Post('get-balance')
  getBalance(@Body() dto: GetBalanceDto) {
    return this.walletService.getBalance(dto);
  }

  @Post('withdraw')
  withdraw(@Body() dto: WithdrawDto) {
    return this.walletService.withdraw(dto);
  }

  @Post('deposit')
  deposit(@Body() dto: DepositDto) {
    return this.walletService.deposit(dto);
  }

  @Post('rollback')
  rollback(@Body() dto: RollbackDto) {
    return this.walletService.rollback(dto);
  }
}
