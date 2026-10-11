import 'server-only'

import type { CustomerOrder, CustomerOrderCard, CustomerOrdersPage, Money } from '../../types'
import { customerFetch } from '../client'
import { toCustomerImage, type RawCustomerImage } from './shared'

/**
 * Customer orders (list + detail). Documents copied verbatim from the Phase 4
 * plan's "Validated documents" (validated 2026-10-11 against the `customer`
 * schema, `statusPageUrl` on the list included).
 *
 * Card status: the Customer Account API exposes per-fulfillment
 * `FulfillmentStatus` (`SUCCESS`, `OPEN`, `PENDING`, `CANCELLED`, `ERROR`,
 * `FAILURE`) rather than an order-level fulfillment status, so the card reads
 * the first fulfillment: none → `UNFULFILLED`, `SUCCESS` → `FULFILLED`,
 * `OPEN`/`PENDING` → `IN_PROGRESS`, `CANCELLED` → `CANCELLED`, else `UNKNOWN`.
 * In-transit vs delivered is not in these documents (that would need
 * fulfillment events); the order page links `statusPageUrl` for that.
 */

// ---------------------------------------------------------------- documents

export const CUSTOMER_ORDERS_QUERY =
  'query CustomerOrders($first: Int!, $after: String) { customer { orders(first: $first, after: $after, sortKey: PROCESSED_AT, reverse: true) { pageInfo { hasNextPage endCursor } nodes { id name number processedAt financialStatus statusPageUrl fulfillments(first: 1) { nodes { status } } totalPrice { amount currencyCode } lineItems(first: 3) { nodes { id title quantity image { url altText } } } } } } }'

export const CUSTOMER_ORDER_QUERY =
  'query CustomerOrder($id: ID!) { order(id: $id) { id name number processedAt financialStatus cancelledAt statusPageUrl totalPrice { amount currencyCode } subtotal { amount currencyCode } totalShipping { amount currencyCode } totalTax { amount currencyCode } shippingAddress { formatted } lineItems(first: 50) { nodes { id title quantity variantTitle image { url altText } price { amount currencyCode } totalPrice { amount currencyCode } } } fulfillments(first: 10) { nodes { id status createdAt trackingInformation { number company url } } } discountApplications(first: 10) { nodes { value { ... on MoneyV2 { amount currencyCode } ... on PricingPercentageValue { percentage } } } } } }'

// ---------------------------------------------------------------- raw shapes

type RawMoney = { amount: string; currencyCode: string }

export type RawFulfillmentStatusNode = { status: string | null }

export type RawOrderCard = {
  id: string
  name: string
  number: number
  processedAt: string
  financialStatus: string | null
  statusPageUrl: string | null
  fulfillments: { nodes: RawFulfillmentStatusNode[] } | null
  totalPrice: RawMoney
  lineItems: { nodes: { id: string; title: string; quantity: number; image: RawCustomerImage }[] } | null
}

export type RawOrdersResponse = {
  customer: {
    orders: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null }
      nodes: RawOrderCard[]
    }
  } | null
}

export type RawOrderLine = {
  id: string
  title: string
  quantity: number
  variantTitle: string | null
  image: RawCustomerImage
  price: RawMoney | null
  totalPrice: RawMoney | null
}

export type RawFulfillment = {
  id: string
  status: string | null
  createdAt: string
  trackingInformation: { number: string | null; company: string | null; url: string | null }[] | null
}

export type RawDiscountValue = { amount?: string; currencyCode?: string; percentage?: number }

export type RawOrder = {
  id: string
  name: string
  number: number
  processedAt: string
  financialStatus: string | null
  cancelledAt: string | null
  statusPageUrl: string | null
  totalPrice: RawMoney
  subtotal: RawMoney | null
  totalShipping: RawMoney | null
  totalTax: RawMoney | null
  shippingAddress: { formatted: string[] | null } | null
  lineItems: { nodes: RawOrderLine[] } | null
  fulfillments: { nodes: RawFulfillment[] } | null
  discountApplications: { nodes: { value: RawDiscountValue | null }[] } | null
}

export type RawOrderResponse = { order: RawOrder | null }

// ---------------------------------------------------------------- normalisers

function money(raw: RawMoney | null | undefined): Money | null {
  return raw ? { amount: raw.amount, currencyCode: raw.currencyCode } : null
}

export function toFulfillmentStatus(
  fulfillments: RawFulfillmentStatusNode[] | null | undefined
): CustomerOrderCard['fulfillmentStatus'] {
  const first = fulfillments?.[0]
  if (!first) return 'UNFULFILLED'
  switch (first.status) {
    case 'SUCCESS':
      return 'FULFILLED'
    case 'OPEN':
    case 'PENDING':
      return 'IN_PROGRESS'
    case 'CANCELLED':
      return 'CANCELLED'
    default:
      return 'UNKNOWN'
  }
}

export function normalizeOrderCard(raw: RawOrderCard): CustomerOrderCard {
  return {
    id: raw.id,
    name: raw.name,
    number: raw.number,
    processedAt: raw.processedAt,
    financialStatus: raw.financialStatus ?? null,
    fulfillmentStatus: toFulfillmentStatus(raw.fulfillments?.nodes),
    total: { amount: raw.totalPrice.amount, currencyCode: raw.totalPrice.currencyCode },
    lineItems: (raw.lineItems?.nodes ?? []).map((line) => ({
      id: line.id,
      title: line.title,
      quantity: line.quantity,
      image: toCustomerImage(line.image),
    })),
    statusPageUrl: raw.statusPageUrl ?? null,
  }
}

export function normalizeOrdersPage(raw: RawOrdersResponse): CustomerOrdersPage {
  const connection = raw.customer?.orders
  if (!connection) return { orders: [], hasNextPage: false, endCursor: null }
  return {
    orders: connection.nodes.map(normalizeOrderCard),
    hasNextPage: Boolean(connection.pageInfo?.hasNextPage),
    endCursor: connection.pageInfo?.endCursor ?? null,
  }
}

function toDiscount(value: RawDiscountValue | null): CustomerOrder['discounts'][number] {
  const amount =
    value && typeof value.amount === 'string' && typeof value.currencyCode === 'string'
      ? { amount: value.amount, currencyCode: value.currencyCode }
      : null
  const percentage =
    value && typeof value.percentage === 'number' && Number.isFinite(value.percentage)
      ? value.percentage
      : null
  return { amount, percentage }
}

export function normalizeOrder(raw: RawOrder): CustomerOrder {
  const lines = raw.lineItems?.nodes ?? []
  const fulfillments = raw.fulfillments?.nodes ?? []
  const card = normalizeOrderCard({
    id: raw.id,
    name: raw.name,
    number: raw.number,
    processedAt: raw.processedAt,
    financialStatus: raw.financialStatus,
    statusPageUrl: raw.statusPageUrl,
    fulfillments: { nodes: fulfillments.map((f) => ({ status: f.status })) },
    totalPrice: raw.totalPrice,
    lineItems: { nodes: lines.map((l) => ({ id: l.id, title: l.title, quantity: l.quantity, image: l.image })) },
  })

  return {
    ...card,
    subtotal: money(raw.subtotal),
    shipping: money(raw.totalShipping),
    tax: money(raw.totalTax),
    cancelledAt: raw.cancelledAt ?? null,
    shippingAddress: raw.shippingAddress?.formatted ?? null,
    discounts: (raw.discountApplications?.nodes ?? []).map((node) => toDiscount(node.value)),
    lines: lines.map((line) => ({
      id: line.id,
      title: line.title,
      variantTitle: line.variantTitle ?? null,
      quantity: line.quantity,
      image: toCustomerImage(line.image),
      unitPrice: money(line.price),
      total: money(line.totalPrice),
    })),
    fulfillments: fulfillments.map((f) => ({
      id: f.id,
      status: f.status ?? 'UNKNOWN',
      createdAt: f.createdAt,
      tracking: (f.trackingInformation ?? []).map((t) => ({
        number: t.number ?? null,
        company: t.company ?? null,
        url: t.url ?? null,
      })),
    })),
  }
}

// ---------------------------------------------------------------- fetchers

export type GetCustomerOrdersArgs = { first?: number; after?: string | null }

export async function getCustomerOrders(
  token: string,
  { first = 10, after }: GetCustomerOrdersArgs = {}
): Promise<CustomerOrdersPage> {
  const data = await customerFetch<RawOrdersResponse>(CUSTOMER_ORDERS_QUERY, {
    accessToken: token,
    variables: { first, after: after ?? null },
  })
  return normalizeOrdersPage(data)
}

/** `null` when Shopify returns `order: null` (not this customer's order, or gone). */
export async function getCustomerOrder(token: string, id: string): Promise<CustomerOrder | null> {
  const data = await customerFetch<RawOrderResponse>(CUSTOMER_ORDER_QUERY, {
    accessToken: token,
    variables: { id },
  })
  return data.order ? normalizeOrder(data.order) : null
}
