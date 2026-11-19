import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateQuestDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsIn(['bet_count', 'bet_amount_usd'])
  goalType!: 'bet_count' | 'bet_amount_usd';

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'targetValue must be a positive number (max 4 decimals)',
  })
  targetValue!: string;

  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'rewardUsd must be a positive number (max 4 decimals)',
  })
  rewardUsd!: string;
}
