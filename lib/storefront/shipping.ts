import type { Money } from '@/lib/shopify/types'

import { toNumber } from './money'

/**
 * Free-shipping threshold and progress maths. Pure and client-safe: the cart
 * drawer's `FreeShippingBar` and the announcement bar both read from here so
 * the "$75" never drifts between surfaces again.
 *
 * `NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD` must be read as a direct
 * `process.env.NEXT_PUBLIC_…` access so Next can inline it into client bundles.
 */

const DEFAULT_THRESHOLD = 75

function resolveThreshold(raw: string | undefined): number {
  const value = Number(raw)
  return raw !== undefined && raw.trim() !== '' && Number.isFinite(value) && value > 0
    ? value
    : DEFAULT_THRESHOLD
}

/** Subtotal (in store currency) at which US shipping becomes free. */
export const FREE_SHIPPING_THRESHOLD: number = resolveThreshold(
  process.env.NEXT_PUBLIC_FREE_SHIPPING_THRESHOLD
)

function formatThreshold(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

/** Announcement / marquee copy, e.g. `Free US shipping over $75`. */
export const FREE_SHIPPING_COPY = `Free US shipping over $${formatThreshold(FREE_SHIPPING_THRESHOLD)}`

export type FreeShippingProgress = {
  /** Amount still needed, never negative, rounded to cents. */
  remaining: number
  /** Progress toward the threshold, clamped to 0..1. */
  ratio: number
  /** True once the subtotal reaches the threshold. */
  unlocked: boolean
}

/** How close a cart subtotal is to free shipping. */
export function freeShippingProgress(subtotal: Money): FreeShippingProgress {
  const amount = Math.max(0, toNumber(subtotal))
  const remaining = Math.max(0, Math.round((FREE_SHIPPING_THRESHOLD - amount) * 100) / 100)
  const ratio = Math.min(1, amount / FREE_SHIPPING_THRESHOLD)
  return { remaining, ratio, unlocked: amount >= FREE_SHIPPING_THRESHOLD }
}
