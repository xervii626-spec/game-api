import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateFaqDto {
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  question!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  answer!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}
