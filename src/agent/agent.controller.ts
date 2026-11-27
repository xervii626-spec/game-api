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
import { AgentService } from './agent.service';
import { AgentPaymentsService } from './agent-payments.service';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AgentRolesGuard } from './agent-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentAdmin } from '../common/decorators/current-admin.decorator';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';
import { CreateSubAgentDto } from './dto/create-sub-agent.dto';
import { CreateAgentPlayerDto } from './dto/create-agent-player.dto';
import { AgentAdjustBalanceDto } from './dto/agent-adjust-balance.dto';
import { CreateAgentPaymentDto } from './dto/create-agent-payment.dto';
import { ReviewAgentPaymentDto } from './dto/review-agent-payment.dto';

@ApiTags('agent')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AgentRolesGuard)
@Controller('agent')
export class AgentController {
  constructor(
    private readonly agents: AgentService,
    private readonly payments: AgentPaymentsService,
  ) {}

  @Get('dashboard/summary')
  summary(@CurrentAdmin() agent: AdminJwtPayload) {
    return this.agents.winLoseSummary(agent);
  }

  @Get('dashboard/activity')
  activity(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agents.winLoseActivity(
      agent,
      page ? Number(page) : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('big-wins')
  bigWins(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Query('limit') limit?: string,
  ) {
    return this.agents.listBigWins(agent, limit ? Number(limit) : 30);
  }

  @Get('leaderboard')
  leaderboard(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Query('metric') metric?: string,
    @Query('period') period?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agents.listLeaderboard(
      agent,
      (metric as 'win' | 'bet' | 'net' | 'biggest') || 'win',
      (period as 'day' | 'week' | 'all') || 'day',
      limit ? Number(limit) : 50,
    );
  }

  @Roles('master_agent')
  @Get('sub-agents')
  listSubs(@CurrentAdmin() agent: AdminJwtPayload) {
    return this.agents.listSubAgents(agent);
  }

  @Roles('master_agent')
  @Post('sub-agents')
  createSub(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Body() dto: CreateSubAgentDto,
  ) {
    return this.agents.createSubAgent(agent, dto);
  }

  @Get('players')
  listPlayers(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.agents.listPlayers(
      agent,
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  @Post('players')
  createPlayer(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Body() dto: CreateAgentPlayerDto,
  ) {
    return this.agents.createPlayer(agent, dto);
  }

  @Post('players/:id/adjust-balance')
  adjust(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AgentAdjustBalanceDto,
  ) {
    return this.agents.adjustPlayerBalance(
      agent,
      id,
      dto.direction,
      dto.amount,
      dto.note,
    );
  }

  // ─── Sub → Master payments ─────────────────────────────────

  @Get('payments/rate')
  paymentRate() {
    return this.payments.getRate();
  }

  @Get('payments')
  listPayments(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.payments.list(agent, {
      status,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Roles('sub_agent')
  @Post('payments')
  createPayment(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Body() dto: CreateAgentPaymentDto,
  ) {
    return this.payments.create(agent, dto);
  }

  @Roles('master_agent')
  @Post('payments/:id/approve')
  approvePayment(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewAgentPaymentDto,
  ) {
    return this.payments.approve(agent, id, dto.note);
  }

  @Roles('master_agent')
  @Post('payments/:id/reject')
  rejectPayment(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewAgentPaymentDto,
  ) {
    return this.payments.reject(agent, id, dto.note);
  }

  @Roles('sub_agent')
  @Post('payments/:id/cancel')
  cancelPayment(
    @CurrentAdmin() agent: AdminJwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.payments.cancel(agent, id);
  }
}
