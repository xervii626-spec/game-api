import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AgentService } from './agent.service';
import { AdminJwtAuthGuard } from '../admin/admin-jwt-auth.guard';
import { AdminRolesGuard } from '../admin/admin-roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CreateMasterAgentDto } from './dto/create-master-agent.dto';

/** Platform admin manages Master Agents. */
@ApiTags('admin-agents')
@ApiBearerAuth()
@UseGuards(AdminJwtAuthGuard, AdminRolesGuard)
@Roles('admin')
@Controller('admin/agents')
export class AdminAgentsController {
  constructor(private readonly agents: AgentService) {}

  @Get()
  list() {
    return this.agents.listMasterAgents();
  }

  @Post()
  create(@Body() dto: CreateMasterAgentDto) {
    return this.agents.createMasterAgent(dto);
  }

  @Patch(':id/activate')
  activate(@Param('id', ParseIntPipe) id: number) {
    return this.agents.setMasterActive(id, true);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.agents.setMasterActive(id, false);
  }
}
