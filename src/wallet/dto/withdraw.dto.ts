import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class WithdrawDto {
  @IsInt()
  OperatorId!: number;

  @IsInt()
  PlayerId!: number;

  @IsString()
  @MaxLength(50)
  Token!: string;

  /** Allow negative — BC "Wrong Amount" test; reject in service with ErrorId 109 */
  @IsNumber()
  WithdrawAmount!: number;

  @IsString()
  @Length(3, 3)
  Currency!: string;

  @IsInt()
  GameId!: number;

  @IsInt()
  RGSTransactionId!: number;

  @IsInt()
  TypeId!: number;

  @IsOptional()
  @IsInt()
  BonusDefId?: number;

  @IsString()
  @Length(64, 64)
  PublicKey!: string;
}
