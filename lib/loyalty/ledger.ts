import 'server-only'

import { prisma } from '@/lib/prisma'

/**
 * Care Points ledger for the storefront hub (Phase 4, Task 2): a cursor-paged,
 * filterable view over `PointsTransaction` plus the customer's minted codes.
 * Read-only; nothing here moves points.
 */

export type LedgerKind = 'earned' | 'redeemed' | 'expired' | 'adjusted'
export type LedgerFilter = 'all' | 'earned' | 'redeemed'

export type LedgerRow = {
  id: string
  /** ISO timestamp. */
  at: string
  points: number
  kind: LedgerKind
  label: string
  reference: { type: 'order' | 'code' | 'review' | 'none'; label: string; href: string | null }
}

export type LedgerPage = { rows: LedgerRow[]; nextCursor: string | null }

export type ActiveCode = {
  code: string
  rewardName: string
  expiresAt: string | null
  status: 'ACTIVE' | 'USED' | 'EXPIRED'
}

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

type TransactionRow = {
  id: string
  createdAt: Date
  points: number
  type: string
  description: string
  orderId: string | null
  reviewId: string | null
  metadata: string | null
  redemption: { couponCode: string | null; reward: { name: string } | null } | null
}

function kindOf(type: string, points: number): LedgerKind {
  if (type === 'REDEMPTION') return 'redeemed'
  if (type === 'EXPIRATION') return 'expired'
  if (type === 'ADMIN_ADJUSTMENT') return 'adjusted'
  return points < 0 ? 'adjusted' : 'earned'
}

/** Strips emoji / symbols the legacy service puts in descriptions; the hub sets its own tone. */
function cleanLabel(description: string): string {
  return description
    .replace(/[\p{Extended_Pictographic}️]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function orderReference(metadata: string | null): LedgerRow['reference'] | null {
  if (!metadata) return null
  try {
    const parsed = JSON.parse(metadata) as { orderGid?: unknown; orderName?: unknown }
    if (typeof parsed.orderGid === 'string' && parsed.orderGid.length > 0) {
      const label = typeof parsed.orderName === 'string' && parsed.orderName ? parsed.orderName : 'Order'
      return { type: 'order', label, href: `/account/orders/${encodeURIComponent(parsed.orderGid)}` }
    }
  } catch {
    /* not JSON */
  }
  return null
}

export function toLedgerRow(row: TransactionRow): LedgerRow {
  let reference: LedgerRow['reference'] = { type: 'none', label: '', href: null }
  const shopifyOrder = orderReference(row.metadata)
  if (shopifyOrder) {
    reference = shopifyOrder
  } else if (row.redemption?.couponCode) {
    reference = { type: 'code', label: row.redemption.couponCode, href: null }
  } else if (row.orderId) {
    // Legacy Prisma order: listed read-only under "Earlier orders", no detail page.
    reference = { type: 'order', label: `Order ${row.orderId.slice(-8).toUpperCase()}`, href: null }
  } else if (row.reviewId) {
    reference = { type: 'review', label: 'Review', href: null }
  }

  const label =
    row.type === 'REDEMPTION' && row.redemption?.reward?.name
      ? `Redeemed ${row.redemption.reward.name}`
      : cleanLabel(row.description) || 'Care Points'

  return {
    id: row.id,
    at: row.createdAt.toISOString(),
    points: row.points,
    kind: kindOf(row.type, row.points),
    label,
    reference,
  }
}

export async function getLedgerPage(
  customerId: string,
  options: { cursor?: string | null; limit?: number; filter?: LedgerFilter } = {}
): Promise<LedgerPage> {
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.floor(options.limit ?? DEFAULT_LIMIT)))
  const filter = options.filter ?? 'all'
  const where = {
    customerId,
    ...(filter === 'earned' ? { points: { gt: 0 } } : {}),
    ...(filter === 'redeemed' ? { type: 'REDEMPTION' as const } : {}),
  }

  const rows = await prisma.pointsTransaction.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      createdAt: true,
      points: true,
      type: true,
      description: true,
      orderId: true,
      reviewId: true,
      metadata: true,
      redemption: { select: { couponCode: true, reward: { select: { name: true } } } },
    },
  })

  const page = rows.slice(0, limit)
  return {
    rows: page.map(toLedgerRow),
    nextCursor: rows.length > limit ? page[page.length - 1].id : null,
  }
}

/** Codes this customer minted, newest first; an ACTIVE code past `expiresAt` reads as EXPIRED. */
export async function getActiveCodes(customerId: string): Promise<ActiveCode[]> {
  const now = Date.now()
  const redemptions = await prisma.rewardRedemption.findMany({
    where: { customerId, couponCode: { not: null }, status: { in: ['ACTIVE', 'USED', 'EXPIRED'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      couponCode: true,
      status: true,
      expiresAt: true,
      reward: { select: { name: true } },
    },
  })

  return redemptions
    .filter((redemption): redemption is typeof redemption & { couponCode: string } => Boolean(redemption.couponCode))
    .map((redemption) => {
      const expired =
        redemption.status === 'EXPIRED' ||
        (redemption.status === 'ACTIVE' && redemption.expiresAt !== null && redemption.expiresAt.getTime() < now)
      return {
        code: redemption.couponCode,
        rewardName: redemption.reward.name,
        expiresAt: redemption.expiresAt?.toISOString() ?? null,
        status: expired ? 'EXPIRED' : redemption.status === 'USED' ? 'USED' : 'ACTIVE',
      }
    })
}
