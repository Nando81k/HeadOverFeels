'use client'

import * as React from 'react'
import type { WishlistActionResult, WishlistEntry } from '@/lib/storefront/wishlist'

/**
 * The wishlist context and its hooks (Phase 4, Task 7).
 *
 * The context object lives here, apart from `WishlistProvider`, so that light
 * consumers — the PDP heart, a product card — import only this module and never
 * drag the Server Actions behind the provider into their bundle or their tests.
 * `useWishlist()` throws outside a provider; `useWishlistOptional()` returns
 * `null` there, which is how the heart hides itself on pages without one.
 */

export type WishlistStatus =
  /** Entries live in localStorage (signed out, or the account is unavailable). */
  | 'guest'
  /** Signed in; the server list (and a one-off guest merge) is being loaded. */
  | 'loading'
  /** Signed in; `entries` mirrors the server list. */
  | 'ready'

export type WishlistContextValue = {
  /** Newest first. */
  entries: WishlistEntry[]
  count: number
  status: WishlistStatus
  has(variantId: string): boolean
  /**
   * Adds the variant when absent, removes it when present. Optimistic when
   * signed in (rolled back on `{ ok: false }`); a pure local write for guests.
   * Never rejects.
   */
  toggle(variantId: string, productHandle: string): Promise<WishlistActionResult>
  /** Guest entries folded into the server list after sign-in; 0 once dismissed. */
  merged: number
  dismissMerged(): void
  /** The last failed load / toggle message, for an inline notice. */
  error: string | null
  clearError(): void
}

export const WishlistContext = React.createContext<WishlistContextValue | null>(null)

/** The wishlist. Throws outside a `WishlistProvider`. */
export function useWishlist(): WishlistContextValue {
  const value = React.useContext(WishlistContext)
  if (!value) throw new Error('useWishlist() must be used inside a <WishlistProvider>.')
  return value
}

/** The wishlist, or `null` outside a `WishlistProvider` (PDP, cards). */
export function useWishlistOptional(): WishlistContextValue | null {
  return React.useContext(WishlistContext)
}
