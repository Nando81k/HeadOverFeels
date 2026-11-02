// tests/unit/storefront/wishlist-storage.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearGuestWishlist,
  mergeWishlists,
  parseWishlistEntries,
  readGuestWishlist,
  toggleEntry,
  WISHLIST_STORAGE_KEY,
  writeGuestWishlist,
  type WishlistEntry,
} from '@/lib/storefront/wishlist'

const HOODIE = 'gid://shopify/ProductVariant/45123456789005'
const CREW = 'gid://shopify/ProductVariant/45123456789205'
const TEE = 'gid://shopify/ProductVariant/45123456789301'

const entry = (variantId: string, productHandle: string, addedAt: string): WishlistEntry => ({
  variantId,
  productHandle,
  addedAt,
})

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('WISHLIST_STORAGE_KEY', () => {
  it('is the versioned guest key', () => {
    expect(WISHLIST_STORAGE_KEY).toBe('hof_wishlist_v1')
  })
})

describe('parseWishlistEntries', () => {
  it('returns [] for anything that is not an array', () => {
    expect(parseWishlistEntries(null)).toEqual([])
    expect(parseWishlistEntries(undefined)).toEqual([])
    expect(parseWishlistEntries('nope')).toEqual([])
    expect(parseWishlistEntries({ variantId: HOODIE })).toEqual([])
  })

  it('keeps only well-formed entries', () => {
    const good = entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z')
    const result = parseWishlistEntries([
      good,
      null,
      'string',
      { variantId: 'gid://shopify/Product/1', productHandle: 'x', addedAt: '2026-10-01T10:00:00.000Z' },
      { variantId: CREW, productHandle: '', addedAt: '2026-10-01T10:00:00.000Z' },
      { variantId: TEE, productHandle: 'tee', addedAt: 'not-a-date' },
      { variantId: TEE, productHandle: 'tee' },
    ])
    expect(result).toEqual([good])
  })

  it('de-duplicates by variantId keeping the oldest addedAt', () => {
    const result = parseWishlistEntries([
      entry(HOODIE, 'core-hoodie', '2026-10-05T10:00:00.000Z'),
      entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z'),
    ])
    expect(result).toEqual([entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z')])
  })
})

describe('readGuestWishlist', () => {
  it('returns [] when nothing is stored', () => {
    expect(readGuestWishlist()).toEqual([])
  })

  it('reads stored entries', () => {
    const entries = [entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z')]
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(entries))
    expect(readGuestWishlist()).toEqual(entries)
  })

  it('tolerates corrupt JSON', () => {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, '{not json')
    expect(readGuestWishlist()).toEqual([])
  })

  it('tolerates a stored value of the wrong shape', () => {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify({ variantId: HOODIE }))
    expect(readGuestWishlist()).toEqual([])
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify([1, 'two', null]))
    expect(readGuestWishlist()).toEqual([])
  })

  it('tolerates localStorage throwing (private mode / blocked storage)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(readGuestWishlist()).toEqual([])
  })

  it('returns [] during SSR when window is undefined', () => {
    vi.stubGlobal('window', undefined)
    expect(readGuestWishlist()).toEqual([])
  })
})

describe('writeGuestWishlist', () => {
  it('stores the entries as JSON', () => {
    const entries = [entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z')]
    writeGuestWishlist(entries)
    expect(JSON.parse(window.localStorage.getItem(WISHLIST_STORAGE_KEY) ?? 'null')).toEqual(entries)
  })

  it('removes the key when given an empty list', () => {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, '[]')
    writeGuestWishlist([])
    expect(window.localStorage.getItem(WISHLIST_STORAGE_KEY)).toBeNull()
  })

  it('clears the key via clearGuestWishlist', () => {
    window.localStorage.setItem(WISHLIST_STORAGE_KEY, '[]')
    clearGuestWishlist()
    expect(window.localStorage.getItem(WISHLIST_STORAGE_KEY)).toBeNull()
  })

  it('swallows storage errors (quota exceeded)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(() =>
      writeGuestWishlist([entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z')])
    ).not.toThrow()
  })

  it('is a no-op during SSR', () => {
    vi.stubGlobal('window', undefined)
    expect(() =>
      writeGuestWishlist([entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z')])
    ).not.toThrow()
    expect(() => clearGuestWishlist()).not.toThrow()
  })
})

describe('mergeWishlists', () => {
  it('unions by variantId and keeps the oldest addedAt', () => {
    const server = [
      entry(HOODIE, 'core-hoodie', '2026-10-03T10:00:00.000Z'),
      entry(CREW, 'boxy-crew', '2026-10-01T10:00:00.000Z'),
    ]
    const guest = [
      entry(HOODIE, 'core-hoodie', '2026-09-20T10:00:00.000Z'),
      entry(TEE, 'mind-over-matter-tee', '2026-10-02T10:00:00.000Z'),
    ]

    const merged = mergeWishlists(server, guest)

    expect(merged).toHaveLength(3)
    expect(merged.find((e) => e.variantId === HOODIE)?.addedAt).toBe('2026-09-20T10:00:00.000Z')
    expect(merged.find((e) => e.variantId === CREW)?.addedAt).toBe('2026-10-01T10:00:00.000Z')
    expect(merged.find((e) => e.variantId === TEE)?.addedAt).toBe('2026-10-02T10:00:00.000Z')
  })

  it('orders the result newest first', () => {
    const merged = mergeWishlists(
      [entry(CREW, 'boxy-crew', '2026-10-01T10:00:00.000Z')],
      [
        entry(TEE, 'mind-over-matter-tee', '2026-10-02T10:00:00.000Z'),
        entry(HOODIE, 'core-hoodie', '2026-09-20T10:00:00.000Z'),
      ]
    )
    expect(merged.map((e) => e.variantId)).toEqual([TEE, CREW, HOODIE])
  })

  it('prefers the server productHandle on a tie and does not mutate its inputs', () => {
    const server = [entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z')]
    const guest = [entry(HOODIE, 'core-hoodie-old', '2026-10-01T10:00:00.000Z')]
    const serverCopy = structuredClone(server)
    const guestCopy = structuredClone(guest)

    const merged = mergeWishlists(server, guest)

    expect(merged).toEqual(server)
    expect(server).toEqual(serverCopy)
    expect(guest).toEqual(guestCopy)
  })

  it('handles empty inputs', () => {
    expect(mergeWishlists([], [])).toEqual([])
    const only = [entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z')]
    expect(mergeWishlists(only, [])).toEqual(only)
    expect(mergeWishlists([], only)).toEqual(only)
  })
})

describe('toggleEntry', () => {
  const now = new Date('2026-10-11T12:00:00.000Z')

  it('adds a missing variant to the front with the given timestamp', () => {
    const existing = [entry(CREW, 'boxy-crew', '2026-10-01T10:00:00.000Z')]
    const result = toggleEntry(existing, { variantId: HOODIE, productHandle: 'core-hoodie' }, now)
    expect(result).toEqual([
      entry(HOODIE, 'core-hoodie', '2026-10-11T12:00:00.000Z'),
      entry(CREW, 'boxy-crew', '2026-10-01T10:00:00.000Z'),
    ])
    expect(existing).toHaveLength(1)
  })

  it('removes a present variant', () => {
    const existing = [
      entry(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z'),
      entry(CREW, 'boxy-crew', '2026-10-01T10:00:00.000Z'),
    ]
    const result = toggleEntry(existing, { variantId: HOODIE, productHandle: 'core-hoodie' }, now)
    expect(result).toEqual([entry(CREW, 'boxy-crew', '2026-10-01T10:00:00.000Z')])
  })
})
