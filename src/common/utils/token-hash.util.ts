import { createHash, randomBytes } from 'crypto';

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

/** Opaque refresh / SSE ticket (url-safe). */
export function createOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('base64url');
}
