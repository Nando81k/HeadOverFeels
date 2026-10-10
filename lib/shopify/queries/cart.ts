/**
 * Storefront cart documents, the cart normaliser and the cart helpers.
 *
 * Documents are copied verbatim from the Phase 3 plan's "Shared contracts"
 * (validated against Storefront API 2026-07 on 2026-10-10). `CART_FIELDS`
 * carries `CartFields`, `CartLineFields`, `ImageFields` and `MoneyFields`
 * exactly once; every document appends `CART_FIELDS` once and nothing else —
 * a duplicate fragment definition is a GraphQL validation error. Shopify's
 * deprecated `totalTaxAmount` / `totalDutyAmount` are omitted on purpose
 * (taxes show at checkout).
 *
 * Freshness: every call uses `revalidate: false` (no-store) and no cache tags —
 * nothing caches the cart, so `revalidateTag('cart')` is never needed.
 *
 * Errors: a mutation throws `ShopifyError(firstUserError.message, { userErrors })`
 * when Shopify returns `userErrors`, and a plain `ShopifyError` when the payload
 * or its `cart` is null. `getCartById` returns `null` for an expired/invalid id.
 *
 * Warnings: Shopify mutation payloads also carry non-fatal `warnings` (e.g.
 * `MERCHANDISE_NOT_ENOUGH_STOCK`, `MERCHANDISE_OUT_OF_STOCK`). The helpers keep
 * the contract's `Promise<Cart>` return type and expose warnings through an
 * optional LAST parameter, `onWarnings?: (warnings: CartWarning[]) => void`. It
 * is called at most once, synchronously, only when the mutation succeeded (a
 * cart is returned) and only when the warnings list is non-empty. Callers map
 * warnings to `CartActionResult.warning` text — never to errors.
 */

import { storefrontFetch } from '../client'
import { ShopifyError, type ShopifyUserError } from '../errors'
import type { Cart, CartLine, Money } from '../types'
import { IMAGE_FIELDS, MONEY_FIELDS, toImage, toMoney, type RawImage, type RawMoney } from './fragments'

// ---------------------------------------------------------------- documents

const CART_LINE_FIELDS = `fragment CartLineFields on BaseCartLine {
  id quantity
  attributes { key value }
  cost { totalAmount { ...MoneyFields } amountPerQuantity { ...MoneyFields } compareAtAmountPerQuantity { ...MoneyFields } }
  discountAllocations { discountedAmount { ...MoneyFields } }
  merchandise { ... on ProductVariant {
    id title sku availableForSale quantityAvailable
    price { ...MoneyFields } compareAtPrice { ...MoneyFields }
    selectedOptions { name value }
    image { ...ImageFields }
    product { id handle title tags featuredImage { ...ImageFields } maxPerOrder: metafield(namespace: "custom", key: "max_per_order") { value } }
  } }
}`

const CART_FRAGMENT = `fragment CartFields on Cart {
  id checkoutUrl totalQuantity note
  buyerIdentity { email countryCode customer { id } }
  discountCodes { code applicable }
  discountAllocations { discountedAmount { ...MoneyFields } }
  cost { subtotalAmount { ...MoneyFields } totalAmount { ...MoneyFields } checkoutChargeAmount { ...MoneyFields } }
  lines(first: 100) { nodes { ...CartLineFields } }
}`

/** `CartFields` + `CartLineFields` + `ImageFields` + `MoneyFields`, each exactly once. */
export const CART_FIELDS = `${CART_FRAGMENT}

${CART_LINE_FIELDS}

${IMAGE_FIELDS}

${MONEY_FIELDS}`

export const CART_BY_ID_QUERY = `query CartById($id: ID!) { cart(id: $id) { ...CartFields } }

${CART_FIELDS}`

export const CART_CREATE_MUTATION = `mutation CartCreate($input: CartInput!) { cartCreate(input: $input) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }

${CART_FIELDS}`

export const CART_LINES_ADD_MUTATION = `mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }

${CART_FIELDS}`

export const CART_LINES_UPDATE_MUTATION = `mutation CartLinesUpdate($cartId: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $cartId, lines: $lines) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }

${CART_FIELDS}`

export const CART_LINES_REMOVE_MUTATION = `mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $cartId, lineIds: $lineIds) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }

${CART_FIELDS}`

export const CART_DISCOUNT_CODES_UPDATE_MUTATION = `mutation CartDiscountCodesUpdate($cartId: ID!, $discountCodes: [String!]!) { cartDiscountCodesUpdate(cartId: $cartId, discountCodes: $discountCodes) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }

${CART_FIELDS}`

export const CART_NOTE_UPDATE_MUTATION = `mutation CartNoteUpdate($cartId: ID!, $note: String!) { cartNoteUpdate(cartId: $cartId, note: $note) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }

${CART_FIELDS}`

export const CART_BUYER_IDENTITY_UPDATE_MUTATION = `mutation CartBuyerIdentityUpdate($cartId: ID!, $buyerIdentity: CartBuyerIdentityInput!) { cartBuyerIdentityUpdate(cartId: $cartId, buyerIdentity: $buyerIdentity) { cart { ...CartFields } userErrors { field message code } warnings { code message target } } }

${CART_FIELDS}`

// ---------------------------------------------------------------- raw shapes

export type RawCartMetafield = { value: string } | null

export type RawCartDiscountAllocation = { discountedAmount: RawMoney }

export type RawCartMerchandise = {
  id: string
  title: string
  sku: string | null
  availableForSale: boolean
  quantityAvailable: number | null
  price: RawMoney
  compareAtPrice: RawMoney | null
  selectedOptions: { name: string; value: string }[]
  image: RawImage | null
  product: {
    id: string
    handle: string
    title: string
    tags: string[]
    featuredImage: RawImage | null
    maxPerOrder: RawCartMetafield
  }
}

export type RawCartLine = {
  id: string
  quantity: number
  attributes: { key: string; value: string | null }[] | null
  cost: {
    totalAmount: RawMoney
    amountPerQuantity: RawMoney
    compareAtAmountPerQuantity: RawMoney | null
  }
  discountAllocations: RawCartDiscountAllocation[] | null
  merchandise: RawCartMerchandise
}

export type RawCartBuyerIdentity = {
  email: string | null
  countryCode: string | null
  customer: { id: string } | null
}

export type RawCart = {
  id: string
  checkoutUrl: string
  totalQuantity: number
  note: string | null
  buyerIdentity: RawCartBuyerIdentity | null
  discountCodes: { code: string; applicable: boolean }[] | null
  discountAllocations: RawCartDiscountAllocation[] | null
  cost: {
    subtotalAmount: RawMoney
    totalAmount: RawMoney
    checkoutChargeAmount: RawMoney | null
  }
  lines: { nodes: RawCartLine[] }
}

export type CartUserError = { field: string[] | null; message: string; code: string | null }
export type CartWarning = { code: string; message: string; target: string | null }
export type OnCartWarnings = (warnings: CartWarning[]) => void

type CartMutationPayload = {
  cart: RawCart | null
  userErrors: CartUserError[] | null
  warnings: CartWarning[] | null
}

// ---------------------------------------------------------------- normaliser

function fractionDigits(amount: string): number {
  const dot = amount.indexOf('.')
  return dot === -1 ? 0 : amount.length - dot - 1
}

/** `"16.80"` -> `"16.8"`, `"17.00"` -> `"17.0"` (Shopify's decimal-string style). */
function trimDecimal(value: string): string {
  if (!value.includes('.')) return `${value}.0`
  const trimmed = value.replace(/0+$/, '')
  return trimmed.endsWith('.') ? `${trimmed}0` : trimmed
}

/**
 * Sums allocation amounts in the first allocation's currency (a cart has one
 * currency). Uses scaled integers so decimal strings add without float drift.
 * Returns null when there is nothing to sum.
 */
function sumAllocations(allocations: RawCartDiscountAllocation[] | null | undefined): Money | null {
  const amounts = (allocations ?? []).map((allocation) => allocation.discountedAmount)
  if (amounts.length === 0) return null
  if (amounts.length === 1) return toMoney(amounts[0])

  const currencyCode = amounts[0].currencyCode
  const sameCurrency = amounts.filter((money) => money.currencyCode === currencyCode)
  const digits = Math.max(...sameCurrency.map((money) => fractionDigits(money.amount)))
  const scale = 10 ** digits
  const total = sameCurrency.reduce((sum, money) => {
    const value = Number(money.amount)
    return Number.isFinite(value) ? sum + Math.round(value * scale) : sum
  }, 0)
  return { amount: trimDecimal((total / scale).toFixed(digits)), currencyCode }
}

function toIntOrNull(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null
}

function toCartLine(raw: RawCartLine): CartLine {
  const variant = raw.merchandise
  return {
    id: raw.id,
    quantity: raw.quantity,
    merchandise: {
      id: variant.id,
      title: variant.title,
      sku: variant.sku ?? null,
      availableForSale: variant.availableForSale,
      quantityAvailable: variant.quantityAvailable ?? null,
      price: toMoney(variant.price),
      compareAtPrice: variant.compareAtPrice ? toMoney(variant.compareAtPrice) : null,
      selectedOptions: variant.selectedOptions.map((o) => ({ name: o.name, value: o.value })),
      image: toImage(variant.image),
      product: {
        id: variant.product.id,
        handle: variant.product.handle,
        title: variant.product.title,
        tags: variant.product.tags,
        featuredImage: toImage(variant.product.featuredImage),
        maxPerOrder: toIntOrNull(variant.product.maxPerOrder?.value),
      },
    },
    cost: {
      total: toMoney(raw.cost.totalAmount),
      perUnit: toMoney(raw.cost.amountPerQuantity),
      compareAtPerUnit: raw.cost.compareAtAmountPerQuantity
        ? toMoney(raw.cost.compareAtAmountPerQuantity)
        : null,
    },
    discount: sumAllocations(raw.discountAllocations),
    attributes: (raw.attributes ?? []).map((a) => ({ key: a.key, value: a.value ?? '' })),
  }
}

export function normalizeCart(raw: RawCart): Cart {
  return {
    id: raw.id,
    checkoutUrl: raw.checkoutUrl,
    totalQuantity: raw.totalQuantity,
    note: raw.note ? raw.note : null,
    lines: raw.lines.nodes.map(toCartLine),
    discountCodes: (raw.discountCodes ?? []).map((d) => ({ code: d.code, applicable: d.applicable })),
    cost: {
      subtotal: toMoney(raw.cost.subtotalAmount),
      total: toMoney(raw.cost.totalAmount),
      discount: sumAllocations(raw.discountAllocations),
    },
    buyer: {
      email: raw.buyerIdentity?.email ?? null,
      customerId: raw.buyerIdentity?.customer?.id ?? null,
    },
  }
}

// ---------------------------------------------------------------- fetchers

type CartLineInput = { merchandiseId: string; quantity: number }
type CartLineUpdateInput = { id: string; quantity: number }

export type CreateCartInput = {
  lines?: CartLineInput[]
  note?: string
  discountCodes?: string[]
}

export type CartBuyerIdentityInput = {
  email?: string
  customerAccessToken?: string
  countryCode?: string
}

/** `ShopifyUserError.code` is optional rather than nullable, so drop a null code. */
function toShopifyUserError(error: CartUserError): ShopifyUserError {
  return error.code === null
    ? { field: error.field, message: error.message }
    : { field: error.field, message: error.message, code: error.code }
}

async function runCartMutation(
  document: string,
  root: string,
  variables: Record<string, unknown>,
  onWarnings?: OnCartWarnings
): Promise<Cart> {
  const data = await storefrontFetch<Record<string, CartMutationPayload | null>>(document, {
    variables,
    revalidate: false,
  })

  const result = data[root]
  if (!result) throw new ShopifyError(`Shopify ${root} returned no payload`)

  const userErrors = result.userErrors ?? []
  if (userErrors.length > 0) {
    throw new ShopifyError(userErrors[0].message, { userErrors: userErrors.map(toShopifyUserError) })
  }

  if (!result.cart) throw new ShopifyError(`Shopify ${root} returned no cart`)

  const warnings = result.warnings ?? []
  if (onWarnings && warnings.length > 0) onWarnings(warnings)

  return normalizeCart(result.cart)
}

/** Returns null when Shopify returns `cart: null` (expired or invalid id). */
export async function getCartById(id: string): Promise<Cart | null> {
  const data = await storefrontFetch<{ cart: RawCart | null }>(CART_BY_ID_QUERY, {
    variables: { id },
    revalidate: false,
  })
  return data.cart ? normalizeCart(data.cart) : null
}

/** `lines`, `note` and `discountCodes` are sent only when given. */
export async function createCart(
  input: CreateCartInput,
  onWarnings?: OnCartWarnings
): Promise<Cart> {
  const cartInput: CreateCartInput = {}
  if (input.lines !== undefined) cartInput.lines = input.lines
  if (input.note !== undefined) cartInput.note = input.note
  if (input.discountCodes !== undefined) cartInput.discountCodes = input.discountCodes
  return runCartMutation(CART_CREATE_MUTATION, 'cartCreate', { input: cartInput }, onWarnings)
}

export async function addCartLines(
  cartId: string,
  lines: CartLineInput[],
  onWarnings?: OnCartWarnings
): Promise<Cart> {
  return runCartMutation(CART_LINES_ADD_MUTATION, 'cartLinesAdd', { cartId, lines }, onWarnings)
}

export async function updateCartLines(
  cartId: string,
  lines: CartLineUpdateInput[],
  onWarnings?: OnCartWarnings
): Promise<Cart> {
  return runCartMutation(CART_LINES_UPDATE_MUTATION, 'cartLinesUpdate', { cartId, lines }, onWarnings)
}

export async function removeCartLines(
  cartId: string,
  lineIds: string[],
  onWarnings?: OnCartWarnings
): Promise<Cart> {
  return runCartMutation(CART_LINES_REMOVE_MUTATION, 'cartLinesRemove', { cartId, lineIds }, onWarnings)
}

export async function updateCartDiscountCodes(
  cartId: string,
  codes: string[],
  onWarnings?: OnCartWarnings
): Promise<Cart> {
  return runCartMutation(
    CART_DISCOUNT_CODES_UPDATE_MUTATION,
    'cartDiscountCodesUpdate',
    { cartId, discountCodes: codes },
    onWarnings
  )
}

export async function updateCartNote(
  cartId: string,
  note: string,
  onWarnings?: OnCartWarnings
): Promise<Cart> {
  return runCartMutation(CART_NOTE_UPDATE_MUTATION, 'cartNoteUpdate', { cartId, note }, onWarnings)
}

/** Only the buyer fields that are given are sent. */
export async function updateCartBuyerIdentity(
  cartId: string,
  buyer: CartBuyerIdentityInput,
  onWarnings?: OnCartWarnings
): Promise<Cart> {
  const buyerIdentity: CartBuyerIdentityInput = {}
  if (buyer.email !== undefined) buyerIdentity.email = buyer.email
  if (buyer.customerAccessToken !== undefined) {
    buyerIdentity.customerAccessToken = buyer.customerAccessToken
  }
  if (buyer.countryCode !== undefined) buyerIdentity.countryCode = buyer.countryCode
  return runCartMutation(
    CART_BUYER_IDENTITY_UPDATE_MUTATION,
    'cartBuyerIdentityUpdate',
    { cartId, buyerIdentity },
    onWarnings
  )
}
