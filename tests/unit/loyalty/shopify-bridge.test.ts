// tests/unit/loyalty/shopify-bridge.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import fixture from '@/tests/fixtures/shopify/webhooks/orders-paid.json'

vi.mock('server-only', () => ({}))

const { db, service, admin, env } = vi.hoisted(() => {
  const model = (...methods: string[]) =>
    Object.fromEntries(methods.map((method) => [method, vi.fn()])) as Record<string, ReturnType<typeof vi.fn>>
  const db = {
    customer: model('findUnique', 'update', 'create', 'count'),
    loyaltyTier: model('findFirst', 'findMany'),
    pointsTransaction: model('findFirst', 'findUnique', 'updateMany', 'create', 'aggregate'),
    rewardRedemption: model('findUnique', 'findMany', 'updateMany', 'update', 'count', 'create', 'groupBy'),
    reward: model('findUnique', 'update', 'findMany'),
    earlyAccessGrant: model('upsert'),
    $transaction: vi.fn(),
  }
  return {
    db,
    service: {
      awardPurchasePoints: vi.fn(),
      awardFirstPurchasePoints: vi.fn(),
      awardReferralPoints: vi.fn(),
      deductPoints: vi.fn(),
      getCustomerLoyaltyStats: vi.fn(),
      getReferralCode: vi.fn(),
      updateCustomerTier: vi.fn(),
    },
    admin: { createCustomerDiscountCode: vi.fn(), createFreeShippingCode: vi.fn() },
    env: { hasShopifyAdminEnv: vi.fn(() => true) },
  }
})

vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/loyalty/service', () => service)
vi.mock('@/lib/shopify/admin/discounts', () => admin)
vi.mock('@/lib/shopify/env', () => env)

import {
  awardPointsForPaidOrder,
  generateRewardCode,
  getLoyaltyOverview,
  LoyaltyError,
  parseOrdersPaid,
  redeemRewardToCode,
  resolveCustomer,
  restoreRedemptionsForCancelledOrder,
  syncCustomerFromShopify,
  tierPerks,
  type PaidOrder,
} from '@/lib/loyalty/shopify-bridge'

const ORDER_GID = 'gid://shopify/Order/6213458182369'
const CUSTOMER_GID = 'gid://shopify/Customer/8125374129377'
const CUSTOMER_ID = 'cus_1'

const tiers = [
  { id: 'tier-newcomer', name: 'Newcomer', slug: 'newcomer', minAnnualPoints: 0, pointMultiplier: 1, freeShipping: false, earlyDropAccess: false, perks: null, sortOrder: 0, isActive: true, isInviteOnly: false },
  { id: 'tier-friend', name: 'Friend', slug: 'friend', minAnnualPoints: 1000, pointMultiplier: 1.25, freeShipping: true, earlyDropAccess: false, perks: '{"birthdayGift":true}', sortOrder: 1, isActive: true, isInviteOnly: false },
  { id: 'tier-bestie', name: 'Bestie', slug: 'bestie', minAnnualPoints: 3000, pointMultiplier: 1.5, freeShipping: true, earlyDropAccess: true, perks: '["Exclusive Care Box"]', sortOrder: 2, isActive: true, isInviteOnly: false },
]

function reward(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reward-5off',
    name: '$5 Off Your Order',
    slug: 'five-dollars-off',
    description: 'Get $5 off',
    pointsCost: 500,
    rewardType: 'DISCOUNT',
    value: 5,
    isActive: true,
    maxRedemptionsPerCustomer: null,
    totalAvailable: null,
    totalRedeemed: 0,
    minTierRequired: null,
    metadata: null,
    sortOrder: 0,
    ...overrides,
  }
}

function paidOrder(overrides: Partial<PaidOrder> = {}): PaidOrder {
  return {
    orderGid: ORDER_GID,
    orderName: '#1042',
    webhookId: 'wh_1',
    customer: { shopifyCustomerId: CUSTOMER_GID, email: 'nando@example.com', firstName: 'Nando', lastName: 'Rivera' },
    subtotalAfterDiscounts: 151,
    currency: 'USD',
    discountCodes: ['HOF-DISC-K7M2P9'],
    processedAt: '2026-10-11T18:02:11.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  env.hasShopifyAdminEnv.mockReturnValue(true)
  // Interactive transactions run against the same mocked delegates.
  db.$transaction.mockImplementation(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db))
  db.loyaltyTier.findMany.mockResolvedValue(tiers)
  db.loyaltyTier.findFirst.mockResolvedValue(tiers[0])
})

describe('generateRewardCode', () => {
  it('builds HOF-<KIND>-<6> from the safe alphabet (no O/0/I/1)', () => {
    for (let index = 0; index < 50; index += 1) {
      const code = generateRewardCode('DISC')
      expect(code).toMatch(/^HOF-DISC-[A-HJ-NP-Z2-9]{6}$/)
    }
    expect(generateRewardCode('SHIP')).toMatch(/^HOF-SHIP-/)
    expect(generateRewardCode('DROP')).toMatch(/^HOF-DROP-/)
  })
})

describe('parseOrdersPaid', () => {
  it('normalises the Shopify REST payload from the fixture', () => {
    const order = parseOrdersPaid(fixture, { webhookId: 'wh_1' })
    expect(order).toEqual({
      orderGid: ORDER_GID,
      orderName: '#1042',
      webhookId: 'wh_1',
      customer: { shopifyCustomerId: CUSTOMER_GID, email: 'nando@example.com', firstName: 'Nando', lastName: 'Rivera' },
      subtotalAfterDiscounts: 151,
      currency: 'USD',
      discountCodes: ['HOF-DISC-K7M2P9'],
      processedAt: '2026-10-11T14:02:11-04:00',
    })
  })

  it('never goes negative, falls back to the order email and builds a gid from a numeric id', () => {
    const order = parseOrdersPaid({
      ...fixture,
      current_subtotal_price: '10.00',
      current_total_discounts: '25.00',
      customer: { id: 42, email: null, first_name: null, last_name: null },
      email: '  Buyer@Example.com ',
      discount_codes: null,
    })
    expect(order.subtotalAfterDiscounts).toBe(0)
    expect(order.customer).toEqual({ shopifyCustomerId: 'gid://shopify/Customer/42', email: 'buyer@example.com', firstName: null, lastName: null })
    expect(order.discountCodes).toEqual([])
    expect(order.webhookId).toBe('')
  })

  it('handles guest orders (no customer) and rejects a body without an order gid', () => {
    const guest = parseOrdersPaid({ ...fixture, customer: null, email: null, contact_email: 'g@x.io' })
    expect(guest.customer).toEqual({ shopifyCustomerId: null, email: 'g@x.io', firstName: null, lastName: null })
    expect(() => parseOrdersPaid({ name: '#1' })).toThrow()
  })
})

describe('resolveCustomer', () => {
  it('finds by shopifyCustomerId first', async () => {
    db.customer.findUnique.mockResolvedValueOnce({ id: CUSTOMER_ID })
    await expect(resolveCustomer({ shopifyCustomerId: CUSTOMER_GID, email: 'nando@example.com' })).resolves.toEqual({ id: CUSTOMER_ID, created: false })
    expect(db.customer.findUnique).toHaveBeenCalledWith({ where: { shopifyCustomerId: CUSTOMER_GID }, select: { id: true } })
    expect(db.customer.update).not.toHaveBeenCalled()
  })

  it('falls back to email (lower-cased) and links the gid', async () => {
    db.customer.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'legacy_1' })
    db.customer.update.mockResolvedValue({})
    await expect(resolveCustomer({ shopifyCustomerId: CUSTOMER_GID, email: ' Nando@Example.com ' })).resolves.toEqual({ id: 'legacy_1', created: false })
    expect(db.customer.findUnique).toHaveBeenNthCalledWith(2, { where: { email: 'nando@example.com' }, select: { id: true } })
    expect(db.customer.update).toHaveBeenCalledWith({ where: { id: 'legacy_1' }, data: { shopifyCustomerId: CUSTOMER_GID } })
  })

  it('creates a slim row on the lowest tier when nothing matches', async () => {
    db.customer.findUnique.mockResolvedValue(null)
    db.customer.create.mockResolvedValue({ id: 'new_1' })
    await expect(resolveCustomer({ shopifyCustomerId: CUSTOMER_GID, email: 'new@example.com', firstName: 'New', lastName: 'Person' })).resolves.toEqual({ id: 'new_1', created: true })
    expect(db.customer.create).toHaveBeenCalledWith({
      data: { email: 'new@example.com', name: 'New Person', shopifyCustomerId: CUSTOMER_GID, newsletter: false, loyaltyTierId: 'tier-newcomer' },
      select: { id: true },
    })
  })

  it('recovers from a lost create race (P2002)', async () => {
    db.customer.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'winner' })
    db.customer.create.mockRejectedValue({ code: 'P2002' })
    await expect(resolveCustomer({ shopifyCustomerId: CUSTOMER_GID, email: 'new@example.com' })).resolves.toEqual({ id: 'winner', created: false })
  })
})

describe('syncCustomerFromShopify', () => {
  it('updates email + name on the linked row only when they changed', async () => {
    db.customer.findUnique.mockResolvedValue({ id: CUSTOMER_ID, email: 'old@example.com', name: 'Nando Rivera' })
    db.customer.update.mockResolvedValue({})
    await syncCustomerFromShopify({ shopifyCustomerId: CUSTOMER_GID, email: 'New@Example.com', firstName: 'Nando', lastName: 'Rivera' })
    expect(db.customer.update).toHaveBeenCalledWith({ where: { id: CUSTOMER_ID }, data: { email: 'new@example.com' } })
  })

  it('is a no-op for unknown customers', async () => {
    db.customer.findUnique.mockResolvedValue(null)
    await expect(syncCustomerFromShopify({ shopifyCustomerId: 'gid://shopify/Customer/0', email: 'x@y.z', firstName: null, lastName: null })).resolves.toEqual({ customerId: null })
    expect(db.customer.update).not.toHaveBeenCalled()
  })
})

describe('awardPointsForPaidOrder', () => {
  beforeEach(() => {
    db.customer.findUnique.mockImplementation(async (args: { where: Record<string, unknown>; select?: Record<string, unknown> }) => {
      if (args.where.shopifyCustomerId) return { id: CUSTOMER_ID }
      if (args.select?.referredBy) return { referredBy: 'referrer_1' }
      return { id: CUSTOMER_ID }
    })
    service.awardPurchasePoints.mockResolvedValue({ id: 'ptx_1', points: 151 })
    service.awardFirstPurchasePoints.mockResolvedValue({ id: 'ptx_2', points: 100 })
    service.awardReferralPoints.mockResolvedValue({ id: 'ptx_3', points: 250 })
    service.updateCustomerTier.mockResolvedValue(null)
    db.pointsTransaction.updateMany.mockResolvedValue({ count: 1 })
    db.rewardRedemption.findMany.mockResolvedValue([{ id: 'red_1' }])
    db.rewardRedemption.updateMany.mockResolvedValue({ count: 1 })
  })

  it('awards purchase + first-order + referral with the contract idempotency keys and marks the code USED', async () => {
    db.pointsTransaction.findFirst.mockResolvedValue(null)
    const result = await awardPointsForPaidOrder(paidOrder())

    expect(result).toEqual({ customerId: CUSTOMER_ID, pointsAwarded: 151, firstOrder: true, redemptionsUsed: ['red_1'] })
    expect(service.awardPurchasePoints).toHaveBeenCalledWith(CUSTOMER_ID, null, 151, `shopify-order-paid-${ORDER_GID}`)
    expect(service.awardFirstPurchasePoints).toHaveBeenCalledWith(CUSTOMER_ID, null, `shopify-first-${ORDER_GID}`)
    expect(service.awardReferralPoints).toHaveBeenCalledWith('referrer_1', CUSTOMER_ID, `shopify-referral-${ORDER_GID}`)
    expect(service.updateCustomerTier).toHaveBeenCalledWith(CUSTOMER_ID)
    expect(db.pointsTransaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'ptx_1', metadata: null },
      data: { metadata: JSON.stringify({ orderGid: ORDER_GID, orderName: '#1042', currency: 'USD', webhookId: 'wh_1' }) },
    })
    expect(db.rewardRedemption.findMany).toHaveBeenCalledWith({
      where: { couponCode: { in: ['HOF-DISC-K7M2P9'] }, status: { in: ['ACTIVE', 'PENDING'] } },
      select: { id: true },
    })
    expect(db.rewardRedemption.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['red_1'] } },
      data: { status: 'USED', usedAt: new Date('2026-10-11T18:02:11.000Z'), orderId: ORDER_GID },
    })
  })

  it('skips the first-order bonuses when an earlier PURCHASE exists (excluding this order on replay)', async () => {
    db.pointsTransaction.findFirst.mockResolvedValue({ id: 'older' })
    const result = await awardPointsForPaidOrder(paidOrder({ discountCodes: [] }))
    expect(result.firstOrder).toBe(false)
    expect(db.pointsTransaction.findFirst).toHaveBeenCalledWith({
      where: { customerId: CUSTOMER_ID, type: 'PURCHASE', NOT: { idempotencyKey: `shopify-order-paid-${ORDER_GID}` } },
      select: { id: true },
    })
    expect(service.awardFirstPurchasePoints).not.toHaveBeenCalled()
    expect(service.awardReferralPoints).not.toHaveBeenCalled()
    expect(db.rewardRedemption.findMany).not.toHaveBeenCalled()
    expect(result.redemptionsUsed).toEqual([])
  })

  it('skips orders without any customer identity', async () => {
    const result = await awardPointsForPaidOrder(paidOrder({ customer: { shopifyCustomerId: null, email: null, firstName: null, lastName: null } }))
    expect(result).toEqual({ customerId: null, pointsAwarded: 0, firstOrder: false, redemptionsUsed: [] })
    expect(service.awardPurchasePoints).not.toHaveBeenCalled()
  })

  it('links a guest order by email only and skips unknown guests', async () => {
    db.customer.findUnique.mockResolvedValue(null)
    const result = await awardPointsForPaidOrder(paidOrder({ customer: { shopifyCustomerId: null, email: 'guest@example.com', firstName: null, lastName: null } }))
    expect(result.customerId).toBeNull()
    expect(db.customer.findUnique).toHaveBeenCalledWith({ where: { email: 'guest@example.com' }, select: { id: true } })
    expect(db.customer.create).not.toHaveBeenCalled()
  })
})

describe('restoreRedemptionsForCancelledOrder', () => {
  it('cancels USED redemptions of the order and restores their points once', async () => {
    db.rewardRedemption.findMany.mockResolvedValue([{ id: 'red_1', customerId: CUSTOMER_ID, pointsSpent: 500, reward: { name: '$5 Off' } }])
    db.rewardRedemption.update.mockResolvedValue({})
    db.pointsTransaction.findUnique.mockResolvedValue(null)
    db.customer.update.mockResolvedValue({})
    db.pointsTransaction.create.mockResolvedValue({})

    await expect(restoreRedemptionsForCancelledOrder(ORDER_GID)).resolves.toEqual(['red_1'])
    expect(db.rewardRedemption.update).toHaveBeenCalledWith({ where: { id: 'red_1' }, data: { status: 'CANCELLED' } })
    expect(db.customer.update).toHaveBeenCalledWith({ where: { id: CUSTOMER_ID }, data: { currentPoints: { increment: 500 } } })
    expect(db.pointsTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ customerId: CUSTOMER_ID, points: 500, type: 'ADMIN_ADJUSTMENT', redemptionId: 'red_1', idempotencyKey: 'restore-red_1' }),
    })
  })

  it('does not restore twice', async () => {
    db.rewardRedemption.findMany.mockResolvedValue([{ id: 'red_1', customerId: CUSTOMER_ID, pointsSpent: 500, reward: { name: '$5 Off' } }])
    db.rewardRedemption.update.mockResolvedValue({})
    db.pointsTransaction.findUnique.mockResolvedValue({ id: 'already' })
    await restoreRedemptionsForCancelledOrder(ORDER_GID)
    expect(db.customer.update).not.toHaveBeenCalled()
  })
})

describe('redeemRewardToCode', () => {
  const input = { customerId: CUSTOMER_ID, rewardId: 'reward-5off', idempotencyKey: 'idem-1234', shopifyCustomerId: CUSTOMER_GID }

  beforeEach(() => {
    db.rewardRedemption.findUnique.mockResolvedValue(null)
    db.reward.findUnique.mockResolvedValue(reward())
    db.customer.findUnique.mockImplementation(async (args: { select?: Record<string, unknown> }) =>
      args.select?.currentPoints ? { currentPoints: 700 } : { id: CUSTOMER_ID, currentPoints: 1200, loyaltyTier: { id: 'tier-friend', slug: 'friend', sortOrder: 1 } }
    )
    db.rewardRedemption.create.mockImplementation(async (args: { data: { couponCode: string } }) => ({ id: 'red_new', couponCode: args.data.couponCode, status: 'PENDING' }))
    db.reward.update.mockResolvedValue({})
    db.rewardRedemption.update.mockResolvedValue({})
    db.rewardRedemption.count.mockResolvedValue(0)
    service.deductPoints.mockResolvedValue({ id: 'ptx_d' })
    admin.createCustomerDiscountCode.mockImplementation(async (args: { code: string; endsAt: string }) => ({ discountId: 'gid://shopify/DiscountCodeNode/1', code: args.code, endsAt: args.endsAt }))
    admin.createFreeShippingCode.mockImplementation(async (args: { code: string; endsAt: string }) => ({ discountId: 'gid://shopify/DiscountCodeNode/2', code: args.code, endsAt: args.endsAt }))
  })

  it('happy path: PENDING row → deductPoints → Admin mint → ACTIVE with discount id + expiry', async () => {
    const before = Date.now()
    const result = await redeemRewardToCode(input)

    expect(result.redemptionId).toBe('red_new')
    expect(result.code).toMatch(/^HOF-DISC-[A-HJ-NP-Z2-9]{6}$/)
    expect(result.newBalance).toBe(700)
    const expires = new Date(result.expiresAt).getTime()
    expect(expires).toBeGreaterThanOrEqual(before + 89 * 24 * 60 * 60 * 1000)
    expect(expires).toBeLessThanOrEqual(Date.now() + 91 * 24 * 60 * 60 * 1000)

    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' })
    expect(db.rewardRedemption.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ customerId: CUSTOMER_ID, rewardId: 'reward-5off', pointsSpent: 500, status: 'PENDING', idempotencyKey: 'idem-1234' }),
    }))
    expect(db.reward.update).toHaveBeenCalledWith({ where: { id: 'reward-5off' }, data: { totalRedeemed: { increment: 1 } } })
    expect(service.deductPoints).toHaveBeenCalledWith(CUSTOMER_ID, 500, 'red_new', 'Redeemed: $5 Off Your Order', 'redeem-red_new')
    expect(admin.createCustomerDiscountCode).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Care Points · $5 Off Your Order · 8125374129377',
      code: result.code,
      customerGid: CUSTOMER_GID,
      value: { amount: '5.00' },
    }))
    expect(db.rewardRedemption.update).toHaveBeenLastCalledWith({
      where: { id: 'red_new' },
      data: { status: 'ACTIVE', shopifyDiscountId: 'gid://shopify/DiscountCodeNode/1', expiresAt: expect.any(Date) },
    })
  })

  it('sends a percentage value when the reward metadata says so, and free shipping through the shipping mutation', async () => {
    db.reward.findUnique.mockResolvedValue(reward({ id: 'reward-15', name: '15% Off', value: 15, metadata: JSON.stringify({ type: 'percentage' }) }))
    await redeemRewardToCode({ ...input, rewardId: 'reward-15' })
    expect(admin.createCustomerDiscountCode).toHaveBeenCalledWith(expect.objectContaining({ value: { percentage: 0.15 } }))

    db.reward.findUnique.mockResolvedValue(reward({ id: 'reward-ship', name: 'Free Shipping', rewardType: 'FREE_SHIPPING', value: null, pointsCost: 300 }))
    const result = await redeemRewardToCode({ ...input, rewardId: 'reward-ship', idempotencyKey: 'idem-ship' })
    expect(result.code).toMatch(/^HOF-SHIP-/)
    expect(admin.createFreeShippingCode).toHaveBeenCalledWith(expect.objectContaining({ code: result.code, customerGid: CUSTOMER_GID }))
    expect(admin.createFreeShippingCode.mock.calls[0][0]).not.toHaveProperty('value')
  })

  it('Admin failure: redemption CANCELLED, totalRedeemed rolled back, points restored exactly (no multiplier), throws CODE_FAILED', async () => {
    admin.createCustomerDiscountCode.mockRejectedValue(new Error('userErrors: code taken'))
    db.pointsTransaction.findUnique.mockResolvedValue(null)
    db.customer.update.mockResolvedValue({})
    db.pointsTransaction.create.mockResolvedValue({})

    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ name: 'LoyaltyError', code: 'CODE_FAILED' })
    expect(db.rewardRedemption.update).toHaveBeenCalledWith({ where: { id: 'red_new' }, data: { status: 'CANCELLED' } })
    expect(db.reward.update).toHaveBeenCalledWith({ where: { id: 'reward-5off' }, data: { totalRedeemed: { decrement: 1 } } })
    expect(db.customer.update).toHaveBeenCalledWith({ where: { id: CUSTOMER_ID }, data: { currentPoints: { increment: 500 } } })
    expect(db.pointsTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ points: 500, type: 'ADMIN_ADJUSTMENT', idempotencyKey: 'restore-red_new' }),
    })
  })

  it('deductPoints insufficient balance → INSUFFICIENT_POINTS, redemption cancelled, nothing minted', async () => {
    service.deductPoints.mockRejectedValue(new Error('Insufficient points balance'))
    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ code: 'INSUFFICIENT_POINTS' })
    expect(db.rewardRedemption.update).toHaveBeenCalledWith({ where: { id: 'red_new' }, data: { status: 'CANCELLED' } })
    expect(admin.createCustomerDiscountCode).not.toHaveBeenCalled()
  })

  it('gates: tier by sortOrder (slug or id), per-customer limit, sold out, balance, inactive, unavailable admin', async () => {
    db.reward.findUnique.mockResolvedValue(reward({ minTierRequired: 'bestie' }))
    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ code: 'TIER_REQUIRED' })

    db.reward.findUnique.mockResolvedValue(reward({ minTierRequired: 'tier-bestie' }))
    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ code: 'TIER_REQUIRED' })

    db.reward.findUnique.mockResolvedValue(reward({ minTierRequired: 'friend' }))
    await expect(redeemRewardToCode(input)).resolves.toBeTruthy()

    db.reward.findUnique.mockResolvedValue(reward({ maxRedemptionsPerCustomer: 1 }))
    db.rewardRedemption.count.mockResolvedValue(1)
    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ code: 'LIMIT_REACHED' })
    db.rewardRedemption.count.mockResolvedValue(0)

    db.reward.findUnique.mockResolvedValue(reward({ totalAvailable: 10, totalRedeemed: 10 }))
    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ code: 'SOLD_OUT' })

    db.reward.findUnique.mockResolvedValue(reward({ pointsCost: 5000 }))
    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ code: 'INSUFFICIENT_POINTS' })

    db.reward.findUnique.mockResolvedValue(reward({ isActive: false }))
    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ code: 'REWARD_UNAVAILABLE' })

    db.reward.findUnique.mockResolvedValue(reward({ rewardType: 'PHYSICAL_PERK' }))
    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ code: 'REWARD_UNAVAILABLE' })

    db.reward.findUnique.mockResolvedValue(reward())
    env.hasShopifyAdminEnv.mockReturnValue(false)
    await expect(redeemRewardToCode(input)).rejects.toMatchObject({ code: 'REWARDS_UNAVAILABLE' })

    expect(service.deductPoints).toHaveBeenCalledTimes(1) // only the friend-tier success
    expect(db.rewardRedemption.create).toHaveBeenCalledTimes(1)
  })

  it('replays an existing ACTIVE redemption for the same idempotency key without redeeming again', async () => {
    db.rewardRedemption.findUnique.mockResolvedValue({ id: 'red_old', customerId: CUSTOMER_ID, status: 'ACTIVE', couponCode: 'HOF-DISC-AAAAAA', expiresAt: new Date('2027-01-01T00:00:00.000Z'), reward: reward() })
    await expect(redeemRewardToCode(input)).resolves.toEqual({ redemptionId: 'red_old', code: 'HOF-DISC-AAAAAA', expiresAt: '2027-01-01T00:00:00.000Z', newBalance: 700 })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(service.deductPoints).not.toHaveBeenCalled()
    expect(admin.createCustomerDiscountCode).not.toHaveBeenCalled()
  })

  it('EARLY_ACCESS: no Shopify code, grant upserted from reward metadata, redemption FULFILLED', async () => {
    db.reward.findUnique.mockResolvedValue(reward({ id: 'reward-drop', name: 'Early Drop Access', rewardType: 'EARLY_ACCESS', value: null, pointsCost: 750, metadata: JSON.stringify({ productId: 'prod_1', validDays: 3 }) }))
    db.earlyAccessGrant.upsert.mockResolvedValue({})
    env.hasShopifyAdminEnv.mockReturnValue(false) // not needed for early access

    const result = await redeemRewardToCode({ ...input, rewardId: 'reward-drop' })
    expect(result.code).toMatch(/^HOF-DROP-/)
    expect(result.expiresAt).toBe('')
    expect(db.earlyAccessGrant.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { customerId_productId: { customerId: CUSTOMER_ID, productId: 'prod_1' } },
      create: expect.objectContaining({ grantType: 'POINTS_REDEMPTION', redemptionId: 'red_new', productId: 'prod_1' }),
    }))
    expect(admin.createCustomerDiscountCode).not.toHaveBeenCalled()
    expect(admin.createFreeShippingCode).not.toHaveBeenCalled()
    expect(db.rewardRedemption.update).toHaveBeenLastCalledWith({ where: { id: 'red_new' }, data: { status: 'FULFILLED', usedAt: expect.any(Date) } })
  })
})

describe('tierPerks', () => {
  it('derives perks from flags plus JSON perks (array or object)', () => {
    expect(tierPerks(tiers[0])).toEqual([])
    expect(tierPerks(tiers[1])).toEqual(['1.25x points on every order', 'Free shipping', 'Birthday gift'])
    expect(tierPerks(tiers[2])).toEqual(['1.5x points on every order', 'Free shipping', 'Early drop access', 'Exclusive Care Box'])
    expect(tierPerks({ pointMultiplier: 1, freeShipping: false, earlyDropAccess: false, perks: '{not json' })).toEqual([])
  })
})

describe('getLoyaltyOverview', () => {
  beforeEach(() => {
    service.getCustomerLoyaltyStats.mockResolvedValue({
      currentPoints: 1240,
      lifetimePoints: 4100,
      annualPointsEarned: 1800,
      annualSpend: 0,
      currentTier: tiers[1],
      nextTier: tiers[2],
      pointsToNextTier: 1200,
      recentTransactions: [],
      recentRedemptions: [],
    })
    db.pointsTransaction.aggregate.mockImplementation(async (args: { where: { type?: string } }) =>
      args.where.type === 'REFERRAL_GIVE' ? { _sum: { points: 250 } } : { _sum: { points: 120 } }
    )
    db.pointsTransaction.findFirst.mockResolvedValue({ expiresAt: new Date('2026-10-30T00:00:00.000Z') })
    db.reward.findMany.mockResolvedValue([
      reward(),
      reward({ id: 'reward-bestie', name: 'Bestie Only', pointsCost: 100, minTierRequired: 'bestie' }),
      reward({ id: 'reward-big', name: '$50 Off', pointsCost: 3500, value: 50 }),
      reward({ id: 'reward-limit', name: 'Once', pointsCost: 100, maxRedemptionsPerCustomer: 1 }),
      reward({ id: 'reward-gone', name: 'Gone', pointsCost: 100, totalAvailable: 5, totalRedeemed: 5 }),
      reward({ id: 'reward-box', name: 'Mystery Box', rewardType: 'PHYSICAL_PERK', value: null, pointsCost: 5000 }),
    ])
    db.rewardRedemption.groupBy.mockResolvedValue([{ rewardId: 'reward-limit', _count: { _all: 1 } }])
    service.getReferralCode.mockResolvedValue({ code: 'NANDO7X2', timesUsed: 2 })
    db.customer.count.mockResolvedValueOnce(3).mockResolvedValueOnce(1)
    process.env.NEXT_PUBLIC_BASE_URL = 'https://headoverfeels.test/'
  })

  it('assembles stats, progress, expiring, gated rewards and referral', async () => {
    const overview = await getLoyaltyOverview(CUSTOMER_ID)

    expect(overview.points).toBe(1240)
    expect(overview.lifetimePoints).toBe(4100)
    expect(overview.annualPoints).toBe(1800)
    expect(overview.tier).toMatchObject({ id: 'tier-friend', slug: 'friend', current: true, pointMultiplier: 1.25 })
    expect(overview.nextTier).toMatchObject({ id: 'tier-bestie', current: false })
    expect(overview.pointsToNext).toBe(1200)
    expect(overview.progressRatio).toBeCloseTo(800 / 2000, 5)
    expect(overview.multiplier).toBe(1.25)
    expect(overview.expiringSoon).toEqual({ points: 120, at: '2026-10-30T00:00:00.000Z' })
    expect(overview.tiers.map((tier) => tier.slug)).toEqual(['newcomer', 'friend', 'bestie'])
    expect(overview.referral).toEqual({ code: 'NANDO7X2', url: 'https://headoverfeels.test/?ref=NANDO7X2', joined: 3, ordered: 1, pointsEarned: 250 })

    const byId = Object.fromEntries(overview.rewards.map((entry) => [entry.id, entry]))
    expect(Object.keys(byId)).toEqual(['reward-5off', 'reward-bestie', 'reward-big', 'reward-limit', 'reward-gone'])
    expect(byId['reward-5off']).toMatchObject({ type: 'DISCOUNT', canRedeem: true, reason: 'ok', pointsShort: 0, value: 5 })
    expect(byId['reward-bestie']).toMatchObject({ canRedeem: false, reason: 'tier' })
    expect(byId['reward-big']).toMatchObject({ canRedeem: false, reason: 'points', pointsShort: 2260 })
    expect(byId['reward-limit']).toMatchObject({ canRedeem: false, reason: 'limit' })
    expect(byId['reward-gone']).toMatchObject({ canRedeem: false, reason: 'soldout' })
  })

  it('reports no expiring points and a null next tier at the top', async () => {
    service.getCustomerLoyaltyStats.mockResolvedValue({
      currentPoints: 10, lifetimePoints: 10, annualPointsEarned: 9000, annualSpend: 0,
      currentTier: tiers[2], nextTier: null, pointsToNextTier: null, recentTransactions: [], recentRedemptions: [],
    })
    db.pointsTransaction.aggregate.mockResolvedValue({ _sum: { points: null } })
    db.pointsTransaction.findFirst.mockResolvedValue(null)
    const overview = await getLoyaltyOverview(CUSTOMER_ID)
    expect(overview.nextTier).toBeNull()
    expect(overview.pointsToNext).toBeNull()
    expect(overview.progressRatio).toBe(1)
    expect(overview.expiringSoon).toBeNull()
    expect(overview.referral.pointsEarned).toBe(0)
  })

  it('falls back to the lowest tier for a customer without one', async () => {
    service.getCustomerLoyaltyStats.mockResolvedValue({
      currentPoints: 0, lifetimePoints: 0, annualPointsEarned: 0, annualSpend: 0,
      currentTier: null, nextTier: tiers[1], pointsToNextTier: 1000, recentTransactions: [], recentRedemptions: [],
    })
    const overview = await getLoyaltyOverview(CUSTOMER_ID)
    expect(overview.tier.slug).toBe('newcomer')
    expect(overview.nextTier?.slug).toBe('friend')
    expect(overview.pointsToNext).toBe(1000)
  })
})

describe('LoyaltyError', () => {
  it('carries a code', () => {
    const error = new LoyaltyError('SOLD_OUT', 'gone')
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('SOLD_OUT')
    expect(error.name).toBe('LoyaltyError')
  })
})
