import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewAgentPaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
