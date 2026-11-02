import { Module } from '@nestjs/common';
import { PlayerWalletController } from './player-wallet.controller';
import { PlayerWalletService } from './player-wallet.service';
import { WalletModule } from '../wallet/wallet.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [WalletModule, AuthModule],
  controllers: [PlayerWalletController],
  providers: [PlayerWalletService],
})
export class PlayerWalletModule {}
