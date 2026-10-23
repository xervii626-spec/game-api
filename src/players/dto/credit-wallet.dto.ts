import { IsString, Matches } from 'class-validator';

export class CreditWalletDto {
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'amount must be a positive number (max 4 decimals)',
  })
  amount!: string;
}
