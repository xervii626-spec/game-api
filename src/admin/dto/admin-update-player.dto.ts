import {
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
} from 'class-validator';

export class AdminUpdatePlayerDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  password?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string | null;
}
