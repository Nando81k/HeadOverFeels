import { createHmac, timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import {
  awardPointsForPaidOrder,
  parseOrdersPaid,
  restoreRedemptionsForCancelledOrder,
  syncCustomerFromShopify,
} from '@/lib/loyalty/shopify-bridge'
import { prisma } from '@/lib/prisma'

/**
 * POST /api/webhooks/shopify — Shopify Admin webhooks for the Care Points program
 * (Phase 4, Task 2). Mirrors the Stripe webhook's HMAC + idempotency pattern:
 *
 * 1. Missing `SHOPIFY_WEBHOOK_SECRET` → 500 (logged once per request).
 * 2. HMAC: base64(HMAC-SHA256(secret, raw body)) vs `X-Shopify-Hmac-Sha256`,
 *    compared with `timingSafeEqual` (lengths checked first) → 401 on mismatch.
 * 3. `ShopifyWebhookEvent` is inserted by `X-Shopify-Webhook-Id` BEFORE any side
 *    effect; a P2002 means Shopify retried → 200 `{ ok: true, duplicate: true }`.
 * 4. The topic is processed inline (Vercel has no queue). Any failure marks the
 *    row `failed` with the error message and still answers 200 so Shopify does
 *    not retry forever; the per-award idempotency keys make a manual replay safe.
 *
 * Never logs tokens, codes or raw bodies: only webhookId, topic, gids, messages.
 */

export const runtime = 'nodejs'

type Outcome = Record<string, unknown>

function verifyHmac(raw: string, header: string | null, secret: string): boolean {
  if (!header) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(raw, 'utf8').digest('base64'))
  const received = Buffer.from(header)
  if (expected.length !== received.length) return false
  return timingSafeEqual(expected, received)
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/** `admin_graphql_api_id` when present, else a gid built from the numeric `id`. */
function gidOf(record: Record<string, unknown>, resource: 'Customer' | 'Order'): string | null {
  const gid = stringOrNull(record.admin_graphql_api_id)
  if (gid) return gid
  const id = record.id
  if (typeof id === 'number' || (typeof id === 'string' && id.trim().length > 0)) {
    return `gid://shopify/${resource}/${id}`
  }
  return null
}

async function handleTopic(topic: string, payload: unknown, webhookId: string): Promise<Outcome> {
  switch (topic) {
    case 'orders/paid': {
      const order = parseOrdersPaid(payload, { webhookId })
      const result = await awardPointsForPaidOrder(order)
      console.log(
        `[shopify-webhook] ${webhookId} orders/paid ${order.orderGid} → customer ${result.customerId ?? 'none'}, +${result.pointsAwarded} pts${result.firstOrder ? ' (first order)' : ''}`
      )
      return { orderGid: order.orderGid, ...result }
    }
    case 'customers/update': {
      const customer = asRecord(payload)
      const shopifyCustomerId = gidOf(customer, 'Customer')
      if (!shopifyCustomerId) return { skipped: 'no customer id' }
      const result = await syncCustomerFromShopify({
        shopifyCustomerId,
        email: stringOrNull(customer.email),
        firstName: stringOrNull(customer.first_name),
        lastName: stringOrNull(customer.last_name),
      })
      return { shopifyCustomerId, ...result }
    }
    case 'orders/cancelled': {
      const order = asRecord(payload)
      const orderGid = gidOf(order, 'Order')
      if (!orderGid) return { skipped: 'no order id' }
      const restored = await restoreRedemptionsForCancelledOrder(orderGid)
      return { orderGid, redemptionsRestored: restored }
    }
    case 'refunds/create': {
      // Partial refunds cannot be sized from the refund payload alone; only a full
      // cancellation (`orders/cancelled`) returns a redeemed code. Recorded, no action.
      const refund = asRecord(payload)
      return { skipped: 'partial refunds are not reversed', orderId: refund.order_id ?? null }
    }
    default:
      return { skipped: 'unhandled topic' }
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const secret = (process.env.SHOPIFY_WEBHOOK_SECRET ?? '').trim()
  if (!secret) {
    console.error('[shopify-webhook] SHOPIFY_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
  }

  const raw = await request.text()
  if (!verifyHmac(raw, request.headers.get('x-shopify-hmac-sha256'), secret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const webhookId = request.headers.get('x-shopify-webhook-id')?.trim() ?? ''
  const topic = request.headers.get('x-shopify-topic')?.trim() ?? ''
  const shopDomain = request.headers.get('x-shopify-shop-domain')?.trim() ?? ''
  if (!webhookId || !topic) {
    return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 })
  }

  try {
    await prisma.shopifyWebhookEvent.create({ data: { id: webhookId, topic, shopDomain } })
  } catch (error) {
    if (isUniqueViolation(error)) return NextResponse.json({ ok: true, duplicate: true })
    console.error(`[shopify-webhook] ${webhookId} could not be recorded: ${errorMessage(error)}`)
    return NextResponse.json({ error: 'Could not record webhook' }, { status: 500 })
  }

  let status: 'processed' | 'failed' = 'processed'
  let failure: string | null = null
  try {
    let payload: unknown
    try {
      payload = JSON.parse(raw)
    } catch {
      throw new Error('Invalid JSON body')
    }
    await handleTopic(topic, payload, webhookId)
  } catch (error) {
    status = 'failed'
    failure = errorMessage(error)
    console.error(`[shopify-webhook] ${webhookId} ${topic} failed: ${failure}`)
  }

  try {
    await prisma.shopifyWebhookEvent.update({
      where: { id: webhookId },
      data: { status, processedAt: new Date(), error: failure },
    })
  } catch (error) {
    console.error(`[shopify-webhook] ${webhookId} status update failed: ${errorMessage(error)}`)
  }

  return NextResponse.json({ ok: true, status })
}
