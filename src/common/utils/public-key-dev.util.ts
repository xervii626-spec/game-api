import { computePublicKeyFromBody } from './sha256.util';

/** Helper for local testing — build PublicKey for a request body */
export function makeDevPublicKey(
  bodyWithoutPublicKey: Record<string, unknown>,
  sharedKey: string,
): string {
  return computePublicKeyFromBody(bodyWithoutPublicKey, sharedKey);
}
