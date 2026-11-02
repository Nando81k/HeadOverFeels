// lib/storefront/back-in-stock.ts
//
// Back-in-stock alerts keyed by Shopify ids (Phase 5 plan, Task 3). Server-only.
//
// A subscription is one `BackInStockNotification` row per (variant gid, email),
// `PENDING` until a `products/update` webhook reports that variant available
// again; the email goes out through the shared sender and the row flips to
// `NOTIFIED`. The legacy Prisma product id is filled in when a product with
// that slug exists so `/admin` stats keep working.

import 'server-only'

import { sendBackInStockEmail, isBackInStockEmailConfigured } from '@/lib/back-in-stock/send'
import { prisma } from '@/lib/prisma'

export type SubscribeInput = {
  /** Shopify variant gid. */
  variantId: string
  handle: string
  email: string
  customerId?: string | null
}

export type SubscribeResult = { id: string; status: 'PENDING'; email: string }

export type WebhookVariant = {
  /** Shopify variant gid. */
  id: string
  title: string
  availableForSale: boolean
}

export type ProductsUpdate = {
  productGid: string | null
  handle: string | null
  title: string
  variants: WebhookVariant[]
}

export type NotifyResult = {
  /** Variants in the payload that are available again. */
  available: number
  /** Rows marked NOTIFIED. */
  sent: number
  /** Rows left PENDING after a failed send. */
  failed: number
  /** Rows marked NOTIFIED-by-skip (no email configured, nothing sent). */
  skipped: number
}

/** Subscriptions expire quietly after this many days. */
export const BACK_IN_STOCK_TTL_DAYS = 90

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL || 'https://headoverfeels.com').replace(/\/+$/, '')
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** Signed link that cancels one row; the id is unguessable and the email must match. */
export function unsubscribeUrl(id: string, email: string): string {
  const params = new URLSearchParams({ id, email })
  return `${baseUrl()}/back-in-stock/unsubscribe?${params.toString()}`
}

// ------------------------------------------------------------- subscribe

export async function subscribe(input: SubscribeInput): Promise<SubscribeResult> {
  const email = normalizeEmail(input.email)
  const expiresAt = new Date(Date.now() + BACK_IN_STOCK_TTL_DAYS * 24 * 60 * 60 * 1000)
  const product = await prisma.product.findUnique({ where: { slug: input.handle }, select: { id: true } })

  const row = await prisma.backInStockNotification.upsert({
    where: { shopifyVariantId_email: { shopifyVariantId: input.variantId, email } },
    update: {
      status: 'PENDING',
      productHandle: input.handle,
      productId: product?.id ?? null,
      customerId: input.customerId ?? undefined,
      expiresAt,
      notifiedAt: null,
    },
    create: {
      shopifyVariantId: input.variantId,
      productHandle: input.handle,
      productId: product?.id ?? null,
      email,
      customerId: input.customerId ?? null,
      expiresAt,
    },
    select: { id: true },
  })
  return { id: row.id, status: 'PENDING', email }
}

/** Cancels one subscription from its unsubscribe link. False when nothing matched. */
export async function cancelSubscription(id: string, email: string): Promise<boolean> {
  const result = await prisma.backInStockNotification.updateMany({
    where: { id, email: normalizeEmail(email), status: 'PENDING' },
    data: { status: 'CANCELLED' },
  })
  return result.count > 0
}

// ------------------------------------------------------------- webhook

type Rec = Record<string, unknown>
const asRecord = (value: unknown): Rec =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Rec) : {}
const str = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null

function variantGid(variant: Rec): string | null {
  const gid = str(variant.admin_graphql_api_id)
  if (gid) return gid
  const id = variant.id
  if (typeof id === 'number' || (typeof id === 'string' && id.trim())) return `gid://shopify/ProductVariant/${id}`
  return null
}

/**
 * Is the variant purchasable per the `products/update` payload? Positive stock,
 * or a `continue` policy (oversell allowed), or inventory not tracked at all.
 */
export function variantAvailable(variant: Rec): boolean {
  const quantity = typeof variant.inventory_quantity === 'number' ? variant.inventory_quantity : 0
  if (quantity > 0) return true
  if (variant.inventory_policy === 'continue') return true
  if (variant.inventory_management === null) return true
  return false
}

/** Shape of the REST `products/update` payload we need; throws when there is no product. */
export function parseProductsUpdate(payload: unknown): ProductsUpdate {
  const product = asRecord(payload)
  const title = str(product.title)
  if (!title) throw new Error('products/update payload has no title')
  const rawVariants = Array.isArray(product.variants) ? product.variants : []
  const variants: WebhookVariant[] = []
  for (const raw of rawVariants) {
    const variant = asRecord(raw)
    const id = variantGid(variant)
    if (!id) continue
    variants.push({ id, title: str(variant.title) ?? 'Default Title', availableForSale: variantAvailable(variant) })
  }
  const productGid = str(product.admin_graphql_api_id) ?? (product.id != null ? `gid://shopify/Product/${product.id}` : null)
  return { productGid, handle: str(product.handle), title, variants }
}

/**
 * Sends every pending alert for the variants that are available again and
 * marks them `NOTIFIED`. A failed send leaves its row `PENDING` for the next
 * webhook. Without an email provider the rows are marked anyway so a later
 * configuration does not fire a backlog of stale alerts.
 */
export async function notifyVariantsBackInStock(update: ProductsUpdate): Promise<NotifyResult> {
  const result: NotifyResult = { available: 0, sent: 0, failed: 0, skipped: 0 }
  const available = update.variants.filter((variant) => variant.availableForSale)
  result.available = available.length
  if (available.length === 0) return result

  const rows = await prisma.backInStockNotification.findMany({
    where: {
      shopifyVariantId: { in: available.map((variant) => variant.id) },
      status: 'PENDING',
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true, email: true, shopifyVariantId: true, productHandle: true, customer: { select: { name: true } } },
  })
  if (rows.length === 0) return result

  const configured = isBackInStockEmailConfigured()
  const byVariant = new Map(available.map((variant) => [variant.id, variant]))
  const notified: string[] = []

  for (const row of rows) {
    const variant = row.shopifyVariantId ? byVariant.get(row.shopifyVariantId) : undefined
    const handle = row.productHandle ?? update.handle
    if (!configured) {
      notified.push(row.id)
      result.skipped += 1
      continue
    }
    const sent = await sendBackInStockEmail({
      to: row.email,
      customerName: row.customer?.name ?? undefined,
      productTitle: update.title,
      variantTitle: variant?.title ?? null,
      productUrl: handle ? `${baseUrl()}/products/${handle}` : baseUrl(),
      unsubscribeUrl: unsubscribeUrl(row.id, row.email),
    })
    if (sent.ok) {
      notified.push(row.id)
      result.sent += 1
    } else {
      result.failed += 1
      console.error(`[back-in-stock] send failed for subscription ${row.id}: ${sent.error}`)
    }
  }

  if (notified.length > 0) {
    try {
      await prisma.backInStockNotification.updateMany({
        where: { id: { in: notified } },
        data: { status: 'NOTIFIED', notifiedAt: new Date() },
      })
    } catch (error) {
      console.error(`[back-in-stock] could not mark ${notified.length} rows notified: ${errorMessage(error)}`)
    }
  }
  return result
}
