import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { AdminJwtPayload } from '../admin/admin-jwt.strategy';

/** Default: master_agent | sub_agent. Use @Roles(...) to narrow. */
@Injectable()
export class AgentRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const allowed = required?.length
      ? required
      : ['master_agent', 'sub_agent'];

    const req = context.switchToHttp().getRequest<{ user: AdminJwtPayload }>();
    if (!req.user || !allowed.includes(req.user.role)) {
      throw new ForbiddenException('Agent role required');
    }
    return true;
  }
}
