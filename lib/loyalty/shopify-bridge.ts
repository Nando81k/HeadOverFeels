import 'server-only'

import { randomBytes } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import {
  awardFirstPurchasePoints,
  awardPurchasePoints,
  awardReferralPoints,
  deductPoints,
  getCustomerLoyaltyStats,
  getReferralCode,
  updateCustomerTier,
} from '@/lib/loyalty/service'
import { calculateTierProgressWithTiers } from '@/lib/loyalty/tier-progress'
import {
  createCustomerDiscountCode,
  createFreeShippingCode,
} from '@/lib/shopify/admin/discounts'
import { hasShopifyAdminEnv } from '@/lib/shopify/env'

/**
 * Bridge between Shopify identities/events and the Prisma Care Points program
 * (Phase 4, Task 2). Loyalty arithmetic stays in `lib/loyalty/service.ts`; this
 * module only resolves who a Shopify customer is in Prisma, turns `orders/paid`
 * into service calls, and mints single-use Shopify discount codes for rewards.
 *
 * Idempotency keys (contract):
 *   purchase  `shopify-order-paid-<order gid>`
 *   first     `shopify-first-<order gid>`
 *   referral  `shopify-referral-<order gid>`
 *   deduction `redeem-<redemption id>`, restore `restore-<redemption id>`
 */

// ------------------------------------------------------------------ types

export type PaidOrder = {
  orderGid: string
  orderName: string
  webhookId: string
  customer: {
    shopifyCustomerId: string | null
    email: string | null
    firstName: string | null
    lastName: string | null
  }
  /** `current_subtotal_price − current_total_discounts`, never negative. */
  subtotalAfterDiscounts: number
  currency: string
  discountCodes: string[]
  processedAt: string
}

export type RedeemResult = {
  redemptionId: string
  code: string
  /** ISO timestamp; empty for rewards that mint no code (early access). */
  expiresAt: string
  newBalance: number
}

export type TierView = {
  id: string
  name: string
  slug: string
  minAnnualPoints: number
  pointMultiplier: number
  perks: string[]
  current: boolean
}

export type RewardViewType = 'DISCOUNT' | 'FREE_SHIPPING' | 'EARLY_ACCESS' | 'OTHER'
export type RewardReason = 'ok' | 'points' | 'tier' | 'limit' | 'soldout'

export type RewardView = {
  id: string
  name: string
  description: string | null
  type: RewardViewType
  value: number | null
  pointsCost: number
  canRedeem: boolean
  reason: RewardReason
  pointsShort: number
}

export type LoyaltyOverview = {
  points: number
  lifetimePoints: number
  annualPoints: number
  tier: TierView
  nextTier: TierView | null
  pointsToNext: number | null
  /** 0–1 progress from the current tier's threshold to the next one's. */
  progressRatio: number
  multiplier: number
  expiringSoon: { points: number; at: string } | null
  rewards: RewardView[]
  /** Every active tier in order (additive to the contract; the hub renders the table from it). */
  tiers: TierView[]
  referral: { code: string; url: string; joined: number; ordered: number; pointsEarned: number }
}

export type { LoyaltyActionResult } from '@/lib/shopify/types'

export type LoyaltyErrorCode =
  | 'REWARD_UNAVAILABLE'
  | 'INSUFFICIENT_POINTS'
  | 'TIER_REQUIRED'
  | 'LIMIT_REACHED'
  | 'SOLD_OUT'
  | 'REWARDS_UNAVAILABLE'
  | 'REDEMPTION_CANCELLED'
  | 'CUSTOMER_NOT_FOUND'
  | 'CODE_FAILED'

/** A redemption refused for a reason the customer can act on; the action maps it 1:1. */
export class LoyaltyError extends Error {
  code: LoyaltyErrorCode
  constructor(code: LoyaltyErrorCode, message: string) {
    super(message)
    this.name = 'LoyaltyError'
    this.code = code
  }
}

// -------------------------------------------------------------- constants

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // A–Z0–9 minus O/0/I/1, 32 symbols
const CODE_LENGTH = 6
const CODE_TTL_DAYS = 90
const EXPIRING_WINDOW_DAYS = 30
const EARLY_ACCESS_DEFAULT_DAYS = 7

/**
 * `awardPurchasePoints` / `awardFirstPurchasePoints` take a legacy `Order.id`
 * (FK). Shopify orders have no Prisma `Order` row, so the FK column is left null;
 * the signatures are frozen, hence the cast. The order gid lives in `metadata`.
 */
const NO_LEGACY_ORDER = null as unknown as string

// ---------------------------------------------------------------- helpers

export function generateRewardCode(kind: 'DISC' | 'SHIP' | 'DROP'): string {
  const bytes = randomBytes(CODE_LENGTH)
  let suffix = ''
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    suffix += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length]
  }
  return `HOF-${kind}-${suffix}`
}

function normalizeEmail(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return trimmed.length > 0 ? trimmed : null
}

function fullName(first: string | null | undefined, last: string | null | undefined): string | null {
  const parts = [first, last].map((part) => (typeof part === 'string' ? part.trim() : '')).filter(Boolean)
  return parts.length > 0 ? parts.join(' ') : null
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === 'P2002'
}

function gidTail(gid: string): string {
  const tail = gid.split('/').pop() ?? gid
  return tail.split('?')[0]
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100
}

function parseJson(value: string | null | undefined): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/** The lowest active, non-invite tier (what a new customer starts on). */
async function lowestTierId(): Promise<string | null> {
  const tier = await prisma.loyaltyTier.findFirst({
    where: { isActive: true, isInviteOnly: false },
    orderBy: [{ minAnnualPoints: 'asc' }, { sortOrder: 'asc' }],
    select: { id: true },
  })
  return tier?.id ?? null
}

// ------------------------------------------------------- identity bridge

/**
 * Finds the Prisma customer for a Shopify customer: by `shopifyCustomerId`, then
 * by email (linking the gid), else creates a slim row on the lowest tier.
 */
export async function resolveCustomer(p: {
  shopifyCustomerId: string
  email: string
  firstName?: string | null
  lastName?: string | null
}): Promise<{ id: string; created: boolean }> {
  const email = normalizeEmail(p.email)
  if (!email) throw new LoyaltyError('CUSTOMER_NOT_FOUND', 'An email address is required.')

  const byGid = await prisma.customer.findUnique({
    where: { shopifyCustomerId: p.shopifyCustomerId },
    select: { id: true },
  })
  if (byGid) return { id: byGid.id, created: false }

  const byEmail = await prisma.customer.findUnique({ where: { email }, select: { id: true } })
  if (byEmail) {
    try {
      await prisma.customer.update({
        where: { id: byEmail.id },
        data: { shopifyCustomerId: p.shopifyCustomerId },
      })
    } catch (error) {
      // Another row already carries this gid (race with a parallel link); keep the email match.
      if (!isUniqueViolation(error)) throw error
    }
    return { id: byEmail.id, created: false }
  }

  try {
    const created = await prisma.customer.create({
      data: {
        email,
        name: fullName(p.firstName, p.lastName),
        shopifyCustomerId: p.shopifyCustomerId,
        newsletter: false,
        loyaltyTierId: await lowestTierId(),
      },
      select: { id: true },
    })
    return { id: created.id, created: true }
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    // Lost a create race: whoever won is now findable.
    const winner =
      (await prisma.customer.findUnique({
        where: { shopifyCustomerId: p.shopifyCustomerId },
        select: { id: true },
      })) ?? (await prisma.customer.findUnique({ where: { email }, select: { id: true } }))
    if (!winner) throw error
    return { id: winner.id, created: false }
  }
}

/** `customers/update`: keep email + name of the linked row in step with Shopify. */
export async function syncCustomerFromShopify(p: {
  shopifyCustomerId: string
  email: string | null
  firstName: string | null
  lastName: string | null
}): Promise<{ customerId: string | null }> {
  const existing = await prisma.customer.findUnique({
    where: { shopifyCustomerId: p.shopifyCustomerId },
    select: { id: true, email: true, name: true },
  })
  if (!existing) return { customerId: null }

  const email = normalizeEmail(p.email)
  const name = fullName(p.firstName, p.lastName)
  const data: { email?: string; name?: string } = {}
  if (email && email !== existing.email) data.email = email
  if (name && name !== existing.name) data.name = name
  if (Object.keys(data).length === 0) return { customerId: existing.id }

  try {
    await prisma.customer.update({ where: { id: existing.id }, data })
  } catch (error) {
    // The new email belongs to another legacy row; keep the name change only.
    if (!isUniqueViolation(error) || !data.name) throw error
    await prisma.customer.update({ where: { id: existing.id }, data: { name: data.name } })
  }
  return { customerId: existing.id }
}

// ------------------------------------------------------------ orders/paid

const moneyField = z
  .union([z.string(), z.number()])
  .transform((value) => {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  })

const ordersPaidSchema = z.object({
  admin_graphql_api_id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().nullish(),
  contact_email: z.string().nullish(),
  currency: z.string().min(1),
  current_subtotal_price: moneyField,
  current_total_discounts: moneyField.nullish(),
  discount_codes: z.array(z.object({ code: z.string() })).nullish(),
  processed_at: z.string().nullish(),
  created_at: z.string().nullish(),
  customer: z
    .object({
      admin_graphql_api_id: z.string().nullish(),
      id: z.union([z.number(), z.string()]).nullish(),
      email: z.string().nullish(),
      first_name: z.string().nullish(),
      last_name: z.string().nullish(),
    })
    .nullish(),
})

/**
 * Normalises Shopify's REST-shaped `orders/paid` payload. Throws a `ZodError` on
 * a malformed body. `context.webhookId` is the delivery id (not in the payload).
 */
export function parseOrdersPaid(payload: unknown, context: { webhookId?: string } = {}): PaidOrder {
  const order = ordersPaidSchema.parse(payload)
  const customer = order.customer ?? null
  const shopifyCustomerId =
    customer?.admin_graphql_api_id ??
    (customer?.id !== null && customer?.id !== undefined
      ? `gid://shopify/Customer/${customer.id}`
      : null)
  const discounts = order.current_total_discounts ?? 0

  return {
    orderGid: order.admin_graphql_api_id,
    orderName: order.name,
    webhookId: context.webhookId ?? '',
    customer: {
      shopifyCustomerId,
      email: normalizeEmail(customer?.email) ?? normalizeEmail(order.email) ?? normalizeEmail(order.contact_email),
      firstName: customer?.first_name?.trim() || null,
      lastName: customer?.last_name?.trim() || null,
    },
    subtotalAfterDiscounts: roundMoney(Math.max(0, order.current_subtotal_price - discounts)),
    currency: order.currency,
    discountCodes: (order.discount_codes ?? [])
      .map((entry) => entry.code.trim())
      .filter((code) => code.length > 0),
    processedAt: order.processed_at ?? order.created_at ?? new Date().toISOString(),
  }
}

export type PaidOrderOutcome = {
  customerId: string | null
  pointsAwarded: number
  firstOrder: boolean
  redemptionsUsed: string[]
}

/**
 * Posts Care Points for a paid Shopify order. Safe to replay: every award is
 * keyed by the order gid, and used codes are only moved from ACTIVE/PENDING.
 */
export async function awardPointsForPaidOrder(order: PaidOrder): Promise<PaidOrderOutcome> {
  const skipped: PaidOrderOutcome = {
    customerId: null,
    pointsAwarded: 0,
    firstOrder: false,
    redemptionsUsed: [],
  }

  let customerId: string | null = null
  if (order.customer.email && order.customer.shopifyCustomerId) {
    customerId = (await resolveCustomer({
      shopifyCustomerId: order.customer.shopifyCustomerId,
      email: order.customer.email,
      firstName: order.customer.firstName,
      lastName: order.customer.lastName,
    })).id
  } else if (order.customer.email) {
    // Guest checkout: link by email only (never invent a Shopify id).
    const byEmail = await prisma.customer.findUnique({
      where: { email: order.customer.email },
      select: { id: true },
    })
    customerId = byEmail?.id ?? null
  } else if (order.customer.shopifyCustomerId) {
    const byGid = await prisma.customer.findUnique({
      where: { shopifyCustomerId: order.customer.shopifyCustomerId },
      select: { id: true },
    })
    customerId = byGid?.id ?? null
  }
  if (!customerId) return skipped

  const purchaseKey = `shopify-order-paid-${order.orderGid}`

  // "First order" must survive a replay: ignore the transaction this very order creates.
  const priorPurchase = await prisma.pointsTransaction.findFirst({
    where: { customerId, type: 'PURCHASE', NOT: { idempotencyKey: purchaseKey } },
    select: { id: true },
  })
  const firstOrder = !priorPurchase

  const purchase = await awardPurchasePoints(
    customerId,
    NO_LEGACY_ORDER,
    order.subtotalAfterDiscounts,
    purchaseKey
  )
  // The service has no metadata parameter; stamp the Shopify reference once.
  await prisma.pointsTransaction.updateMany({
    where: { id: purchase.id, metadata: null },
    data: {
      metadata: JSON.stringify({
        orderGid: order.orderGid,
        orderName: order.orderName,
        currency: order.currency,
        webhookId: order.webhookId,
      }),
    },
  })

  if (firstOrder) {
    await awardFirstPurchasePoints(customerId, NO_LEGACY_ORDER, `shopify-first-${order.orderGid}`)
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { referredBy: true },
    })
    if (customer?.referredBy) {
      await awardReferralPoints(customer.referredBy, customerId, `shopify-referral-${order.orderGid}`)
    }
  }

  await updateCustomerTier(customerId)

  let redemptionsUsed: string[] = []
  if (order.discountCodes.length > 0) {
    const codes = order.discountCodes.map((code) => code.toUpperCase())
    const matches = await prisma.rewardRedemption.findMany({
      where: { couponCode: { in: codes }, status: { in: ['ACTIVE', 'PENDING'] } },
      select: { id: true },
    })
    if (matches.length > 0) {
      redemptionsUsed = matches.map((match) => match.id)
      await prisma.rewardRedemption.updateMany({
        where: { id: { in: redemptionsUsed } },
        data: { status: 'USED', usedAt: new Date(order.processedAt), orderId: order.orderGid },
      })
    }
  }

  return { customerId, pointsAwarded: purchase.points, firstOrder, redemptionsUsed }
}

// -------------------------------------------------------- cancellations

/**
 * `orders/cancelled`: a code consumed by this order goes back to the customer.
 * The redemption is CANCELLED and its points restored (idempotent per redemption).
 * Earned points for the order are left alone (out of scope: full cancel only).
 */
export async function restoreRedemptionsForCancelledOrder(orderGid: string): Promise<string[]> {
  const used = await prisma.rewardRedemption.findMany({
    where: { orderId: orderGid, status: 'USED' },
    select: { id: true, customerId: true, pointsSpent: true, reward: { select: { name: true } } },
  })
  for (const redemption of used) {
    await prisma.rewardRedemption.update({
      where: { id: redemption.id },
      data: { status: 'CANCELLED' },
    })
    await restorePoints({
      customerId: redemption.customerId,
      redemptionId: redemption.id,
      points: redemption.pointsSpent,
      description: `Points returned: ${redemption.reward.name} (order cancelled)`,
    })
  }
  return used.map((redemption) => redemption.id)
}

/**
 * Gives a redemption's points back, exactly and once (`restore-<redemption id>`).
 * Not `awardPoints`: that applies the tier multiplier, which would over-credit.
 */
async function restorePoints(p: {
  customerId: string
  redemptionId: string
  points: number
  description: string
}): Promise<void> {
  const idempotencyKey = `restore-${p.redemptionId}`
  await prisma.$transaction(async (tx) => {
    const existing = await tx.pointsTransaction.findUnique({ where: { idempotencyKey } })
    if (existing) return
    await tx.customer.update({
      where: { id: p.customerId },
      data: { currentPoints: { increment: p.points } },
    })
    await tx.pointsTransaction.create({
      data: {
        customerId: p.customerId,
        points: p.points,
        type: 'ADMIN_ADJUSTMENT',
        description: p.description,
        redemptionId: p.redemptionId,
        idempotencyKey,
      },
    })
  })
}

// ------------------------------------------------------------- redemption

type TierRow = { id: string; slug: string; sortOrder: number }

/** `minTierRequired` is a slug in some seeds and a tier id in others; accept both. */
function findRequiredTier(tiers: TierRow[], required: string): TierRow | null {
  const wanted = required.trim().toLowerCase()
  return tiers.find((tier) => tier.slug.toLowerCase() === wanted || tier.id === required) ?? null
}

function rewardKind(type: string): 'DISC' | 'SHIP' | 'DROP' | null {
  if (type === 'DISCOUNT') return 'DISC'
  if (type === 'FREE_SHIPPING') return 'SHIP'
  if (type === 'EARLY_ACCESS') return 'DROP'
  return null
}

/**
 * Redeems a reward for a signed-in customer and turns it into a single-use
 * Shopify code (or an early-access grant). Order of operations:
 *   1. Serializable tx: gates (active, tier by `sortOrder`, limits, balance) →
 *      RewardRedemption PENDING with the code, totalRedeemed + 1.
 *   2. `deductPoints` (the only way points leave).
 *   3. Admin mint → ACTIVE with `shopifyDiscountId` + `expiresAt`.
 * Any failure after step 1 cancels the redemption and restores the points.
 */
export async function redeemRewardToCode(p: {
  customerId: string
  rewardId: string
  idempotencyKey: string
  shopifyCustomerId: string
}): Promise<RedeemResult> {
  const existing = await prisma.rewardRedemption.findUnique({
    where: { idempotencyKey: p.idempotencyKey },
    include: { reward: true },
  })
  if (existing && existing.customerId !== p.customerId) {
    throw new LoyaltyError('REWARD_UNAVAILABLE', 'This reward is not available.')
  }
  if (existing && (existing.status === 'ACTIVE' || existing.status === 'FULFILLED' || existing.status === 'USED')) {
    return {
      redemptionId: existing.id,
      code: existing.couponCode ?? '',
      expiresAt: existing.expiresAt?.toISOString() ?? '',
      newBalance: await currentBalance(p.customerId),
    }
  }
  if (existing && existing.status !== 'PENDING') {
    throw new LoyaltyError('REDEMPTION_CANCELLED', 'This redemption was cancelled.')
  }

  const now = new Date()
  let redemption: { id: string; couponCode: string | null; status: string }
  let reward: {
    id: string
    name: string
    rewardType: string
    value: number | null
    pointsCost: number
    metadata: string | null
  }

  if (existing) {
    // A PENDING row means an earlier attempt stopped before the Admin step; resume it.
    redemption = existing
    reward = existing.reward
  } else {
    const created = await prisma.$transaction(
      async (tx) => {
        const rewardRow = await tx.reward.findUnique({ where: { id: p.rewardId } })
        if (!rewardRow || !rewardRow.isActive || !rewardKind(rewardRow.rewardType)) {
          throw new LoyaltyError('REWARD_UNAVAILABLE', 'This reward is not available.')
        }
        if (rewardRow.rewardType === 'DISCOUNT' && !(typeof rewardRow.value === 'number' && rewardRow.value > 0)) {
          throw new LoyaltyError('REWARD_UNAVAILABLE', 'This reward is not available.')
        }
        if ((rewardRow.rewardType === 'DISCOUNT' || rewardRow.rewardType === 'FREE_SHIPPING') && !hasShopifyAdminEnv()) {
          throw new LoyaltyError('REWARDS_UNAVAILABLE', 'Rewards unavailable')
        }

        const customer = await tx.customer.findUnique({
          where: { id: p.customerId },
          include: { loyaltyTier: { select: { id: true, slug: true, sortOrder: true } } },
        })
        if (!customer) throw new LoyaltyError('CUSTOMER_NOT_FOUND', 'Customer not found.')

        if (rewardRow.minTierRequired) {
          const tiers = await tx.loyaltyTier.findMany({
            where: { isActive: true },
            select: { id: true, slug: true, sortOrder: true },
          })
          const required = findRequiredTier(tiers, rewardRow.minTierRequired)
          if (required && (!customer.loyaltyTier || customer.loyaltyTier.sortOrder < required.sortOrder)) {
            throw new LoyaltyError('TIER_REQUIRED', 'This reward unlocks at a higher tier.')
          }
        }
        if (rewardRow.totalAvailable !== null && rewardRow.totalRedeemed >= rewardRow.totalAvailable) {
          throw new LoyaltyError('SOLD_OUT', 'This reward is sold out.')
        }
        if (rewardRow.maxRedemptionsPerCustomer !== null) {
          const used = await tx.rewardRedemption.count({
            where: { customerId: p.customerId, rewardId: rewardRow.id, status: { not: 'CANCELLED' } },
          })
          if (used >= rewardRow.maxRedemptionsPerCustomer) {
            throw new LoyaltyError('LIMIT_REACHED', 'You have already redeemed this reward.')
          }
        }
        if (customer.currentPoints < rewardRow.pointsCost) {
          throw new LoyaltyError('INSUFFICIENT_POINTS', 'Not enough Care Points yet.')
        }

        const kind = rewardKind(rewardRow.rewardType) as 'DISC' | 'SHIP' | 'DROP'
        const isEarlyAccess = rewardRow.rewardType === 'EARLY_ACCESS'
        const row = await tx.rewardRedemption.create({
          data: {
            customerId: p.customerId,
            rewardId: rewardRow.id,
            pointsSpent: rewardRow.pointsCost,
            status: 'PENDING',
            couponCode: generateRewardCode(kind),
            idempotencyKey: p.idempotencyKey,
            metadata: JSON.stringify({ shopifyCustomerId: p.shopifyCustomerId, source: 'storefront' }),
          },
          select: { id: true, couponCode: true, status: true },
        })
        await tx.reward.update({
          where: { id: rewardRow.id },
          data: { totalRedeemed: { increment: 1 } },
        })
        if (isEarlyAccess) {
          await grantEarlyAccess(tx, {
            customerId: p.customerId,
            redemptionId: row.id,
            metadata: parseJson(rewardRow.metadata),
            now,
          })
        }
        return { redemption: row, reward: rewardRow }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
    redemption = created.redemption
    reward = created.reward
  }

  const code = redemption.couponCode ?? ''

  // 2. Points leave through the service only (atomic compare-and-set).
  try {
    await deductPoints(
      p.customerId,
      reward.pointsCost,
      redemption.id,
      `Redeemed: ${reward.name}`,
      `redeem-${redemption.id}`
    )
  } catch (error) {
    await cancelRedemption(redemption.id, reward.id, { restore: false })
    if (error instanceof Error && /insufficient/i.test(error.message)) {
      throw new LoyaltyError('INSUFFICIENT_POINTS', 'Not enough Care Points yet.')
    }
    throw error
  }

  // 3. Early access needs no Shopify code.
  if (reward.rewardType === 'EARLY_ACCESS') {
    await prisma.rewardRedemption.update({
      where: { id: redemption.id },
      data: { status: 'FULFILLED', usedAt: now },
    })
    return {
      redemptionId: redemption.id,
      code,
      expiresAt: '',
      newBalance: await currentBalance(p.customerId),
    }
  }

  const expiresAt = new Date(now.getTime() + CODE_TTL_DAYS * 24 * 60 * 60 * 1000)
  const common = {
    title: `Care Points · ${reward.name} · ${gidTail(p.shopifyCustomerId)}`,
    code,
    customerGid: p.shopifyCustomerId,
    startsAt: now.toISOString(),
    endsAt: expiresAt.toISOString(),
  }

  let minted: { discountId: string; code: string; endsAt: string }
  try {
    if (reward.rewardType === 'FREE_SHIPPING') {
      minted = await createFreeShippingCode(common)
    } else {
      const meta = parseJson(reward.metadata)
      const value = reward.value ?? 0
      minted = await createCustomerDiscountCode({
        ...common,
        value:
          meta?.type === 'percentage'
            ? { percentage: Math.min(1, Math.max(0, value / 100)) }
            : { amount: value.toFixed(2) },
      })
    }
  } catch (error) {
    await cancelRedemption(redemption.id, reward.id, {
      restore: true,
      customerId: p.customerId,
      points: reward.pointsCost,
      description: `Points returned: ${reward.name} could not be issued`,
    })
    console.error(
      `[loyalty] discount mint failed for redemption ${redemption.id}: ${error instanceof Error ? error.message : String(error)}`
    )
    throw new LoyaltyError('CODE_FAILED', 'We could not issue your code. Your points were not taken.')
  }

  await prisma.rewardRedemption.update({
    where: { id: redemption.id },
    data: { status: 'ACTIVE', shopifyDiscountId: minted.discountId, expiresAt },
  })

  return {
    redemptionId: redemption.id,
    code: minted.code || code,
    expiresAt: expiresAt.toISOString(),
    newBalance: await currentBalance(p.customerId),
  }
}

async function grantEarlyAccess(
  tx: Prisma.TransactionClient,
  p: { customerId: string; redemptionId: string; metadata: Record<string, unknown> | null; now: Date }
): Promise<void> {
  const productId = typeof p.metadata?.productId === 'string' ? p.metadata.productId : null
  if (!productId) return // Reward not tied to a drop yet; Phase 5 reads the grant table.
  const days =
    typeof p.metadata?.validDays === 'number' && p.metadata.validDays > 0
      ? p.metadata.validDays
      : EARLY_ACCESS_DEFAULT_DAYS
  const validUntil = new Date(p.now.getTime() + days * 24 * 60 * 60 * 1000)
  await tx.earlyAccessGrant.upsert({
    where: { customerId_productId: { customerId: p.customerId, productId } },
    create: {
      customerId: p.customerId,
      productId,
      grantType: 'POINTS_REDEMPTION',
      redemptionId: p.redemptionId,
      validUntil,
    },
    update: { validUntil, grantType: 'POINTS_REDEMPTION' },
  })
}

async function cancelRedemption(
  redemptionId: string,
  rewardId: string,
  restore:
    | { restore: false }
    | { restore: true; customerId: string; points: number; description: string }
): Promise<void> {
  await prisma.rewardRedemption.update({
    where: { id: redemptionId },
    data: { status: 'CANCELLED' },
  })
  await prisma.reward.update({
    where: { id: rewardId },
    data: { totalRedeemed: { decrement: 1 } },
  })
  if (restore.restore) {
    await restorePoints({
      customerId: restore.customerId,
      redemptionId,
      points: restore.points,
      description: restore.description,
    })
  }
}

async function currentBalance(customerId: string): Promise<number> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { currentPoints: true },
  })
  return customer?.currentPoints ?? 0
}

// ---------------------------------------------------------------- overview

type TierRecord = {
  id: string
  name: string
  slug: string
  minAnnualPoints: number
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  perks: string | null
  sortOrder: number
}

const PERK_LABELS: Record<string, string> = {
  careBox: 'Exclusive Care Box',
  engravedItem: 'Engraved items',
  customItem: 'Custom items',
  birthdayGift: 'Birthday gift',
  prioritySupport: 'Priority support',
}

function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim()
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function tierPerks(tier: Pick<TierRecord, 'pointMultiplier' | 'freeShipping' | 'earlyDropAccess' | 'perks'>): string[] {
  const perks: string[] = []
  if (tier.pointMultiplier > 1) perks.push(`${tier.pointMultiplier}x points on every order`)
  if (tier.freeShipping) perks.push('Free shipping')
  if (tier.earlyDropAccess) perks.push('Early drop access')
  if (tier.perks) {
    try {
      const parsed = JSON.parse(tier.perks) as unknown
      if (Array.isArray(parsed)) {
        for (const entry of parsed) if (typeof entry === 'string' && entry.trim()) perks.push(entry.trim())
      } else if (parsed && typeof parsed === 'object') {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (value === true) perks.push(PERK_LABELS[key] ?? humanize(key))
          else if (typeof value === 'string' && value.trim()) perks.push(value.trim())
        }
      }
    } catch {
      /* malformed perks JSON: ignore */
    }
  }
  return Array.from(new Set(perks))
}

function toTierView(tier: TierRecord, currentId: string | null): TierView {
  return {
    id: tier.id,
    name: tier.name,
    slug: tier.slug,
    minAnnualPoints: tier.minAnnualPoints,
    pointMultiplier: tier.pointMultiplier,
    perks: tierPerks(tier),
    current: tier.id === currentId,
  }
}

function toRewardType(type: string): RewardViewType {
  return type === 'DISCOUNT' || type === 'FREE_SHIPPING' || type === 'EARLY_ACCESS' ? type : 'OTHER'
}

/** Stats + tiers + progress + expiring + rewards (with the reason they are locked) + referral. */
export async function getLoyaltyOverview(customerId: string): Promise<LoyaltyOverview> {
  const stats = await getCustomerLoyaltyStats(customerId)

  const tierRows = await prisma.loyaltyTier.findMany({
    where: { isActive: true, isInviteOnly: false },
    orderBy: [{ sortOrder: 'asc' }, { minAnnualPoints: 'asc' }],
  })
  const tiers: TierRecord[] = tierRows.map((tier) => ({
    id: tier.id,
    name: tier.name,
    slug: tier.slug,
    minAnnualPoints: tier.minAnnualPoints,
    pointMultiplier: tier.pointMultiplier,
    freeShipping: tier.freeShipping,
    earlyDropAccess: tier.earlyDropAccess,
    perks: tier.perks,
    sortOrder: tier.sortOrder,
  }))

  const currentTier: TierRecord | null =
    (stats.currentTier && tiers.find((tier) => tier.id === stats.currentTier?.id)) ??
    (stats.currentTier
      ? {
          id: stats.currentTier.id,
          name: stats.currentTier.name,
          slug: stats.currentTier.slug,
          minAnnualPoints: stats.currentTier.minAnnualPoints,
          pointMultiplier: stats.currentTier.pointMultiplier,
          freeShipping: stats.currentTier.freeShipping,
          earlyDropAccess: stats.currentTier.earlyDropAccess,
          perks: stats.currentTier.perks,
          sortOrder: stats.currentTier.sortOrder,
        }
      : null) ??
    tiers[0] ??
    null
  if (!currentTier) {
    throw new Error('No active loyalty tiers configured')
  }

  const progress = calculateTierProgressWithTiers({
    currentTierSlug: currentTier.slug,
    annualPointsEarned: stats.annualPointsEarned,
    tiers,
  })
  const nextTierRecord = progress.nextTier
    ? tiers.find((tier) => tier.slug === progress.nextTier?.slug) ?? null
    : null

  const now = new Date()
  const windowEnd = new Date(now.getTime() + EXPIRING_WINDOW_DAYS * 24 * 60 * 60 * 1000)
  const expiringWhere = {
    customerId,
    isExpired: false,
    points: { gt: 0 },
    expiresAt: { gte: now, lte: windowEnd },
  }
  const [expiringSum, expiringFirst] = await Promise.all([
    prisma.pointsTransaction.aggregate({ where: expiringWhere, _sum: { points: true } }),
    prisma.pointsTransaction.findFirst({
      where: expiringWhere,
      orderBy: { expiresAt: 'asc' },
      select: { expiresAt: true },
    }),
  ])
  const expiringPoints = expiringSum._sum.points ?? 0
  const expiringSoon =
    expiringPoints > 0 && expiringFirst?.expiresAt
      ? { points: expiringPoints, at: expiringFirst.expiresAt.toISOString() }
      : null

  const [rewardRows, redemptionCounts] = await Promise.all([
    prisma.reward.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { pointsCost: 'asc' }],
    }),
    prisma.rewardRedemption.groupBy({
      by: ['rewardId'],
      where: { customerId, status: { not: 'CANCELLED' } },
      _count: { _all: true },
    }),
  ])
  const countByReward = new Map(redemptionCounts.map((row) => [row.rewardId, row._count._all]))
  const tierRowsForGate: TierRow[] = tierRows.map((tier) => ({ id: tier.id, slug: tier.slug, sortOrder: tier.sortOrder }))

  const rewards: RewardView[] = rewardRows
    .filter((reward) => rewardKind(reward.rewardType) !== null)
    .map((reward) => {
      let reason: RewardReason = 'ok'
      if (reward.totalAvailable !== null && reward.totalRedeemed >= reward.totalAvailable) {
        reason = 'soldout'
      } else if (
        reward.maxRedemptionsPerCustomer !== null &&
        (countByReward.get(reward.id) ?? 0) >= reward.maxRedemptionsPerCustomer
      ) {
        reason = 'limit'
      } else if (reward.minTierRequired) {
        const required = findRequiredTier(tierRowsForGate, reward.minTierRequired)
        if (required && currentTier.sortOrder < required.sortOrder) reason = 'tier'
      }
      if (reason === 'ok' && stats.currentPoints < reward.pointsCost) reason = 'points'
      return {
        id: reward.id,
        name: reward.name,
        description: reward.description,
        type: toRewardType(reward.rewardType),
        value: reward.value,
        pointsCost: reward.pointsCost,
        canRedeem: reason === 'ok',
        reason,
        pointsShort: Math.max(0, reward.pointsCost - stats.currentPoints),
      }
    })

  const referralCode = await getReferralCode(customerId)
  const [joined, ordered, referralPoints] = await Promise.all([
    prisma.customer.count({ where: { referredBy: customerId } }),
    prisma.customer.count({
      where: { referredBy: customerId, pointsTransactions: { some: { type: 'PURCHASE' } } },
    }),
    prisma.pointsTransaction.aggregate({
      where: { customerId, type: 'REFERRAL_GIVE' },
      _sum: { points: true },
    }),
  ])
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL ?? '').trim().replace(/\/+$/, '')

  return {
    points: stats.currentPoints,
    lifetimePoints: stats.lifetimePoints,
    annualPoints: stats.annualPointsEarned,
    tier: toTierView(currentTier, currentTier.id),
    nextTier: nextTierRecord ? toTierView(nextTierRecord, currentTier.id) : null,
    pointsToNext: nextTierRecord ? progress.pointsNeeded : null,
    progressRatio: Math.min(1, Math.max(0, progress.progressPercentage / 100)),
    multiplier: currentTier.pointMultiplier,
    expiringSoon,
    rewards,
    tiers: tiers.map((tier) => toTierView(tier, currentTier.id)),
    referral: {
      code: referralCode.code,
      url: `${baseUrl}/?ref=${encodeURIComponent(referralCode.code)}`,
      joined,
      ordered,
      pointsEarned: referralPoints._sum.points ?? 0,
    },
  }
}
