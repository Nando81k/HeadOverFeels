// tests/unit/app/admin/loyalty/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const customerFindUnique = vi.fn()
const customerCount = vi.fn()
const customerFindMany = vi.fn()
const tierCreate = vi.fn()
const tierUpdate = vi.fn()
const tierDelete = vi.fn()
const tierFindUnique = vi.fn()
const tierFindMany = vi.fn()
const rewardCreate = vi.fn()
const rewardUpdate = vi.fn()
const rewardDelete = vi.fn()
const rewardFindUnique = vi.fn()
const rewardFindMany = vi.fn()
const redemptionFindUnique = vi.fn()
const redemptionFindMany = vi.fn()
const redemptionUpdate = vi.fn()
const redemptionCount = vi.fn()
const eventCreate = vi.fn()
const eventUpdate = vi.fn()
const eventDelete = vi.fn()
const eventFindUnique = vi.fn()
const eventFindMany = vi.fn()
const settingsUpsert = vi.fn()
const settingsFindUnique = vi.fn()
const pointsTxFindMany = vi.fn()
const pointsTxCount = vi.fn()
const rewardCount = vi.fn()

const awardPoints = vi.fn()
const deductPoints = vi.fn()
const updateCustomerTier = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customer: {
      findUnique: customerFindUnique,
      count: customerCount,
      findMany: customerFindMany,
    },
    loyaltyTier: {
      create: tierCreate,
      update: tierUpdate,
      delete: tierDelete,
      findUnique: tierFindUnique,
      findMany: tierFindMany,
    },
    reward: {
      create: rewardCreate,
      update: rewardUpdate,
      delete: rewardDelete,
      findUnique: rewardFindUnique,
      findMany: rewardFindMany,
      count: rewardCount,
    },
    rewardRedemption: {
      findUnique: redemptionFindUnique,
      findMany: redemptionFindMany,
      update: redemptionUpdate,
      count: redemptionCount,
    },
    pointsMultiplierEvent: {
      create: eventCreate,
      update: eventUpdate,
      delete: eventDelete,
      findUnique: eventFindUnique,
      findMany: eventFindMany,
      count: vi.fn().mockResolvedValue(0),
    },
    loyaltySettings: { upsert: settingsUpsert, findUnique: settingsFindUnique },
    pointsTransaction: {
      findMany: pointsTxFindMany,
      count: pointsTxCount,
    },
  },
}))

vi.mock('@/lib/loyalty/service', () => ({
  awardPoints: (...a: unknown[]) => awardPoints(...a),
  deductPoints: (...a: unknown[]) => deductPoints(...a),
  updateCustomerTier: (...a: unknown[]) => updateCustomerTier(...a),
}))

vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue('admin-1'),
  requireAdminRole: vi.fn().mockResolvedValue('admin-1'),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TIER actions', () => {
  it('createTier persists the row', async () => {
    tierCreate.mockResolvedValue({ id: 't1' })
    const { createTier } = await import('@/app/admin/loyalty/actions')
    const r = await createTier({
      name: 'Bronze', slug: 'bronze', primaryColor: '#64748B', secondaryColor: '#475569',
      minAnnualSpend: 0, minAnnualPoints: 0, pointMultiplier: 1, sortOrder: 1,
      isActive: true, isInviteOnly: false, freeShipping: false, earlyDropAccess: false,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.id).toBe('t1')
  })

  it('createTier rejects blank name', async () => {
    const { createTier } = await import('@/app/admin/loyalty/actions')
    const r = await createTier({
      name: '', slug: 'bronze', primaryColor: '#64748B', secondaryColor: '#475569',
      pointMultiplier: 1, sortOrder: 1,
    })
    expect(r.ok).toBe(false)
  })

  it('updateTier applies partial fields', async () => {
    tierUpdate.mockResolvedValue({})
    const { updateTier } = await import('@/app/admin/loyalty/actions')
    const r = await updateTier('t1', { name: 'Silver' })
    expect(r.ok).toBe(true)
    expect(tierUpdate.mock.calls[0][0].data.name).toBe('Silver')
  })

  it('deleteTier rejects when customers are on the tier', async () => {
    customerCount.mockResolvedValue(3)
    const { deleteTier } = await import('@/app/admin/loyalty/actions')
    const r = await deleteTier('t1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/reassign/i)
  })

  it('deleteTier deletes when no customers are on it', async () => {
    customerCount.mockResolvedValue(0)
    tierDelete.mockResolvedValue({})
    const { deleteTier } = await import('@/app/admin/loyalty/actions')
    const r = await deleteTier('t1')
    expect(r.ok).toBe(true)
  })

  it('toggleTierActive flips isActive', async () => {
    tierFindUnique.mockResolvedValue({ id: 't1', isActive: true })
    tierUpdate.mockResolvedValue({})
    const { toggleTierActive } = await import('@/app/admin/loyalty/actions')
    const r = await toggleTierActive('t1')
    expect(r.ok).toBe(true)
    expect(tierUpdate.mock.calls[0][0].data.isActive).toBe(false)
  })

  it('toggleTierActive returns not found when tier missing', async () => {
    tierFindUnique.mockResolvedValue(null)
    const { toggleTierActive } = await import('@/app/admin/loyalty/actions')
    const r = await toggleTierActive('missing')
    expect(r.ok).toBe(false)
  })
})

describe('MEMBER actions', () => {
  it('adjustMemberPoints calls awardPoints with ADMIN_ADJUSTMENT + idempotencyKey', async () => {
    customerFindUnique.mockResolvedValue({ id: 'c1', currentPoints: 1000 })
    awardPoints.mockResolvedValue({ id: 'p1' })
    const { adjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await adjustMemberPoints('c1', 50, 'Test bonus')
    expect(r.ok).toBe(true)
    const [customerId, points, type, description, opts] = awardPoints.mock.calls[0]
    expect(customerId).toBe('c1')
    expect(points).toBe(50)
    expect(type).toBe('ADMIN_ADJUSTMENT')
    expect(description).toContain('Test bonus')
    expect(opts.idempotencyKey).toMatch(/^admin-adjust-admin-1-c1-/)
  })

  it('adjustMemberPoints rejects negative delta that would overdraft', async () => {
    customerFindUnique.mockResolvedValue({ id: 'c1', currentPoints: 10 })
    const { adjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await adjustMemberPoints('c1', -50, 'Reverse')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/insufficient/i)
    expect(awardPoints).not.toHaveBeenCalled()
  })

  it('adjustMemberPoints rejects when reason is blank', async () => {
    const { adjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await adjustMemberPoints('c1', 10, '   ')
    expect(r.ok).toBe(false)
  })

  it('adjustMemberPoints rejects zero delta', async () => {
    const { adjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await adjustMemberPoints('c1', 0, 'reason')
    expect(r.ok).toBe(false)
  })

  it('adjustMemberPoints allows valid negative delta without overdraft', async () => {
    customerFindUnique.mockResolvedValue({ id: 'c1', currentPoints: 200 })
    awardPoints.mockResolvedValue({ id: 'p1' })
    const { adjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await adjustMemberPoints('c1', -100, 'Correction')
    expect(r.ok).toBe(true)
    expect(awardPoints).toHaveBeenCalledWith(
      'c1', -100, 'ADMIN_ADJUSTMENT', expect.any(String),
      expect.objectContaining({ idempotencyKey: expect.stringMatching(/^admin-adjust-admin-1-c1-/) }),
    )
  })

  it('recomputeMemberTier calls updateCustomerTier', async () => {
    updateCustomerTier.mockResolvedValue(null)
    const { recomputeMemberTier } = await import('@/app/admin/loyalty/actions')
    const r = await recomputeMemberTier('c1')
    expect(r.ok).toBe(true)
    expect(updateCustomerTier).toHaveBeenCalledWith('c1')
  })

  it('bulkAdjustMemberPoints uses one batchId per call', async () => {
    customerFindUnique.mockResolvedValue({ id: 'c1', currentPoints: 1000 })
    awardPoints.mockResolvedValue({ id: 'p1' })
    const { bulkAdjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await bulkAdjustMemberPoints(['c1', 'c2'], 100, 'Promo')
    expect(r.ok).toBe(true)
    // Both calls share the same batch UUID prefix
    const k1 = awardPoints.mock.calls[0][4].idempotencyKey as string
    const k2 = awardPoints.mock.calls[1][4].idempotencyKey as string
    const batch1 = k1.split('-')[1]
    const batch2 = k2.split('-')[1]
    expect(batch1).toBe(batch2)
  })

  it('bulkAdjustMemberPoints skips members that would overdraft', async () => {
    customerFindUnique
      .mockResolvedValueOnce({ id: 'c1', currentPoints: 10 })   // will fail
      .mockResolvedValueOnce({ id: 'c2', currentPoints: 1000 }) // will succeed
    awardPoints.mockResolvedValue({ id: 'p1' })
    const { bulkAdjustMemberPoints } = await import('@/app/admin/loyalty/actions')
    const r = await bulkAdjustMemberPoints(['c1', 'c2'], -500, 'Bulk correction')
    expect(r.ok).toBe(true)
    if (r.ok && r.data) {
      expect(r.data.succeeded).toEqual(['c2'])
      expect(r.data.failed[0].id).toBe('c1')
    }
  })

  it('bulkRecomputeTiers calls updateCustomerTier per member', async () => {
    updateCustomerTier.mockResolvedValue(null)
    const { bulkRecomputeTiers } = await import('@/app/admin/loyalty/actions')
    const r = await bulkRecomputeTiers(['c1', 'c2'])
    expect(r.ok).toBe(true)
    expect(updateCustomerTier).toHaveBeenCalledTimes(2)
  })
})

describe('REWARD actions', () => {
  it('createReward validates pointsCost positive', async () => {
    const { createReward } = await import('@/app/admin/loyalty/actions')
    const r = await createReward({
      name: 'Bad', slug: 'bad', description: 'd', pointsCost: -10,
      rewardType: 'DISCOUNT', isActive: true, sortOrder: 0,
    })
    expect(r.ok).toBe(false)
  })

  it('createReward persists with defaults', async () => {
    rewardCreate.mockResolvedValue({ id: 'r1' })
    const { createReward } = await import('@/app/admin/loyalty/actions')
    const r = await createReward({
      name: '10% off', slug: '10-off', description: 'd', pointsCost: 500,
      rewardType: 'DISCOUNT', isActive: true, sortOrder: 0,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.id).toBe('r1')
  })

  it('createReward rejects blank name', async () => {
    const { createReward } = await import('@/app/admin/loyalty/actions')
    const r = await createReward({
      name: '', slug: 'slug', description: 'd', pointsCost: 100,
      rewardType: 'DISCOUNT', isActive: true, sortOrder: 0,
    })
    expect(r.ok).toBe(false)
  })

  it('updateReward applies partial patch', async () => {
    rewardUpdate.mockResolvedValue({})
    const { updateReward } = await import('@/app/admin/loyalty/actions')
    const r = await updateReward('r1', { pointsCost: 750 })
    expect(r.ok).toBe(true)
    expect(rewardUpdate.mock.calls[0][0].data.pointsCost).toBe(750)
  })

  it('deleteReward rejects when redemptions exist', async () => {
    redemptionCount.mockResolvedValue(5)
    const { deleteReward } = await import('@/app/admin/loyalty/actions')
    const r = await deleteReward('r1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/redemption history/i)
  })

  it('deleteReward succeeds when no redemptions exist', async () => {
    redemptionCount.mockResolvedValue(0)
    rewardDelete.mockResolvedValue({})
    const { deleteReward } = await import('@/app/admin/loyalty/actions')
    const r = await deleteReward('r1')
    expect(r.ok).toBe(true)
  })

  it('toggleRewardActive flips isActive', async () => {
    rewardFindUnique.mockResolvedValue({ id: 'r1', isActive: true })
    rewardUpdate.mockResolvedValue({})
    const { toggleRewardActive } = await import('@/app/admin/loyalty/actions')
    const r = await toggleRewardActive('r1')
    expect(r.ok).toBe(true)
    expect(rewardUpdate.mock.calls[0][0].data.isActive).toBe(false)
  })

  it('toggleRewardActive returns not found when reward missing', async () => {
    rewardFindUnique.mockResolvedValue(null)
    const { toggleRewardActive } = await import('@/app/admin/loyalty/actions')
    const r = await toggleRewardActive('missing')
    expect(r.ok).toBe(false)
  })

  it('bulkActivateRewards returns per-id results', async () => {
    rewardUpdate.mockResolvedValue({})
    const { bulkActivateRewards } = await import('@/app/admin/loyalty/actions')
    const r = await bulkActivateRewards(['r1', 'r2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.succeeded).toEqual(['r1', 'r2'])
  })

  it('bulkDeactivateRewards sets isActive false', async () => {
    rewardUpdate.mockResolvedValue({})
    const { bulkDeactivateRewards } = await import('@/app/admin/loyalty/actions')
    const r = await bulkDeactivateRewards(['r1'])
    expect(r.ok).toBe(true)
    expect(rewardUpdate.mock.calls[0][0].data.isActive).toBe(false)
  })
})

describe('REDEMPTION actions', () => {
  it('fulfillRedemption rejects non-pending/active status', async () => {
    redemptionFindUnique.mockResolvedValue({ id: 'red1', status: 'USED' })
    const { fulfillRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await fulfillRedemption('red1', 'TRACK-123')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/already finalized/i)
  })

  it('fulfillRedemption sets FULFILLED + trackingNumber', async () => {
    redemptionFindUnique.mockResolvedValue({ id: 'red1', status: 'PENDING' })
    redemptionUpdate.mockResolvedValue({})
    const { fulfillRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await fulfillRedemption('red1', 'TRACK-123')
    expect(r.ok).toBe(true)
    const data = redemptionUpdate.mock.calls[0][0].data
    expect(data.status).toBe('FULFILLED')
    expect(data.trackingNumber).toBe('TRACK-123')
    expect(data.shippedAt).toBeInstanceOf(Date)
  })

  it('fulfillRedemption works without trackingNumber', async () => {
    redemptionFindUnique.mockResolvedValue({ id: 'red1', status: 'ACTIVE' })
    redemptionUpdate.mockResolvedValue({})
    const { fulfillRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await fulfillRedemption('red1')
    expect(r.ok).toBe(true)
    const data = redemptionUpdate.mock.calls[0][0].data
    expect(data.trackingNumber).toBeNull()
  })

  it('fulfillRedemption returns not found when redemption missing', async () => {
    redemptionFindUnique.mockResolvedValue(null)
    const { fulfillRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await fulfillRedemption('missing')
    expect(r.ok).toBe(false)
  })

  it('cancelRedemption reverses points via awardPoints with idempotency cancel-${id}', async () => {
    redemptionFindUnique.mockResolvedValue({
      id: 'red1', status: 'PENDING', customerId: 'c1', pointsSpent: 500,
    })
    redemptionUpdate.mockResolvedValue({})
    awardPoints.mockResolvedValue({ id: 'p1' })
    const { cancelRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await cancelRedemption('red1', 'Customer request')
    expect(r.ok).toBe(true)
    expect(awardPoints).toHaveBeenCalledWith(
      'c1', 500, 'ADMIN_ADJUSTMENT', expect.any(String),
      expect.objectContaining({ idempotencyKey: 'cancel-red1' }),
    )
    expect(redemptionUpdate.mock.calls[0][0].data.status).toBe('CANCELLED')
  })

  it('cancelRedemption refuses already-finalized statuses', async () => {
    redemptionFindUnique.mockResolvedValue({ id: 'red1', status: 'FULFILLED' })
    const { cancelRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await cancelRedemption('red1', 'oops')
    expect(r.ok).toBe(false)
  })

  it('cancelRedemption rejects blank reason', async () => {
    const { cancelRedemption } = await import('@/app/admin/loyalty/actions')
    const r = await cancelRedemption('red1', '  ')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/reason/i)
  })

  it('bulkFulfillRedemptions calls fulfillRedemption per id', async () => {
    redemptionFindUnique
      .mockResolvedValueOnce({ id: 'r1', status: 'PENDING' })
      .mockResolvedValueOnce({ id: 'r2', status: 'ACTIVE' })
    redemptionUpdate.mockResolvedValue({})
    const { bulkFulfillRedemptions } = await import('@/app/admin/loyalty/actions')
    const r = await bulkFulfillRedemptions(['r1', 'r2'])
    expect(r.ok).toBe(true)
    if (r.ok && r.data) expect(r.data.succeeded).toHaveLength(2)
  })

  it('bulkCancelRedemptions calls cancelRedemption per id', async () => {
    redemptionFindUnique
      .mockResolvedValueOnce({ id: 'r1', status: 'PENDING', customerId: 'c1', pointsSpent: 100 })
      .mockResolvedValueOnce({ id: 'r2', status: 'ACTIVE', customerId: 'c2', pointsSpent: 200 })
    redemptionUpdate.mockResolvedValue({})
    awardPoints.mockResolvedValue({ id: 'p1' })
    const { bulkCancelRedemptions } = await import('@/app/admin/loyalty/actions')
    const r = await bulkCancelRedemptions(['r1', 'r2'], 'Batch cancel')
    expect(r.ok).toBe(true)
    if (r.ok && r.data) expect(r.data.succeeded).toHaveLength(2)
  })
})

describe('EVENT actions', () => {
  it('createEvent persists', async () => {
    eventCreate.mockResolvedValue({ id: 'e1' })
    const { createEvent } = await import('@/app/admin/loyalty/actions')
    const r = await createEvent({
      name: 'Memorial 2x', description: 'd',
      startDate: new Date('2026-05-25'), endDate: new Date('2026-05-27'),
      multiplier: 2, isActive: true,
    })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.id).toBe('e1')
  })

  it('createEvent rejects blank name', async () => {
    const { createEvent } = await import('@/app/admin/loyalty/actions')
    const r = await createEvent({
      name: '', startDate: new Date(), endDate: new Date(), multiplier: 2,
    })
    expect(r.ok).toBe(false)
  })

  it('createEvent rejects endDate before startDate', async () => {
    const { createEvent } = await import('@/app/admin/loyalty/actions')
    const r = await createEvent({
      name: 'Bad dates',
      startDate: new Date('2026-05-27'), endDate: new Date('2026-05-25'),
      multiplier: 2,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/endDate/i)
  })

  it('updateEvent applies patch', async () => {
    eventUpdate.mockResolvedValue({})
    const { updateEvent } = await import('@/app/admin/loyalty/actions')
    const r = await updateEvent('e1', { multiplier: 3 })
    expect(r.ok).toBe(true)
    expect(eventUpdate.mock.calls[0][0].data.multiplier).toBe(3)
  })

  it('deleteEvent succeeds (no FK guards)', async () => {
    eventDelete.mockResolvedValue({})
    const { deleteEvent } = await import('@/app/admin/loyalty/actions')
    const r = await deleteEvent('e1')
    expect(r.ok).toBe(true)
  })

  it('toggleEventActive flips isActive', async () => {
    eventFindUnique.mockResolvedValue({ id: 'e1', isActive: false })
    eventUpdate.mockResolvedValue({})
    const { toggleEventActive } = await import('@/app/admin/loyalty/actions')
    const r = await toggleEventActive('e1')
    expect(r.ok).toBe(true)
    expect(eventUpdate.mock.calls[0][0].data.isActive).toBe(true)
  })

  it('toggleEventActive returns not found when event missing', async () => {
    eventFindUnique.mockResolvedValue(null)
    const { toggleEventActive } = await import('@/app/admin/loyalty/actions')
    const r = await toggleEventActive('missing')
    expect(r.ok).toBe(false)
  })

  it('bulkActivateEvents activates all', async () => {
    eventUpdate.mockResolvedValue({})
    const { bulkActivateEvents } = await import('@/app/admin/loyalty/actions')
    const r = await bulkActivateEvents(['e1', 'e2'])
    expect(r.ok).toBe(true)
    if (r.ok && r.data) expect(r.data.succeeded).toHaveLength(2)
  })

  it('bulkDeactivateEvents deactivates all', async () => {
    eventUpdate.mockResolvedValue({})
    const { bulkDeactivateEvents } = await import('@/app/admin/loyalty/actions')
    const r = await bulkDeactivateEvents(['e1'])
    expect(r.ok).toBe(true)
    expect(eventUpdate.mock.calls[0][0].data.isActive).toBe(false)
  })
})

describe('SETTINGS actions', () => {
  it('updateLoyaltySettings strips cron fields silently', async () => {
    settingsUpsert.mockResolvedValue({})
    const { updateLoyaltySettings } = await import('@/app/admin/loyalty/actions')
    const r = await updateLoyaltySettings({
      isEnabled: true,
      programName: 'New Name',
      pointsPerDollar: 2,
      pointsExpireMonths: 999, // should be stripped
      tierEvaluationPeriod: 'monthly', // should be stripped
    })
    expect(r.ok).toBe(true)
    const data = settingsUpsert.mock.calls[0][0].update
    expect(data.programName).toBe('New Name')
    expect(data.pointsExpireMonths).toBeUndefined()
    expect(data.tierEvaluationPeriod).toBeUndefined()
  })

  it('getLoyaltySettings returns defaults when not found', async () => {
    settingsFindUnique.mockResolvedValue(null)
    const { getLoyaltySettings } = await import('@/app/admin/loyalty/actions')
    const s = await getLoyaltySettings()
    expect(s.id).toBe('default')
    expect(s.pointsPerDollar).toBe(1)
    expect(s.pointsExpireMonths).toBe(12)
  })

  it('getLoyaltySettings returns row when found', async () => {
    settingsFindUnique.mockResolvedValue({
      id: 'default', isEnabled: true, programName: 'HOF Rewards',
      pointsPerDollar: 2, pointsRoundingMode: 'floor', minimumOrderForPoints: 10,
      referralPointsReferrer: 100, referralPointsReferred: 50, referralEnabled: true,
      reviewPointsEnabled: true, reviewPointsAmount: 25, reviewWithPhotoBonus: 25,
      birthdayRewardsEnabled: true, birthdayRewardType: 'points',
      birthdayRewardValue: 100, birthdayRewardExpireDays: 30,
      pointsExpireEnabled: true, pointsExpireMonths: 12, tierEvaluationPeriod: 'annual',
      tierDowngradeEnabled: false, showPointsInCart: true, showPointsInCheckout: true,
      showTierProgress: true, updatedAt: new Date(),
    })
    const { getLoyaltySettings } = await import('@/app/admin/loyalty/actions')
    const s = await getLoyaltySettings()
    expect(s.programName).toBe('HOF Rewards')
    expect(s.pointsPerDollar).toBe(2)
  })
})

describe('Inspector wrappers (inline queries)', () => {
  it('getMemberDetailForInspector returns null on missing', async () => {
    customerFindUnique.mockResolvedValue(null)
    const { getMemberDetailForInspector } = await import('@/app/admin/loyalty/actions')
    expect(await getMemberDetailForInspector('missing')).toBeNull()
  })

  it('getMemberDetailForInspector returns full detail with transactions', async () => {
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
    const { getMemberDetailForInspector } = await import('@/app/admin/loyalty/actions')
    const d = await getMemberDetailForInspector('c1')
    expect(d?.email).toBe('a@e.com')
    expect(d?.transactions).toHaveLength(1)
    expect(d?.tierName).toBe('Silver')
  })

  it('getTierDetailForInspector returns null on missing', async () => {
    tierFindUnique.mockResolvedValue(null)
    const { getTierDetailForInspector } = await import('@/app/admin/loyalty/actions')
    expect(await getTierDetailForInspector('missing')).toBeNull()
  })

  it('getTierDetailForInspector returns detail with memberCount', async () => {
    tierFindUnique.mockResolvedValue({
      id: 't1', name: 'Bronze', slug: 'bronze', description: null,
      primaryColor: '#64748B', secondaryColor: '#475569',
      minAnnualSpend: 0, minAnnualPoints: 0, isInviteOnly: false,
      pointMultiplier: 1, freeShipping: false, earlyDropAccess: false,
      perks: null, sortOrder: 1, isActive: true,
    })
    customerCount.mockResolvedValue(10)
    const { getTierDetailForInspector } = await import('@/app/admin/loyalty/actions')
    const d = await getTierDetailForInspector('t1')
    expect(d?.memberCount).toBe(10)
    expect(d?.name).toBe('Bronze')
  })

  it('getRewardDetailForInspector returns null on missing', async () => {
    rewardFindUnique.mockResolvedValue(null)
    const { getRewardDetailForInspector } = await import('@/app/admin/loyalty/actions')
    expect(await getRewardDetailForInspector('missing')).toBeNull()
  })

  it('getRewardDetailForInspector returns full detail', async () => {
    rewardFindUnique.mockResolvedValue({
      id: 'r1', name: '10% off', slug: '10-off', description: 'd',
      pointsCost: 500, rewardType: 'DISCOUNT', value: 10, isActive: true,
      maxRedemptionsPerCustomer: null, totalAvailable: null, totalRedeemed: 5,
      minTierRequired: null, metadata: null, image: null, sortOrder: 0,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { getRewardDetailForInspector } = await import('@/app/admin/loyalty/actions')
    const d = await getRewardDetailForInspector('r1')
    expect(d?.name).toBe('10% off')
    expect(d?.pointsCost).toBe(500)
  })

  it('getRedemptionDetailForInspector returns null on missing', async () => {
    redemptionFindUnique.mockResolvedValue(null)
    const { getRedemptionDetailForInspector } = await import('@/app/admin/loyalty/actions')
    expect(await getRedemptionDetailForInspector('missing')).toBeNull()
  })

  it('getRedemptionDetailForInspector returns full redemption detail', async () => {
    redemptionFindUnique.mockResolvedValue({
      id: 'red1', customerId: 'c1', rewardId: 'r1', pointsSpent: 500,
      status: 'PENDING', couponCode: 'HOF-ABC', usedAt: null, orderId: null,
      trackingNumber: null, shippedAt: null, metadata: null, idempotencyKey: 'k',
      createdAt: new Date(), updatedAt: new Date(),
      customer: { id: 'c1', email: 'a@e.com', name: 'Ada' },
      reward: { id: 'r1', name: '10% off', rewardType: 'DISCOUNT' },
    })
    const { getRedemptionDetailForInspector } = await import('@/app/admin/loyalty/actions')
    const d = await getRedemptionDetailForInspector('red1')
    expect(d?.customerEmail).toBe('a@e.com')
    expect(d?.rewardName).toBe('10% off')
  })

  it('getEventDetailForInspector returns full event detail', async () => {
    eventFindUnique.mockResolvedValue({
      id: 'e1', name: 'Memorial Day 2x', description: 'd',
      startDate: new Date(), endDate: new Date(), multiplier: 2,
      tierIds: null, categoryIds: null, isActive: true,
      totalBonusPointsAwarded: 100, ordersAffected: 5,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { getEventDetailForInspector } = await import('@/app/admin/loyalty/actions')
    const d = await getEventDetailForInspector('e1')
    expect(d?.name).toBe('Memorial Day 2x')
    expect(d?.multiplier).toBe(2)
  })

  it('getEventDetailForInspector returns null on missing', async () => {
    eventFindUnique.mockResolvedValue(null)
    const { getEventDetailForInspector } = await import('@/app/admin/loyalty/actions')
    expect(await getEventDetailForInspector('missing')).toBeNull()
  })
})

describe('CSV exports', () => {
  it('exportMembersCsv returns ActionResult<{ csv }>', async () => {
    customerCount.mockResolvedValue(1)
    customerFindMany.mockResolvedValue([
      { id: 'c1', email: 'a@e.com', name: 'Ada',
        currentPoints: 100, lifetimePoints: 1000, annualPointsEarned: 500,
        lastOrderDate: new Date('2026-05-15'),
        loyaltyTier: { name: 'Silver' } },
    ])
    const { exportMembersCsv } = await import('@/app/admin/loyalty/actions')
    const r = await exportMembersCsv()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.csv).toContain('a@e.com')
  })

  it('rejects exportMembersCsv over cap', async () => {
    customerCount.mockResolvedValue(20000)
    const { exportMembersCsv } = await import('@/app/admin/loyalty/actions')
    const r = await exportMembersCsv()
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/too many rows/i)
  })

  it('exportRewardsCsv returns csv with reward data', async () => {
    rewardCount.mockResolvedValue(1)
    rewardFindMany.mockResolvedValue([
      { id: 'r1', name: '10% off', slug: '10-off', rewardType: 'DISCOUNT',
        pointsCost: 500, isActive: true, totalRedeemed: 5,
        maxRedemptionsPerCustomer: null, totalAvailable: null, minTierRequired: null },
    ])
    const { exportRewardsCsv } = await import('@/app/admin/loyalty/actions')
    const r = await exportRewardsCsv()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.csv).toContain('10% off')
  })

  it('exportRedemptionsCsv returns csv for range', async () => {
    redemptionCount.mockResolvedValue(1)
    redemptionFindMany.mockResolvedValue([
      { id: 'red1', createdAt: new Date('2026-05-20'), pointsSpent: 500,
        status: 'PENDING', couponCode: 'HOF-ABC', trackingNumber: null, shippedAt: null,
        customer: { email: 'a@e.com' },
        reward: { name: '10% off' } },
    ])
    const { exportRedemptionsCsv } = await import('@/app/admin/loyalty/actions')
    const r = await exportRedemptionsCsv('30d')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.csv).toContain('a@e.com')
  })

  it('exportEventsCsv returns csv with event data', async () => {
    const pointsMultiplierEventCount = vi.fn().mockResolvedValue(1)
    // Override via module re-mock — event count uses the mocked prisma mock
    eventFindMany.mockResolvedValue([
      { id: 'e1', name: 'Memorial 2x', startDate: new Date('2026-05-25'),
        endDate: new Date('2026-05-27'), multiplier: 2, isActive: true,
        totalBonusPointsAwarded: 0, ordersAffected: 0 },
    ])
    const { exportEventsCsv } = await import('@/app/admin/loyalty/actions')
    const r = await exportEventsCsv()
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.csv).toContain('Memorial 2x')
  })

  it('exportOverviewCsv returns csv with transaction data', async () => {
    pointsTxFindMany.mockResolvedValue([
      { id: 'tx1', points: 100, type: 'PURCHASE', description: 'earned',
        createdAt: new Date('2026-05-20'),
        customer: { email: 'a@e.com' } },
    ])
    const { exportOverviewCsv } = await import('@/app/admin/loyalty/actions')
    const r = await exportOverviewCsv('30d')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.data?.csv).toContain('a@e.com')
  })
})
