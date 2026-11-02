import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  CurrentUser,
  JwtPayload,
} from '../common/decorators/current-user.decorator';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /** Current MMK↔USD rate (public for UI) */
  @Get('rate')
  getRate() {
    return this.payments.getRate();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('deposit')
  deposit(@CurrentUser() user: JwtPayload, @Body() dto: CreatePaymentDto) {
    return this.payments.createDeposit(user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('withdraw')
  withdraw(@CurrentUser() user: JwtPayload, @Body() dto: CreatePaymentDto) {
    return this.payments.createWithdraw(user.sub, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  listMine(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payments.listMine(
      user.sub,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/:id')
  getMine(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.payments.getOne(id, user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('me/:id/cancel')
  cancelMine(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.payments.cancelMine(user.sub, id);
  }
}
