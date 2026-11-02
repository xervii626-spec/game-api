import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class AdjustBalanceDto {
  @IsIn(['credit', 'debit'])
  direction!: 'credit' | 'debit';

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'amount must be a positive number (max 4 decimals)',
  })
  amount!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
