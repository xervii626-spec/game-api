import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlayerWalletService } from './player-wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator';

@ApiTags('player-wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('player/wallet')
export class PlayerWalletController {
  constructor(private readonly wallet: PlayerWalletService) {}

  @Get('balance')
  balance(@CurrentUser() user: JwtPayload) {
    return this.wallet.getBalance(user.sub);
  }

  @Get('transactions')
  transactions(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wallet.getTransactions(
      user.sub,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('ledger')
  ledger(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.wallet.getLedger(
      user.sub,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }
}
