'use client'

import * as React from 'react'
import {
  getWishlistAction,
  mergeGuestWishlistAction,
  toggleWishlistAction,
} from '@/app/(storefront)/_actions/wishlist'
import { useCustomerOptional } from '@/components/storefront/account/useCustomer'
import {
  clearGuestWishlist,
  hasVariant,
  mergeWishlists,
  readGuestWishlist,
  toggleEntry,
  writeGuestWishlist,
  type WishlistActionResult,
  type WishlistEntry,
} from '@/lib/storefront/wishlist'
import { WishlistContext, type WishlistContextValue, type WishlistStatus } from './useWishlist'

/**
 * Client-side wishlist state (Phase 4, Task 7).
 *
 * - Guests: the list is `localStorage` (`lib/storefront/wishlist.ts`). The first
 *   render is always empty and the stored list is read in an effect, so server
 *   and client markup match (no hydration mismatch).
 * - Sign-in: when the customer context turns `ready`, `getWishlistAction()` loads
 *   the server list; if a guest list exists it is folded in once with
 *   `mergeGuestWishlistAction`, storage is cleared and `merged` carries the count
 *   for the page banner. A merge that fails keeps the guest list in storage (and
 *   shows the union locally) so the next sign-in retries it.
 * - Toggles are optimistic: the entry flips at once and the server's list replaces
 *   it when the action settles; `{ ok: false }` rolls the one entry back. The
 *   action answering `SIGNED_OUT` (no server list for this session) drops the
 *   provider back to guest mode and keeps the change locally.
 * - Sign-out returns to whatever storage holds (normally nothing).
 *
 * The layout mounts it with no props; `actions` only injects fakes in tests.
 */

export type WishlistActions = {
  get: () => Promise<WishlistActionResult>
  toggle: (input: { variantId: string; productHandle: string }) => Promise<WishlistActionResult>
  merge: (entries: WishlistEntry[]) => Promise<WishlistActionResult>
}

export interface WishlistProviderProps {
  children: React.ReactNode
  /** Inject fakes (tests). Missing entries fall back to the Server Actions. */
  actions?: Partial<WishlistActions>
}

const DEFAULT_ACTIONS: WishlistActions = {
  get: getWishlistAction,
  toggle: toggleWishlistAction,
  merge: mergeGuestWishlistAction,
}

/** The action's own "no server list for this session" answer. */
const SIGNED_OUT = 'SIGNED_OUT'
const LOAD_ERROR = 'Something went wrong loading your wishlist.'
const UPDATE_ERROR = 'Something went wrong updating your wishlist.'

async function settle(
  call: () => Promise<WishlistActionResult>,
  fallback: string
): Promise<WishlistActionResult> {
  try {
    return await call()
  } catch {
    return { ok: false, error: fallback }
  }
}

/** Undo one optimistic toggle: drop an added entry, or put a removed one back where it was. */
function revertToggle(
  current: WishlistEntry[],
  previous: WishlistEntry[],
  variantId: string
): WishlistEntry[] {
  const index = previous.findIndex((entry) => entry.variantId === variantId)
  if (index === -1) return current.filter((entry) => entry.variantId !== variantId)
  if (hasVariant(current, variantId)) return current
  const restored = [...current]
  restored.splice(Math.min(index, restored.length), 0, previous[index])
  return restored
}

export function WishlistProvider({ children, actions }: WishlistProviderProps) {
  const actionsRef = React.useRef<WishlistActions>({ ...DEFAULT_ACTIONS, ...actions })
  React.useEffect(() => {
    actionsRef.current = { ...DEFAULT_ACTIONS, ...actions }
  }, [actions])

  const [entries, setEntries] = React.useState<WishlistEntry[]>([])
  const [status, setStatus] = React.useState<WishlistStatus>('guest')
  const [merged, setMerged] = React.useState(0)
  const [error, setError] = React.useState<string | null>(null)

  // Latest committed values for callbacks that must not go stale mid-flight.
  // `toggle` also writes them synchronously so back-to-back toggles compose.
  const entriesRef = React.useRef(entries)
  React.useEffect(() => {
    entriesRef.current = entries
  }, [entries])
  const statusRef = React.useRef(status)
  React.useEffect(() => {
    statusRef.current = status
  }, [status])

  const customer = useCustomerOptional()
  const signedIn = customer?.status === 'ready'

  // Guest list: never on the first render (SSR parity), always in an effect.
  React.useEffect(() => {
    setEntries(readGuestWishlist())
  }, [])

  // Sign-in sync, once per signed-in session; sign-out returns to the guest list.
  const syncedRef = React.useRef(false)
  React.useEffect(() => {
    if (!signedIn) {
      if (syncedRef.current) {
        syncedRef.current = false
        setStatus('guest')
        setMerged(0)
        setError(null)
        setEntries(readGuestWishlist())
      }
      return
    }
    if (syncedRef.current) return
    syncedRef.current = true

    let cancelled = false
    let done = false
    setStatus('loading')
    setError(null)
    ;(async () => {
      const guest = readGuestWishlist()
      const loaded = await settle(() => actionsRef.current.get(), LOAD_ERROR)
      if (cancelled) return
      if (!loaded.ok) {
        done = true
        setStatus('guest')
        setError(loaded.error)
        return
      }

      let server = loaded.entries
      if (guest.length > 0) {
        const mergedResult = await settle(() => actionsRef.current.merge(guest), UPDATE_ERROR)
        if (cancelled) return
        if (mergedResult.ok) {
          server = mergedResult.entries
          clearGuestWishlist()
          setMerged(guest.length)
        } else if (mergedResult.error === SIGNED_OUT) {
          // Nothing can be persisted for this session: stay a guest, list as stored.
          done = true
          setStatus('guest')
          setEntries(guest)
          return
        } else {
          // Keep storage as it is so the next sign-in retries the merge.
          server = mergeWishlists(server, guest)
          setError(mergedResult.error)
        }
      }
      done = true
      setEntries(server)
      setStatus('ready')
    })()

    return () => {
      cancelled = true
      // Interrupted before it landed (StrictMode remount, quick sign-out): let it run again.
      if (!done) syncedRef.current = false
    }
  }, [signedIn])

  const has = React.useCallback((variantId: string) => hasVariant(entries, variantId), [entries])

  const toggle = React.useCallback<WishlistContextValue['toggle']>(
    async (variantId, productHandle) => {
      const input = { variantId, productHandle }
      const previous = entriesRef.current
      const commit = (next: WishlistEntry[]) => {
        entriesRef.current = next
        setEntries(next)
      }
      const optimistic = toggleEntry(previous, input)
      setError(null)
      commit(optimistic)

      if (statusRef.current !== 'ready') {
        writeGuestWishlist(optimistic)
        return { ok: true, entries: optimistic }
      }

      const result = await settle(() => actionsRef.current.toggle(input), UPDATE_ERROR)
      if (result.ok) {
        commit(result.entries)
      } else if (result.error === SIGNED_OUT) {
        statusRef.current = 'guest'
        setStatus('guest')
        writeGuestWishlist(entriesRef.current)
      } else {
        commit(revertToggle(entriesRef.current, previous, variantId))
        setError(result.error)
      }
      return result
    },
    []
  )

  const dismissMerged = React.useCallback(() => setMerged(0), [])
  const clearError = React.useCallback(() => setError(null), [])

  const value = React.useMemo<WishlistContextValue>(
    () => ({
      entries,
      count: entries.length,
      status,
      has,
      toggle,
      merged,
      dismissMerged,
      error,
      clearError,
    }),
    [entries, status, has, toggle, merged, dismissMerged, error, clearError]
  )

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>
}
