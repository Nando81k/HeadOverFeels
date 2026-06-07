// tests/unit/lib/admin/loyalty.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerCount = vi.fn()
const customerFindMany = vi.fn()
const customerFindUnique = vi.fn()
const customerGroupBy = vi.fn()
const pointsTxFindMany = vi.fn()
const pointsTxAggregate = vi.fn()
const pointsTxGroupBy = vi.fn()
const pointsTxCount = vi.fn()
const tierFindMany = vi.fn()
const tierFindUnique = vi.fn()
const tierCount = vi.fn()
const rewardFindMany = vi.fn()
const rewardFindUnique = vi.fn()
const rewardCount = vi.fn()
const redemptionFindMany = vi.fn()
const redemptionFindUnique = vi.fn()
const redemptionCount = vi.fn()
const eventFindMany = vi.fn()
const eventFindUnique = vi.fn()
const eventCount = vi.fn()
const settingsFindUnique = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      count: customerCount,
      findMany: customerFindMany,
      findUnique: customerFindUnique,
      groupBy: customerGroupBy,
    },
    pointsTransaction: {
      findMany: pointsTxFindMany,
      aggregate: pointsTxAggregate,
      groupBy: pointsTxGroupBy,
      count: pointsTxCount,
    },
    loyaltyTier: {
      findMany: tierFindMany,
      findUnique: tierFindUnique,
      count: tierCount,
    },
    reward: {
      findMany: rewardFindMany,
      findUnique: rewardFindUnique,
      count: rewardCount,
    },
    rewardRedemption: {
      findMany: redemptionFindMany,
      findUnique: redemptionFindUnique,
      count: redemptionCount,
    },
    pointsMultiplierEvent: {
      findMany: eventFindMany,
      findUnique: eventFindUnique,
      count: eventCount,
    },
    loyaltySettings: { findUnique: settingsFindUnique },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getRangeBounds (loyalty)', () => {
  it('maps 7d to 7-day window with previous shift', async () => {
    const { getRangeBounds } = await import('@/lib/admin/loyalty')
    const ref = new Date('2026-05-31T12:00:00Z')
    const b = getRangeBounds('7d', ref)
    const day = 24 * 60 * 60 * 1000
    expect(b.end.getTime() - b.start.getTime()).toBe(7 * day)
    expect(b.previousEnd.getTime()).toBe(b.end.getTime() - 7 * day)
  })
  it('today snaps start to UTC midnight', async () => {
    const { getRangeBounds } = await import('@/lib/admin/loyalty')
    const ref = new Date('2026-05-31T18:00:00Z')
    const b = getRangeBounds('today', ref)
    expect(b.start.toISOString()).toBe('2026-05-31T00:00:00.000Z')
  })
})

describe('loadLoyaltyKpis', () => {
  it('returns activeMembers, earned, redeemed, redemptionRate with trends', async () => {
    customerCount.mockResolvedValueOnce(120) // active members (current snapshot)
    pointsTxAggregate
      .mockResolvedValueOnce({ _sum: { points: 5000 } }) // earned current (positive)
      .mockResolvedValueOnce({ _sum: { points: 3000 } }) // earned previous
      .mockResolvedValueOnce({ _sum: { points: -1500 } }) // redeemed current (negative)
      .mockResolvedValueOnce({ _sum: { points: -1200 } }) // redeemed previous
    const { loadLoyaltyKpis } = await import('@/lib/admin/loyalty')
    const k = await loadLoyaltyKpis('30d')
    expect(k.activeMembers).toBe(120)
    expect(k.pointsEarned).toBe(5000)
    expect(k.pointsRedeemed).toBe(1500)
    expect(k.redemptionRate).toBeCloseTo(30, 5)
    expect(k.pointsEarnedTrend.direction).toBe('up')
  })

  it('handles zero earned without dividing by zero', async () => {
    customerCount.mockResolvedValue(0)
    pointsTxAggregate.mockResolvedValue({ _sum: { points: 0 } })
    const { loadLoyaltyKpis } = await import('@/lib/admin/loyalty')
    const k = await loadLoyaltyKpis('30d')
    expect(Number.isFinite(k.redemptionRate)).toBe(true)
    expect(k.redemptionRate).toBe(0)
  })
})

describe('loadOverviewData', () => {
  it('returns 4 chart series + tier perks + reward activations + recent + popular', async () => {
    pointsTxFindMany.mockResolvedValue([])
    customerGroupBy.mockResolvedValue([
      { loyaltyTierId: 'tier-bronze', _count: { _all: 30 } },
    ])
    tierFindMany.mockResolvedValue([
      { id: 'tier-bronze', name: 'Bronze', slug: 'bronze', primaryColor: '#64748B',
        secondaryColor: '#475569', freeShipping: false, earlyDropAccess: false,
        pointMultiplier: 1, sortOrder: 1, isActive: true },
    ])
    rewardFindMany.mockResolvedValue([
      { id: 'r1', name: '10% off', pointsCost: 500, totalRedeemed: 12, isActive: true, sortOrder: 0 },
    ])
    customerFindMany.mockResolvedValue([])
    pointsTxAggregate.mockResolvedValue({ _sum: { points: 0 } })
    const { loadOverviewData } = await import('@/lib/admin/loyalty')
    const d = await loadOverviewData('30d')
    expect(Array.isArray(d.pointsActivity)).toBe(true)
    expect(d.tierDistribution.length).toBe(1)
    expect(d.tierPerks[0].name).toBe('Bronze')
    expect(d.rewardActivations[0].name).toBe('10% off')
  })
})

describe('loadMembersTab', () => {
  it('returns paginated MemberRow list', async () => {
    customerFindMany.mockResolvedValue([
      { id: 'c1', email: 'a@e.com', name: 'Ada', currentPoints: 250,
        lifetimePoints: 1500, lastOrderDate: new Date('2026-05-20'),
        annualPointsEarned: 800, tierStartDate: new Date('2026-01-01'),
        loyaltyTier: { id: 't1', name: 'Silver', slug: 'silver', primaryColor: '#aaa' } },
    ])
    customerCount.mockResolvedValue(1)
    const { loadMembersTab } = await import('@/lib/admin/loyalty')
    const r = await loadMembersTab()
    expect(r.items).toHaveLength(1)
    expect(r.items[0].email).toBe('a@e.com')
    expect(r.items[0].tierName).toBe('Silver')
  })

  it('filters by tierId when provided', async () => {
    customerFindMany.mockResolvedValue([])
    customerCount.mockResolvedValue(0)
    const { loadMembersTab } = await import('@/lib/admin/loyalty')
    await loadMembersTab({ tierId: 'tier-gold' })
    expect(customerFindMany.mock.calls[0][0].where.loyaltyTierId).toBe('tier-gold')
  })
})

describe('loadTiersTab', () => {
  it('returns all tiers sorted by sortOrder', async () => {
    tierFindMany.mockResolvedValue([
      { id: 't1', name: 'Bronze', slug: 'bronze', primaryColor: '#64748B',
        secondaryColor: '#475569', minAnnualSpend: 0, minAnnualPoints: 0,
        isInviteOnly: false, pointMultiplier: 1, freeShipping: false,
        earlyDropAccess: false, perks: null, sortOrder: 1, isActive: true,
        description: null, createdAt: new Date(), updatedAt: new Date() },
    ])
    customerGroupBy.mockResolvedValue([
      { loyaltyTierId: 't1', _count: { _all: 30 } },
    ])
    const { loadTiersTab } = await import('@/lib/admin/loyalty')
    const r = await loadTiersTab()
    expect(r).toHaveLength(1)
    expect(r[0].name).toBe('Bronze')
    expect(r[0].memberCount).toBe(30)
  })
})

describe('loadRewardsTab', () => {
  it('returns paginated rewards', async () => {
    rewardFindMany.mockResolvedValue([
      { id: 'r1', name: '10% off', slug: '10-off', pointsCost: 500,
        rewardType: 'DISCOUNT', isActive: true, totalRedeemed: 5,
        maxRedemptionsPerCustomer: null, totalAvailable: null,
        minTierRequired: null, sortOrder: 0, image: null,
        createdAt: new Date(), updatedAt: new Date() },
    ])
    rewardCount.mockResolvedValue(1)
    const { loadRewardsTab } = await import('@/lib/admin/loyalty')
    const r = await loadRewardsTab()
    expect(r.items[0].name).toBe('10% off')
  })
})

describe('loadRedemptionsTab', () => {
  it('returns paginated redemptions in range', async () => {
    redemptionFindMany.mockResolvedValue([
      { id: 'red1', customerId: 'c1', rewardId: 'r1', pointsSpent: 500,
        status: 'PENDING', couponCode: 'HOF-ABC', usedAt: null, orderId: null,
        trackingNumber: null, shippedAt: null, createdAt: new Date('2026-05-20'),
        updatedAt: new Date(),
        customer: { id: 'c1', email: 'a@e.com', name: 'Ada' },
        reward: { id: 'r1', name: '10% off', rewardType: 'DISCOUNT' } },
    ])
    redemptionCount.mockResolvedValue(1)
    const { loadRedemptionsTab } = await import('@/lib/admin/loyalty')
    const r = await loadRedemptionsTab('30d')
    expect(r.items[0].customerEmail).toBe('a@e.com')
    expect(r.items[0].rewardName).toBe('10% off')
  })
})

describe('loadEventsTab', () => {
  it('returns paginated events', async () => {
    eventFindMany.mockResolvedValue([
      { id: 'e1', name: 'Memorial Day 2x', description: 'Double points',
        startDate: new Date('2026-05-25'), endDate: new Date('2026-05-27'),
        multiplier: 2, tierIds: null, categoryIds: null, isActive: true,
        totalBonusPointsAwarded: 0, ordersAffected: 0,
        createdAt: new Date(), updatedAt: new Date() },
    ])
    eventCount.mockResolvedValue(1)
    const { loadEventsTab } = await import('@/lib/admin/loyalty')
    const r = await loadEventsTab()
    expect(r.items[0].name).toBe('Memorial Day 2x')
  })
})

describe('detail loaders', () => {
  it('loadMemberDetail returns null when missing', async () => {
    customerFindUnique.mockResolvedValue(null)
    const { loadMemberDetail } = await import('@/lib/admin/loyalty')
    expect(await loadMemberDetail('missing')).toBeNull()
  })

  it('loadMemberDetail returns full detail with last 50 transactions', async () => {
    customerFindUnique.mockResolvedValue({
      id: 'c1', email: 'a@e.com', name: 'Ada',
      currentPoints: 250, lifetimePoints: 1500,
      annualPointsEarned: 800, tierStartDate: new Date('2026-01-01'),
      lastOrderDate: new Date('2026-05-20'),
      loyaltyTier: { id: 't1', name: 'Silver', slug: 'silver', primaryColor: '#aaa' },
      pointsTransactions: [
        { id: 'p1', points: 100, type: 'PURCHASE', description: 'order 1',
          createdAt: new Date(), orderId: 'o1', redemptionId: null,
          referralId: null, reviewId: null },
      ],
    })
    const { loadMemberDetail } = await import('@/lib/admin/loyalty')
    const d = await loadMemberDetail('c1')
    expect(d?.email).toBe('a@e.com')
    expect(d?.transactions).toHaveLength(1)
  })

  it('loadTierDetail returns null when missing', async () => {
    tierFindUnique.mockResolvedValue(null)
    const { loadTierDetail } = await import('@/lib/admin/loyalty')
    expect(await loadTierDetail('missing')).toBeNull()
  })

  it('loadRewardDetail returns full reward', async () => {
    rewardFindUnique.mockResolvedValue({
      id: 'r1', name: '10% off', slug: '10-off',
      description: 'd', pointsCost: 500, rewardType: 'DISCOUNT',
      value: 10, isActive: true, maxRedemptionsPerCustomer: null,
      totalAvailable: null, totalRedeemed: 5, minTierRequired: null,
      metadata: null, image: null, sortOrder: 0,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { loadRewardDetail } = await import('@/lib/admin/loyalty')
    const d = await loadRewardDetail('r1')
    expect(d?.name).toBe('10% off')
  })

  it('loadRedemptionDetail returns full redemption with customer + reward', async () => {
    redemptionFindUnique.mockResolvedValue({
      id: 'red1', customerId: 'c1', rewardId: 'r1', pointsSpent: 500,
      status: 'PENDING', couponCode: 'HOF-ABC', usedAt: null, orderId: null,
      trackingNumber: null, shippedAt: null, metadata: null, idempotencyKey: 'k',
      createdAt: new Date(), updatedAt: new Date(),
      customer: { id: 'c1', email: 'a@e.com', name: 'Ada' },
      reward: { id: 'r1', name: '10% off', rewardType: 'DISCOUNT', pointsCost: 500 },
    })
    const { loadRedemptionDetail } = await import('@/lib/admin/loyalty')
    const d = await loadRedemptionDetail('red1')
    expect(d?.customerEmail).toBe('a@e.com')
    expect(d?.rewardName).toBe('10% off')
  })

  it('loadEventDetail returns full event', async () => {
    eventFindUnique.mockResolvedValue({
      id: 'e1', name: 'Memorial Day 2x', description: 'd',
      startDate: new Date(), endDate: new Date(), multiplier: 2,
      tierIds: null, categoryIds: null, isActive: true,
      totalBonusPointsAwarded: 100, ordersAffected: 5,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { loadEventDetail } = await import('@/lib/admin/loyalty')
    const d = await loadEventDetail('e1')
    expect(d?.name).toBe('Memorial Day 2x')
  })

  it('loadLoyaltySettings returns defaults when missing', async () => {
    settingsFindUnique.mockResolvedValue(null)
    const { loadLoyaltySettings } = await import('@/lib/admin/loyalty')
    const s = await loadLoyaltySettings()
    expect(s.id).toBe('default')
    expect(s.pointsPerDollar).toBe(1)
    expect(s.pointsExpireMonths).toBe(12)
  })
})
