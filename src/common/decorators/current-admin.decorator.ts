import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AdminJwtPayload } from '../../admin/admin-jwt.strategy';

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AdminJwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: AdminJwtPayload }>();
    return request.user;
  },
);
