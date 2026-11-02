import { IsString, Matches } from 'class-validator';

export class SetRateDto {
  /** MMK per 1 USD */
  @IsString()
  @Matches(/^\d+(\.\d{1,4})?$/, {
    message: 'mmkPerUsd must be a positive number (max 4 decimals)',
  })
  mmkPerUsd!: string;
}
