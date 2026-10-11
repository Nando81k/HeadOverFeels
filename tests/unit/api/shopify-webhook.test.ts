// tests/unit/api/shopify-webhook.test.ts — POST /api/webhooks/shopify
import { createHmac } from 'node:crypto'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import fixture from '@/tests/fixtures/shopify/webhooks/orders-paid.json'

vi.mock('server-only', () => ({}))

const { db, bridge } = vi.hoisted(() => ({
  db: { shopifyWebhookEvent: { create: vi.fn(), update: vi.fn() } },
  bridge: {
    parseOrdersPaid: vi.fn(),
    awardPointsForPaidOrder: vi.fn(),
    syncCustomerFromShopify: vi.fn(),
    restoreRedemptionsForCancelledOrder: vi.fn(),
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/loyalty/shopify-bridge', () => bridge)

import { POST, runtime } from '@/app/api/webhooks/shopify/route'

const SECRET = 'shpss_test_secret'
const WEBHOOK_ID = 'b54557e4-bdd9-4b37-8a5f-bf7d70bcd043'

function sign(raw: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(raw, 'utf8').digest('base64')
}

function request(
  body: string,
  overrides: { hmac?: string | null; topic?: string | null; id?: string | null; shop?: string | null } = {}
): Request {
  const headers = new Headers({ 'content-type': 'application/json' })
  const hmac = overrides.hmac === undefined ? sign(body) : overrides.hmac
  if (hmac !== null) headers.set('X-Shopify-Hmac-Sha256', hmac)
  const topic = overrides.topic === undefined ? 'orders/paid' : overrides.topic
  if (topic !== null) headers.set('X-Shopify-Topic', topic)
  const id = overrides.id === undefined ? WEBHOOK_ID : overrides.id
  if (id !== null) headers.set('X-Shopify-Webhook-Id', id)
  const shop = overrides.shop === undefined ? 'tgqucm-qg.myshopify.com' : overrides.shop
  if (shop !== null) headers.set('X-Shopify-Shop-Domain', shop)
  return new Request('http://localhost:3000/api/webhooks/shopify', { method: 'POST', headers, body })
}

const body = JSON.stringify(fixture)
let consoleError: ReturnType<typeof vi.spyOn>
let consoleLog: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.clearAllMocks()
  process.env.SHOPIFY_WEBHOOK_SECRET = SECRET
  db.shopifyWebhookEvent.create.mockResolvedValue({})
  db.shopifyWebhookEvent.update.mockResolvedValue({})
  bridge.parseOrdersPaid.mockReturnValue({ orderGid: fixture.admin_graphql_api_id, webhookId: WEBHOOK_ID })
  bridge.awardPointsForPaidOrder.mockResolvedValue({ customerId: 'cus_1', pointsAwarded: 151, firstOrder: true, redemptionsUsed: [] })
  bridge.syncCustomerFromShopify.mockResolvedValue({ customerId: 'cus_1' })
  bridge.restoreRedemptionsForCancelledOrder.mockResolvedValue(['red_1'])
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  consoleError.mockRestore()
  consoleLog.mockRestore()
})

describe('POST /api/webhooks/shopify', () => {
  it('runs on the Node runtime (needs node:crypto + raw body)', () => {
    expect(runtime).toBe('nodejs')
  })

  it('returns 500 and logs when the secret is missing, before reading anything', async () => {
    process.env.SHOPIFY_WEBHOOK_SECRET = '   '
    const response = await POST(request(body))
    expect(response.status).toBe(500)
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('SHOPIFY_WEBHOOK_SECRET'))
    expect(db.shopifyWebhookEvent.create).not.toHaveBeenCalled()
  })

  it('rejects a missing, wrong-length or wrong-secret HMAC with 401 and no side effects', async () => {
    for (const hmac of [null, 'short', sign(body, 'other-secret'), sign(`${body} `)]) {
      const response = await POST(request(body, { hmac }))
      expect(response.status).toBe(401)
    }
    expect(db.shopifyWebhookEvent.create).not.toHaveBeenCalled()
    expect(bridge.awardPointsForPaidOrder).not.toHaveBeenCalled()
  })

  it('accepts a valid HMAC over the exact raw body, records the event first, awards points and marks it processed', async () => {
    const response = await POST(request(body))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'processed' })

    expect(db.shopifyWebhookEvent.create).toHaveBeenCalledWith({
      data: { id: WEBHOOK_ID, topic: 'orders/paid', shopDomain: 'tgqucm-qg.myshopify.com' },
    })
    expect(bridge.parseOrdersPaid).toHaveBeenCalledWith(fixture, { webhookId: WEBHOOK_ID })
    expect(bridge.awardPointsForPaidOrder).toHaveBeenCalledWith({ orderGid: fixture.admin_graphql_api_id, webhookId: WEBHOOK_ID })
    expect(db.shopifyWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: WEBHOOK_ID },
      data: { status: 'processed', processedAt: expect.any(Date), error: null },
    })
    // create happens before any processing
    const createOrder = db.shopifyWebhookEvent.create.mock.invocationCallOrder[0]
    const awardOrder = bridge.awardPointsForPaidOrder.mock.invocationCallOrder[0]
    expect(createOrder).toBeLessThan(awardOrder)
  })

  it('short-circuits a duplicate webhook id (P2002) with 200 { duplicate: true }', async () => {
    db.shopifyWebhookEvent.create.mockRejectedValue({ code: 'P2002' })
    const response = await POST(request(body))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, duplicate: true })
    expect(bridge.awardPointsForPaidOrder).not.toHaveBeenCalled()
    expect(db.shopifyWebhookEvent.update).not.toHaveBeenCalled()
  })

  it('answers 400 when the webhook id or topic header is missing', async () => {
    expect((await POST(request(body, { id: null }))).status).toBe(400)
    expect((await POST(request(body, { topic: null }))).status).toBe(400)
    expect(db.shopifyWebhookEvent.create).not.toHaveBeenCalled()
  })

  it('marks a failed handler as failed with the message only and still answers 200', async () => {
    bridge.awardPointsForPaidOrder.mockRejectedValue(new Error('Customer not found'))
    const response = await POST(request(body))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true, status: 'failed' })
    expect(db.shopifyWebhookEvent.update).toHaveBeenCalledWith({
      where: { id: WEBHOOK_ID },
      data: { status: 'failed', processedAt: expect.any(Date), error: 'Customer not found' },
    })
    const logged = consoleError.mock.calls.map((call: unknown[]) => String(call[0])).join('\n')
    expect(logged).toContain(WEBHOOK_ID)
    expect(logged).not.toContain('HOF-DISC-K7M2P9')
    expect(logged).not.toContain(SECRET)
  })

  it('treats an unparsable body as a failed event (signature was valid)', async () => {
    const raw = '{not json'
    const response = await POST(request(raw))
    expect(response.status).toBe(200)
    expect(db.shopifyWebhookEvent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'failed', error: 'Invalid JSON body' }) }))
  })

  it('routes customers/update to the identity sync', async () => {
    const payload = JSON.stringify({ id: 8125374129377, admin_graphql_api_id: 'gid://shopify/Customer/8125374129377', email: 'new@example.com', first_name: 'Nando', last_name: 'Rivera' })
    const response = await POST(request(payload, { topic: 'customers/update' }))
    expect(response.status).toBe(200)
    expect(bridge.syncCustomerFromShopify).toHaveBeenCalledWith({ shopifyCustomerId: 'gid://shopify/Customer/8125374129377', email: 'new@example.com', firstName: 'Nando', lastName: 'Rivera' })
  })

  it('routes orders/cancelled to redemption restore and builds the gid from a numeric id when needed', async () => {
    await POST(request(JSON.stringify({ id: 6213458182369 }), { topic: 'orders/cancelled' }))
    expect(bridge.restoreRedemptionsForCancelledOrder).toHaveBeenCalledWith('gid://shopify/Order/6213458182369')
  })

  it('records refunds/create and unknown topics as processed without side effects', async () => {
    for (const topic of ['refunds/create', 'products/update']) {
      const response = await POST(request(JSON.stringify({ id: 1, order_id: 2 }), { topic }))
      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toEqual({ ok: true, status: 'processed' })
    }
    expect(bridge.awardPointsForPaidOrder).not.toHaveBeenCalled()
    expect(bridge.restoreRedemptionsForCancelledOrder).not.toHaveBeenCalled()
    expect(bridge.syncCustomerFromShopify).not.toHaveBeenCalled()
  })
})
