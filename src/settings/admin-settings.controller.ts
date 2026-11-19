import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { SetTelegramRegisterDto } from './dto/set-telegram-register.dto';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../admin/admin-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('admin-settings')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Roles('admin')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('telegram-register')
  getTelegram() {
    return this.settings.getPublicSettings();
  }

  @Put('telegram-register')
  setTelegram(@Body() dto: SetTelegramRegisterDto) {
    return this.settings.setTelegramRegisterUrl(dto.telegramRegisterUrl);
  }
}
