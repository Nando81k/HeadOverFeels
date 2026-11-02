import type { Money } from '@/lib/shopify/types'

export type { Money }

export type FormatMoneyOptions = {
  /** Drop the `.00` on whole amounts (`$40.00` → `$40`); `$42.50` is untouched. */
  trimZeros?: boolean
  /** BCP-47 locale. Defaults to `en-US` so server and client render identically. */
  locale?: string
}

const DEFAULT_LOCALE = 'en-US'

/** Shopify money amounts arrive as decimal strings; never trust them to parse. */
export function toNumber(money: Money): number {
  const parsed = Number.parseFloat(money.amount)
  return Number.isFinite(parsed) ? parsed : 0
}

/**
 * Format a Shopify `Money` for display.
 *
 * `formatMoney({ amount: '42.5', currencyCode: 'USD' })` → `'$42.50'`
 * `formatMoney({ amount: '40.00', ... }, { trimZeros: true })` → `'$40'`
 */
export function formatMoney(money: Money, opts: FormatMoneyOptions = {}): string {
  const { trimZeros = false, locale = DEFAULT_LOCALE } = opts
  const value = toNumber(money)
  const whole = trimZeros && Number.isInteger(value)

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currencyCode,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(value)
}

/**
 * True only when `compareAt` is a strictly higher amount in the same currency —
 * Shopify happily returns a compare-at price equal to (or below) the price.
 */
export function isOnSale(price: Money, compareAt: Money | null | undefined): boolean {
  if (!compareAt) return false
  if (compareAt.currencyCode !== price.currencyCode) return false
  return toNumber(compareAt) > toNumber(price)
}
