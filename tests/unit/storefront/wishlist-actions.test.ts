// tests/unit/storefront/wishlist-actions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => ({ get: vi.fn(), set: vi.fn() })) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))

vi.mock('@/lib/shopify/customer/session', () => ({ getCustomerSession: vi.fn() }))
vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: vi.fn(() => true) }))
vi.mock('@/lib/shopify/queries/variants', () => ({ getVariantsByIds: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: { findUnique: vi.fn() },
    storefrontWishlistItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      createMany: vi.fn(),
    },
  },
}))

import {
  getWishlistAction,
  mergeGuestWishlistAction,
  toggleWishlistAction,
  wishlistCardsAction,
} from '@/app/(storefront)/_actions/wishlist'
import { prisma } from '@/lib/prisma'
import { getCustomerSession } from '@/lib/shopify/customer/session'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { getVariantsByIds, type ProductCardVariant } from '@/lib/shopify/queries/variants'
import type { WishlistEntry } from '@/lib/storefront/wishlist'

const SHOPIFY_CUSTOMER_ID = 'gid://shopify/Customer/7001'
const CUSTOMER_ID = 'cus_prisma_1'
const HOODIE = 'gid://shopify/ProductVariant/45123456789005'
const CREW = 'gid://shopify/ProductVariant/45123456789205'
const TEE = 'gid://shopify/ProductVariant/45123456789301'

const session = {
  tokens: { accessToken: 'at', refreshToken: null, idToken: null, expiresAt: Date.now() + 60_000 },
  customerId: SHOPIFY_CUSTOMER_ID,
  email: 'nando@example.com',
  firstName: 'Nando',
  lastName: null,
}

type Row = {
  id: string
  customerId: string
  variantId: string
  productHandle: string
  createdAt: Date
}

const row = (variantId: string, productHandle: string, createdAt: string, id = `wl_${variantId.slice(-3)}`): Row => ({
  id,
  customerId: CUSTOMER_ID,
  variantId,
  productHandle,
  createdAt: new Date(createdAt),
})

const mockSession = () => vi.mocked(getCustomerSession)
const mockCustomer = () => vi.mocked(prisma.customer.findUnique)
const items = () => ({
  findMany: vi.mocked(prisma.storefrontWishlistItem.findMany),
  findUnique: vi.mocked(prisma.storefrontWishlistItem.findUnique),
  create: vi.mocked(prisma.storefrontWishlistItem.create),
  delete: vi.mocked(prisma.storefrontWishlistItem.delete),
  createMany: vi.mocked(prisma.storefrontWishlistItem.createMany),
})

function signIn() {
  mockSession().mockResolvedValue(session)
  mockCustomer().mockResolvedValue({ id: CUSTOMER_ID } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSession().mockResolvedValue(null)
  mockCustomer().mockResolvedValue(null)
  vi.mocked(hasShopifyEnv).mockReturnValue(true)
  items().findMany.mockResolvedValue([] as never)
  items().findUnique.mockResolvedValue(null as never)
  items().createMany.mockResolvedValue({ count: 0 } as never)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getWishlistAction', () => {
  it('returns an empty list for a signed-out visitor without touching prisma', async () => {
    await expect(getWishlistAction()).resolves.toEqual({ ok: true, entries: [] })
    expect(mockCustomer()).not.toHaveBeenCalled()
    expect(items().findMany).not.toHaveBeenCalled()
  })

  it('returns an empty list when the session has no Prisma customer yet', async () => {
    mockSession().mockResolvedValue(session)
    await expect(getWishlistAction()).resolves.toEqual({ ok: true, entries: [] })
    expect(mockCustomer()).toHaveBeenCalledWith({
      where: { shopifyCustomerId: SHOPIFY_CUSTOMER_ID },
      select: { id: true },
    })
    expect(items().findMany).not.toHaveBeenCalled()
  })

  it('maps the customer rows to entries, newest first', async () => {
    signIn()
    items().findMany.mockResolvedValue([
      row(CREW, 'boxy-crew', '2026-10-05T10:00:00.000Z'),
      row(HOODIE, 'core-hoodie', '2026-10-01T10:00:00.000Z'),
    ] as never)

    const result = await getWishlistAction()

    expect(items().findMany).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID },
      orderBy: { createdAt: 'desc' },
    })
    expect(result).toEqual({
      ok: true,
      entries: [
        { variantId: CREW, productHandle: 'boxy-crew', addedAt: '2026-10-05T10:00:00.000Z' },
        { variantId: HOODIE, productHandle: 'core-hoodie', addedAt: '2026-10-01T10:00:00.000Z' },
      ],
    })
  })

  it('never throws: a prisma failure becomes an error result', async () => {
    signIn()
    items().findMany.mockRejectedValue(new Error('connection refused'))
    const result = await getWishlistAction()
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toBe('Something went wrong loading your wishlist.')
  })
})

describe('toggleWishlistAction', () => {
  it('rejects a variant id that is not a ProductVariant gid', async () => {
    signIn()
    await expect(
      toggleWishlistAction({ variantId: 'gid://shopify/Product/1', productHandle: 'core-hoodie' })
    ).resolves.toEqual({ ok: false, error: 'INVALID_INPUT' })
    await expect(
      toggleWishlistAction({ variantId: HOODIE, productHandle: '' })
    ).resolves.toEqual({ ok: false, error: 'INVALID_INPUT' })
    expect(items().create).not.toHaveBeenCalled()
  })

  it('returns SIGNED_OUT for a guest so the provider keeps localStorage', async () => {
    await expect(
      toggleWishlistAction({ variantId: HOODIE, productHandle: 'core-hoodie' })
    ).resolves.toEqual({ ok: false, error: 'SIGNED_OUT' })
    expect(items().findUnique).not.toHaveBeenCalled()
  })

  it('returns SIGNED_OUT when the session has no Prisma customer', async () => {
    mockSession().mockResolvedValue(session)
    await expect(
      toggleWishlistAction({ variantId: HOODIE, productHandle: 'core-hoodie' })
    ).resolves.toEqual({ ok: false, error: 'SIGNED_OUT' })
  })

  it('adds a missing variant and returns the refreshed list', async () => {
    signIn()
    items().findUnique.mockResolvedValue(null as never)
    items().findMany.mockResolvedValue([
      row(HOODIE, 'core-hoodie', '2026-10-11T12:00:00.000Z'),
    ] as never)

    const result = await toggleWishlistAction({ variantId: `  ${HOODIE}  `, productHandle: 'core-hoodie' })

    expect(items().findUnique).toHaveBeenCalledWith({
      where: { customerId_variantId: { customerId: CUSTOMER_ID, variantId: HOODIE } },
      select: { id: true },
    })
    expect(items().create).toHaveBeenCalledWith({
      data: { customerId: CUSTOMER_ID, variantId: HOODIE, productHandle: 'core-hoodie' },
    })
    expect(items().delete).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      entries: [{ variantId: HOODIE, productHandle: 'core-hoodie', addedAt: '2026-10-11T12:00:00.000Z' }],
    })
  })

  it('removes a present variant and returns the refreshed list', async () => {
    signIn()
    items().findUnique.mockResolvedValue({ id: 'wl_005' } as never)
    items().findMany.mockResolvedValue([] as never)

    const result = await toggleWishlistAction({ variantId: HOODIE, productHandle: 'core-hoodie' })

    expect(items().delete).toHaveBeenCalledWith({ where: { id: 'wl_005' } })
    expect(items().create).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true, entries: [] })
  })

  it('never throws: a prisma failure becomes an error result', async () => {
    signIn()
    items().create.mockRejectedValue(new Error('unique violation'))
    const result = await toggleWishlistAction({ variantId: HOODIE, productHandle: 'core-hoodie' })
    expect(result).toEqual({ ok: false, error: 'Something went wrong updating your wishlist.' })
  })
})

describe('mergeGuestWishlistAction', () => {
  const guest: WishlistEntry[] = [
    { variantId: HOODIE, productHandle: 'core-hoodie', addedAt: '2026-09-20T10:00:00.000Z' },
    { variantId: TEE, productHandle: 'mind-over-matter-tee', addedAt: '2026-10-02T10:00:00.000Z' },
  ]

  it('returns SIGNED_OUT for a guest', async () => {
    await expect(mergeGuestWishlistAction(guest)).resolves.toEqual({ ok: false, error: 'SIGNED_OUT' })
    expect(items().createMany).not.toHaveBeenCalled()
  })

  it('inserts the guest entries with skipDuplicates and returns the merged server list', async () => {
    signIn()
    items().findMany.mockResolvedValue([
      row(TEE, 'mind-over-matter-tee', '2026-10-02T10:00:00.000Z'),
      row(CREW, 'boxy-crew', '2026-10-01T10:00:00.000Z'),
      row(HOODIE, 'core-hoodie', '2026-09-20T10:00:00.000Z'),
    ] as never)

    const result = await mergeGuestWishlistAction(guest)

    expect(items().createMany).toHaveBeenCalledWith({
      data: [
        {
          customerId: CUSTOMER_ID,
          variantId: HOODIE,
          productHandle: 'core-hoodie',
          createdAt: new Date('2026-09-20T10:00:00.000Z'),
        },
        {
          customerId: CUSTOMER_ID,
          variantId: TEE,
          productHandle: 'mind-over-matter-tee',
          createdAt: new Date('2026-10-02T10:00:00.000Z'),
        },
      ],
      skipDuplicates: true,
    })
    expect(result).toEqual({
      ok: true,
      entries: [
        { variantId: TEE, productHandle: 'mind-over-matter-tee', addedAt: '2026-10-02T10:00:00.000Z' },
        { variantId: CREW, productHandle: 'boxy-crew', addedAt: '2026-10-01T10:00:00.000Z' },
        { variantId: HOODIE, productHandle: 'core-hoodie', addedAt: '2026-09-20T10:00:00.000Z' },
      ],
    })
  })

  it('drops malformed guest entries instead of failing the merge', async () => {
    signIn()
    const result = await mergeGuestWishlistAction([
      guest[0],
      { variantId: 'gid://shopify/Product/1', productHandle: 'x', addedAt: '2026-10-02T10:00:00.000Z' },
      { variantId: CREW, productHandle: 'boxy-crew', addedAt: 'garbage' },
      null as unknown as WishlistEntry,
    ])

    expect(items().createMany).toHaveBeenCalledTimes(1)
    const call = items().createMany.mock.calls[0][0] as { data: { variantId: string }[] }
    expect(call.data.map((d) => d.variantId)).toEqual([HOODIE])
    expect(result.ok).toBe(true)
  })

  it('skips the insert for an empty guest list and still returns the server list', async () => {
    signIn()
    items().findMany.mockResolvedValue([row(CREW, 'boxy-crew', '2026-10-01T10:00:00.000Z')] as never)

    const result = await mergeGuestWishlistAction([])

    expect(items().createMany).not.toHaveBeenCalled()
    expect(result).toEqual({
      ok: true,
      entries: [{ variantId: CREW, productHandle: 'boxy-crew', addedAt: '2026-10-01T10:00:00.000Z' }],
    })
  })

  it('never throws: a prisma failure becomes an error result', async () => {
    signIn()
    items().createMany.mockRejectedValue(new Error('boom'))
    await expect(mergeGuestWishlistAction(guest)).resolves.toEqual({
      ok: false,
      error: 'Something went wrong updating your wishlist.',
    })
  })
})

describe('wishlistCardsAction', () => {
  const card = (id: string, handle: string): ProductCardVariant => ({
    id,
    title: 'M / Taupe',
    availableForSale: true,
    quantityAvailable: 1,
    price: { amount: '88.0', currencyCode: 'USD' },
    compareAtPrice: null,
    selectedOptions: [],
    image: null,
    product: { id: 'gid://shopify/Product/1', handle, title: 'Core Hoodie', tags: [], availableForSale: true, featuredImage: null },
  })

  it('returns [] without fetching when no valid ids are given', async () => {
    await expect(wishlistCardsAction([])).resolves.toEqual([])
    await expect(wishlistCardsAction(['gid://shopify/Product/1', ''])).resolves.toEqual([])
    expect(getVariantsByIds).not.toHaveBeenCalled()
  })

  it('returns [] when the store is unconfigured', async () => {
    vi.mocked(hasShopifyEnv).mockReturnValue(false)
    await expect(wishlistCardsAction([HOODIE])).resolves.toEqual([])
    expect(getVariantsByIds).not.toHaveBeenCalled()
  })

  it('passes only valid, trimmed, de-duplicated ids to the query layer', async () => {
    vi.mocked(getVariantsByIds).mockResolvedValue([card(HOODIE, 'core-hoodie'), card(CREW, 'boxy-crew')])

    const result = await wishlistCardsAction([` ${HOODIE} `, 'gid://shopify/Product/1', CREW, HOODIE])

    expect(getVariantsByIds).toHaveBeenCalledWith([HOODIE, CREW])
    expect(result.map((v) => v.id)).toEqual([HOODIE, CREW])
  })

  it('works for guests (no session needed)', async () => {
    vi.mocked(getVariantsByIds).mockResolvedValue([card(HOODIE, 'core-hoodie')])
    await expect(wishlistCardsAction([HOODIE])).resolves.toHaveLength(1)
    expect(mockSession()).not.toHaveBeenCalled()
  })

  it('never throws: a Storefront failure becomes an empty list', async () => {
    vi.mocked(getVariantsByIds).mockRejectedValue(new Error('429'))
    await expect(wishlistCardsAction([HOODIE])).resolves.toEqual([])
  })
})
