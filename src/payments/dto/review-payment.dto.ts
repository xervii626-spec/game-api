import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  adminNote?: string;
}
