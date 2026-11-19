import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AgentAuthService } from './agent-auth.service';
import { AgentLoginDto } from './dto/agent-login.dto';
import { AgentRefreshDto } from './dto/agent-refresh.dto';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AgentRolesGuard } from './agent-roles.guard';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';

@ApiTags('agent-auth')
@Controller('agent/auth')
export class AgentAuthController {
  constructor(private readonly auth: AgentAuthService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  login(@Body() dto: AgentLoginDto) {
    return this.auth.login(dto);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  refresh(@Body() dto: AgentRefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AgentRolesGuard)
  @Get('me')
  me(@CurrentAdmin() agent: AdminJwtPayload) {
    return this.auth.me(agent);
  }

  @ApiBearerAuth()
  @UseGuards(AdminJwtAuthGuard, AgentRolesGuard)
  @Post('logout')
  logout(@CurrentAdmin() agent: AdminJwtPayload) {
    return this.auth.logout(agent);
  }
}
