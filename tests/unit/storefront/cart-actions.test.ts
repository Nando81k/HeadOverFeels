// tests/unit/storefront/cart-actions.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `lib/shopify/cart/cookie.ts` is server-only.
vi.mock('server-only', () => ({}))

// In-memory cookie jar standing in for `await cookies()` from `next/headers`.
type JarEntry = { name: string; value: string; options?: Record<string, unknown> }
const jarStore = new Map<string, JarEntry>()
const jar = {
  get: vi.fn((name: string) => {
    const entry = jarStore.get(name)
    return entry ? { name: entry.name, value: entry.value } : undefined
  }),
  set: vi.fn((name: string, value: string, options?: Record<string, unknown>) => {
    jarStore.set(name, { name, value, options })
  }),
  delete: vi.fn((name: string) => {
    jarStore.delete(name)
  }),
}
vi.mock('next/headers', () => ({ cookies: vi.fn(async () => jar) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn() }))

vi.mock('@/lib/shopify/env', () => ({ hasShopifyEnv: vi.fn(() => true) }))
vi.mock('@/lib/shopify/queries/cart', () => ({
  getCartById: vi.fn(),
  createCart: vi.fn(),
  addCartLines: vi.fn(),
  updateCartLines: vi.fn(),
  removeCartLines: vi.fn(),
  updateCartDiscountCodes: vi.fn(),
  updateCartNote: vi.fn(),
}))

import {
  addCartLine,
  addCartLineForm,
  applyDiscountCode,
  getCartAction,
  removeCartLine,
  removeDiscountCode,
  updateCartLine,
  updateCartNoteAction,
} from '@/app/(storefront)/_actions/cart'
import { CART_COOKIE, clearCartId, readCartId, writeCartId } from '@/lib/shopify/cart/cookie'
import { hasShopifyEnv } from '@/lib/shopify/env'
import { ShopifyError } from '@/lib/shopify/errors'
import {
  addCartLines,
  createCart,
  getCartById,
  removeCartLines,
  updateCartDiscountCodes,
  updateCartLines,
  updateCartNote,
} from '@/lib/shopify/queries/cart'
import { revalidateTag } from 'next/cache'
import type { Cart, CartLine } from '@/lib/shopify/types'

const CART_ID = 'gid://shopify/Cart/Z2NwLXVzLWVhc3QxOjAx?key=abc123'
const NEW_CART_ID = 'gid://shopify/Cart/Z2NwLXVzLWVhc3QxOjAy?key=def456'
const VARIANT_ID = 'gid://shopify/ProductVariant/111'
const OTHER_VARIANT_ID = 'gid://shopify/ProductVariant/222'
const LINE_ID = 'gid://shopify/CartLine/aaa?cart=Z2NwLXVzLWVhc3QxOjAx'
const OTHER_LINE_ID = 'gid://shopify/CartLine/bbb?cart=Z2NwLXVzLWVhc3QxOjAx'

const usd = (amount: string) => ({ amount, currencyCode: 'USD' })

function makeLine(overrides: {
  id?: string
  quantity?: number
  variantId?: string
  title?: string
  quantityAvailable?: number | null
  maxPerOrder?: number | null
} = {}): CartLine {
  return {
    id: overrides.id ?? LINE_ID,
    quantity: overrides.quantity ?? 1,
    merchandise: {
      id: overrides.variantId ?? VARIANT_ID,
      title: 'Taupe / M',
      sku: 'HOF-CORE-TAUPE-M',
      availableForSale: true,
      quantityAvailable: overrides.quantityAvailable ?? null,
      price: usd('88.0'),
      compareAtPrice: null,
      selectedOptions: [
        { name: 'Color', value: 'Taupe' },
        { name: 'Size', value: 'M' },
      ],
      image: null,
      product: {
        id: 'gid://shopify/Product/1',
        handle: 'core-hoodie',
        title: overrides.title ?? 'Core Hoodie',
        tags: [],
        featuredImage: null,
        maxPerOrder: overrides.maxPerOrder ?? null,
      },
    },
    cost: { total: usd('88.0'), perUnit: usd('88.0'), compareAtPerUnit: null },
    discount: null,
    attributes: [],
  }
}

function makeCart(overrides: Partial<Cart> = {}): Cart {
  const lines = overrides.lines ?? [makeLine()]
  return {
    id: CART_ID,
    checkoutUrl: 'https://tgqucm-qg.myshopify.com/cart/c/Z2NwLXVzLWVhc3QxOjAx?key=abc123',
    totalQuantity: lines.reduce((sum, line) => sum + line.quantity, 0),
    note: null,
    lines,
    discountCodes: [],
    cost: { subtotal: usd('88.0'), total: usd('88.0'), discount: null },
    buyer: { email: null, customerId: null },
    ...overrides,
  }
}

const GENERIC_ERROR = { ok: false, error: 'Something went wrong updating your cart.' }
const UNAVAILABLE = { ok: false, error: 'Cart unavailable' }

const queryMocks = [
  getCartById,
  createCart,
  addCartLines,
  updateCartLines,
  removeCartLines,
  updateCartDiscountCodes,
  updateCartNote,
]

function expectNoShopifyCalls() {
  for (const mock of queryMocks) expect(mock).not.toHaveBeenCalled()
}

function setCookie(value: string = CART_ID) {
  jarStore.set(CART_COOKIE, { name: CART_COOKIE, value })
}

let consoleError: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  jarStore.clear()
  jar.get.mockClear()
  jar.set.mockClear()
  jar.delete.mockClear()
  for (const mock of queryMocks) vi.mocked(mock).mockReset()
  vi.mocked(hasShopifyEnv).mockReset()
  vi.mocked(hasShopifyEnv).mockReturnValue(true)
  vi.mocked(revalidateTag).mockClear()
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  // No action may ever bust a cache tag: nothing caches the cart.
  expect(revalidateTag).not.toHaveBeenCalled()
  consoleError.mockRestore()
})

describe('cart cookie', () => {
  it('writes an httpOnly lax cookie on / for 30 days', async () => {
    await writeCartId(CART_ID)

    expect(jar.set).toHaveBeenCalledWith(CART_COOKIE, CART_ID, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    expect(CART_COOKIE).toBe('hof_cart')
  })

  it('marks the cookie secure in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    try {
      await writeCartId(CART_ID)
      expect(jar.set.mock.calls[0][2]).toMatchObject({ secure: true })
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('reads back a cart GID and treats anything else as absent', async () => {
    await expect(readCartId()).resolves.toBeNull()

    setCookie()
    await expect(readCartId()).resolves.toBe(CART_ID)

    setCookie('not-a-cart')
    await expect(readCartId()).resolves.toBeNull()

    setCookie('gid://shopify/Product/1')
    await expect(readCartId()).resolves.toBeNull()

    setCookie('gid://shopify/Cart/')
    await expect(readCartId()).resolves.toBeNull()
  })

  it('clears the cookie', async () => {
    setCookie()
    await clearCartId()

    expect(jar.delete).toHaveBeenCalledWith(CART_COOKIE)
    await expect(readCartId()).resolves.toBeNull()
  })
})

describe('getCartAction', () => {
  it('returns null without fetching when there is no cookie', async () => {
    await expect(getCartAction()).resolves.toBeNull()
    expectNoShopifyCalls()
  })

  it('ignores a malformed cookie', async () => {
    setCookie('garbage')
    await expect(getCartAction()).resolves.toBeNull()
    expectNoShopifyCalls()
  })

  it('loads the cart named by the cookie', async () => {
    const cart = makeCart()
    setCookie()
    vi.mocked(getCartById).mockResolvedValue(cart)

    await expect(getCartAction()).resolves.toEqual(cart)
    expect(getCartById).toHaveBeenCalledWith(CART_ID)
    expect(jar.delete).not.toHaveBeenCalled()
  })

  it('clears the cookie when the cart has expired', async () => {
    setCookie()
    vi.mocked(getCartById).mockResolvedValue(null)

    await expect(getCartAction()).resolves.toBeNull()
    expect(jar.delete).toHaveBeenCalledWith(CART_COOKIE)
  })

  it('returns null and logs the message when Shopify throws', async () => {
    setCookie()
    vi.mocked(getCartById).mockRejectedValue(new ShopifyError('Storefront API 502'))

    await expect(getCartAction()).resolves.toBeNull()
    expect(consoleError).toHaveBeenCalledWith('[storefront] cart action failed: Storefront API 502')
  })
})

describe('addCartLine', () => {
  it('creates the cart and stores its id when there is no cookie', async () => {
    const cart = makeCart({ id: NEW_CART_ID })
    vi.mocked(createCart).mockResolvedValue(cart)

    const result = await addCartLine({ variantId: VARIANT_ID, quantity: 2 })

    expect(createCart).toHaveBeenCalledWith(
      { lines: [{ merchandiseId: VARIANT_ID, quantity: 2 }] },
      expect.any(Function)
    )
    expect(addCartLines).not.toHaveBeenCalled()
    expect(jar.set).toHaveBeenCalledWith(CART_COOKIE, NEW_CART_ID, expect.any(Object))
    expect(result).toEqual({ ok: true, cart })
  })

  it('adds to the existing cart when the cookie is set', async () => {
    const cart = makeCart()
    setCookie()
    vi.mocked(addCartLines).mockResolvedValue(cart)

    const result = await addCartLine({ variantId: VARIANT_ID })

    expect(addCartLines).toHaveBeenCalledWith(
      CART_ID,
      [{ merchandiseId: VARIANT_ID, quantity: 1 }],
      expect.any(Function)
    )
    expect(createCart).not.toHaveBeenCalled()
    expect(jar.set).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true, cart })
  })

  it('defaults the quantity to 1', async () => {
    vi.mocked(createCart).mockResolvedValue(makeCart())

    await addCartLine({ variantId: VARIANT_ID })

    expect(createCart).toHaveBeenCalledWith(
      { lines: [{ merchandiseId: VARIANT_ID, quantity: 1 }] },
      expect.any(Function)
    )
  })

  it.each([
    ['a product id', { variantId: 'gid://shopify/Product/1' }],
    ['an empty id', { variantId: '' }],
    ['a zero quantity', { variantId: VARIANT_ID, quantity: 0 }],
    ['a fractional quantity', { variantId: VARIANT_ID, quantity: 1.5 }],
    ['a huge quantity', { variantId: VARIANT_ID, quantity: 100 }],
  ])('rejects %s without fetching', async (_label, input) => {
    setCookie()
    const result = await addCartLine(input)

    expect(result.ok).toBe(false)
    expectNoShopifyCalls()
  })

  it('recreates the cart once when the cookie points at an expired cart', async () => {
    setCookie()
    vi.mocked(addCartLines).mockRejectedValue(
      new ShopifyError('Cart mutation failed', {
        userErrors: [
          { field: ['cartId'], message: 'The specified cart does not exist.', code: 'INVALID' },
        ],
      })
    )
    const fresh = makeCart({ id: NEW_CART_ID })
    vi.mocked(createCart).mockResolvedValue(fresh)

    const result = await addCartLine({ variantId: VARIANT_ID, quantity: 1 })

    expect(jar.delete).toHaveBeenCalledWith(CART_COOKIE)
    expect(createCart).toHaveBeenCalledTimes(1)
    expect(createCart).toHaveBeenCalledWith(
      { lines: [{ merchandiseId: VARIANT_ID, quantity: 1 }] },
      expect.any(Function)
    )
    expect(jarStore.get(CART_COOKIE)?.value).toBe(NEW_CART_ID)
    expect(result).toEqual({ ok: true, cart: fresh })
  })

  it('also recreates when the add mutation comes back without a cart', async () => {
    setCookie()
    vi.mocked(addCartLines).mockRejectedValue(new ShopifyError('Shopify cartLinesAdd returned no cart'))
    const fresh = makeCart({ id: NEW_CART_ID })
    vi.mocked(createCart).mockResolvedValue(fresh)

    await expect(addCartLine({ variantId: VARIANT_ID })).resolves.toEqual({ ok: true, cart: fresh })
    expect(createCart).toHaveBeenCalledTimes(1)
    expect(jarStore.get(CART_COOKIE)?.value).toBe(NEW_CART_ID)
  })

  it('maps a warning from cart creation', async () => {
    const cart = makeCart({ id: NEW_CART_ID })
    vi.mocked(createCart).mockImplementation(async (_input, onWarnings) => {
      onWarnings?.([{ code: 'MERCHANDISE_OUT_OF_STOCK', message: 'Sold out.', target: null }])
      return cart
    })

    await expect(addCartLine({ variantId: VARIANT_ID })).resolves.toEqual({
      ok: true,
      cart,
      warning: 'Sold out.',
    })
  })

  it('caps the line at the product max per order and warns', async () => {
    setCookie()
    vi.mocked(addCartLines).mockResolvedValue(
      makeCart({ lines: [makeLine({ quantity: 3, maxPerOrder: 2, title: 'Crew Tee' })] })
    )
    const capped = makeCart({ lines: [makeLine({ quantity: 2, maxPerOrder: 2, title: 'Crew Tee' })] })
    vi.mocked(updateCartLines).mockResolvedValue(capped)

    const result = await addCartLine({ variantId: VARIANT_ID, quantity: 1 })

    expect(updateCartLines).toHaveBeenCalledWith(
      CART_ID,
      [{ id: LINE_ID, quantity: 2 }],
      expect.any(Function)
    )
    expect(result).toEqual({ ok: true, cart: capped, warning: 'Max 2 per order for Crew Tee.' })
  })

  it('caps the line at the available stock and warns', async () => {
    setCookie()
    vi.mocked(addCartLines).mockResolvedValue(
      makeCart({ lines: [makeLine({ quantity: 2, quantityAvailable: 1, title: 'Signature Tee' })] })
    )
    const capped = makeCart({
      lines: [makeLine({ quantity: 1, quantityAvailable: 1, title: 'Signature Tee' })],
    })
    vi.mocked(updateCartLines).mockResolvedValue(capped)

    const result = await addCartLine({ variantId: VARIANT_ID })

    expect(updateCartLines).toHaveBeenCalledWith(
      CART_ID,
      [{ id: LINE_ID, quantity: 1 }],
      expect.any(Function)
    )
    expect(result).toEqual({ ok: true, cart: capped, warning: 'Only 1 left for Signature Tee.' })
  })

  it('caps only the line for the added variant', async () => {
    setCookie()
    vi.mocked(addCartLines).mockResolvedValue(
      makeCart({
        lines: [
          makeLine({ id: OTHER_LINE_ID, variantId: OTHER_VARIANT_ID, quantity: 9, maxPerOrder: 2 }),
          makeLine({ quantity: 1, maxPerOrder: 2 }),
        ],
      })
    )

    const result = await addCartLine({ variantId: VARIANT_ID })

    expect(updateCartLines).not.toHaveBeenCalled()
    expect(result.ok).toBe(true)
    expect(result).not.toHaveProperty('warning')
  })

  it('ignores a zero or unknown quantityAvailable', async () => {
    setCookie()
    const cart = makeCart({ lines: [makeLine({ quantity: 4, quantityAvailable: 0 })] })
    vi.mocked(addCartLines).mockResolvedValue(cart)

    await expect(addCartLine({ variantId: VARIANT_ID })).resolves.toEqual({ ok: true, cart })
    expect(updateCartLines).not.toHaveBeenCalled()
  })

  it('maps a Shopify cart warning to the result warning', async () => {
    setCookie()
    const cart = makeCart()
    vi.mocked(addCartLines).mockImplementation(async (_id, _lines, onWarnings) => {
      onWarnings?.([
        {
          code: 'MERCHANDISE_NOT_ENOUGH_STOCK',
          message: 'Only 1 item was added to your cart due to availability.',
          target: LINE_ID,
        },
        { code: 'MERCHANDISE_OUT_OF_STOCK', message: 'Second warning', target: null },
      ])
      return cart
    })

    const result = await addCartLine({ variantId: VARIANT_ID, quantity: 3 })

    expect(result).toEqual({
      ok: true,
      cart,
      warning: 'Only 1 item was added to your cart due to availability.',
    })
  })

  it('prefers its own cap warning over a Shopify warning', async () => {
    setCookie()
    vi.mocked(addCartLines).mockImplementation(async (_id, _lines, onWarnings) => {
      onWarnings?.([{ code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: 'Shopify says', target: null }])
      return makeCart({ lines: [makeLine({ quantity: 3, maxPerOrder: 2 })] })
    })
    vi.mocked(updateCartLines).mockResolvedValue(
      makeCart({ lines: [makeLine({ quantity: 2, maxPerOrder: 2 })] })
    )

    const result = await addCartLine({ variantId: VARIANT_ID })

    expect(result.ok && result.warning).toBe('Max 2 per order for Core Hoodie.')
  })

  it('maps Shopify userErrors to the first message and code', async () => {
    setCookie()
    vi.mocked(addCartLines).mockRejectedValue(
      new ShopifyError('Cart mutation failed', {
        userErrors: [
          {
            field: ['lines', '0', 'merchandiseId'],
            message: 'The merchandise with id gid://shopify/ProductVariant/111 does not exist.',
            code: 'INVALID',
          },
        ],
      })
    )

    const result = await addCartLine({ variantId: VARIANT_ID })

    expect(result).toEqual({
      ok: false,
      error: 'The merchandise with id gid://shopify/ProductVariant/111 does not exist.',
      code: 'INVALID',
    })
    expect(createCart).not.toHaveBeenCalled()
    expect(jar.delete).not.toHaveBeenCalled()
  })

  it('turns a thrown ShopifyError into the friendly error and logs the message only', async () => {
    setCookie()
    const error = new ShopifyError('Storefront API 503 Service Unavailable', { status: 503 })
    vi.mocked(addCartLines).mockRejectedValue(error)

    const result = await addCartLine({ variantId: VARIANT_ID })

    expect(result).toEqual(GENERIC_ERROR)
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(
      '[storefront] cart action failed: Storefront API 503 Service Unavailable'
    )
  })
})

describe('addCartLineForm', () => {
  it('reads variantId and quantity from the form', async () => {
    const cart = makeCart()
    vi.mocked(createCart).mockResolvedValue(cart)
    const form = new FormData()
    form.set('variantId', VARIANT_ID)
    form.set('quantity', '2')

    const result = await addCartLineForm(null, form)

    expect(createCart).toHaveBeenCalledWith(
      { lines: [{ merchandiseId: VARIANT_ID, quantity: 2 }] },
      expect.any(Function)
    )
    expect(result).toEqual({ ok: true, cart })
  })

  it('defaults a missing quantity to 1', async () => {
    vi.mocked(createCart).mockResolvedValue(makeCart())
    const form = new FormData()
    form.set('variantId', VARIANT_ID)

    await addCartLineForm(null, form)

    expect(createCart).toHaveBeenCalledWith(
      { lines: [{ merchandiseId: VARIANT_ID, quantity: 1 }] },
      expect.any(Function)
    )
  })

  it('rejects a form without a variant', async () => {
    const result = await addCartLineForm(null, new FormData())

    expect(result.ok).toBe(false)
    expectNoShopifyCalls()
  })
})

describe('updateCartLine', () => {
  it('updates the quantity', async () => {
    setCookie()
    const cart = makeCart({ lines: [makeLine({ quantity: 3 })] })
    vi.mocked(updateCartLines).mockResolvedValue(cart)

    const result = await updateCartLine({ lineId: LINE_ID, quantity: 3 })

    expect(updateCartLines).toHaveBeenCalledWith(
      CART_ID,
      [{ id: LINE_ID, quantity: 3 }],
      expect.any(Function)
    )
    expect(result).toEqual({ ok: true, cart })
  })

  it('removes the line when the quantity is 0', async () => {
    setCookie()
    const cart = makeCart({ lines: [] })
    vi.mocked(removeCartLines).mockResolvedValue(cart)

    const result = await updateCartLine({ lineId: LINE_ID, quantity: 0 })

    expect(removeCartLines).toHaveBeenCalledWith(CART_ID, [LINE_ID], expect.any(Function))
    expect(updateCartLines).not.toHaveBeenCalled()
    expect(result).toEqual({ ok: true, cart })
  })

  it('maps a Shopify warning', async () => {
    setCookie()
    const cart = makeCart()
    vi.mocked(updateCartLines).mockImplementation(async (_id, _lines, onWarnings) => {
      onWarnings?.([{ code: 'MERCHANDISE_NOT_ENOUGH_STOCK', message: 'Only 2 available.', target: LINE_ID }])
      return cart
    })

    await expect(updateCartLine({ lineId: LINE_ID, quantity: 5 })).resolves.toEqual({
      ok: true,
      cart,
      warning: 'Only 2 available.',
    })
  })

  it.each([
    ['a variant id', { lineId: VARIANT_ID, quantity: 1 }],
    ['a negative quantity', { lineId: LINE_ID, quantity: -1 }],
    ['a quantity over 99', { lineId: LINE_ID, quantity: 120 }],
  ])('rejects %s without fetching', async (_label, input) => {
    setCookie()
    const result = await updateCartLine(input)

    expect(result.ok).toBe(false)
    expectNoShopifyCalls()
  })

  it('fails without a cart cookie', async () => {
    const result = await updateCartLine({ lineId: LINE_ID, quantity: 1 })

    expect(result).toMatchObject({ ok: false, code: 'CART_NOT_FOUND' })
    expectNoShopifyCalls()
  })

  it('clears the cookie when the cart has expired', async () => {
    setCookie()
    vi.mocked(updateCartLines).mockRejectedValue(
      new ShopifyError('Cart mutation failed', {
        userErrors: [{ field: ['cartId'], message: 'The specified cart does not exist.', code: 'INVALID' }],
      })
    )

    const result = await updateCartLine({ lineId: LINE_ID, quantity: 2 })

    expect(result).toMatchObject({ ok: false, code: 'CART_NOT_FOUND' })
    expect(jar.delete).toHaveBeenCalledWith(CART_COOKIE)
  })
})

describe('removeCartLine', () => {
  it('removes the line', async () => {
    setCookie()
    const cart = makeCart({ lines: [] })
    vi.mocked(removeCartLines).mockResolvedValue(cart)

    await expect(removeCartLine({ lineId: LINE_ID })).resolves.toEqual({ ok: true, cart })
    expect(removeCartLines).toHaveBeenCalledWith(CART_ID, [LINE_ID], expect.any(Function))
  })

  it('rejects a malformed line id without fetching', async () => {
    setCookie()
    const result = await removeCartLine({ lineId: 'line-1' })

    expect(result.ok).toBe(false)
    expectNoShopifyCalls()
  })
})

describe('applyDiscountCode', () => {
  it('merges the new code with the existing applicable codes', async () => {
    setCookie()
    vi.mocked(getCartById).mockResolvedValue(
      makeCart({
        discountCodes: [
          { code: 'GOLD15', applicable: true },
          { code: 'STALE', applicable: false },
        ],
      })
    )
    const updated = makeCart({
      discountCodes: [
        { code: 'GOLD15', applicable: true },
        { code: 'FREESHIP', applicable: true },
      ],
    })
    vi.mocked(updateCartDiscountCodes).mockResolvedValue(updated)

    const result = await applyDiscountCode({ code: '  FREESHIP ' })

    expect(getCartById).toHaveBeenCalledWith(CART_ID)
    expect(updateCartDiscountCodes).toHaveBeenCalledTimes(1)
    expect(updateCartDiscountCodes).toHaveBeenCalledWith(
      CART_ID,
      ['GOLD15', 'FREESHIP'],
      expect.any(Function)
    )
    expect(result).toEqual({ ok: true, cart: updated })
  })

  it('removes a non-applicable code again and reports it', async () => {
    setCookie()
    vi.mocked(getCartById).mockResolvedValue(
      makeCart({ discountCodes: [{ code: 'GOLD15', applicable: true }] })
    )
    vi.mocked(updateCartDiscountCodes)
      .mockResolvedValueOnce(
        makeCart({
          discountCodes: [
            { code: 'GOLD15', applicable: true },
            { code: 'NOPE', applicable: false },
          ],
        })
      )
      .mockResolvedValueOnce(makeCart({ discountCodes: [{ code: 'GOLD15', applicable: true }] }))

    const result = await applyDiscountCode({ code: 'NOPE' })

    expect(updateCartDiscountCodes).toHaveBeenNthCalledWith(
      1,
      CART_ID,
      ['GOLD15', 'NOPE'],
      expect.any(Function)
    )
    expect(updateCartDiscountCodes).toHaveBeenNthCalledWith(2, CART_ID, ['GOLD15'], expect.any(Function))
    expect(result).toEqual({
      ok: false,
      error: "NOPE isn't valid for this cart.",
      code: 'DISCOUNT_NOT_APPLICABLE',
      cart: makeCart({ discountCodes: [{ code: 'GOLD15', applicable: true }] }),
    })
  })

  it.each([
    ['blank', '   '],
    ['too long', 'X'.repeat(65)],
  ])('rejects a %s code without fetching', async (_label, code) => {
    setCookie()
    const result = await applyDiscountCode({ code })

    expect(result.ok).toBe(false)
    expectNoShopifyCalls()
  })

  it('clears the cookie when the cart has expired', async () => {
    setCookie()
    vi.mocked(getCartById).mockResolvedValue(null)

    const result = await applyDiscountCode({ code: 'GOLD15' })

    expect(result).toMatchObject({ ok: false, code: 'CART_NOT_FOUND' })
    expect(jar.delete).toHaveBeenCalledWith(CART_COOKIE)
    expect(updateCartDiscountCodes).not.toHaveBeenCalled()
  })
})

describe('removeDiscountCode', () => {
  it('keeps every other code', async () => {
    setCookie()
    vi.mocked(getCartById).mockResolvedValue(
      makeCart({
        discountCodes: [
          { code: 'GOLD15', applicable: true },
          { code: 'FREESHIP', applicable: true },
        ],
      })
    )
    const updated = makeCart({ discountCodes: [{ code: 'FREESHIP', applicable: true }] })
    vi.mocked(updateCartDiscountCodes).mockResolvedValue(updated)

    const result = await removeDiscountCode({ code: 'gold15' })

    expect(updateCartDiscountCodes).toHaveBeenCalledWith(CART_ID, ['FREESHIP'], expect.any(Function))
    expect(result).toEqual({ ok: true, cart: updated })
  })
})

describe('updateCartNoteAction', () => {
  it('trims the note', async () => {
    setCookie()
    const cart = makeCart({ note: 'Gift wrap please' })
    vi.mocked(updateCartNote).mockResolvedValue(cart)

    const result = await updateCartNoteAction({ note: '  Gift wrap please \n' })

    expect(updateCartNote).toHaveBeenCalledWith(CART_ID, 'Gift wrap please', expect.any(Function))
    expect(result).toEqual({ ok: true, cart })
  })

  it('rejects a note over 1000 characters without fetching', async () => {
    setCookie()
    const result = await updateCartNoteAction({ note: 'a'.repeat(1001) })

    expect(result.ok).toBe(false)
    expectNoShopifyCalls()
  })
})

describe('unconfigured store', () => {
  beforeEach(() => {
    vi.mocked(hasShopifyEnv).mockReturnValue(false)
    setCookie()
  })

  it('returns null from getCartAction without fetching', async () => {
    await expect(getCartAction()).resolves.toBeNull()
    expectNoShopifyCalls()
  })

  it.each([
    ['addCartLine', () => addCartLine({ variantId: VARIANT_ID })],
    [
      'addCartLineForm',
      () => {
        const form = new FormData()
        form.set('variantId', VARIANT_ID)
        return addCartLineForm(null, form)
      },
    ],
    ['updateCartLine', () => updateCartLine({ lineId: LINE_ID, quantity: 2 })],
    ['removeCartLine', () => removeCartLine({ lineId: LINE_ID })],
    ['applyDiscountCode', () => applyDiscountCode({ code: 'GOLD15' })],
    ['removeDiscountCode', () => removeDiscountCode({ code: 'GOLD15' })],
    ['updateCartNoteAction', () => updateCartNoteAction({ note: 'hi' })],
  ])('%s returns Cart unavailable without fetching', async (_name, run) => {
    await expect(run()).resolves.toEqual(UNAVAILABLE)
    expectNoShopifyCalls()
  })
})
