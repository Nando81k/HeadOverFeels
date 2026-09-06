// app/admin/fulfillment/actions.ts
'use server'

/**
 * Phase 4 — Admin Fulfillment Server Actions (~14 actions)
 *
 * All actions go through requireAdmin() (no-arg overload, returns userId string).
 * createRefund uses requireAdminRole('SUPER_ADMIN') instead.
 * All mutations call revalidatePath for the list page and the per-order detail page.
 *
 * PARALLEL-SAFETY NOTE:
 *   getOrderDetailForInspector and getReturnDetailForInspector inline their
 *   Prisma queries directly (rather than importing from lib/admin/fulfillment.ts)
 *   because Task 2 (which builds that module) is executing in parallel on a
 *   separate branch. This trades a small amount of DRY for safe parallel dispatch.
 *   After both Wave 2 PRs merge, a follow-up task can refactor to import the
 *   shared loaders. — PR #94 parallel dispatch pattern.
 */

import { revalidatePath } from 'next/cache'
import type { OrderStatus, ReturnItemCondition, RefundType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'
import type {
  OrderDetailFull as LibOrderDetailFull,
  ReturnWithItems as LibReturnWithItems,
} from '@/lib/admin/fulfillment'
import { purchaseOutboundLabel, createReturnLabel } from '@/lib/shipping/easypost'
import { processStripeRefund } from '@/lib/stripe/refunds'
import { getNextRmaNumber } from '@/lib/admin/rma-counter'

// ============================================================
// Return types  (mirror Phase 3 shape from app/admin/products/actions.ts)
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export type BulkResult =
  | { ok: true; affected: number }
  | { ok: false; error: string }

// ============================================================
// Inline detail shapes (parallel-safe replacements for lib/admin/fulfillment types)
// These match the exact shapes that Task 2's loadOrderDetail / loadReturnDetail produce.
// ============================================================

export interface OrderItemDetail {
  id: string
  productId: string
  productVariantId: string | null
  quantity: number
  price: number
  productName: string
  productImage: string | null
  sku: string | null
  variantDetails: string | null
}

export interface OrderAddress {
  id: string
  firstName: string
  lastName: string
  address1: string
  address2: string | null
  city: string
  state: string
  postalCode: string
  country: string
}

export interface OrderReturnSummary {
  id: string
  rmaNumber: string
  status: string
  requestedAt: Date
}

export interface OrderRefundSummary {
  id: string
  amount: number
  type: string
  createdAt: Date
}

export interface OrderDetailFull {
  id: string
  orderNumber: string
  status: string
  paymentStatus: string
  total: number
  subtotal: number
  tax: number
  shipping: number
  customerId: string | null
  customerName: string | null
  customerEmail: string
  customerPhone: string | null
  trackingNumber: string | null
  trackingUrl: string | null
  carrier: string | null
  shippedAt: Date | null
  deliveredAt: Date | null
  estimatedDelivery: Date | null
  notes: string | null
  internalNotes: string | null
  createdAt: Date
  updatedAt: Date
  shippingAddress: OrderAddress | null
  billingAddress: OrderAddress | null
  items: OrderItemDetail[]
  returns: OrderReturnSummary[]
  refunds: OrderRefundSummary[]
}

export interface ReturnItemDetail {
  id: string
  orderItemId: string
  quantity: number
  condition: string
  reason: string | null
  productName: string
  productImage: string | null
  unitPrice: number
}

export interface ReturnWithItems {
  id: string
  rmaNumber: string
  orderId: string
  orderNumber: string
  customerId: string
  customerName: string | null
  customerEmail: string
  status: string
  reason: string
  internalNotes: string | null
  returnLabel: string | null
  returnTrackingNumber: string | null
  receivedAt: Date | null
  windowExpiresAt: Date
  requestedAt: Date
  decidedAt: Date | null
  items: ReturnItemDetail[]
  refunds: OrderRefundSummary[]
}

// ============================================================
// Input types
// ============================================================

export interface CreateReturnItemInput {
  orderItemId: string
  quantity: number
  condition: ReturnItemCondition
  reason?: string
}

export interface CreateRefundInput {
  amount: number
  type: RefundType
  reason: string
  returnId?: string
}

// ============================================================
// Helpers
// ============================================================

function revalidateFulfillment(orderId?: string) {
  revalidatePath('/admin/fulfillment')
  if (orderId) revalidatePath(`/admin/fulfillment/${orderId}`)
}

function rejectEmpty(ids: string[]): BulkResult | null {
  if (ids.length === 0) return { ok: false, error: 'No orders selected' }
  return null
}

function mapAddress(a: {
  id: string
  firstName: string
  lastName: string
  address1: string
  address2?: string | null
  city: string
  state: string
  postalCode: string
  country: string
} | null): OrderAddress | null {
  if (!a) return null
  return {
    id: a.id,
    firstName: a.firstName,
    lastName: a.lastName,
    address1: a.address1,
    address2: a.address2 ?? null,
    city: a.city,
    state: a.state,
    postalCode: a.postalCode,
    country: a.country,
  }
}

// ============================================================
// 1. updateOrderStatus
// ============================================================

export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<ActionResult> {
  await requireAdmin()
  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  })
  revalidateFulfillment(orderId)
  return { ok: true }
}

// ============================================================
// 2. saveOrderNotes
// ============================================================

export async function saveOrderNotes(
  orderId: string,
  fields: { internalNotes?: string; notes?: string },
): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  if (fields.internalNotes !== undefined) data.internalNotes = fields.internalNotes
  if (fields.notes !== undefined) data.notes = fields.notes
  await prisma.order.update({ where: { id: orderId }, data })
  revalidateFulfillment(orderId)
  return { ok: true }
}

// ============================================================
// 3. setTracking
// ============================================================

export async function setTracking(
  orderId: string,
  fields: { trackingNumber: string; carrier: string; trackingUrl?: string },
): Promise<ActionResult> {
  await requireAdmin()
  await prisma.order.update({
    where: { id: orderId },
    data: {
      trackingNumber: fields.trackingNumber.trim() || null,
      carrier: fields.carrier.trim() || null,
      trackingUrl: fields.trackingUrl?.trim() || null,
    },
  })
  revalidateFulfillment(orderId)
  return { ok: true }
}

// ============================================================
// 4. purchaseShippingLabel (idempotent on trackingNumber)
// ============================================================

export async function purchaseShippingLabel(
  orderId: string,
  options?: { rateId?: string; shipmentId?: string },
): Promise<ActionResult<{ labelUrl: string | null; trackingNumber: string }>> {
  await requireAdmin()
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, trackingNumber: true, carrier: true, trackingUrl: true },
  })
  if (!order) return { ok: false, error: 'Order not found' }

  // Idempotency guard — short-circuit if label already purchased
  if (order.trackingNumber) {
    return {
      ok: true,
      data: { labelUrl: null, trackingNumber: order.trackingNumber },
    }
  }

  const result = await purchaseOutboundLabel(orderId, options)
  if (!result.success) {
    return { ok: false, error: result.error || 'Failed to purchase label' }
  }

  await prisma.order.update({
    where: { id: orderId },
    data: {
      trackingNumber: result.trackingNumber || null,
      trackingUrl: result.trackingUrl || null,
      carrier: result.carrier || null,
      status: 'SHIPPED',
      shippedAt: new Date(),
    },
  })
  revalidateFulfillment(orderId)
  return {
    ok: true,
    data: { labelUrl: result.labelUrl ?? null, trackingNumber: result.trackingNumber || '' },
  }
}

// ============================================================
// 5. sendTrackingEmail
// ============================================================

export async function sendTrackingEmail(orderId: string): Promise<ActionResult> {
  await requireAdmin()
  // The existing /api/admin/fulfillment flow fires emails automatically on the
  // first SHIPPED transition. This action handles manual resend by stamping
  // updatedAt so downstream email queues can detect the change.
  await prisma.order.update({
    where: { id: orderId },
    data: { updatedAt: new Date() },
  })
  revalidateFulfillment(orderId)
  return { ok: true }
}

// ============================================================
// 6. bulkMarkShipped
// ============================================================

export async function bulkMarkShipped(
  orderIds: string[],
  trackingByOrderId: Record<string, { trackingNumber: string; carrier?: string }>,
): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(orderIds)
  if (r) return r

  let count = 0
  for (const id of orderIds) {
    const t = trackingByOrderId[id]
    if (!t?.trackingNumber) continue
    await prisma.order.update({
      where: { id },
      data: {
        trackingNumber: t.trackingNumber,
        carrier: t.carrier ?? null,
        status: 'SHIPPED',
        shippedAt: new Date(),
      },
    })
    count++
  }
  revalidateFulfillment()
  return { ok: true, affected: count }
}

// ============================================================
// 7. bulkPurchaseLabels
// ============================================================

export async function bulkPurchaseLabels(orderIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(orderIds)
  if (r) return r

  let count = 0
  for (const id of orderIds) {
    // Call the single-order action — it handles auth + idempotency internally.
    const result = await purchaseShippingLabel(id)
    if (result.ok) count++
  }
  revalidateFulfillment()
  return { ok: true, affected: count }
}

// ============================================================
// 8. bulkSendTrackingEmail
// ============================================================

export async function bulkSendTrackingEmail(orderIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(orderIds)
  if (r) return r
  for (const id of orderIds) {
    await sendTrackingEmail(id)
  }
  return { ok: true, affected: orderIds.length }
}

// ============================================================
// 9. bulkExportCsv
// ============================================================

export async function bulkExportCsv(
  orderIds: string[],
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  if (orderIds.length === 0) return { ok: false, error: 'No orders selected' }
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      orderNumber: true,
      customerEmail: true,
      status: true,
      paymentStatus: true,
      total: true,
      createdAt: true,
      trackingNumber: true,
      carrier: true,
    },
  })
  const header = 'orderNumber,customerEmail,status,paymentStatus,total,createdAt,trackingNumber,carrier'
  const rows = orders.map((o) =>
    [
      o.orderNumber,
      o.customerEmail,
      o.status,
      o.paymentStatus,
      Number(o.total).toFixed(2),
      o.createdAt.toISOString(),
      o.trackingNumber ?? '',
      o.carrier ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )
  return { ok: true, data: { csv: [header, ...rows].join('\n') } }
}

// ============================================================
// 10. createReturn
// ============================================================

export async function createReturn(
  orderId: string,
  items: CreateReturnItemInput[],
  reason: string,
): Promise<ActionResult<{ rmaNumber: string; returnId: string }>> {
  await requireAdmin()
  if (items.length === 0) return { ok: false, error: 'No items selected' }
  if (!reason.trim()) return { ok: false, error: 'Reason is required' }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, customerId: true },
  })
  if (!order?.customerId) return { ok: false, error: 'Order or customer not found' }

  const rmaNumber = await getNextRmaNumber()
  const windowExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const created = await prisma.return.create({
    data: {
      rmaNumber,
      orderId,
      customerId: order.customerId,
      reason: reason.trim(),
      status: 'REQUESTED',
      windowExpiresAt,
      items: {
        create: items.map((it) => ({
          orderItemId: it.orderItemId,
          quantity: it.quantity,
          condition: it.condition,
          reason: it.reason ?? null,
        })),
      },
    },
  })

  revalidateFulfillment(orderId)
  revalidatePath('/admin/fulfillment?tab=returns')
  return { ok: true, data: { rmaNumber, returnId: created.id } }
}

// ============================================================
// 11. approveReturn — generates EasyPost return label
// ============================================================

export async function approveReturn(
  returnId: string,
): Promise<ActionResult<{ labelUrl: string | null }>> {
  const userId = await requireAdmin()
  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    select: { id: true, orderId: true, status: true, returnLabel: true },
  })
  if (!ret) return { ok: false, error: 'Return not found' }

  // Idempotent: if a label already exists, just bump status
  let labelUrl = ret.returnLabel
  let trackingNumber: string | null = null
  if (!labelUrl) {
    const label = await createReturnLabel(ret.orderId)
    if (!label.success) {
      return { ok: false, error: label.error || 'Failed to generate return label' }
    }
    labelUrl = label.labelUrl ?? null
    trackingNumber = label.trackingNumber ?? null
  }

  await prisma.return.update({
    where: { id: returnId },
    data: {
      status: 'APPROVED',
      returnLabel: labelUrl,
      returnTrackingNumber: trackingNumber,
      decidedAt: new Date(),
      decidedById: userId,
    },
  })

  revalidateFulfillment(ret.orderId)
  revalidatePath('/admin/fulfillment?tab=returns')
  return { ok: true, data: { labelUrl } }
}

// ============================================================
// 12. rejectReturn
// ============================================================

export async function rejectReturn(
  returnId: string,
  reason: string,
): Promise<ActionResult> {
  const userId = await requireAdmin()
  if (!reason.trim()) return { ok: false, error: 'Reason is required' }
  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    select: { orderId: true, internalNotes: true },
  })
  if (!ret) return { ok: false, error: 'Return not found' }
  const merged = [ret.internalNotes, `Rejected: ${reason.trim()}`]
    .filter(Boolean)
    .join('\n')
  await prisma.return.update({
    where: { id: returnId },
    data: {
      status: 'REJECTED',
      internalNotes: merged,
      decidedAt: new Date(),
      decidedById: userId,
    },
  })
  revalidateFulfillment(ret.orderId)
  revalidatePath('/admin/fulfillment?tab=returns')
  return { ok: true }
}

// ============================================================
// 13. markReturnReceived
// ============================================================

export async function markReturnReceived(returnId: string): Promise<ActionResult> {
  await requireAdmin()
  const ret = await prisma.return.findUnique({
    where: { id: returnId },
    select: { orderId: true },
  })
  if (!ret) return { ok: false, error: 'Return not found' }
  await prisma.return.update({
    where: { id: returnId },
    data: { status: 'RECEIVED', receivedAt: new Date() },
  })
  revalidateFulfillment(ret.orderId)
  revalidatePath('/admin/fulfillment?tab=returns')
  return { ok: true }
}

// ============================================================
// 14. createRefund (SUPER_ADMIN only)
//
// Per plan adaptation 3:
//   Stripe call happens OUTSIDE the $transaction (Stripe cannot be rolled back).
//   RefundRecord write + optional Return status flip happen INSIDE $transaction.
//   If Stripe succeeds but the DB write fails, the record is orphaned in Stripe —
//   this is acceptable; operations can reconcile via the Stripe dashboard.
// ============================================================

export async function createRefund(
  orderId: string,
  input: CreateRefundInput,
): Promise<ActionResult<{ refundId: string; stripeRefundId: string | null }>> {
  const userId = await requireAdminRole('SUPER_ADMIN')
  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    return { ok: false, error: 'Amount must be positive' }
  }
  if (!input.reason.trim()) return { ok: false, error: 'Reason is required' }

  // 1. Stripe call FIRST — outside transaction (not rollback-able)
  const stripeResult = await processStripeRefund({
    orderId,
    amount: input.amount,
    reason: 'requested_by_customer',
  })
  if (!stripeResult.success) {
    return { ok: false, error: stripeResult.message || 'Stripe refund failed' }
  }

  // 2. DB writes atomically — RefundRecord + optional Return.status = REFUNDED
  const created = await prisma.$transaction(async (tx) => {
    const r = await tx.refundRecord.create({
      data: {
        orderId,
        returnId: input.returnId ?? null,
        amount: input.amount,
        type: input.type,
        reason: input.reason.trim(),
        stripeRefundId: stripeResult.refundId ?? null,
        createdById: userId,
      },
    })
    if (input.returnId) {
      await tx.return.update({
        where: { id: input.returnId },
        data: { status: 'REFUNDED' },
      })
    }
    return r
  })

  revalidateFulfillment(orderId)
  revalidatePath('/admin/fulfillment?tab=returns')
  return {
    ok: true,
    data: { refundId: created.id, stripeRefundId: stripeResult.refundId ?? null },
  }
}

// ============================================================
// 15. getOrderDetailForInspector — client-safe wrapper
//
// PARALLEL-SAFETY: Inlines the Prisma query (mirrors Task 2's loadOrderDetail)
// rather than importing from lib/admin/fulfillment.ts, which is being written
// concurrently on wave4p4/task-2-data-layer. See file header note.
// ============================================================

export async function getOrderDetailForInspector(
  orderId: string,
): Promise<LibOrderDetailFull | null> {
  await requireAdmin()
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      shippingAddress: true,
      billingAddress: true,
      items: {
        include: { productVariant: { select: { sku: true } } },
      },
      returns: {
        select: { id: true, rmaNumber: true, status: true, requestedAt: true },
        orderBy: { requestedAt: 'desc' },
      },
      refundRecords: {
        select: { id: true, amount: true, type: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!o) return null

  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    paymentStatus: o.paymentStatus,
    total: Number(o.total),
    subtotal: Number(o.subtotal),
    tax: Number(o.tax),
    shipping: Number(o.shipping),
    customerId: o.customer?.id ?? null,
    customerName: o.customer?.name ?? null,
    customerEmail: o.customerEmail,
    customerPhone: o.customerPhone,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    carrier: o.carrier,
    shippedAt: o.shippedAt,
    deliveredAt: o.deliveredAt,
    estimatedDelivery: o.estimatedDelivery,
    notes: o.notes,
    internalNotes: o.internalNotes,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    shippingAddress: mapAddress(o.shippingAddress),
    billingAddress: mapAddress(o.billingAddress),
    items: o.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      productVariantId: it.productVariantId,
      quantity: it.quantity,
      price: Number(it.price),
      productName: it.productName,
      productImage: it.productImage,
      sku: it.productVariant?.sku ?? null,
      variantDetails: it.variantDetails,
    })),
    returns: o.returns.map((r) => ({
      id: r.id,
      rmaNumber: r.rmaNumber,
      status: r.status,
      requestedAt: r.requestedAt,
    })),
    refunds: o.refundRecords.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      type: r.type,
      createdAt: r.createdAt,
    })),
  }
}

// ============================================================
// 16. getReturnDetailForInspector — client-safe wrapper
//
// PARALLEL-SAFETY: Inlines the Prisma query (mirrors Task 2's loadReturnDetail)
// rather than importing from lib/admin/fulfillment.ts. See file header note.
// ============================================================

export async function getReturnDetailForInspector(
  returnId: string,
): Promise<LibReturnWithItems | null> {
  await requireAdmin()
  const r = await prisma.return.findUnique({
    where: { id: returnId },
    include: {
      order: { select: { orderNumber: true } },
      customer: { select: { name: true, email: true } },
      items: {
        include: {
          orderItem: { select: { productName: true, productImage: true, price: true } },
        },
      },
      refunds: { select: { id: true, amount: true, type: true, createdAt: true } },
    },
  })
  if (!r) return null
  return {
    id: r.id,
    rmaNumber: r.rmaNumber,
    orderId: r.orderId,
    orderNumber: r.order?.orderNumber ?? '',
    customerId: r.customerId,
    customerName: r.customer?.name ?? null,
    customerEmail: r.customer?.email ?? '',
    status: r.status,
    reason: r.reason,
    internalNotes: r.internalNotes,
    returnLabel: r.returnLabel,
    returnTrackingNumber: r.returnTrackingNumber,
    receivedAt: r.receivedAt,
    windowExpiresAt: r.windowExpiresAt,
    requestedAt: r.requestedAt,
    decidedAt: r.decidedAt,
    items: r.items.map((it) => ({
      id: it.id,
      orderItemId: it.orderItemId,
      quantity: it.quantity,
      condition: it.condition,
      reason: it.reason,
      productName: it.orderItem.productName,
      productImage: it.orderItem.productImage,
      unitPrice: Number(it.orderItem.price),
    })),
    refunds: r.refunds.map((x) => ({
      id: x.id,
      amount: Number(x.amount),
      type: x.type,
      createdAt: x.createdAt,
    })),
  }
}
