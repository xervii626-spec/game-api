import {
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  username!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(50)
  nickname!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password!: string;

  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/)
  currency!: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
