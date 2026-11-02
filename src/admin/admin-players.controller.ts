import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminPlayersService } from './admin-players.service';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { AdminRolesGuard } from './admin-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from './admin-jwt.strategy';
import { AdjustBalanceDto } from './dto/adjust-balance.dto';

@ApiTags('admin-players')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller('admin/players')
export class AdminPlayersController {
  constructor(private readonly players: AdminPlayersService) {}

  @Get()
  list(
    @Query('search') search?: string,
    @Query('blocked') blocked?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.players.list({
      search,
      blocked,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.players.detail(id);
  }

  @Roles('admin')
  @Patch(':id/block')
  block(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.players.setBlocked(id, true, admin.sub);
  }

  @Roles('admin')
  @Patch(':id/unblock')
  unblock(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: AdminJwtPayload,
  ) {
    return this.players.setBlocked(id, false, admin.sub);
  }

  @Roles('admin')
  @Post(':id/adjust-balance')
  adjustBalance(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() dto: AdjustBalanceDto,
  ) {
    return this.players.adjustBalance(id, admin.sub, dto);
  }
}
