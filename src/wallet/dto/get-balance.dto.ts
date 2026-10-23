import { IsInt, IsString, Length, MaxLength } from 'class-validator';

export class GetBalanceDto {
  @IsInt()
  OperatorId!: number;

  @IsInt()
  PlayerId!: number;

  @IsString()
  @MaxLength(50)
  Token!: string;

  @IsString()
  @Length(64, 64)
  PublicKey!: string;
}
