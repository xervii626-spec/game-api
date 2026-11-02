import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminAuthService } from './admin-auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from './admin-jwt.strategy';

@ApiTags('admin-auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @Get('me')
  me(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.auth.me(admin);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard)
  @Post('logout')
  logout(@CurrentAdmin() admin: AdminJwtPayload) {
    return this.auth.logout(admin);
  }
}
