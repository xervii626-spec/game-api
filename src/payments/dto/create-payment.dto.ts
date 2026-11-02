import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreatePaymentDto {
  /** MMK amount player pays (deposit) or wants to receive (withdraw) */
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'amountMmk must be a positive number (max 2 decimals)',
  })
  amountMmk!: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  playerNote?: string;
}
