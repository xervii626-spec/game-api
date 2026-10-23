import { IsInt, IsString, Length, MaxLength } from 'class-validator';

export class RollbackDto {
  @IsInt()
  OperatorId!: number;

  @IsInt()
  PlayerId!: number;

  @IsString()
  @MaxLength(50)
  Token!: string;

  @IsInt()
  RGSTransactionId!: number;

  @IsInt()
  GameId!: number;

  @IsString()
  @Length(64, 64)
  PublicKey!: string;
}
