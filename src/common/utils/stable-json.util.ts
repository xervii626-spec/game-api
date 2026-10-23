/**
 * Sort object keys alphabetically (BetConstruct PublicKey rule).
 * Arrays keep order; nested objects are sorted recursively.
 */
export function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = sortKeysDeep(obj[key]);
    }
    return sorted;
  }
  return value;
}

/** JSON string with keys ordered by name (no extra spaces). */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

/**
 * Body used for PublicKey hash = request fields except PublicKey itself.
 */
export function bodyForPublicKey(
  body: Record<string, unknown>,
): string {
  const { PublicKey: _pk, publicKey: _pk2, ...rest } = body;
  return stableStringify(rest);
}
