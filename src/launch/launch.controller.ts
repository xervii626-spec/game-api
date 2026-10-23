import { Controller, Get } from '@nestjs/common';
import { LaunchService } from './launch.service';

@Controller('launch')
export class LaunchController {
  constructor(private readonly launchService: LaunchService) {}

  @Get('health')
  health() {
    return this.launchService.health();
  }
}
