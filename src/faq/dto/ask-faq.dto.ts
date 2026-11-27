import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class AskFaqDto {
  @Type(() => Number)
  @IsInt()
  faqId!: number;
}
