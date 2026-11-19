import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class SetTelegramRegisterDto {
  /** Full https Telegram invite / channel / chat link */
  @IsString()
  @MinLength(12)
  @MaxLength(300)
  @Matches(/^https:\/\/(t\.me|telegram\.me)\//i, {
    message: 'URL must be an https://t.me/… or https://telegram.me/… link',
  })
  telegramRegisterUrl!: string;
}
