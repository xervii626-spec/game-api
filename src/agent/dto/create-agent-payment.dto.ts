import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAgentPaymentDto {
  @IsInt()
  @Min(1)
  playerId!: number;

  @IsIn(['deposit', 'withdraw'])
  type!: 'deposit' | 'withdraw';

  @IsString()
  @MinLength(1)
  @MaxLength(30)
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
  note?: string;
}
