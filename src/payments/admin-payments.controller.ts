import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { ReviewPaymentDto } from './dto/review-payment.dto';
import { SetRateDto } from './dto/set-rate.dto';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../admin/admin-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';

@ApiTags('admin-payments')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Controller('admin/payments')
export class AdminPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('rate')
  getRate() {
    return this.payments.getRate();
  }

  @Roles('admin')
  @Put('rate')
  setRate(@CurrentAdmin() admin: AdminJwtPayload, @Body() dto: SetRateDto) {
    return this.payments.setRate(admin.sub, dto.mmkPerUsd);
  }

  @Get()
  list(
    @Query('status') status?: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payments.list({
      status,
      type,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.payments.getOne(id);
  }

  @Roles('admin')
  @Post(':id/approve')
  approve(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() dto: ReviewPaymentDto,
  ) {
    return this.payments.approve(id, admin.sub, dto.adminNote);
  }

  @Roles('admin')
  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentAdmin() admin: AdminJwtPayload,
    @Body() dto: ReviewPaymentDto,
  ) {
    return this.payments.reject(id, admin.sub, dto.adminNote);
  }
}
