/**
 * Wishlist domain helpers — client-safe, no React, no server imports.
 *
 * Guests keep their wishlist in `localStorage` under `WISHLIST_STORAGE_KEY` as a JSON
 * `WishlistEntry[]`; signed-in customers keep it in Prisma (`StorefrontWishlistItem`) via
 * `app/(storefront)/_actions/wishlist.ts`. The provider (Phase 4 Task 7) merges the two
 * once after sign-in with `mergeWishlists` and `mergeGuestWishlistAction`.
 *
 * Every function here is pure (or wraps storage access in try/catch) and SSR-safe:
 * reading on the server returns `[]`, writing is a no-op, and a corrupt stored value
 * is treated as empty rather than thrown.
 *
 * Phase 4 Task 1 mirrors `WishlistEntry` / `WishlistActionResult` into
 * `lib/shopify/types.ts` with the same shapes; this file stays the storefront import.
 */

export const WISHLIST_STORAGE_KEY = 'hof_wishlist_v1'

export type WishlistEntry = { variantId: string; productHandle: string; addedAt: string }

export type WishlistActionResult =
  | { ok: true; entries: WishlistEntry[] }
  | { ok: false; error: string }

export type WishlistToggleInput = { variantId: string; productHandle: string }

const VARIANT_GID_PREFIX = 'gid://shopify/ProductVariant/'

// ---------------------------------------------------------------- parsing

function toTime(iso: string): number {
  const time = Date.parse(iso)
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY
}

export function isWishlistEntry(value: unknown): value is WishlistEntry {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<WishlistEntry>
  return (
    typeof candidate.variantId === 'string' &&
    candidate.variantId.startsWith(VARIANT_GID_PREFIX) &&
    typeof candidate.productHandle === 'string' &&
    candidate.productHandle.length > 0 &&
    typeof candidate.addedAt === 'string' &&
    Number.isFinite(Date.parse(candidate.addedAt))
  )
}

/**
 * Turns untrusted JSON (storage, a client payload) into a clean entry list: only
 * well-formed entries survive and each variant appears once, keeping its oldest
 * `addedAt`. Order of first appearance is preserved.
 */
export function parseWishlistEntries(value: unknown): WishlistEntry[] {
  if (!Array.isArray(value)) return []
  const byVariant = new Map<string, WishlistEntry>()
  for (const item of value) {
    if (!isWishlistEntry(item)) continue
    const existing = byVariant.get(item.variantId)
    if (!existing || toTime(item.addedAt) < toTime(existing.addedAt)) {
      byVariant.set(item.variantId, {
        variantId: item.variantId,
        productHandle: item.productHandle,
        addedAt: item.addedAt,
      })
    }
  }
  return Array.from(byVariant.values())
}

// ---------------------------------------------------------------- guest storage

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage ?? null
  } catch {
    // Accessing `localStorage` itself throws when storage is blocked.
    return null
  }
}

export function readGuestWishlist(): WishlistEntry[] {
  const store = storage()
  if (!store) return []
  try {
    const raw = store.getItem(WISHLIST_STORAGE_KEY)
    if (!raw) return []
    return parseWishlistEntries(JSON.parse(raw))
  } catch {
    return []
  }
}

export function writeGuestWishlist(entries: WishlistEntry[]): void {
  const store = storage()
  if (!store) return
  try {
    if (entries.length === 0) {
      store.removeItem(WISHLIST_STORAGE_KEY)
      return
    }
    store.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(entries))
  } catch {
    // Quota exceeded / private mode: the in-memory list is still the source of truth.
  }
}

export function clearGuestWishlist(): void {
  writeGuestWishlist([])
}

// ---------------------------------------------------------------- pure list ops

export function hasVariant(entries: WishlistEntry[], variantId: string): boolean {
  return entries.some((entry) => entry.variantId === variantId)
}

/**
 * Adds the variant (to the front, stamped `now`) when absent, removes it when present.
 * Returns a new array; the input is never mutated.
 */
export function toggleEntry(
  entries: WishlistEntry[],
  input: WishlistToggleInput,
  now: Date = new Date()
): WishlistEntry[] {
  if (hasVariant(entries, input.variantId)) {
    return entries.filter((entry) => entry.variantId !== input.variantId)
  }
  return [
    { variantId: input.variantId, productHandle: input.productHandle, addedAt: now.toISOString() },
    ...entries,
  ]
}

/**
 * Union of the server and guest lists by `variantId`; the oldest `addedAt` wins (on a
 * tie the server entry does). The result is ordered newest first, which is how the
 * wishlist page and the server action present it.
 */
export function mergeWishlists(server: WishlistEntry[], guest: WishlistEntry[]): WishlistEntry[] {
  const merged = parseWishlistEntries([...server, ...guest])
  return merged
    .map((entry, index) => ({ entry, index, time: toTime(entry.addedAt) }))
    .sort((a, b) => b.time - a.time || a.index - b.index)
    .map(({ entry }) => entry)
}
