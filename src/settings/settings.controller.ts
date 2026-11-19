import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  /** Public — login screens fetch Register → Telegram URL */
  @Get('public')
  publicSettings() {
    return this.settings.getPublicSettings();
  }
}
