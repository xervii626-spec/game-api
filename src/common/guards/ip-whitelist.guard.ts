import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Allow RGS wallet callbacks only from whitelisted IPs.
 * Empty whitelist = allow all (local/dev).
 */
@Injectable()
export class IpWhitelistGuard implements CanActivate {
  private readonly logger = new Logger(IpWhitelistGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const whitelist = this.config.get<string[]>('rgsIpWhitelist') ?? [];
    if (whitelist.length === 0) {
      return true;
    }

    const normalizedWhitelist = new Set(whitelist.map((ip) => this.normalizeIp(ip)));
    const request = context.switchToHttp().getRequest<Request>();
    const candidates = this.collectCandidateIps(request);

    const allowed = candidates.some((ip) => normalizedWhitelist.has(ip));
    if (!allowed) {
      this.logger.warn(
        `IP blocked. candidates=${candidates.join('|') || '(none)'}`,
      );
      throw new ForbiddenException(
        `IP not allowed: ${candidates[0] || 'unknown'}`,
      );
    }
    return true;
  }

  /** Strip IPv6-mapped IPv4 prefix used by Node/proxies. */
  private normalizeIp(ip: string): string {
    const trimmed = ip.trim().replace(/^\[|\]$/g, '');
    if (trimmed.startsWith('::ffff:')) {
      return trimmed.slice('::ffff:'.length);
    }
    return trimmed;
  }

  private collectCandidateIps(request: Request): string[] {
    const rawForwarded = request.headers['x-forwarded-for'];
    const forwarded = Array.isArray(rawForwarded)
      ? rawForwarded.join(',')
      : (rawForwarded ?? '');

    const fromHeader = forwarded
      .split(',')
      .map((part) => this.normalizeIp(part))
      .filter(Boolean);

    const direct = this.normalizeIp(request.ip || request.socket?.remoteAddress || '');

    return [...new Set([...fromHeader, direct].filter(Boolean))];
  }
}
