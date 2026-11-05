import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class AuthenticateDto {
  @IsInt()
  OperatorId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  Token?: string;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  ClientRfid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  UserName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  Password?: string;

  @IsString()
  @Length(64, 64)
  PublicKey!: string;
}
