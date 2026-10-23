import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Allow RGS wallet callbacks only from whitelisted IPs.
 * Empty whitelist = allow all (local/dev).
 */
@Injectable()
export class IpWhitelistGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const whitelist = this.config.get<string[]>('rgsIpWhitelist') ?? [];
    if (whitelist.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const ip =
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.ip ||
      '';

    if (!whitelist.includes(ip)) {
      throw new ForbiddenException(`IP not allowed: ${ip}`);
    }
    return true;
  }
}
