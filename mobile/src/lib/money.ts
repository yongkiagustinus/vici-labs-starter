/**
 * Money helpers. The backend stores integer minor units (cents) per currency to
 * avoid float drift — the "trust the numbers" promise. All formatting funnels
 * through here so the UI never does ad-hoc float math.
 */

const ZERO_DECIMAL = new Set(["JPY", "KRW", "VND", "CLP", "ISK"]);

function fractionDigits(currency: string): number {
  return ZERO_DECIMAL.has(currency.toUpperCase()) ? 0 : 2;
}

/** minor units -> major number (e.g. 12345 USD -> 123.45). */
export function toMajor(minor: number, currency: string): number {
  return minor / Math.pow(10, fractionDigits(currency));
}

/** major string/number -> minor units (e.g. "123.45" USD -> 12345). */
export function toMinor(major: number | string, currency: string): number {
  const n = typeof major === "string" ? parseFloat(major) : major;
  if (!isFinite(n)) return 0;
  return Math.round(n * Math.pow(10, fractionDigits(currency)));
}

export function formatMoney(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(toMajor(minor, currency));
  } catch {
    // Unknown currency code — fall back to a plain formatted number + code.
    return `${toMajor(minor, currency).toFixed(digits)} ${currency}`;
  }
}

/**
 * A unified balance across mixed currencies. Without live FX rates we honestly
 * subtotal per-currency rather than fabricating a single converted figure.
 */
export function subtotalByCurrency(
  rows: Array<{ amount: number; currency: string }>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.currency] = (out[r.currency] ?? 0) + r.amount;
  return out;
}
