import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class LaunchGameDto {
  @IsInt()
  @Min(1)
  gameId!: number;

  @IsIn(['real', 'fun'])
  openType!: 'real' | 'fun';

  @IsOptional()
  @IsString()
  @MaxLength(10)
  language?: string;

  /** 1=web, 2=mobile web, 3=iOS, 4=Android */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  deviceTypeId?: number;

  @IsOptional()
  @IsUrl({ require_tld: false })
  exitUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  depositUrl?: string;
}
