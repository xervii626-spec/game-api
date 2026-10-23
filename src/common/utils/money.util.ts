import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export function toDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

export function add(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return toDecimal(a).plus(toDecimal(b));
}

export function sub(a: string | number | Decimal, b: string | number | Decimal): Decimal {
  return toDecimal(a).minus(toDecimal(b));
}

export function isEnough(
  balance: string | number | Decimal,
  amount: string | number | Decimal,
): boolean {
  return toDecimal(balance).gte(toDecimal(amount));
}

export function formatMoney(value: string | number | Decimal): string {
  return toDecimal(value).toFixed(4);
}
