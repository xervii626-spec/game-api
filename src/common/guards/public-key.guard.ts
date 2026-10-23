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
    // Local/dev placeholder — skip strict verify until real SharedKey is set
    if (!sharedKey || sharedKey === 'change_me_shared_key') {
      return true;
    }

    if (!verifyPublicKeyFromBody(body, sharedKey, publicKey)) {
      throw new UnauthorizedException('Invalid PublicKey');
    }
    return true;
  }
}
