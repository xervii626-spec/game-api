import { IsInt, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class AuthenticateDto {
  @IsInt()
  OperatorId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  Token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  ClientRfid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  UserName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  Password?: string;

  @IsString()
  @Length(64, 64)
  PublicKey!: string;
}
