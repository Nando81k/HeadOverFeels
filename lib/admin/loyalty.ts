// lib/admin/loyalty.ts
//
// Single source of truth for Phase 7 loyalty admin data shapes and Prisma queries.
// All loaders are pure async functions called from Server Components.
//
// Schema adaptations:
//   - TimeRange is Phase 7 specific (matches Phase 6 vocabulary): 'today' | '7d' | '30d' | '90d' | 'year'
//   - We DO NOT import TimeRange from lib/admin/analytics.ts — cross-phase coupling adds churn.
//   - Mutations are NEVER performed here — that's app/admin/loyalty/actions.ts wrapping lib/loyalty/service.ts.
//   - Customer.annualSpend is legacy/informational; we use lastOrderDate for "active members" proxy.
//   - "Redemption rate" = |redeemed points| / earned points × 100 (zero-earned protection applied).
//   - PointsTransaction.points is signed: positive = earned, negative = REDEMPTION/EXPIRATION.

import { prisma } from '@/lib/prisma'
import type { PointsTransactionType, RedemptionStatus, RewardType } from '@prisma/client'

// ============================================================
// TimeRange + range bounds
// ============================================================

export type TimeRange = 'today' | '7d' | '30d' | '90d' | 'year'
export const TIME_RANGES: TimeRange[] = ['today', '7d', '30d', '90d', 'year']

export interface RangeBounds {
  start: Date
  end: Date
  previousStart: Date
  previousEnd: Date
}

export function getRangeBounds(range: TimeRange, ref: Date = new Date()): RangeBounds {
  const end = new Date(ref)
  const start = new Date(ref)
  const day = 24 * 60 * 60 * 1000
  let durationMs: number
  let previousShiftMs: number

  switch (range) {
    case 'today':
      start.setUTCHours(0, 0, 0, 0)
      durationMs = end.getTime() - start.getTime()
      previousShiftMs = day
      break
    case '7d':
      durationMs = 7 * day
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
    case '30d':
      durationMs = 30 * day
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
    case '90d':
      durationMs = 90 * day
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
    case 'year':
      durationMs = 365 * day
      previousShiftMs = durationMs
      start.setTime(end.getTime() - durationMs)
      break
  }

  return {
    start,
    end,
    previousStart: new Date(start.getTime() - previousShiftMs),
    previousEnd: new Date(end.getTime() - previousShiftMs),
  }
}

// ============================================================
// Trend helper
// ============================================================

export interface TrendData {
  direction: 'up' | 'down' | 'flat'
  text: string
}

export function buildTrend(current: number, previous: number): TrendData {
  if (previous === 0) {
    return { direction: 'flat', text: current > 0 ? '↑ new' : '— No prior data' }
  }
  const pct = ((current - previous) / previous) * 100
  if (Math.abs(pct) < 0.5) return { direction: 'flat', text: '— 0%' }
  return {
    direction: pct > 0 ? 'up' : 'down',
    text: `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct).toFixed(1)}%`,
  }
}

// ============================================================
// Pagination + filters
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

const DEFAULT_PAGE_SIZE = 25

export interface MembersFilters {
  search?: string
  tierId?: string
  page?: number
  pageSize?: number
}
export interface RewardsFilters {
  search?: string
  isActive?: boolean
  rewardType?: RewardType
  page?: number
  pageSize?: number
}
export interface RedemptionsFilters {
  status?: RedemptionStatus
  rewardId?: string
  customerId?: string
  page?: number
  pageSize?: number
}
export interface EventsFilters {
  isActive?: boolean
  page?: number
  pageSize?: number
}

// ============================================================
// Row + chart point shapes
// ============================================================

export interface PointsActivityPoint {
  bucket: string // ISO date
  earned: number
  redeemed: number
}

export interface TierDistributionPoint {
  tierId: string | null
  tierName: string
  count: number
  percent: number
}

export interface TopRewardPoint {
  rewardId: string
  name: string
  totalRedeemed: number
}

export interface MemberGrowthPoint {
  bucket: string
  newMembers: number
}

export interface TierPerksRow {
  id: string
  name: string
  primaryColor: string
  freeShipping: boolean
  earlyDropAccess: boolean
  pointMultiplier: number
  sortOrder: number
}

export interface RewardActivationsRow {
  id: string
  name: string
  pointsCost: number
  isActive: boolean
  totalRedeemed: number
  sortOrder: number
}

export interface RecentTransactionRow {
  id: string
  customerEmail: string
  customerName: string | null
  type: PointsTransactionType
  points: number
  description: string
  createdAt: Date
}

export interface PopularRewardRow {
  id: string
  name: string
  pointsCost: number
  totalRedeemed: number
  rewardType: RewardType
}

// ============================================================
// KPI shape
// ============================================================

export interface LoyaltyKpiData {
  activeMembers: number
  pointsEarned: number
  pointsEarnedTrend: TrendData
  pointsRedeemed: number
  pointsRedeemedTrend: TrendData
  redemptionRate: number // percent 0-100
  redemptionRateTrend: TrendData
}

// ============================================================
// Tab data shapes
// ============================================================

export interface OverviewData {
  pointsActivity: PointsActivityPoint[]
  tierDistribution: TierDistributionPoint[]
  topRewards: TopRewardPoint[]
  memberGrowth: MemberGrowthPoint[]
  tierPerks: TierPerksRow[]
  rewardActivations: RewardActivationsRow[]
  recentTransactions: RecentTransactionRow[]
  popularRewards: PopularRewardRow[]
}

export interface MemberRow {
  id: string
  email: string
  name: string | null
  tierId: string | null
  tierName: string | null
  tierColor: string | null
  currentPoints: number
  lifetimePoints: number
  annualPointsEarned: number
  lastOrderDate: Date | null
  tierStartDate: Date
}

export interface TierRow {
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

export interface RewardRow {
  id: string
  name: string
  slug: string
  pointsCost: number
  rewardType: RewardType
  isActive: boolean
  totalRedeemed: number
  maxRedemptionsPerCustomer: number | null
  totalAvailable: number | null
  minTierRequired: string | null
  sortOrder: number
  image: string | null
}

export interface RedemptionRow {
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
  trackingNumber: string | null
  createdAt: Date
}

export interface EventRow {
  id: string
  name: string
  description: string | null
  startDate: Date
  endDate: Date
  multiplier: number
  isActive: boolean
  totalBonusPointsAwarded: number
  ordersAffected: number
}

// ============================================================
// Detail shapes
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

export interface TierDetailFull extends TierRow {}

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
  pointsExpireMonths: number // CRON-MANAGED, render read-only
  tierEvaluationPeriod: string // CRON-MANAGED, render read-only
  tierDowngradeEnabled: boolean
  showPointsInCart: boolean
  showPointsInCheckout: boolean
  showTierProgress: boolean
  updatedAt: Date
}

// ============================================================
// Helpers
// ============================================================

function bucketCount(range: TimeRange): number {
  switch (range) {
    case 'today': return 24
    case '7d': return 7
    case '30d': return 30
    case '90d': return 30
    case 'year': return 12
  }
}

// ============================================================
// KPI loader
// ============================================================

export async function loadLoyaltyKpis(range: TimeRange): Promise<LoyaltyKpiData> {
  const { start, end, previousStart, previousEnd } = getRangeBounds(range)

  const [
    activeMembers,
    earnedCur,
    earnedPrev,
    redeemedCur,
    redeemedPrev,
  ] = await Promise.all([
    prisma.customer.count({ where: { lastOrderDate: { gte: start, lte: end } } }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: start, lte: end }, points: { gt: 0 } },
      _sum: { points: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: previousStart, lte: previousEnd }, points: { gt: 0 } },
      _sum: { points: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: start, lte: end }, type: 'REDEMPTION' },
      _sum: { points: true },
    }),
    prisma.pointsTransaction.aggregate({
      where: { createdAt: { gte: previousStart, lte: previousEnd }, type: 'REDEMPTION' },
      _sum: { points: true },
    }),
  ])

  const earned = Number(earnedCur._sum.points ?? 0)
  const prevEarned = Number(earnedPrev._sum.points ?? 0)
  const redeemed = Math.abs(Number(redeemedCur._sum.points ?? 0))
  const prevRedeemed = Math.abs(Number(redeemedPrev._sum.points ?? 0))
  const rate = earned === 0 ? 0 : (redeemed / earned) * 100
  const prevRate = prevEarned === 0 ? 0 : (prevRedeemed / prevEarned) * 100

  return {
    activeMembers,
    pointsEarned: earned,
    pointsEarnedTrend: buildTrend(earned, prevEarned),
    pointsRedeemed: redeemed,
    pointsRedeemedTrend: buildTrend(redeemed, prevRedeemed),
    redemptionRate: rate,
    redemptionRateTrend: buildTrend(rate, prevRate),
  }
}

// ============================================================
// Overview tab
// ============================================================

export async function loadOverviewData(range: TimeRange): Promise<OverviewData> {
  const { start, end } = getRangeBounds(range)
  const buckets = bucketCount(range)

  const [
    txns,
    tierGroups,
    tiers,
    topRewardsRows,
    newMembers,
    recentTxns,
    popular,
    activations,
  ] = await Promise.all([
    prisma.pointsTransaction.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { points: true, type: true, createdAt: true },
    }),
    prisma.customer.groupBy({
      by: ['loyaltyTierId'],
      _count: { _all: true },
    }),
    prisma.loyaltyTier.findMany({
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true, name: true, primaryColor: true, freeShipping: true,
        earlyDropAccess: true, pointMultiplier: true, sortOrder: true,
      },
    }),
    prisma.reward.findMany({
      orderBy: { totalRedeemed: 'desc' },
      take: 5,
      select: { id: true, name: true, totalRedeemed: true, pointsCost: true, rewardType: true },
    }),
    prisma.customer.findMany({
      where: { createdAt: { gte: start, lte: end } },
      select: { createdAt: true },
    }),
    prisma.pointsTransaction.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true, points: true, type: true, description: true, createdAt: true,
        customer: { select: { email: true, name: true } },
      },
    }),
    prisma.reward.findMany({
      orderBy: { totalRedeemed: 'desc' },
      take: 5,
      select: { id: true, name: true, pointsCost: true, totalRedeemed: true, rewardType: true },
    }),
    prisma.reward.findMany({
      orderBy: { sortOrder: 'asc' },
      take: 10,
      select: { id: true, name: true, pointsCost: true, isActive: true, totalRedeemed: true, sortOrder: true },
    }),
  ])

  // Points activity buckets
  const span = Math.max(end.getTime() - start.getTime(), 1)
  const pointsActivity: PointsActivityPoint[] = []
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    pointsActivity.push({ bucket: bStart.toISOString(), earned: 0, redeemed: 0 })
  }
  for (const t of txns) {
    const idx = Math.min(
      buckets - 1,
      Math.max(0, Math.floor(((t.createdAt.getTime() - start.getTime()) / span) * buckets)),
    )
    if (t.type === 'REDEMPTION') {
      pointsActivity[idx].redeemed += Math.abs(Number(t.points))
    } else if (Number(t.points) > 0) {
      pointsActivity[idx].earned += Number(t.points)
    }
  }

  // Member growth buckets
  const memberGrowth: MemberGrowthPoint[] = []
  for (let i = 0; i < buckets; i++) {
    const bStart = new Date(start.getTime() + (i * span) / buckets)
    memberGrowth.push({ bucket: bStart.toISOString(), newMembers: 0 })
  }
  for (const c of newMembers) {
    const idx = Math.min(
      buckets - 1,
      Math.max(0, Math.floor(((c.createdAt.getTime() - start.getTime()) / span) * buckets)),
    )
    memberGrowth[idx].newMembers += 1
  }

  // Tier distribution
  const tierMap = new Map(tiers.map((t) => [t.id, t.name]))
  const totalMembers = tierGroups.reduce((sum, g) => sum + g._count._all, 0) || 1
  const tierDistribution: TierDistributionPoint[] = tierGroups.map((g) => ({
    tierId: g.loyaltyTierId,
    tierName: g.loyaltyTierId ? (tierMap.get(g.loyaltyTierId) ?? 'Unknown') : 'No tier',
    count: g._count._all,
    percent: (g._count._all / totalMembers) * 100,
  }))

  const topRewards: TopRewardPoint[] = topRewardsRows.map((r) => ({
    rewardId: r.id,
    name: r.name,
    totalRedeemed: r.totalRedeemed,
  }))

  return {
    pointsActivity,
    tierDistribution,
    topRewards,
    memberGrowth,
    tierPerks: tiers,
    rewardActivations: activations,
    recentTransactions: recentTxns.map((t) => ({
      id: t.id,
      customerEmail: t.customer?.email ?? 'unknown',
      customerName: t.customer?.name ?? null,
      type: t.type,
      points: Number(t.points),
      description: t.description,
      createdAt: t.createdAt,
    })),
    popularRewards: popular.map((r) => ({
      id: r.id,
      name: r.name,
      pointsCost: r.pointsCost,
      totalRedeemed: r.totalRedeemed,
      rewardType: r.rewardType,
    })),
  }
}

// ============================================================
// Members tab
// ============================================================

export async function loadMembersTab(
  filters: MembersFilters = {},
): Promise<PaginatedResult<MemberRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.tierId) where.loyaltyTierId = filters.tierId
  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search, mode: 'insensitive' as const } },
      { name: { contains: filters.search, mode: 'insensitive' as const } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { lifetimePoints: 'desc' },
      select: {
        id: true, email: true, name: true,
        currentPoints: true, lifetimePoints: true, annualPointsEarned: true,
        lastOrderDate: true, tierStartDate: true,
        loyaltyTier: { select: { id: true, name: true, primaryColor: true } },
      },
    }),
    prisma.customer.count({ where }),
  ])

  return {
    items: rows.map((c) => ({
      id: c.id,
      email: c.email,
      name: c.name ?? null,
      tierId: c.loyaltyTier?.id ?? null,
      tierName: c.loyaltyTier?.name ?? null,
      tierColor: c.loyaltyTier?.primaryColor ?? null,
      currentPoints: c.currentPoints,
      lifetimePoints: c.lifetimePoints,
      annualPointsEarned: c.annualPointsEarned,
      lastOrderDate: c.lastOrderDate ?? null,
      tierStartDate: c.tierStartDate,
    })),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Tiers tab
// ============================================================

export async function loadTiersTab(): Promise<TierRow[]> {
  const [tiers, counts] = await Promise.all([
    prisma.loyaltyTier.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.customer.groupBy({
      by: ['loyaltyTierId'],
      _count: { _all: true },
    }),
  ])
  const countMap = new Map(counts.map((c) => [c.loyaltyTierId, c._count._all]))
  return tiers.map((t) => ({
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
    memberCount: countMap.get(t.id) ?? 0,
  }))
}

// ============================================================
// Rewards tab
// ============================================================

export async function loadRewardsTab(
  filters: RewardsFilters = {},
): Promise<PaginatedResult<RewardRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.rewardType) where.rewardType = filters.rewardType
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' as const } },
      { slug: { contains: filters.search, mode: 'insensitive' as const } },
    ]
  }

  const [rows, total] = await Promise.all([
    prisma.reward.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true, name: true, slug: true, pointsCost: true, rewardType: true,
        isActive: true, totalRedeemed: true, maxRedemptionsPerCustomer: true,
        totalAvailable: true, minTierRequired: true, sortOrder: true, image: true,
      },
    }),
    prisma.reward.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      pointsCost: r.pointsCost,
      rewardType: r.rewardType,
      isActive: r.isActive,
      totalRedeemed: r.totalRedeemed,
      maxRedemptionsPerCustomer: r.maxRedemptionsPerCustomer ?? null,
      totalAvailable: r.totalAvailable ?? null,
      minTierRequired: r.minTierRequired ?? null,
      sortOrder: r.sortOrder,
      image: r.image ?? null,
    })),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Redemptions tab
// ============================================================

export async function loadRedemptionsTab(
  range: TimeRange,
  filters: RedemptionsFilters = {},
): Promise<PaginatedResult<RedemptionRow>> {
  const { start, end } = getRangeBounds(range)
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = { createdAt: { gte: start, lte: end } }
  if (filters.status) where.status = filters.status
  if (filters.rewardId) where.rewardId = filters.rewardId
  if (filters.customerId) where.customerId = filters.customerId

  const [rows, total] = await Promise.all([
    prisma.rewardRedemption.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: { select: { id: true, email: true, name: true } },
        reward: { select: { id: true, name: true, rewardType: true } },
      },
    }),
    prisma.rewardRedemption.count({ where }),
  ])

  return {
    items: rows.map((r) => ({
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
      trackingNumber: r.trackingNumber ?? null,
      createdAt: r.createdAt,
    })),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Events tab
// ============================================================

export async function loadEventsTab(
  filters: EventsFilters = {},
): Promise<PaginatedResult<EventRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Record<string, unknown> = {}
  if (filters.isActive !== undefined) where.isActive = filters.isActive

  const [rows, total] = await Promise.all([
    prisma.pointsMultiplierEvent.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { startDate: 'desc' },
    }),
    prisma.pointsMultiplierEvent.count({ where }),
  ])

  return {
    items: rows.map((e) => ({
      id: e.id,
      name: e.name,
      description: e.description ?? null,
      startDate: e.startDate,
      endDate: e.endDate,
      multiplier: Number(e.multiplier ?? 1),
      isActive: e.isActive,
      totalBonusPointsAwarded: e.totalBonusPointsAwarded,
      ordersAffected: e.ordersAffected,
    })),
    total,
    page,
    pageSize,
  }
}

// ============================================================
// Detail loaders
// ============================================================

export async function loadMemberDetail(id: string): Promise<MemberDetailFull | null> {
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

export async function loadTierDetail(id: string): Promise<TierDetailFull | null> {
  const t = await prisma.loyaltyTier.findUnique({ where: { id } })
  if (!t) return null
  const count = await prisma.customer.count({ where: { loyaltyTierId: id } })
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
    memberCount: count,
  }
}

export async function loadRewardDetail(id: string): Promise<RewardDetailFull | null> {
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

export async function loadRedemptionDetail(id: string): Promise<RedemptionDetailFull | null> {
  const r = await prisma.rewardRedemption.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, email: true, name: true } },
      reward: { select: { id: true, name: true, rewardType: true, pointsCost: true } },
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

export async function loadEventDetail(id: string): Promise<EventDetailFull | null> {
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

const SETTINGS_DEFAULTS: LoyaltySettingsRow = {
  id: 'default',
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
  updatedAt: new Date(0),
}

export async function loadLoyaltySettings(): Promise<LoyaltySettingsRow> {
  const s = await prisma.loyaltySettings.findUnique({ where: { id: 'default' } })
  if (!s) return { ...SETTINGS_DEFAULTS }
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
// Tab constants + type guards
// ============================================================

export const LOYALTY_TABS = [
  'overview',
  'members',
  'tiers',
  'rewards',
  'redemptions',
  'events',
] as const
export type LoyaltyTab = (typeof LOYALTY_TABS)[number]

export function isLoyaltyTab(v: unknown): v is LoyaltyTab {
  return typeof v === 'string' && (LOYALTY_TABS as readonly string[]).includes(v)
}

export function isTimeRange(v: unknown): v is TimeRange {
  return typeof v === 'string' && (TIME_RANGES as readonly string[]).includes(v)
}
