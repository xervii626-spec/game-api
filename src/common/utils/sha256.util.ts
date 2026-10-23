import { createHash } from 'crypto';
import { bodyForPublicKey } from './stable-json.util';

/**
 * BetConstruct PublicKey:
 * SHA256( sortedJSON(requestWithoutPublicKey) + SharedKey )
 */
export function computePublicKey(messageJsonBody: string, sharedKey: string): string {
  return createHash('sha256')
    .update(`${messageJsonBody}${sharedKey}`, 'utf8')
    .digest('hex');
}

export function computePublicKeyFromBody(
  body: Record<string, unknown>,
  sharedKey: string,
): string {
  return computePublicKey(bodyForPublicKey(body), sharedKey);
}

export function verifyPublicKey(
  messageJsonBody: string,
  sharedKey: string,
  publicKey: string,
): boolean {
  const expected = computePublicKey(messageJsonBody, sharedKey);
  return expected.toLowerCase() === publicKey.toLowerCase();
}

export function verifyPublicKeyFromBody(
  body: Record<string, unknown>,
  sharedKey: string,
  publicKey: string,
): boolean {
  return verifyPublicKey(bodyForPublicKey(body), sharedKey, publicKey);
}
