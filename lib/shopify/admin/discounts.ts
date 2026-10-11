/**
 * Admin API discount helpers for Care Points redemptions (Phase 4, Task 2).
 *
 * Server/scripts only (see `lib/shopify/admin-client.ts`). Documents validated
 * 2026-10-11 against the pinned Admin schema (2026-07) with the Shopify MCP:
 *
 *   mutation LoyaltyDiscountCreate($basicCodeDiscount: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) { codeDiscountNode { id codeDiscount { ... on DiscountCodeBasic { title codes(first: 1) { nodes { code } } startsAt endsAt usageLimit appliesOncePerCustomer } } } userErrors { field message code } } }
 *   mutation LoyaltyFreeShippingCreate($freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) { discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount) { codeDiscountNode { id codeDiscount { ... on DiscountCodeFreeShipping { title codes(first: 1) { nodes { code } } startsAt endsAt usageLimit appliesOncePerCustomer } } } userErrors { field message code } } }
 *   mutation LoyaltyDiscountDelete($id: ID!) { discountCodeDelete(id: $id) { deletedCodeDiscountId userErrors { field message } } }
 *
 * Input shapes (also validated inline, 2026-10-11): the 2026-07 schema has NO
 * `customerSelection` on `DiscountCodeBasicInput` / `DiscountCodeFreeShippingInput`.
 * Customer eligibility is `context: { customers: { add: [customerGid] } }`
 * (`DiscountContextInput`, oneOf: all | customerSegments | customers). Everything
 * else matches the plan: `usageLimit: 1`, `appliesOncePerCustomer: true`,
 * `customerGets.value.discountAmount { amount, appliesOnEachItem: false }` or
 * `customerGets.value.percentage` (0–1), `items: { all: true }`,
 * `destination: { all: true }` for free shipping.
 */
import { adminRequest, assertNoUserErrors } from '../admin-client'
import { ShopifyError } from '../errors'

export const DISCOUNT_CODE_BASIC_CREATE_MUTATION = `mutation LoyaltyDiscountCreate($basicCodeDiscount: DiscountCodeBasicInput!) { discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) { codeDiscountNode { id codeDiscount { ... on DiscountCodeBasic { title codes(first: 1) { nodes { code } } startsAt endsAt usageLimit appliesOncePerCustomer } } } userErrors { field message code } } }`

export const DISCOUNT_CODE_FREE_SHIPPING_CREATE_MUTATION = `mutation LoyaltyFreeShippingCreate($freeShippingCodeDiscount: DiscountCodeFreeShippingInput!) { discountCodeFreeShippingCreate(freeShippingCodeDiscount: $freeShippingCodeDiscount) { codeDiscountNode { id codeDiscount { ... on DiscountCodeFreeShipping { title codes(first: 1) { nodes { code } } startsAt endsAt usageLimit appliesOncePerCustomer } } } userErrors { field message code } } }`

export const DISCOUNT_CODE_DELETE_MUTATION = `mutation LoyaltyDiscountDelete($id: ID!) { discountCodeDelete(id: $id) { deletedCodeDiscountId userErrors { field message } } }`

/** A single-use, customer-locked code. `amount` is a decimal string ("5.00"); `percentage` is 0–1. */
export type CustomerDiscountCodeInput = {
  title: string
  code: string
  customerGid: string
  /** ISO timestamps. */
  startsAt: string
  endsAt: string
  value: { amount: string } | { percentage: number }
}

export type FreeShippingCodeInput = Omit<CustomerDiscountCodeInput, 'value'>

export type CreatedDiscountCode = { discountId: string; code: string; endsAt: string }

type CodeDiscountNode = {
  id: string
  codeDiscount: {
    title: string
    codes: { nodes: { code: string }[] }
    startsAt: string
    endsAt: string | null
    usageLimit: number | null
    appliesOncePerCustomer: boolean
  } | null
} | null

type BasicCreateData = { discountCodeBasicCreate: { codeDiscountNode: CodeDiscountNode } }
type FreeShippingCreateData = {
  discountCodeFreeShippingCreate: { codeDiscountNode: CodeDiscountNode }
}
type DeleteData = { discountCodeDelete: { deletedCodeDiscountId: string | null } }

/** `DiscountCodeBasicInput` for one customer, one use, all items. */
export function buildBasicDiscountInput(input: CustomerDiscountCodeInput) {
  return {
    title: input.title,
    code: input.code,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    usageLimit: 1,
    appliesOncePerCustomer: true,
    context: { customers: { add: [input.customerGid] } },
    customerGets: {
      value:
        'percentage' in input.value
          ? { percentage: input.value.percentage }
          : { discountAmount: { amount: input.value.amount, appliesOnEachItem: false } },
      items: { all: true },
    },
  }
}

/** `DiscountCodeFreeShippingInput` for one customer, one use, every destination. */
export function buildFreeShippingInput(input: FreeShippingCodeInput) {
  return {
    title: input.title,
    code: input.code,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    usageLimit: 1,
    appliesOncePerCustomer: true,
    context: { customers: { add: [input.customerGid] } },
    destination: { all: true },
  }
}

function toCreated(node: CodeDiscountNode, fallback: { code: string; endsAt: string }): CreatedDiscountCode {
  if (!node) throw new ShopifyError('Shopify did not return a discount node')
  return {
    discountId: node.id,
    code: node.codeDiscount?.codes.nodes[0]?.code ?? fallback.code,
    endsAt: node.codeDiscount?.endsAt ?? fallback.endsAt,
  }
}

export async function createCustomerDiscountCode(
  input: CustomerDiscountCodeInput
): Promise<CreatedDiscountCode> {
  const data = await adminRequest<BasicCreateData>(DISCOUNT_CODE_BASIC_CREATE_MUTATION, {
    basicCodeDiscount: buildBasicDiscountInput(input),
  })
  assertNoUserErrors(data, 'discountCodeBasicCreate')
  return toCreated(data.discountCodeBasicCreate.codeDiscountNode, input)
}

export async function createFreeShippingCode(
  input: FreeShippingCodeInput
): Promise<CreatedDiscountCode> {
  const data = await adminRequest<FreeShippingCreateData>(
    DISCOUNT_CODE_FREE_SHIPPING_CREATE_MUTATION,
    { freeShippingCodeDiscount: buildFreeShippingInput(input) }
  )
  assertNoUserErrors(data, 'discountCodeFreeShippingCreate')
  return toCreated(data.discountCodeFreeShippingCreate.codeDiscountNode, input)
}

/** Deletes a code discount node; returns the deleted id (null when Shopify reports none). */
export async function deleteDiscountCode(discountId: string): Promise<string | null> {
  const data = await adminRequest<DeleteData>(DISCOUNT_CODE_DELETE_MUTATION, { id: discountId })
  assertNoUserErrors(data, 'discountCodeDelete')
  return data.discountCodeDelete.deletedCodeDiscountId
}
