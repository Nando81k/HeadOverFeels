/** Shared formatting for the Care Points hub. Digits are always rendered inside `.num`. */

export const LOYALTY_SIGN_IN_HREF = '/account/login?return_to=%2Floyalty'

/** The in-page anchors the `/loyalty/*` redirects point at (plan, Task 6 / Task 8). */
export const LOYALTY_ANCHORS = ['rewards', 'earn', 'tiers', 'history', 'refer'] as const
export type LoyaltyAnchor = (typeof LOYALTY_ANCHORS)[number]

export function formatPoints(points: number): string {
  return Math.trunc(points).toLocaleString('en-US')
}

/** `+96` / `−500` (typographic minus, as the cart's discount row). */
export function formatSignedPoints(points: number): string {
  const abs = formatPoints(Math.abs(points))
  return points < 0 ? `−${abs}` : `+${abs}`
}

/** `1.25×`; whole multipliers lose the decimals. */
export function formatMultiplier(multiplier: number): string {
  const rounded = Math.round(multiplier * 100) / 100
  return `${rounded.toLocaleString('en-US', { maximumFractionDigits: 2 })}×`
}

/** `Nov 30, 2026`; an unparseable value renders as given. */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Whole dollars (`$5`) or cents when the value has them (`$7.50`). */
export function formatDollars(value: number): string {
  const whole = Number.isInteger(value)
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}
