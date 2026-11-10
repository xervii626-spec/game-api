import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtAuthGuard } from './admin-jwt-auth.guard';
import { AdminRolesGuard } from './admin-roles.guard';
import { AdminTransactionsService } from './admin-transactions.service';

@ApiTags('admin-transactions')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller('admin/transactions')
export class AdminTransactionsController {
  constructor(private readonly transactions: AdminTransactionsService) {}

  @Get()
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('direction') direction?: string,
    @Query('playerId') playerId?: string,
  ) {
    return this.transactions.list({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      direction: direction || undefined,
      playerId: playerId ? Number(playerId) : undefined,
    });
  }
}
