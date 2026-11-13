import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verifyPublicKeyFromBody } from '../utils/sha256.util';

@Injectable()
export class PublicKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const body = (request.body ?? {}) as Record<string, unknown>;
    const publicKey = body.PublicKey;

    if (typeof publicKey !== 'string' || !publicKey) {
      throw new UnauthorizedException('PublicKey is required');
    }

    const sharedKey = this.config.get<string>('sharedKey') ?? '';
    const isProd = this.config.get<boolean>('isProd') === true;
    // Dev-only: skip until SharedKey is set. Production must always verify.
    if (!isProd && (!sharedKey || sharedKey === 'change_me_shared_key')) {
      return true;
    }
    if (!sharedKey || sharedKey === 'change_me_shared_key') {
      throw new UnauthorizedException('SHARED_KEY is not configured');
    }

    if (!verifyPublicKeyFromBody(body, sharedKey, publicKey)) {
      throw new UnauthorizedException('Invalid PublicKey');
    }
    return true;
  }
}
