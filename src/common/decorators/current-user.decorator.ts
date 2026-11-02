import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export type JwtPayload = {
  sub: number;
  username: string;
  jti: string;
};

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest<{ user: JwtPayload }>();
    return request.user;
  },
);
