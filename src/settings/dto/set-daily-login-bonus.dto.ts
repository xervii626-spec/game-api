import { IsString, Matches } from 'class-validator';

export class SetDailyLoginBonusDto {
  /** USD credited to bonusMoney (play-only) */
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'Amount must be a positive USD value (max 4 decimals)',
  })
  dailyLoginBonusUsd!: string;
}
