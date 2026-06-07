// app/admin/loyalty/actions.ts
'use server'

/**
 * Phase 7 — Admin Loyalty Server Actions (~32 actions).
 *
 * Auth gates:
 *   - requireAdmin() (no-arg) for all read + most write actions.
 *   - requireAdminRole('SUPER_ADMIN') for: deleteTier, deleteReward, cancelRedemption,
 *     bulkAdjustMemberPoints, bulkCancelRedemptions.
 *
 * Points/tier mutations:
 *   ALL points changes route through lib/loyalty/service.ts (awardPoints / deductPoints /
 *   updateCustomerTier) — never write raw to PointsTransaction. Preserves PR #17 + #37
 *   atomicity + idempotency guarantees.
 *
 * PARALLEL-SAFETY NOTE:
 *   get*ForInspector actions inline their Prisma queries because Task 1 (which builds
 *   lib/admin/loyalty.ts) is executing concurrently on a separate branch. Refactor
 *   deferred to Phase 7.5.
 */

import { revalidatePath } from 'next/cache'
import type {
  PointsTransactionType,
  RewardType,
  RedemptionStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'
import { awardPoints, updateCustomerTier } from '@/lib/loyalty/service'

// ============================================================
// Return types
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export interface BulkResultData {
  succeeded: string[]
  failed: { id: string; error: string }[]
}
export type BulkResult = ActionResult<BulkResultData>

// ============================================================
// TimeRange (re-declared inline for parallel-safety with Task 1)
// ============================================================

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'

function getRangeBoundsLocal(range: TimeRange, ref: Date = new Date()): { start: Date; end: Date } {
  const end = new Date(ref)
  const start = new Date(ref)
  const day = 24 * 60 * 60 * 1000
  switch (range) {
    case 'today': start.setUTCHours(0, 0, 0, 0); break
    case '7d':    start.setTime(end.getTime() - 7 * day); break
    case '30d':   start.setTime(end.getTime() - 30 * day); break
    case '90d':   start.setTime(end.getTime() - 90 * day); break
    case 'year':  start.setTime(end.getTime() - 365 * day); break
  }
  return { start, end }
}

const CSV_MAX_ROWS = 10000
const LOYALTY_PATH = '/admin/loyalty'

function revalidateLoyalty() {
  revalidatePath(LOYALTY_PATH)
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = v instanceof Date ? v.toISOString() : String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function rowsToCsv(headers: string[], rows: unknown[][]): string {
  const head = headers.join(',')
  const body = rows.map((r) => r.map(csvEscape).join(',')).join('\n')
  return body ? `${head}\n${body}` : head
}

// ============================================================
// Re-exported detail shapes (so client components can import type)
// These are inlined here for W1 parallel-safety with Task 1.
// ============================================================

export interface MemberLedgerEntry {
  id: string
  points: number
  type: PointsTransactionType
  description: string
  createdAt: Date
  orderId: string | null
  redemptionId: string | null
  referralId: string | null
  reviewId: string | null
}

export interface MemberDetailFull {
  id: string
  email: string
  name: string | null
  tierId: string | null
  tierName: string | null
  tierColor: string | null
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  tierStartDate: Date
  lastOrderDate: Date | null
  transactions: MemberLedgerEntry[]
}

export interface TierDetailFull {
  id: string
  name: string
  slug: string
  description: string | null
  primaryColor: string
  secondaryColor: string
  minAnnualSpend: number
  minAnnualPoints: number
  isInviteOnly: boolean
  pointMultiplier: number
  freeShipping: boolean
  earlyDropAccess: boolean
  perks: string | null
  sortOrder: number
  isActive: boolean
  memberCount: number
}

export interface RewardDetailFull {
  id: string
  name: string
  slug: string
  description: string | null
  pointsCost: number
  rewardType: RewardType
  value: number | null
  isActive: boolean
  maxRedemptionsPerCustomer: number | null
  totalAvailable: number | null
  totalRedeemed: number
  minTierRequired: string | null
  metadata: string | null
  image: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
}

export interface RedemptionDetailFull {
  id: string
  customerId: string
  customerEmail: string
  customerName: string | null
  rewardId: string
  rewardName: string
  rewardType: RewardType
  pointsSpent: number
  status: RedemptionStatus
  couponCode: string | null
  usedAt: Date | null
  orderId: string | null
  trackingNumber: string | null
  shippedAt: Date | null
  metadata: string | null
  idempotencyKey: string
  createdAt: Date
  updatedAt: Date
}

export interface EventDetailFull {
  id: string
  name: string
  description: string | null
  startDate: Date
  endDate: Date
  multiplier: number
  tierIds: string | null
  categoryIds: string | null
  isActive: boolean
  totalBonusPointsAwarded: number
  ordersAffected: number
  createdAt: Date
  updatedAt: Date
}

export interface LoyaltySettingsRow {
  id: string
  isEnabled: boolean
  programName: string
  pointsPerDollar: number
  pointsRoundingMode: string
  minimumOrderForPoints: number
  referralPointsReferrer: number
  referralPointsReferred: number
  referralEnabled: boolean
  reviewPointsEnabled: boolean
  reviewPointsAmount: number
  reviewWithPhotoBonus: number
  birthdayRewardsEnabled: boolean
  birthdayRewardType: string
  birthdayRewardValue: number
  birthdayRewardExpireDays: number
  pointsExpireEnabled: boolean
  pointsExpireMonths: number
  tierEvaluationPeriod: string
  tierDowngradeEnabled: boolean
  showPointsInCart: boolean
  showPointsInCheckout: boolean
  showTierProgress: boolean
  updatedAt: Date
}

// ============================================================
// Re-exported enums (client-safe via import type)
// ============================================================

export type { PointsTransactionType, RewardType, RedemptionStatus }

// ============================================================
// Input types
// ============================================================

export interface CreateTierInput {
  name: string
  slug: string
  description?: string | null
  primaryColor: string
  secondaryColor: string
  minAnnualSpend?: number
  minAnnualPoints?: number
  isInviteOnly?: boolean
  pointMultiplier: number
  freeShipping?: boolean
  earlyDropAccess?: boolean
  perks?: string | null
  sortOrder: number
  isActive?: boolean
}

export type UpdateTierInput = Partial<CreateTierInput>

export interface CreateRewardInput {
  name: string
  slug: string
  description?: string | null
  pointsCost: number
  rewardType: RewardType
  value?: number | null
  isActive?: boolean
  maxRedemptionsPerCustomer?: number | null
  totalAvailable?: number | null
  minTierRequired?: string | null
  metadata?: string | null
  image?: string | null
  sortOrder?: number
}

export type UpdateRewardInput = Partial<CreateRewardInput>

export interface CreateEventInput {
  name: string
  description?: string | null
  startDate: Date
  endDate: Date
  multiplier: number
  tierIds?: string | null
  categoryIds?: string | null
  isActive?: boolean
}

export type UpdateEventInput = Partial<CreateEventInput>

export interface UpdateLoyaltySettingsInput {
  isEnabled?: boolean
  programName?: string
  pointsPerDollar?: number
  pointsRoundingMode?: string
  minimumOrderForPoints?: number
  referralPointsReferrer?: number
  referralPointsReferred?: number
  referralEnabled?: boolean
  reviewPointsEnabled?: boolean
  reviewPointsAmount?: number
  reviewWithPhotoBonus?: number
  birthdayRewardsEnabled?: boolean
  birthdayRewardType?: string
  birthdayRewardValue?: number
  birthdayRewardExpireDays?: number
  pointsExpireEnabled?: boolean
  /** CRON-MANAGED — silently stripped by updateLoyaltySettings. */
  pointsExpireMonths?: number
  /** CRON-MANAGED — silently stripped by updateLoyaltySettings. */
  tierEvaluationPeriod?: string
  tierDowngradeEnabled?: boolean
  showPointsInCart?: boolean
  showPointsInCheckout?: boolean
  showTierProgress?: boolean
}

// ============================================================
// TIERS
// ============================================================

export async function createTier(input: CreateTierInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  if (!input.name?.trim() || !input.slug?.trim()) {
    return { ok: false, error: 'Name and slug are required' }
  }
  try {
    const t = await prisma.loyaltyTier.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim(),
        description: input.description ?? null,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        minAnnualSpend: input.minAnnualSpend ?? 0,
        minAnnualPoints: input.minAnnualPoints ?? 0,
        isInviteOnly: input.isInviteOnly ?? false,
        pointMultiplier: input.pointMultiplier,
        freeShipping: input.freeShipping ?? false,
        earlyDropAccess: input.earlyDropAccess ?? false,
        perks: input.perks ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive ?? true,
      },
    })
    revalidateLoyalty()
    return { ok: true, data: { id: t.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create tier' }
  }
}

export async function updateTier(id: string, input: UpdateTierInput): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateTierInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.loyaltyTier.update({ where: { id }, data })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update tier' }
  }
}

/** SUPER_ADMIN gate — rejects if any customer is on the tier. */
export async function deleteTier(id: string): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  const count = await prisma.customer.count({ where: { loyaltyTierId: id } })
  if (count > 0) {
    return { ok: false, error: `${count} customer(s) on this tier; reassign first` }
  }
  try {
    await prisma.loyaltyTier.delete({ where: { id } })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete tier' }
  }
}

export async function toggleTierActive(id: string): Promise<ActionResult> {
  await requireAdmin()
  const existing = await prisma.loyaltyTier.findUnique({
    where: { id }, select: { isActive: true },
  })
  if (!existing) return { ok: false, error: 'Tier not found' }
  await prisma.loyaltyTier.update({ where: { id }, data: { isActive: !existing.isActive } })
  revalidateLoyalty()
  return { ok: true }
}

export async function getTierDetailForInspector(id: string): Promise<TierDetailFull | null> {
  await requireAdmin()
  const t = await prisma.loyaltyTier.findUnique({ where: { id } })
  if (!t) return null
  const memberCount = await prisma.customer.count({ where: { loyaltyTierId: id } })
  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description ?? null,
    primaryColor: t.primaryColor,
    secondaryColor: t.secondaryColor,
    minAnnualSpend: Number(t.minAnnualSpend ?? 0),
    minAnnualPoints: t.minAnnualPoints,
    isInviteOnly: t.isInviteOnly,
    pointMultiplier: Number(t.pointMultiplier ?? 1),
    freeShipping: t.freeShipping,
    earlyDropAccess: t.earlyDropAccess,
    perks: t.perks ?? null,
    sortOrder: t.sortOrder,
    isActive: t.isActive,
    memberCount,
  }
}

// ============================================================
// MEMBERS
// ============================================================

export async function adjustMemberPoints(
  memberId: string,
  delta: number,
  reason: string,
): Promise<ActionResult> {
  const adminId = await requireAdmin()
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: 'Delta must be a non-zero number' }
  }
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Reason is required' }
  }
  // Pre-check overdraft for negative deltas.
  // awardPoints with negative points does NOT guard against going below zero —
  // only deductPoints does. We enforce it here before calling the service.
  if (delta < 0) {
    const c = await prisma.customer.findUnique({
      where: { id: memberId }, select: { currentPoints: true },
    })
    if (!c) return { ok: false, error: 'Customer not found' }
    if (c.currentPoints + delta < 0) {
      return { ok: false, error: `Insufficient points — balance: ${c.currentPoints}` }
    }
  }
  try {
    await awardPoints(
      memberId,
      delta,
      'ADMIN_ADJUSTMENT',
      `Admin adjustment: ${reason.trim()}`,
      { idempotencyKey: `admin-adjust-${adminId}-${memberId}-${Date.now()}` },
    )
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to adjust points' }
  }
}

export async function recomputeMemberTier(memberId: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await updateCustomerTier(memberId)
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to recompute tier' }
  }
}

/** SUPER_ADMIN gate. One batchId per invocation so per-member idempotency keys are unique. */
export async function bulkAdjustMemberPoints(
  memberIds: string[],
  delta: number,
  reason: string,
): Promise<BulkResult> {
  const adminId = await requireAdminRole('SUPER_ADMIN')
  if (!Number.isFinite(delta) || delta === 0) {
    return { ok: false, error: 'Delta must be a non-zero number' }
  }
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Reason is required' }
  }
  // Generate a single batchId for the whole bulk call (stable prefix for all per-member keys).
  const rawUuid =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`
  const batchId = rawUuid.replace(/-/g, '').slice(0, 12)

  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []

  for (const memberId of memberIds) {
    try {
      if (delta < 0) {
        const c = await prisma.customer.findUnique({
          where: { id: memberId }, select: { currentPoints: true },
        })
        if (!c) {
          failed.push({ id: memberId, error: 'Customer not found' })
          continue
        }
        if (c.currentPoints + delta < 0) {
          failed.push({ id: memberId, error: 'Insufficient points' })
          continue
        }
      }
      await awardPoints(
        memberId,
        delta,
        'ADMIN_ADJUSTMENT',
        `Bulk admin adjustment: ${reason.trim()}`,
        { idempotencyKey: `bulk-${batchId}-${memberId}` },
      )
      succeeded.push(memberId)
    } catch (err) {
      failed.push({ id: memberId, error: err instanceof Error ? err.message : 'failed' })
    }
  }

  void adminId
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function bulkRecomputeTiers(memberIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of memberIds) {
    try {
      await updateCustomerTier(id)
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function getMemberDetailForInspector(id: string): Promise<MemberDetailFull | null> {
  await requireAdmin()
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      loyaltyTier: { select: { id: true, name: true, slug: true, primaryColor: true } },
      pointsTransactions: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, points: true, type: true, description: true, createdAt: true,
          orderId: true, redemptionId: true, referralId: true, reviewId: true,
        },
      },
    },
  })
  if (!c) return null
  return {
    id: c.id,
    email: c.email,
    name: c.name ?? null,
    tierId: c.loyaltyTier?.id ?? null,
    tierName: c.loyaltyTier?.name ?? null,
    tierColor: c.loyaltyTier?.primaryColor ?? null,
    currentPoints: c.currentPoints,
    lifetimePoints: c.lifetimePoints,
    annualPointsEarned: c.annualPointsEarned,
    tierStartDate: c.tierStartDate,
    lastOrderDate: c.lastOrderDate ?? null,
    transactions: c.pointsTransactions.map((t) => ({
      id: t.id,
      points: Number(t.points),
      type: t.type,
      description: t.description,
      createdAt: t.createdAt,
      orderId: t.orderId ?? null,
      redemptionId: t.redemptionId ?? null,
      referralId: t.referralId ?? null,
      reviewId: t.reviewId ?? null,
    })),
  }
}

// ============================================================
// REWARDS
// ============================================================

export async function createReward(input: CreateRewardInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  if (!input.name?.trim() || !input.slug?.trim()) {
    return { ok: false, error: 'Name and slug are required' }
  }
  if (!Number.isFinite(input.pointsCost) || input.pointsCost < 0) {
    return { ok: false, error: 'pointsCost must be a non-negative number' }
  }
  try {
    const r = await prisma.reward.create({
      data: {
        name: input.name.trim(),
        slug: input.slug.trim(),
        description: input.description ?? null,
        pointsCost: input.pointsCost,
        rewardType: input.rewardType,
        value: input.value ?? null,
        isActive: input.isActive ?? true,
        maxRedemptionsPerCustomer: input.maxRedemptionsPerCustomer ?? null,
        totalAvailable: input.totalAvailable ?? null,
        minTierRequired: input.minTierRequired ?? null,
        metadata: input.metadata ?? null,
        image: input.image ?? null,
        sortOrder: input.sortOrder ?? 0,
      },
    })
    revalidateLoyalty()
    return { ok: true, data: { id: r.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create reward' }
  }
}

export async function updateReward(id: string, input: UpdateRewardInput): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateRewardInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.reward.update({ where: { id }, data })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update reward' }
  }
}

/** SUPER_ADMIN gate — rejects if any redemptions exist for this reward. */
export async function deleteReward(id: string): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  const count = await prisma.rewardRedemption.count({ where: { rewardId: id } })
  if (count > 0) {
    return { ok: false, error: 'Reward has redemption history; deactivate instead of deleting' }
  }
  try {
    await prisma.reward.delete({ where: { id } })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete reward' }
  }
}

export async function toggleRewardActive(id: string): Promise<ActionResult> {
  await requireAdmin()
  const existing = await prisma.reward.findUnique({
    where: { id }, select: { isActive: true },
  })
  if (!existing) return { ok: false, error: 'Reward not found' }
  await prisma.reward.update({ where: { id }, data: { isActive: !existing.isActive } })
  revalidateLoyalty()
  return { ok: true }
}

export async function bulkActivateRewards(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      await prisma.reward.update({ where: { id }, data: { isActive: true } })
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function bulkDeactivateRewards(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      await prisma.reward.update({ where: { id }, data: { isActive: false } })
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function getRewardDetailForInspector(id: string): Promise<RewardDetailFull | null> {
  await requireAdmin()
  const r = await prisma.reward.findUnique({ where: { id } })
  if (!r) return null
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? null,
    pointsCost: r.pointsCost,
    rewardType: r.rewardType,
    value: r.value === null ? null : Number(r.value),
    isActive: r.isActive,
    maxRedemptionsPerCustomer: r.maxRedemptionsPerCustomer ?? null,
    totalAvailable: r.totalAvailable ?? null,
    totalRedeemed: r.totalRedeemed,
    minTierRequired: r.minTierRequired ?? null,
    metadata: r.metadata ?? null,
    image: r.image ?? null,
    sortOrder: r.sortOrder,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ============================================================
// REDEMPTIONS
// ============================================================

const FULFILLABLE_STATUSES: RedemptionStatus[] = ['PENDING', 'ACTIVE']
const CANCELLABLE_STATUSES: RedemptionStatus[] = ['PENDING', 'ACTIVE']

export async function fulfillRedemption(
  id: string,
  trackingNumber?: string,
): Promise<ActionResult> {
  await requireAdmin()
  const existing = await prisma.rewardRedemption.findUnique({
    where: { id }, select: { id: true, status: true },
  })
  if (!existing) return { ok: false, error: 'Redemption not found' }
  if (!FULFILLABLE_STATUSES.includes(existing.status)) {
    return { ok: false, error: 'Redemption already finalized — cannot fulfill' }
  }
  try {
    await prisma.rewardRedemption.update({
      where: { id },
      data: {
        status: 'FULFILLED',
        shippedAt: new Date(),
        trackingNumber: trackingNumber ?? null,
      },
    })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to fulfill redemption' }
  }
}

/** SUPER_ADMIN gate — refunds points via awardPoints with stable idempotency key. */
export async function cancelRedemption(id: string, reason: string): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  if (!reason || reason.trim().length === 0) {
    return { ok: false, error: 'Cancellation reason is required' }
  }
  const existing = await prisma.rewardRedemption.findUnique({
    where: { id },
    select: { id: true, status: true, customerId: true, pointsSpent: true },
  })
  if (!existing) return { ok: false, error: 'Redemption not found' }
  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    return { ok: false, error: 'Redemption already finalized — cannot cancel' }
  }
  try {
    // Refund the points using the atomic service with a stable idempotency key.
    // If the same redemption is cancelled twice (e.g. race or retry), the key
    // ensures the refund is applied exactly once.
    await awardPoints(
      existing.customerId,
      existing.pointsSpent,
      'ADMIN_ADJUSTMENT',
      `Refund for cancelled redemption ${id}: ${reason.trim()}`,
      { idempotencyKey: `cancel-${id}` },
    )
    await prisma.rewardRedemption.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to cancel redemption' }
  }
}

export async function bulkFulfillRedemptions(
  ids: string[],
  trackingByRedemptionId: Record<string, string> = {},
): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    const r = await fulfillRedemption(id, trackingByRedemptionId[id])
    if (r.ok) succeeded.push(id)
    else failed.push({ id, error: r.error })
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

/** SUPER_ADMIN gate — delegates to cancelRedemption per id. */
export async function bulkCancelRedemptions(
  ids: string[],
  reason: string,
): Promise<BulkResult> {
  await requireAdminRole('SUPER_ADMIN')
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    const r = await cancelRedemption(id, reason)
    if (r.ok) succeeded.push(id)
    else failed.push({ id, error: r.error })
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function getRedemptionDetailForInspector(
  id: string,
): Promise<RedemptionDetailFull | null> {
  await requireAdmin()
  const r = await prisma.rewardRedemption.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, email: true, name: true } },
      reward: { select: { id: true, name: true, rewardType: true } },
    },
  })
  if (!r) return null
  return {
    id: r.id,
    customerId: r.customerId,
    customerEmail: r.customer?.email ?? 'unknown',
    customerName: r.customer?.name ?? null,
    rewardId: r.rewardId,
    rewardName: r.reward?.name ?? 'unknown',
    rewardType: r.reward?.rewardType ?? 'DISCOUNT',
    pointsSpent: r.pointsSpent,
    status: r.status,
    couponCode: r.couponCode ?? null,
    usedAt: r.usedAt ?? null,
    orderId: r.orderId ?? null,
    trackingNumber: r.trackingNumber ?? null,
    shippedAt: r.shippedAt ?? null,
    metadata: r.metadata ?? null,
    idempotencyKey: r.idempotencyKey,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

// ============================================================
// EVENTS (Points Multiplier Events)
// ============================================================

export async function createEvent(input: CreateEventInput): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()
  if (!input.name?.trim()) return { ok: false, error: 'Name is required' }
  if (input.endDate < input.startDate) {
    return { ok: false, error: 'endDate must be after startDate' }
  }
  try {
    const e = await prisma.pointsMultiplierEvent.create({
      data: {
        name: input.name.trim(),
        description: input.description ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        multiplier: input.multiplier,
        tierIds: input.tierIds ?? null,
        categoryIds: input.categoryIds ?? null,
        isActive: input.isActive ?? true,
      },
    })
    revalidateLoyalty()
    return { ok: true, data: { id: e.id } }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to create event' }
  }
}

export async function updateEvent(id: string, input: UpdateEventInput): Promise<ActionResult> {
  await requireAdmin()
  const data: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateEventInput>) {
    if (input[key] !== undefined) data[key] = input[key]
  }
  try {
    await prisma.pointsMultiplierEvent.update({ where: { id }, data })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update event' }
  }
}

export async function deleteEvent(id: string): Promise<ActionResult> {
  await requireAdmin()
  try {
    await prisma.pointsMultiplierEvent.delete({ where: { id } })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to delete event' }
  }
}

export async function toggleEventActive(id: string): Promise<ActionResult> {
  await requireAdmin()
  const existing = await prisma.pointsMultiplierEvent.findUnique({
    where: { id }, select: { isActive: true },
  })
  if (!existing) return { ok: false, error: 'Event not found' }
  await prisma.pointsMultiplierEvent.update({
    where: { id }, data: { isActive: !existing.isActive },
  })
  revalidateLoyalty()
  return { ok: true }
}

export async function bulkActivateEvents(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      await prisma.pointsMultiplierEvent.update({ where: { id }, data: { isActive: true } })
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function bulkDeactivateEvents(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const succeeded: string[] = []
  const failed: { id: string; error: string }[] = []
  for (const id of ids) {
    try {
      await prisma.pointsMultiplierEvent.update({ where: { id }, data: { isActive: false } })
      succeeded.push(id)
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : 'failed' })
    }
  }
  revalidateLoyalty()
  return { ok: true, data: { succeeded, failed } }
}

export async function getEventDetailForInspector(id: string): Promise<EventDetailFull | null> {
  await requireAdmin()
  const e = await prisma.pointsMultiplierEvent.findUnique({ where: { id } })
  if (!e) return null
  return {
    id: e.id,
    name: e.name,
    description: e.description ?? null,
    startDate: e.startDate,
    endDate: e.endDate,
    multiplier: Number(e.multiplier ?? 1),
    tierIds: e.tierIds ?? null,
    categoryIds: e.categoryIds ?? null,
    isActive: e.isActive,
    totalBonusPointsAwarded: e.totalBonusPointsAwarded,
    ordersAffected: e.ordersAffected,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  }
}

// ============================================================
// SETTINGS (LoyaltySettings singleton — id = "default")
// ============================================================

const SETTINGS_DEFAULTS = {
  isEnabled: true,
  programName: 'Head Over Feels Rewards',
  pointsPerDollar: 1,
  pointsRoundingMode: 'floor',
  minimumOrderForPoints: 0,
  referralPointsReferrer: 100,
  referralPointsReferred: 50,
  referralEnabled: true,
  reviewPointsEnabled: true,
  reviewPointsAmount: 25,
  reviewWithPhotoBonus: 25,
  birthdayRewardsEnabled: true,
  birthdayRewardType: 'points',
  birthdayRewardValue: 100,
  birthdayRewardExpireDays: 30,
  pointsExpireEnabled: true,
  pointsExpireMonths: 12,
  tierEvaluationPeriod: 'annual',
  tierDowngradeEnabled: false,
  showPointsInCart: true,
  showPointsInCheckout: true,
  showTierProgress: true,
}

/**
 * Update the loyalty settings singleton. Silently strips `pointsExpireMonths` and
 * `tierEvaluationPeriod` from the input — these are cron-managed and must not be
 * editable via the admin UI. The UI renders them read-only (Task 12); this is the
 * server-side defence-in-depth guard.
 */
export async function updateLoyaltySettings(
  input: UpdateLoyaltySettingsInput,
): Promise<ActionResult> {
  await requireAdmin()
  // Strip cron-managed fields silently (UI renders them read-only).
  const sanitized: Record<string, unknown> = {}
  for (const key of Object.keys(input) as Array<keyof UpdateLoyaltySettingsInput>) {
    if (key === 'pointsExpireMonths' || key === 'tierEvaluationPeriod') continue
    if (input[key] !== undefined) sanitized[key] = input[key]
  }
  try {
    await prisma.loyaltySettings.upsert({
      where: { id: 'default' },
      update: sanitized,
      create: { id: 'default', ...SETTINGS_DEFAULTS, ...sanitized },
    })
    revalidateLoyalty()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update settings' }
  }
}

export async function getLoyaltySettings(): Promise<LoyaltySettingsRow> {
  await requireAdmin()
  const s = await prisma.loyaltySettings.findUnique({ where: { id: 'default' } })
  if (!s) {
    return {
      id: 'default',
      ...SETTINGS_DEFAULTS,
      updatedAt: new Date(0),
    } as LoyaltySettingsRow
  }
  return {
    id: s.id,
    isEnabled: s.isEnabled,
    programName: s.programName,
    pointsPerDollar: Number(s.pointsPerDollar ?? 1),
    pointsRoundingMode: s.pointsRoundingMode,
    minimumOrderForPoints: Number(s.minimumOrderForPoints ?? 0),
    referralPointsReferrer: s.referralPointsReferrer,
    referralPointsReferred: s.referralPointsReferred,
    referralEnabled: s.referralEnabled,
    reviewPointsEnabled: s.reviewPointsEnabled,
    reviewPointsAmount: s.reviewPointsAmount,
    reviewWithPhotoBonus: s.reviewWithPhotoBonus,
    birthdayRewardsEnabled: s.birthdayRewardsEnabled,
    birthdayRewardType: s.birthdayRewardType,
    birthdayRewardValue: s.birthdayRewardValue,
    birthdayRewardExpireDays: s.birthdayRewardExpireDays,
    pointsExpireEnabled: s.pointsExpireEnabled,
    pointsExpireMonths: s.pointsExpireMonths,
    tierEvaluationPeriod: s.tierEvaluationPeriod,
    tierDowngradeEnabled: s.tierDowngradeEnabled,
    showPointsInCart: s.showPointsInCart,
    showPointsInCheckout: s.showPointsInCheckout,
    showTierProgress: s.showTierProgress,
    updatedAt: s.updatedAt,
  }
}

// ============================================================
// CSV EXPORTS — all capped at 10,000 rows
// ============================================================

/** Overview CSV: points transactions in range, capped at 10,000. */
export async function exportOverviewCsv(range: TimeRange): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const { start, end } = getRangeBoundsLocal(range)
  const txns = await prisma.pointsTransaction.findMany({
    where: { createdAt: { gte: start, lte: end } },
    orderBy: { createdAt: 'desc' },
    take: CSV_MAX_ROWS + 1,
    select: {
      id: true, points: true, type: true, description: true, createdAt: true,
      customer: { select: { email: true } },
    },
  })
  if (txns.length > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const csv = rowsToCsv(
    ['id', 'createdAt', 'customerEmail', 'type', 'points', 'description'],
    txns.map((t) => [
      t.id, t.createdAt, t.customer?.email ?? '', t.type, Number(t.points), t.description,
    ]),
  )
  return { ok: true, data: { csv } }
}

export interface MembersCsvFilters {
  tierId?: string
}

/** Members CSV: all loyalty members (or filtered by tier), sorted by lifetime points. */
export async function exportMembersCsv(
  filters: MembersCsvFilters = {},
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const where: Record<string, unknown> = {}
  if (filters.tierId) where.loyaltyTierId = filters.tierId
  const count = await prisma.customer.count({ where })
  if (count > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const rows = await prisma.customer.findMany({
    where,
    orderBy: { lifetimePoints: 'desc' },
    take: CSV_MAX_ROWS,
    select: {
      id: true, email: true, name: true,
      currentPoints: true, lifetimePoints: true, annualPointsEarned: true,
      lastOrderDate: true,
      loyaltyTier: { select: { name: true } },
    },
  })
  const csv = rowsToCsv(
    ['id', 'email', 'name', 'tier', 'currentPoints', 'lifetimePoints', 'annualPointsEarned', 'lastOrderDate'],
    rows.map((c) => [
      c.id, c.email, c.name ?? '', c.loyaltyTier?.name ?? '',
      c.currentPoints, c.lifetimePoints, c.annualPointsEarned, c.lastOrderDate ?? '',
    ]),
  )
  return { ok: true, data: { csv } }
}

export interface RewardsCsvFilters {
  isActive?: boolean
  rewardType?: RewardType
}

/** Rewards CSV: all rewards (optional filter by active/type). */
export async function exportRewardsCsv(
  filters: RewardsCsvFilters = {},
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.rewardType) where.rewardType = filters.rewardType
  const count = await prisma.reward.count({ where })
  if (count > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const rows = await prisma.reward.findMany({
    where,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    take: CSV_MAX_ROWS,
    select: {
      id: true, name: true, slug: true, rewardType: true,
      pointsCost: true, isActive: true, totalRedeemed: true,
      maxRedemptionsPerCustomer: true, totalAvailable: true, minTierRequired: true,
    },
  })
  const csv = rowsToCsv(
    ['id', 'name', 'slug', 'type', 'pointsCost', 'isActive', 'totalRedeemed', 'maxPerCustomer', 'totalAvailable', 'minTier'],
    rows.map((r) => [
      r.id, r.name, r.slug, r.rewardType, r.pointsCost, r.isActive,
      r.totalRedeemed, r.maxRedemptionsPerCustomer ?? '', r.totalAvailable ?? '', r.minTierRequired ?? '',
    ]),
  )
  return { ok: true, data: { csv } }
}

export interface RedemptionsCsvFilters {
  status?: RedemptionStatus
  rewardId?: string
}

/** Redemptions CSV: redemptions in the given date range (optional status/reward filter). */
export async function exportRedemptionsCsv(
  range: TimeRange,
  filters: RedemptionsCsvFilters = {},
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const { start, end } = getRangeBoundsLocal(range)
  const where: Record<string, unknown> = { createdAt: { gte: start, lte: end } }
  if (filters.status) where.status = filters.status
  if (filters.rewardId) where.rewardId = filters.rewardId
  const count = await prisma.rewardRedemption.count({ where })
  if (count > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const rows = await prisma.rewardRedemption.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: CSV_MAX_ROWS,
    include: {
      customer: { select: { email: true } },
      reward: { select: { name: true } },
    },
  })
  const csv = rowsToCsv(
    ['id', 'createdAt', 'customerEmail', 'reward', 'pointsSpent', 'status', 'couponCode', 'trackingNumber', 'shippedAt'],
    rows.map((r) => [
      r.id, r.createdAt, r.customer?.email ?? '', r.reward?.name ?? '',
      r.pointsSpent, r.status, r.couponCode ?? '', r.trackingNumber ?? '', r.shippedAt ?? '',
    ]),
  )
  return { ok: true, data: { csv } }
}

export interface EventsCsvFilters {
  isActive?: boolean
}

/** Events CSV: all points multiplier events (optional active filter). */
export async function exportEventsCsv(
  filters: EventsCsvFilters = {},
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive
  const count = await prisma.pointsMultiplierEvent.count({ where })
  if (count > CSV_MAX_ROWS) return { ok: false, error: 'Too many rows — narrow filters' }
  const rows = await prisma.pointsMultiplierEvent.findMany({
    where,
    orderBy: { startDate: 'desc' },
    take: CSV_MAX_ROWS,
  })
  const csv = rowsToCsv(
    ['id', 'name', 'startDate', 'endDate', 'multiplier', 'isActive', 'totalBonusPointsAwarded', 'ordersAffected'],
    rows.map((e) => [
      e.id, e.name, e.startDate, e.endDate, Number(e.multiplier ?? 1),
      e.isActive, e.totalBonusPointsAwarded, e.ordersAffected,
    ]),
  )
  return { ok: true, data: { csv } }
}
