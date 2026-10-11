// tests/unit/loyalty/ledger.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const { db } = vi.hoisted(() => ({
  db: {
    pointsTransaction: { findMany: vi.fn() },
    rewardRedemption: { findMany: vi.fn() },
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: db }))

import { getActiveCodes, getLedgerPage, toLedgerRow } from '@/lib/loyalty/ledger'

const CUSTOMER_ID = 'cus_1'

function tx(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ptx_1',
    createdAt: new Date('2026-10-11T18:02:11.000Z'),
    points: 151,
    type: 'PURCHASE',
    description: 'Earned 151 Care Points from purchase',
    orderId: null,
    reviewId: null,
    metadata: null,
    redemption: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('toLedgerRow', () => {
  it('maps a Shopify purchase with an order reference and link', () => {
    const row = toLedgerRow(tx({ metadata: JSON.stringify({ orderGid: 'gid://shopify/Order/1', orderName: '#1042' }) }))
    expect(row).toEqual({
      id: 'ptx_1',
      at: '2026-10-11T18:02:11.000Z',
      points: 151,
      kind: 'earned',
      label: 'Earned 151 Care Points from purchase',
      reference: { type: 'order', label: '#1042', href: '/account/orders/gid%3A%2F%2Fshopify%2FOrder%2F1' },
    })
  })

  it('maps redemptions to a code reference and the reward name, stripping emoji from labels', () => {
    const row = toLedgerRow(tx({ id: 'ptx_2', points: -500, type: 'REDEMPTION', description: 'Redeemed: $5 Off 🎉', redemption: { couponCode: 'HOF-DISC-ABC234', reward: { name: '$5 Off Your Order' } } }))
    expect(row.kind).toBe('redeemed')
    expect(row.label).toBe('Redeemed $5 Off Your Order')
    expect(row.reference).toEqual({ type: 'code', label: 'HOF-DISC-ABC234', href: null })

    const bonus = toLedgerRow(tx({ type: 'FIRST_PURCHASE', description: "First purchase bonus! You're officially part of the family 🎉" }))
    expect(bonus.label).toBe("First purchase bonus! You're officially part of the family")
  })

  it('maps expirations, adjustments, legacy orders and reviews', () => {
    expect(toLedgerRow(tx({ type: 'EXPIRATION', points: -40 })).kind).toBe('expired')
    expect(toLedgerRow(tx({ type: 'ADMIN_ADJUSTMENT', points: 500 })).kind).toBe('adjusted')
    expect(toLedgerRow(tx({ orderId: 'clx0legacyorder' })).reference).toEqual({ type: 'order', label: 'Order ACYORDER', href: null })
    expect(toLedgerRow(tx({ type: 'REVIEW', reviewId: 'rev_1' })).reference).toEqual({ type: 'review', label: 'Review', href: null })
    expect(toLedgerRow(tx({ description: '' })).label).toBe('Care Points')
  })
})

describe('getLedgerPage', () => {
  it('pages by cursor with limit + 1 and returns the next cursor', async () => {
    db.pointsTransaction.findMany.mockResolvedValue([tx({ id: 'a' }), tx({ id: 'b' }), tx({ id: 'c' })])
    const page = await getLedgerPage(CUSTOMER_ID, { limit: 2 })
    expect(page.rows.map((row) => row.id)).toEqual(['a', 'b'])
    expect(page.nextCursor).toBe('b')
    expect(db.pointsTransaction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: CUSTOMER_ID },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 3,
    }))
    expect(db.pointsTransaction.findMany.mock.calls[0][0]).not.toHaveProperty('cursor')

    db.pointsTransaction.findMany.mockResolvedValue([tx({ id: 'c' })])
    const last = await getLedgerPage(CUSTOMER_ID, { limit: 2, cursor: 'b' })
    expect(last.rows.map((row) => row.id)).toEqual(['c'])
    expect(last.nextCursor).toBeNull()
    expect(db.pointsTransaction.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: { id: 'b' }, skip: 1 }))
  })

  it('applies the earned / redeemed filters and clamps the limit', async () => {
    db.pointsTransaction.findMany.mockResolvedValue([])
    await getLedgerPage(CUSTOMER_ID, { filter: 'earned' })
    expect(db.pointsTransaction.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { customerId: CUSTOMER_ID, points: { gt: 0 } }, take: 21 }))
    await getLedgerPage(CUSTOMER_ID, { filter: 'redeemed', limit: 500 })
    expect(db.pointsTransaction.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { customerId: CUSTOMER_ID, type: 'REDEMPTION' }, take: 51 }))
  })
})

describe('getActiveCodes', () => {
  it('lists codes newest first, marking stale ACTIVE codes EXPIRED', async () => {
    db.rewardRedemption.findMany.mockResolvedValue([
      { couponCode: 'HOF-DISC-AAAAAA', status: 'ACTIVE', expiresAt: new Date(Date.now() + 86_400_000), reward: { name: '$5 Off' } },
      { couponCode: 'HOF-SHIP-BBBBBB', status: 'USED', expiresAt: null, reward: { name: 'Free Shipping' } },
      { couponCode: 'HOF-DISC-CCCCCC', status: 'ACTIVE', expiresAt: new Date('2020-01-01T00:00:00.000Z'), reward: { name: '$10 Off' } },
      { couponCode: null, status: 'ACTIVE', expiresAt: null, reward: { name: 'Odd' } },
    ])
    const codes = await getActiveCodes(CUSTOMER_ID)
    expect(codes.map((entry) => [entry.code, entry.status])).toEqual([
      ['HOF-DISC-AAAAAA', 'ACTIVE'],
      ['HOF-SHIP-BBBBBB', 'USED'],
      ['HOF-DISC-CCCCCC', 'EXPIRED'],
    ])
    expect(codes[0].rewardName).toBe('$5 Off')
    expect(codes[1].expiresAt).toBeNull()
    expect(db.rewardRedemption.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId: CUSTOMER_ID, couponCode: { not: null }, status: { in: ['ACTIVE', 'USED', 'EXPIRED'] } },
      orderBy: { createdAt: 'desc' },
    }))
  })
})
