/**
 * Sort object keys alphabetically (BetConstruct PublicKey rule).
 * Arrays keep order; nested objects are sorted recursively.
 */

/** BC Decimal(18,4) money fields — hash often uses 4 fractional digits (-1.0000). */
const MONEY_KEYS = new Set([
  'WithdrawAmount',
  'DepositAmount',
  'Amount',
  'TotalBalance',
  'BonusWin',
  'BonusMoney',
  'FrozenMoney',
  'BetAmount',
  'WinAmount',
]);

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
 * Build JSON for PublicKey with money fields forced to N decimals
 * (JSON.stringify alone turns -1.0000 into -1 and breaks BC hashes).
 */
export function stableStringifyMoney(
  value: unknown,
  moneyDecimals: number,
): string {
  return stringifySorted(value, moneyDecimals);
}

function stringifySorted(value: unknown, moneyDecimals: number, key?: string): string {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 'null';
    if (key && MONEY_KEYS.has(key)) {
      return value.toFixed(moneyDecimals);
    }
    return Number.isInteger(value) ? String(value) : String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stringifySorted(v, moneyDecimals)).join(',')}]`;
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${stringifySorted(obj[k], moneyDecimals, k)}`,
    );
    return `{${parts.join(',')}}`;
  }
  return 'null';
}

/**
 * Body used for PublicKey hash = request fields except PublicKey itself.
 * Returns several serializations — BC tooling varies decimal formatting.
 */
export function bodyForPublicKeyVariants(
  body: Record<string, unknown>,
): string[] {
  const { PublicKey: _pk, publicKey: _pk2, ...rest } = body;
  const variants = new Set<string>([
    stableStringify(rest),
    stableStringifyMoney(rest, 4),
    stableStringifyMoney(rest, 1),
    stableStringifyMoney(rest, 2),
  ]);
  return [...variants];
}

export function bodyForPublicKey(body: Record<string, unknown>): string {
  return bodyForPublicKeyVariants(body)[0]!;
}
