// tests/unit/app/admin/fulfillment/actions.test.ts
//
// Task 3 — Wave 2 (Phase 4) server actions test suite.
//
// NOTE on getOrderDetailForInspector / getReturnDetailForInspector:
//   The plan says to import loaders from lib/admin/fulfillment.ts, but that file
//   is being built in parallel (Task 2). To avoid import conflicts we INLINE the
//   Prisma query directly inside actions.ts. The test therefore exercises those
//   actions via the same orderFindUnique / returnFindUnique mocks, not via a
//   vi.doMock of the loader module.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn(async () => 'admin-123'),
  requireAdminRole: vi.fn(async () => 'super-456'),
}))

const orderUpdate = vi.fn()
const orderFindUnique = vi.fn()
const orderFindMany = vi.fn()
const returnCreate = vi.fn()
const returnUpdate = vi.fn()
const returnFindUnique = vi.fn()
const refundRecordCreate = vi.fn()
const rmaCounterUpdate = vi.fn()
const queryRaw = vi.fn()
const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    order: { update: orderUpdate, findUnique: orderFindUnique },
    return: { create: returnCreate, update: returnUpdate, findUnique: returnFindUnique },
    refundRecord: { create: refundRecordCreate },
    rmaCounter: { update: rmaCounterUpdate },
    $queryRaw: queryRaw,
  })
)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    order: { update: orderUpdate, findUnique: orderFindUnique, findMany: orderFindMany },
    return: { create: returnCreate, update: returnUpdate, findUnique: returnFindUnique },
    refundRecord: { create: refundRecordCreate },
    $transaction: transaction,
  },
}))

const purchaseOutboundLabel = vi.fn()
const createReturnLabel = vi.fn()
vi.mock('@/lib/shipping/easypost', () => ({
  purchaseOutboundLabel,
  createReturnLabel,
}))

const processStripeRefund = vi.fn()
vi.mock('@/lib/stripe/refunds', () => ({ processStripeRefund }))

const getNextRmaNumber = vi.fn()
vi.mock('@/lib/admin/rma-counter', () => ({ getNextRmaNumber }))

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── updateOrderStatus ────────────────────────────────────────────────────────

describe('updateOrderStatus', () => {
  it('updates the order status and returns ok', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { updateOrderStatus } = await import('@/app/admin/fulfillment/actions')
    const r = await updateOrderStatus('o1', 'PROCESSING')
    expect(r.ok).toBe(true)
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { status: 'PROCESSING' },
    })
  })
})

// ─── saveOrderNotes ───────────────────────────────────────────────────────────

describe('saveOrderNotes', () => {
  it('updates both notes fields', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { saveOrderNotes } = await import('@/app/admin/fulfillment/actions')
    const r = await saveOrderNotes('o1', { internalNotes: 'hi', notes: 'thanks' })
    expect(r.ok).toBe(true)
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'o1' },
      data: { internalNotes: 'hi', notes: 'thanks' },
    })
  })

  it('only updates provided fields', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { saveOrderNotes } = await import('@/app/admin/fulfillment/actions')
    await saveOrderNotes('o1', { internalNotes: 'admin only' })
    const data = orderUpdate.mock.calls[0][0].data
    expect(data.internalNotes).toBe('admin only')
    expect(data.notes).toBeUndefined()
  })
})

// ─── setTracking ─────────────────────────────────────────────────────────────

describe('setTracking', () => {
  it('updates tracking number and carrier', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { setTracking } = await import('@/app/admin/fulfillment/actions')
    const r = await setTracking('o1', { trackingNumber: '1Z', carrier: 'UPS' })
    expect(r.ok).toBe(true)
    expect(orderUpdate.mock.calls[0][0].data.trackingNumber).toBe('1Z')
    expect(orderUpdate.mock.calls[0][0].data.carrier).toBe('UPS')
  })
})

// ─── purchaseShippingLabel ────────────────────────────────────────────────────

describe('purchaseShippingLabel — idempotency', () => {
  it('short-circuits when order already has tracking', async () => {
    orderFindUnique.mockResolvedValue({
      id: 'o1',
      trackingNumber: 'EXISTING',
      carrier: 'USPS',
      trackingUrl: 'http://t',
    })
    const { purchaseShippingLabel } = await import('@/app/admin/fulfillment/actions')
    const r = await purchaseShippingLabel('o1')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data?.trackingNumber).toBe('EXISTING')
    }
    expect(purchaseOutboundLabel).not.toHaveBeenCalled()
  })

  it('calls EasyPost when no tracking yet, then updates order', async () => {
    orderFindUnique.mockResolvedValue({ id: 'o1', trackingNumber: null })
    purchaseOutboundLabel.mockResolvedValue({
      success: true,
      trackingNumber: 'NEW123',
      trackingUrl: 'http://new',
      carrier: 'UPS',
      labelUrl: 'http://label',
    })
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { purchaseShippingLabel } = await import('@/app/admin/fulfillment/actions')
    const r = await purchaseShippingLabel('o1')
    expect(r.ok).toBe(true)
    expect(purchaseOutboundLabel).toHaveBeenCalledWith('o1', undefined)
  })

  it('returns error when order not found', async () => {
    orderFindUnique.mockResolvedValue(null)
    const { purchaseShippingLabel } = await import('@/app/admin/fulfillment/actions')
    const r = await purchaseShippingLabel('o1')
    expect(r.ok).toBe(false)
  })
})

// ─── sendTrackingEmail ────────────────────────────────────────────────────────

describe('sendTrackingEmail', () => {
  it('stamps updatedAt and returns ok', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { sendTrackingEmail } = await import('@/app/admin/fulfillment/actions')
    const r = await sendTrackingEmail('o1')
    expect(r.ok).toBe(true)
    expect(orderUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'o1' } }))
  })
})

// ─── createReturn ─────────────────────────────────────────────────────────────

describe('createReturn', () => {
  it('writes a Return and returns the rmaNumber', async () => {
    getNextRmaNumber.mockResolvedValue('RMA-100000')
    returnCreate.mockResolvedValue({ id: 'r1', rmaNumber: 'RMA-100000' })
    orderFindUnique.mockResolvedValue({ id: 'o1', customerId: 'c1' })
    const { createReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await createReturn(
      'o1',
      [{ orderItemId: 'i1', quantity: 1, condition: 'UNOPENED' }],
      'Wrong color',
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.rmaNumber).toBe('RMA-100000')
  })

  it('rejects empty items array', async () => {
    const { createReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await createReturn('o1', [], 'reason')
    expect(r.ok).toBe(false)
  })

  it('rejects blank reason', async () => {
    const { createReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await createReturn('o1', [{ orderItemId: 'i1', quantity: 1, condition: 'UNOPENED' }], '  ')
    expect(r.ok).toBe(false)
  })

  it('returns error when order has no customerId', async () => {
    orderFindUnique.mockResolvedValue(null)
    const { createReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await createReturn('o1', [{ orderItemId: 'i1', quantity: 1, condition: 'UNOPENED' }], 'reason')
    expect(r.ok).toBe(false)
  })
})

// ─── approveReturn ────────────────────────────────────────────────────────────

describe('approveReturn', () => {
  it('generates EasyPost return label and sets status APPROVED', async () => {
    returnFindUnique.mockResolvedValue({ id: 'r1', orderId: 'o1', status: 'REQUESTED', returnLabel: null })
    createReturnLabel.mockResolvedValue({
      success: true,
      labelUrl: 'http://lbl',
      trackingNumber: 'RT1',
      carrier: 'USPS',
    })
    returnUpdate.mockResolvedValue({ id: 'r1', returnLabel: 'http://lbl' })
    const { approveReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await approveReturn('r1')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.labelUrl).toBe('http://lbl')
    expect(returnUpdate.mock.calls[0][0].data.status).toBe('APPROVED')
  })

  it('returns error when return not found', async () => {
    returnFindUnique.mockResolvedValue(null)
    const { approveReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await approveReturn('r1')
    expect(r.ok).toBe(false)
  })

  it('returns error when EasyPost fails', async () => {
    returnFindUnique.mockResolvedValue({ id: 'r1', orderId: 'o1', status: 'REQUESTED', returnLabel: null })
    createReturnLabel.mockResolvedValue({ success: false, error: 'EasyPost down' })
    const { approveReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await approveReturn('r1')
    expect(r.ok).toBe(false)
  })

  it('skips label generation when label already exists (idempotent)', async () => {
    returnFindUnique.mockResolvedValue({
      id: 'r1',
      orderId: 'o1',
      status: 'APPROVED',
      returnLabel: 'http://existing-lbl',
    })
    returnUpdate.mockResolvedValue({ id: 'r1' })
    const { approveReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await approveReturn('r1')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.labelUrl).toBe('http://existing-lbl')
    expect(createReturnLabel).not.toHaveBeenCalled()
  })
})

// ─── rejectReturn ─────────────────────────────────────────────────────────────

describe('rejectReturn', () => {
  it('sets status REJECTED with reason appended to internalNotes', async () => {
    returnFindUnique.mockResolvedValue({ id: 'r1', orderId: 'o1', internalNotes: null })
    returnUpdate.mockResolvedValue({ id: 'r1' })
    const { rejectReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await rejectReturn('r1', 'Out of return window')
    expect(r.ok).toBe(true)
    expect(returnUpdate.mock.calls[0][0].data.status).toBe('REJECTED')
    expect(returnUpdate.mock.calls[0][0].data.internalNotes).toContain('Out of return window')
  })

  it('returns error when reason is blank', async () => {
    const { rejectReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await rejectReturn('r1', '  ')
    expect(r.ok).toBe(false)
  })

  it('returns error when return not found', async () => {
    returnFindUnique.mockResolvedValue(null)
    const { rejectReturn } = await import('@/app/admin/fulfillment/actions')
    const r = await rejectReturn('r1', 'reason')
    expect(r.ok).toBe(false)
  })
})

// ─── markReturnReceived ───────────────────────────────────────────────────────

describe('markReturnReceived', () => {
  it('sets status RECEIVED and stamps receivedAt', async () => {
    returnFindUnique.mockResolvedValue({ id: 'r1', orderId: 'o1' })
    returnUpdate.mockResolvedValue({ id: 'r1' })
    const { markReturnReceived } = await import('@/app/admin/fulfillment/actions')
    const r = await markReturnReceived('r1')
    expect(r.ok).toBe(true)
    expect(returnUpdate.mock.calls[0][0].data.status).toBe('RECEIVED')
    expect(returnUpdate.mock.calls[0][0].data.receivedAt).toBeInstanceOf(Date)
  })

  it('returns error when return not found', async () => {
    returnFindUnique.mockResolvedValue(null)
    const { markReturnReceived } = await import('@/app/admin/fulfillment/actions')
    const r = await markReturnReceived('r1')
    expect(r.ok).toBe(false)
  })
})

// ─── createRefund — SUPER_ADMIN only ─────────────────────────────────────────

describe('createRefund — SUPER_ADMIN only', () => {
  it('calls Stripe first then writes RefundRecord in transaction', async () => {
    processStripeRefund.mockResolvedValue({ success: true, refundId: 're_123', amount: 49.99 })
    refundRecordCreate.mockResolvedValue({ id: 'rr1' })
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { createRefund } = await import('@/app/admin/fulfillment/actions')
    const r = await createRefund('o1', { amount: 49.99, type: 'PARTIAL', reason: 'damaged' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.refundId).toBe('rr1')
    expect(processStripeRefund).toHaveBeenCalled()
    expect(transaction).toHaveBeenCalled()
  })

  it('does not write RefundRecord if Stripe fails', async () => {
    processStripeRefund.mockResolvedValue({ success: false, message: 'declined' })
    const { createRefund } = await import('@/app/admin/fulfillment/actions')
    const r = await createRefund('o1', { amount: 1, type: 'PARTIAL', reason: 'x' })
    expect(r.ok).toBe(false)
    expect(refundRecordCreate).not.toHaveBeenCalled()
  })

  it('rejects non-positive amounts', async () => {
    const { createRefund } = await import('@/app/admin/fulfillment/actions')
    const r = await createRefund('o1', { amount: 0, type: 'PARTIAL', reason: 'test' })
    expect(r.ok).toBe(false)
  })

  it('rejects blank reason', async () => {
    const { createRefund } = await import('@/app/admin/fulfillment/actions')
    const r = await createRefund('o1', { amount: 10, type: 'FULL', reason: '' })
    expect(r.ok).toBe(false)
  })

  it('updates Return status to REFUNDED when returnId provided', async () => {
    processStripeRefund.mockResolvedValue({ success: true, refundId: 're_456', amount: 20 })
    refundRecordCreate.mockResolvedValue({ id: 'rr2' })
    returnUpdate.mockResolvedValue({ id: 'ret1' })
    const { createRefund } = await import('@/app/admin/fulfillment/actions')
    const r = await createRefund('o1', { amount: 20, type: 'PARTIAL', reason: 'partial refund', returnId: 'ret1' })
    expect(r.ok).toBe(true)
    expect(returnUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'ret1' },
      data: { status: 'REFUNDED' },
    }))
  })
})

// ─── bulkMarkShipped ──────────────────────────────────────────────────────────

describe('bulkMarkShipped', () => {
  it('updates each order with tracking info', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { bulkMarkShipped } = await import('@/app/admin/fulfillment/actions')
    const r = await bulkMarkShipped(
      ['o1', 'o2'],
      {
        o1: { trackingNumber: '1Z', carrier: 'UPS' },
        o2: { trackingNumber: '9400' },
      },
    )
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })

  it('rejects empty array', async () => {
    const { bulkMarkShipped } = await import('@/app/admin/fulfillment/actions')
    const r = await bulkMarkShipped([], {})
    expect(r.ok).toBe(false)
  })
})

// ─── bulkPurchaseLabels ───────────────────────────────────────────────────────

describe('bulkPurchaseLabels', () => {
  it('rejects empty array', async () => {
    const { bulkPurchaseLabels } = await import('@/app/admin/fulfillment/actions')
    const r = await bulkPurchaseLabels([])
    expect(r.ok).toBe(false)
  })

  it('counts successful label purchases', async () => {
    orderFindUnique.mockResolvedValue({ id: 'o1', trackingNumber: 'EXISTING' })
    const { bulkPurchaseLabels } = await import('@/app/admin/fulfillment/actions')
    const r = await bulkPurchaseLabels(['o1'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(1)
  })
})

// ─── bulkSendTrackingEmail ────────────────────────────────────────────────────

describe('bulkSendTrackingEmail', () => {
  it('rejects empty array', async () => {
    const { bulkSendTrackingEmail } = await import('@/app/admin/fulfillment/actions')
    const r = await bulkSendTrackingEmail([])
    expect(r.ok).toBe(false)
  })

  it('returns affected count', async () => {
    orderUpdate.mockResolvedValue({ id: 'o1' })
    const { bulkSendTrackingEmail } = await import('@/app/admin/fulfillment/actions')
    const r = await bulkSendTrackingEmail(['o1', 'o2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })
})

// ─── bulkExportCsv ────────────────────────────────────────────────────────────

describe('bulkExportCsv', () => {
  it('returns error when no order IDs given', async () => {
    const { bulkExportCsv } = await import('@/app/admin/fulfillment/actions')
    const r = await bulkExportCsv([])
    expect(r.ok).toBe(false)
  })

  it('returns CSV string with header row', async () => {
    orderFindMany.mockResolvedValue([
      {
        orderNumber: 'HOF-1',
        customerEmail: 'a@b.com',
        status: 'SHIPPED',
        paymentStatus: 'PAID',
        total: 49.99,
        createdAt: new Date('2026-05-01'),
        trackingNumber: '1Z',
        carrier: 'UPS',
      },
    ])
    const { bulkExportCsv } = await import('@/app/admin/fulfillment/actions')
    const r = await bulkExportCsv(['o1'])
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.data?.csv).toContain('orderNumber')
      expect(r.data?.csv).toContain('HOF-1')
    }
  })
})

// ─── getOrderDetailForInspector ──────────────────────────────────────────────

describe('getOrderDetailForInspector', () => {
  it('returns null when order not found', async () => {
    orderFindUnique.mockResolvedValue(null)
    const { getOrderDetailForInspector } = await import('@/app/admin/fulfillment/actions')
    const r = await getOrderDetailForInspector('missing')
    expect(r).toBeNull()
  })

  it('returns order detail shape', async () => {
    orderFindUnique.mockResolvedValue({
      id: 'o1',
      orderNumber: 'HOF-1',
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      total: 100,
      subtotal: 90,
      tax: 5,
      shipping: 5,
      customerEmail: 'ada@example.com',
      customerPhone: null,
      trackingNumber: null,
      trackingUrl: null,
      carrier: null,
      shippedAt: null,
      deliveredAt: null,
      estimatedDelivery: null,
      notes: null,
      internalNotes: null,
      createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-02'),
      customer: { id: 'c1', name: 'Ada', email: 'ada@example.com' },
      shippingAddress: {
        id: 'a1',
        firstName: 'Ada',
        lastName: 'L',
        address1: '1 St',
        address2: null,
        city: 'NY',
        state: 'NY',
        postalCode: '10001',
        country: 'US',
        company: null,
        phone: null,
      },
      billingAddress: null,
      items: [
        {
          id: 'i1',
          productId: 'p1',
          productVariantId: 'v1',
          quantity: 1,
          price: 90,
          productName: 'Tee',
          productImage: '/t.jpg',
          variantDetails: null,
          productVariant: { sku: 'TEE-S-RED' },
        },
      ],
      returns: [],
      refundRecords: [],
    })
    const { getOrderDetailForInspector } = await import('@/app/admin/fulfillment/actions')
    const r = await getOrderDetailForInspector('o1')
    expect(r?.id).toBe('o1')
    expect(r?.items[0].sku).toBe('TEE-S-RED')
  })
})

// ─── getReturnDetailForInspector ─────────────────────────────────────────────

describe('getReturnDetailForInspector', () => {
  it('returns null when return not found', async () => {
    returnFindUnique.mockResolvedValue(null)
    const { getReturnDetailForInspector } = await import('@/app/admin/fulfillment/actions')
    const r = await getReturnDetailForInspector('missing')
    expect(r).toBeNull()
  })

  it('returns return detail shape', async () => {
    returnFindUnique.mockResolvedValue({
      id: 'r1',
      rmaNumber: 'RMA-100000',
      orderId: 'o1',
      customerId: 'c1',
      status: 'REQUESTED',
      reason: 'Wrong size',
      internalNotes: null,
      returnLabel: null,
      returnTrackingNumber: null,
      receivedAt: null,
      windowExpiresAt: new Date('2026-06-30'),
      requestedAt: new Date('2026-05-30'),
      decidedAt: null,
      order: { orderNumber: 'HOF-1' },
      customer: { name: 'Ada', email: 'ada@example.com' },
      items: [
        {
          id: 'ri1',
          orderItemId: 'i1',
          quantity: 1,
          condition: 'UNOPENED',
          reason: null,
          orderItem: { productName: 'Tee', productImage: '/t.jpg', price: 90 },
        },
      ],
      refunds: [],
    })
    const { getReturnDetailForInspector } = await import('@/app/admin/fulfillment/actions')
    const r = await getReturnDetailForInspector('r1')
    expect(r?.id).toBe('r1')
    expect(r?.rmaNumber).toBe('RMA-100000')
    expect(r?.items[0].productName).toBe('Tee')
  })
})
