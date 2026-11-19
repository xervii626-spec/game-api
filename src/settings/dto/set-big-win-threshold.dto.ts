import { IsString, Matches } from 'class-validator';

export class SetBigWinThresholdDto {
  /** MMK amount — wins at/above this show on the public ticker */
  @IsString()
  @Matches(/^\d+(\.\d{1,2})?$/, {
    message: 'Threshold must be a positive MMK amount (max 2 decimals)',
  })
  bigWinThresholdMmk!: string;
}
