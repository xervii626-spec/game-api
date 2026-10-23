import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { CreditWalletDto } from './dto/credit-wallet.dto';

/**
 * Phase A internal/dev APIs — not RGS callbacks.
 * Protect or remove in production later.
 */
@ApiTags('players')
@Controller('players')
export class PlayersController {
  constructor(private readonly playersService: PlayersService) {}

  @Post()
  create(@Body() dto: CreatePlayerDto) {
    return this.playersService.create(dto);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.playersService.findById(id);
  }

  @Get(':id/balance')
  getBalance(@Param('id', ParseIntPipe) id: number) {
    return this.playersService.getBalance(id);
  }

  @Post(':id/credit')
  credit(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreditWalletDto,
  ) {
    return this.playersService.creditRealBalance(id, dto.amount);
  }

  @Patch(':id/block')
  block(@Param('id', ParseIntPipe) id: number) {
    return this.playersService.setBlocked(id, true);
  }

  @Patch(':id/unblock')
  unblock(@Param('id', ParseIntPipe) id: number) {
    return this.playersService.setBlocked(id, false);
  }
}
