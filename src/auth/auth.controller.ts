import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';

/** Player site auth — implement login later */
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('health')
  health() {
    return this.authService.health();
  }
}
