// tests/unit/shopify/cart-query.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/shopify/client', () => ({ storefrontFetch: vi.fn() }))

import { storefrontFetch } from '@/lib/shopify/client'
import { ShopifyError } from '@/lib/shopify/errors'
import {
  CART_BUYER_IDENTITY_UPDATE_MUTATION,
  CART_BY_ID_QUERY,
  CART_CREATE_MUTATION,
  CART_DISCOUNT_CODES_UPDATE_MUTATION,
  CART_FIELDS,
  CART_LINES_ADD_MUTATION,
  CART_LINES_REMOVE_MUTATION,
  CART_LINES_UPDATE_MUTATION,
  CART_NOTE_UPDATE_MUTATION,
  addCartLines,
  createCart,
  getCartById,
  normalizeCart,
  removeCartLines,
  updateCartBuyerIdentity,
  updateCartDiscountCodes,
  updateCartLines,
  updateCartNote,
  type CartUserError,
  type CartWarning,
  type RawCart,
} from '@/lib/shopify/queries/cart'
import * as queries from '@/lib/shopify/queries'
import type { Cart } from '@/lib/shopify/types'
import cartFixture from '@/tests/fixtures/shopify/cart.json'

const rawCart = cartFixture.cart as unknown as RawCart
const mocked = () => vi.mocked(storefrontFetch)

const CART_ID = rawCart.id
const HOODIE_LINE = rawCart.lines.nodes[0].id
const TEE_LINE = rawCart.lines.nodes[1].id

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

const usd = (amount: string) => ({ amount, currencyCode: 'USD' })

function clone(): RawCart {
  return JSON.parse(JSON.stringify(rawCart)) as RawCart
}

function payload(
  cart: RawCart | null,
  userErrors: CartUserError[] = [],
  warnings: CartWarning[] = []
) {
  return { cart, userErrors, warnings }
}

beforeEach(() => {
  mocked().mockReset()
})

// ---------------------------------------------------------------- documents

const FRAGMENT_HEADERS = [
  'fragment CartFields on Cart',
  'fragment CartLineFields on BaseCartLine',
  'fragment ImageFields on Image',
  'fragment MoneyFields on MoneyV2',
]

const DOCUMENTS: [string, string, string][] = [
  ['CART_BY_ID_QUERY', CART_BY_ID_QUERY, 'query CartById($id: ID!)'],
  ['CART_CREATE_MUTATION', CART_CREATE_MUTATION, 'mutation CartCreate($input: CartInput!)'],
  [
    'CART_LINES_ADD_MUTATION',
    CART_LINES_ADD_MUTATION,
    'mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!)',
  ],
  [
    'CART_LINES_UPDATE_MUTATION',
    CART_LINES_UPDATE_MUTATION,
    'mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!)',
  ],
  [
    'CART_LINES_REMOVE_MUTATION',
    CART_LINES_REMOVE_MUTATION,
    'mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!)',
  ],
  [
    'CART_DISCOUNT_CODES_UPDATE_MUTATION',
    CART_DISCOUNT_CODES_UPDATE_MUTATION,
    'mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!)',
  ],
  [
    'CART_NOTE_UPDATE_MUTATION',
    CART_NOTE_UPDATE_MUTATION,
    'mutation CartNoteUpdate($cartId: ID!, $note: String!)',
  ],
  [
    'CART_BUYER_IDENTITY_UPDATE_MUTATION',
    CART_BUYER_IDENTITY_UPDATE_MUTATION,
    'mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!)',
  ],
]

describe('cart documents', () => {
  it('CART_FIELDS carries both cart fragments plus Image/Money fragments exactly once', () => {
    for (const header of FRAGMENT_HEADERS) {
      expect(occurrences(CART_FIELDS, header)).toBe(1)
    }
    expect(CART_FIELDS).toContain('lines(first: 100) { nodes { ...CartLineFields } }')
    expect(CART_FIELDS).toContain(
      'maxPerOrder: metafield(namespace: "custom", key: "max_per_order") { value }'
    )
    expect(CART_FIELDS).toContain('checkoutChargeAmount { ...MoneyFields }')
    // Deprecated Storefront fields stay out (taxes show at checkout).
    expect(CART_FIELDS).not.toContain('totalTaxAmount')
    expect(CART_FIELDS).not.toContain('totalDutyAmount')
  })

  it.each(DOCUMENTS)('%s declares its operation and composes every fragment once', (_, doc, op) => {
    expect(doc.startsWith(op)).toBe(true)
    expect(doc).toContain('...CartFields')
    for (const header of FRAGMENT_HEADERS) {
      expect(occurrences(doc, header)).toBe(1)
    }
  })

  it.each(DOCUMENTS.slice(1))('%s selects userErrors and warnings', (_, doc) => {
    expect(doc).toContain('userErrors { field message code }')
    expect(doc).toContain('warnings { code message target }')
  })
})

// ---------------------------------------------------------------- normaliser

describe('normalizeCart', () => {
  it('maps the fixture onto the Cart contract', () => {
    const expected: Cart = {
      id: CART_ID,
      checkoutUrl: rawCart.checkoutUrl,
      totalQuantity: 2,
      note: null,
      discountCodes: [{ code: 'GOLD15', applicable: true }],
      cost: { subtotal: usd('112.0'), total: usd('95.2'), discount: usd('16.8') },
      buyer: { email: null, customerId: null },
      lines: [
        {
          id: HOODIE_LINE,
          quantity: 1,
          merchandise: {
            id: 'gid://shopify/ProductVariant/45123456789005',
            title: 'M / Taupe',
            sku: 'HOF-CH-TPE-M',
            availableForSale: true,
            quantityAvailable: 12,
            price: usd('88.0'),
            compareAtPrice: null,
            selectedOptions: [
              { name: 'Size', value: 'M' },
              { name: 'Color', value: 'Taupe' },
            ],
            image: {
              url: 'https://cdn.shopify.com/s/files/1/0812/3456/7890/files/core-hoodie-taupe-front.jpg?v=1757116802',
              altText: 'Core Hoodie in Taupe, front',
              width: 1600,
              height: 2000,
            },
            product: {
              id: 'gid://shopify/Product/8123456789012',
              handle: 'core-hoodie',
              title: 'Core Hoodie',
              tags: ['hoodies', 'new-arrival'],
              featuredImage: {
                url: 'https://cdn.shopify.com/s/files/1/0812/3456/7890/files/core-hoodie-black-front.jpg?v=1757116800',
                altText: 'Core Hoodie in Black, front',
                width: 1600,
                height: 2000,
              },
              maxPerOrder: 2,
            },
          },
          cost: { total: usd('88.0'), perUnit: usd('88.0'), compareAtPerUnit: null },
          discount: null,
          attributes: [],
        },
        {
          id: TEE_LINE,
          quantity: 1,
          merchandise: {
            id: 'gid://shopify/ProductVariant/45123456789127',
            title: 'L / Black',
            sku: 'HOF-ST-BLK-L',
            availableForSale: true,
            quantityAvailable: 1,
            price: usd('24.0'),
            compareAtPrice: usd('34.0'),
            selectedOptions: [
              { name: 'Size', value: 'L' },
              { name: 'Color', value: 'Black' },
            ],
            image: {
              url: 'https://cdn.shopify.com/s/files/1/0812/3456/7890/files/signature-tee-black-front.jpg?v=1757289600',
              altText: 'Signature Tee in Black, front',
              width: 1600,
              height: 2000,
            },
            product: {
              id: 'gid://shopify/Product/8123456789014',
              handle: 'signature-tee',
              title: 'Signature Tee',
              tags: ['tees'],
              featuredImage: {
                url: 'https://cdn.shopify.com/s/files/1/0812/3456/7890/files/signature-tee-black-front.jpg?v=1757289600',
                altText: 'Signature Tee in Black, front',
                width: 1600,
                height: 2000,
              },
              maxPerOrder: null,
            },
          },
          cost: { total: usd('24.0'), perUnit: usd('24.0'), compareAtPerUnit: usd('34.0') },
          discount: null,
          attributes: [],
        },
      ],
    }

    expect(normalizeCart(rawCart)).toEqual(expected)
  })

  it('keeps lines in response order', () => {
    const raw = clone()
    raw.lines.nodes.reverse()
    expect(normalizeCart(raw).lines.map((line) => line.id)).toEqual([TEE_LINE, HOODIE_LINE])
  })

  it('sums cart-level discount allocations and returns null when there are none', () => {
    const raw = clone()
    raw.discountAllocations = [
      { discountedAmount: usd('10.0') },
      { discountedAmount: usd('6.8') },
      { discountedAmount: usd('0.05') },
    ]
    expect(normalizeCart(raw).cost.discount).toEqual(usd('16.85'))

    raw.discountAllocations = []
    expect(normalizeCart(raw).cost.discount).toBeNull()
  })

  it('sums line discount allocations and returns null when there are none', () => {
    const raw = clone()
    raw.lines.nodes[0].discountAllocations = [
      { discountedAmount: usd('13.2') },
      { discountedAmount: usd('3.6') },
    ]
    const [hoodie, tee] = normalizeCart(raw).lines
    expect(hoodie.discount).toEqual(usd('16.8'))
    expect(tee.discount).toBeNull()
  })

  it('returns a single allocation unchanged', () => {
    const raw = clone()
    raw.lines.nodes[1].discountAllocations = [{ discountedAmount: usd('3.6') }]
    expect(normalizeCart(raw).lines[1].discount).toEqual(usd('3.6'))
  })

  it('parses maxPerOrder to an integer or null', () => {
    const raw = clone()
    const product = raw.lines.nodes[0].merchandise.product
    product.maxPerOrder = { value: '3' }
    expect(normalizeCart(raw).lines[0].merchandise.product.maxPerOrder).toBe(3)
    product.maxPerOrder = { value: '' }
    expect(normalizeCart(raw).lines[0].merchandise.product.maxPerOrder).toBeNull()
    product.maxPerOrder = { value: 'lots' }
    expect(normalizeCart(raw).lines[0].merchandise.product.maxPerOrder).toBeNull()
    product.maxPerOrder = null
    expect(normalizeCart(raw).lines[0].merchandise.product.maxPerOrder).toBeNull()
  })

  it('maps buyer identity, note, attributes and missing images', () => {
    const raw = clone()
    raw.buyerIdentity = {
      email: 'fan@example.com',
      countryCode: 'US',
      customer: { id: 'gid://shopify/Customer/7123456789012' },
    }
    raw.note = 'Gift wrap please'
    raw.lines.nodes[0].attributes = [{ key: '_source', value: 'pdp' }]
    raw.lines.nodes[0].merchandise.image = null
    raw.lines.nodes[0].merchandise.product.featuredImage = null

    const cart = normalizeCart(raw)
    expect(cart.buyer).toEqual({
      email: 'fan@example.com',
      customerId: 'gid://shopify/Customer/7123456789012',
    })
    expect(cart.note).toBe('Gift wrap please')
    expect(cart.lines[0].attributes).toEqual([{ key: '_source', value: 'pdp' }])
    expect(cart.lines[0].merchandise.image).toBeNull()
    expect(cart.lines[0].merchandise.product.featuredImage).toBeNull()
  })

  it('tolerates a null buyerIdentity and a null note', () => {
    const raw = clone()
    raw.buyerIdentity = null
    raw.note = null
    const cart = normalizeCart(raw)
    expect(cart.buyer).toEqual({ email: null, customerId: null })
    expect(cart.note).toBeNull()
  })
})

// ---------------------------------------------------------------- getCartById

describe('getCartById', () => {
  it('queries by id with revalidate false and no tags', async () => {
    mocked().mockResolvedValue({ cart: rawCart })

    const cart = await getCartById(CART_ID)

    expect(mocked()).toHaveBeenCalledTimes(1)
    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(CART_BY_ID_QUERY)
    expect(opts).toEqual({ variables: { id: CART_ID }, revalidate: false })
    expect(cart).toEqual(normalizeCart(rawCart))
  })

  it('returns null when Shopify returns cart: null (expired or invalid id)', async () => {
    mocked().mockResolvedValue({ cart: null })
    await expect(getCartById('gid://shopify/Cart/expired')).resolves.toBeNull()
  })
})

// ---------------------------------------------------------------- mutations

describe('createCart', () => {
  it('sends an empty input when nothing is given', async () => {
    mocked().mockResolvedValue({ cartCreate: payload(rawCart) })

    const cart = await createCart({})

    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(CART_CREATE_MUTATION)
    expect(opts).toEqual({ variables: { input: {} }, revalidate: false })
    expect(cart.id).toBe(CART_ID)
  })

  it('passes lines, note and discountCodes only when given', async () => {
    mocked().mockResolvedValue({ cartCreate: payload(rawCart) })
    const lines = [{ merchandiseId: 'gid://shopify/ProductVariant/45123456789005', quantity: 1 }]

    await createCart({ lines })
    expect(mocked().mock.calls[0][1]).toEqual({ variables: { input: { lines } }, revalidate: false })

    await createCart({ note: 'Hi' })
    expect(mocked().mock.calls[1][1]).toEqual({
      variables: { input: { note: 'Hi' } },
      revalidate: false,
    })

    await createCart({ discountCodes: ['GOLD15'] })
    expect(mocked().mock.calls[2][1]).toEqual({
      variables: { input: { discountCodes: ['GOLD15'] } },
      revalidate: false,
    })

    await createCart({ lines, note: 'Hi', discountCodes: ['GOLD15'] })
    expect(mocked().mock.calls[3][1]).toEqual({
      variables: { input: { lines, note: 'Hi', discountCodes: ['GOLD15'] } },
      revalidate: false,
    })
  })
})

type MutationCase = {
  name: string
  root: string
  document: string
  call: (onWarnings?: (w: CartWarning[]) => void) => Promise<Cart>
  variables: Record<string, unknown>
}

const ADD_LINES = [{ merchandiseId: 'gid://shopify/ProductVariant/45123456789005', quantity: 2 }]
const UPDATE_LINES = [{ id: HOODIE_LINE, quantity: 2 }]

const MUTATIONS: MutationCase[] = [
  {
    name: 'createCart',
    root: 'cartCreate',
    document: CART_CREATE_MUTATION,
    call: (cb) => createCart({ lines: ADD_LINES }, cb),
    variables: { input: { lines: ADD_LINES } },
  },
  {
    name: 'addCartLines',
    root: 'cartLinesAdd',
    document: CART_LINES_ADD_MUTATION,
    call: (cb) => addCartLines(CART_ID, ADD_LINES, cb),
    variables: { cartId: CART_ID, lines: ADD_LINES },
  },
  {
    name: 'updateCartLines',
    root: 'cartLinesUpdate',
    document: CART_LINES_UPDATE_MUTATION,
    call: (cb) => updateCartLines(CART_ID, UPDATE_LINES, cb),
    variables: { cartId: CART_ID, lines: UPDATE_LINES },
  },
  {
    name: 'removeCartLines',
    root: 'cartLinesRemove',
    document: CART_LINES_REMOVE_MUTATION,
    call: (cb) => removeCartLines(CART_ID, [TEE_LINE], cb),
    variables: { cartId: CART_ID, lineIds: [TEE_LINE] },
  },
  {
    name: 'updateCartDiscountCodes',
    root: 'cartDiscountCodesUpdate',
    document: CART_DISCOUNT_CODES_UPDATE_MUTATION,
    call: (cb) => updateCartDiscountCodes(CART_ID, ['GOLD15'], cb),
    variables: { cartId: CART_ID, discountCodes: ['GOLD15'] },
  },
  {
    name: 'updateCartNote',
    root: 'cartNoteUpdate',
    document: CART_NOTE_UPDATE_MUTATION,
    call: (cb) => updateCartNote(CART_ID, 'Gift wrap please', cb),
    variables: { cartId: CART_ID, note: 'Gift wrap please' },
  },
  {
    name: 'updateCartBuyerIdentity',
    root: 'cartBuyerIdentityUpdate',
    document: CART_BUYER_IDENTITY_UPDATE_MUTATION,
    call: (cb) => updateCartBuyerIdentity(CART_ID, { email: 'fan@example.com', countryCode: 'US' }, cb),
    variables: { cartId: CART_ID, buyerIdentity: { email: 'fan@example.com', countryCode: 'US' } },
  },
]

describe.each(MUTATIONS)('$name', ({ root, document, call, variables }) => {
  it('sends its document and variables with revalidate false and returns the normalised cart', async () => {
    mocked().mockResolvedValue({ [root]: payload(rawCart) })

    const cart = await call()

    expect(mocked()).toHaveBeenCalledTimes(1)
    const [query, opts] = mocked().mock.calls[0]
    expect(query).toBe(document)
    expect(opts).toEqual({ variables, revalidate: false })
    expect(cart).toEqual(normalizeCart(rawCart))
  })

  it('throws a ShopifyError carrying userErrors, with the first message', async () => {
    const userErrors: CartUserError[] = [
      { field: ['lines', '0', 'quantity'], message: 'Quantity must be at least 1', code: 'INVALID' },
      { field: null, message: 'Second problem', code: null },
    ]
    mocked().mockResolvedValue({ [root]: payload(rawCart, userErrors) })

    const error = await call().catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ShopifyError)
    const shopifyError = error as ShopifyError
    expect(shopifyError.message).toBe('Quantity must be at least 1')
    expect(shopifyError.userErrors).toEqual([
      { field: ['lines', '0', 'quantity'], message: 'Quantity must be at least 1', code: 'INVALID' },
      { field: null, message: 'Second problem' },
    ])
  })

  it('throws a ShopifyError when the payload has no cart', async () => {
    mocked().mockResolvedValue({ [root]: payload(null) })
    await expect(call()).rejects.toBeInstanceOf(ShopifyError)
  })

  it('throws a ShopifyError when the mutation payload itself is null', async () => {
    mocked().mockResolvedValue({ [root]: null })
    await expect(call()).rejects.toBeInstanceOf(ShopifyError)
  })

  it('reports Shopify warnings through the optional callback', async () => {
    const warnings: CartWarning[] = [
      {
        code: 'MERCHANDISE_NOT_ENOUGH_STOCK',
        message: 'Only 1 item was added to your cart due to availability.',
        target: TEE_LINE,
      },
    ]
    mocked().mockResolvedValue({ [root]: payload(rawCart, [], warnings) })
    const onWarnings = vi.fn<(w: CartWarning[]) => void>()

    const cart = await call(onWarnings)

    expect(onWarnings).toHaveBeenCalledTimes(1)
    expect(onWarnings).toHaveBeenCalledWith(warnings)
    expect(cart.id).toBe(CART_ID)
  })

  it('does not call the warnings callback when there are no warnings', async () => {
    mocked().mockResolvedValue({ [root]: payload(rawCart) })
    const onWarnings = vi.fn<(w: CartWarning[]) => void>()
    await call(onWarnings)
    expect(onWarnings).not.toHaveBeenCalled()
  })

  it('works without a warnings callback when Shopify returns warnings', async () => {
    mocked().mockResolvedValue({
      [root]: payload(rawCart, [], [{ code: 'MERCHANDISE_OUT_OF_STOCK', message: 'Sold out', target: null }]),
    })
    await expect(call()).resolves.toEqual(normalizeCart(rawCart))
  })
})

describe('updateCartBuyerIdentity input shaping', () => {
  it('passes only the buyer fields that are given', async () => {
    mocked().mockResolvedValue({ cartBuyerIdentityUpdate: payload(rawCart) })

    await updateCartBuyerIdentity(CART_ID, { customerAccessToken: 'tok' })

    expect(mocked().mock.calls[0][1]).toEqual({
      variables: { cartId: CART_ID, buyerIdentity: { customerAccessToken: 'tok' } },
      revalidate: false,
    })
  })
})

// ---------------------------------------------------------------- barrel

describe('lib/shopify/queries barrel', () => {
  it('re-exports the cart module', () => {
    expect(queries.CART_FIELDS).toBe(CART_FIELDS)
    expect(queries.CART_BY_ID_QUERY).toBe(CART_BY_ID_QUERY)
    expect(queries.normalizeCart).toBe(normalizeCart)
    expect(queries.getCartById).toBe(getCartById)
    expect(queries.createCart).toBe(createCart)
    expect(queries.addCartLines).toBe(addCartLines)
    expect(queries.updateCartLines).toBe(updateCartLines)
    expect(queries.removeCartLines).toBe(removeCartLines)
    expect(queries.updateCartDiscountCodes).toBe(updateCartDiscountCodes)
    expect(queries.updateCartNote).toBe(updateCartNote)
    expect(queries.updateCartBuyerIdentity).toBe(updateCartBuyerIdentity)
  })
})
