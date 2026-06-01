// lib/admin/marketing.ts
//
// Single source of truth for Phase 5 marketing data shapes and Prisma queries.
// All loaders are pure async functions called from Server Components.
//
// Schema adaptations:
//   - Promotion.productIds, collectionIds, customerEmails are nullable String fields
//     (likely JSON/comma-separated). Surfaced as string | null in row shapes; let the
//     editor parse them. V1 renders raw.
//   - Promotion.code is String? UNIQUE — nullable.
//   - PopupPosition has 7 values including TOP_RIGHT, TOP_LEFT (added beyond plan assumption).
//   - AbandonedCart.items is a serialized string — parsed to JSON in detail loader with
//     try/catch fallback to [].
//   - NewsletterCampaign.audienceFilter is Json (Prisma JsonValue).
//   - popupConversions7d sums PopupAnalytics.conversions where date >= now() - 7 days.
//   - subscriberDeltaPct: (thisWeekSubs - lastWeekSubs) / lastWeekSubs * 100, zero-divide safe.

import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// ============================================================
// Tab types
// ============================================================

export const MARKETING_TABS = [
  'promotions',
  'popups',
  'subscribers',
  'campaigns',
  'abandoned-carts',
] as const

export type MarketingTab = (typeof MARKETING_TABS)[number]

export function isMarketingTab(value: unknown): value is MarketingTab {
  return typeof value === 'string' && (MARKETING_TABS as readonly string[]).includes(value)
}

// ============================================================
// Shared types
// ============================================================

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

// ============================================================
// KPI types
// ============================================================

export interface MarketingKpiData {
  activePromotions: number
  popupConversions7d: number
  subscriberCount: number
  /** (thisWeek - lastWeek) / lastWeek * 100. 0 when lastWeek = 0. */
  subscriberDeltaPct: number
  cartsToRecover: number
}

// ============================================================
// Promotion types
// ============================================================

export type PromotionTypeValue =
  | 'PERCENTAGE'
  | 'FIXED_AMOUNT'
  | 'FREE_SHIPPING'
  | 'BOGO'
  | 'BUY_X_GET_Y'

export interface PromotionRow {
  id: string
  name: string
  code: string | null
  type: PromotionTypeValue
  value: number
  isActive: boolean
  usedCount: number
  maxUsesTotal: number | null
  startDate: Date
  endDate: Date | null
  totalDiscountGiven: number
  autoApply: boolean
  stackable: boolean
  createdAt: Date
}

export interface PromotionDetailFull extends PromotionRow {
  description: string | null
  minimumPurchase: number | null
  maxUsesPerCustomer: number | null
  /** Raw nullable string — likely JSON or comma-separated. */
  productIds: string | null
  /** Raw nullable string — likely JSON or comma-separated. */
  collectionIds: string | null
  /** Raw nullable string — likely JSON or comma-separated. */
  customerEmails: string | null
  maxDiscountPercent: number | null
  excludeFromLoyalty: boolean
  updatedAt: Date
}

export interface PromotionsFilters {
  search?: string
  isActive?: boolean
  type?: PromotionTypeValue
  page?: number
  pageSize?: number
}

// ============================================================
// Popup types
// ============================================================

export type PopupTemplateValue =
  | 'MODAL'
  | 'BANNER'
  | 'SLIDE_IN'
  | 'FULL_SCREEN'
  | 'EMAIL_CAPTURE'

export type PopupPositionValue =
  | 'TOP'
  | 'BOTTOM'
  | 'CENTER'
  | 'BOTTOM_RIGHT'
  | 'BOTTOM_LEFT'
  | 'TOP_RIGHT'
  | 'TOP_LEFT'

export type PopupTriggerValue = 'DELAY' | 'SCROLL' | 'EXIT_INTENT' | 'IMMEDIATE'

export type PopupFrequencyValue =
  | 'ONCE_PER_SESSION'
  | 'ONCE_PER_DAY'
  | 'ONCE_EVER'
  | 'ALWAYS'

export interface PopupRow {
  id: string
  name: string
  template: PopupTemplateValue
  position: PopupPositionValue
  triggerType: PopupTriggerValue
  isActive: boolean
  priority: number
  startDate: Date | null
  endDate: Date | null
  createdAt: Date
  /** Sum of impressions from analytics rows in the last 7 days. */
  impressions7d: number
  /** Sum of conversions from analytics rows in the last 7 days. */
  conversions7d: number
}

export interface PopupVariantRow {
  id: string
  popupId: string
  name: string
  content: string | null
  weight: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PopupAnalytics7d {
  impressions: number
  clicks: number
  dismissals: number
  conversions: number
}

export interface PopupDetailFull extends Omit<PopupRow, 'impressions7d' | 'conversions7d'> {
  content: string
  triggerValue: number
  showOnPages: string
  showToNewVisitors: boolean
  showToReturning: boolean
  frequency: PopupFrequencyValue
  promotionId: string | null
  updatedAt: Date
  variants: PopupVariantRow[]
  analytics7d: PopupAnalytics7d
}

export interface PopupsFilters {
  search?: string
  isActive?: boolean
  template?: PopupTemplateValue
  page?: number
  pageSize?: number
}

// ============================================================
// Subscriber types
// ============================================================

export interface SubscriberRow {
  id: string
  email: string
  source: string | null
  sourceDetails: string | null
  isActive: boolean
  isVerified: boolean
  createdAt: Date
  unsubscribedAt: Date | null
  utmSource: string | null
}

export interface SubscriberDetailFull extends SubscriberRow {
  verifiedAt: Date | null
  unsubscribeReason: string | null
  utmMedium: string | null
  utmCampaign: string | null
  updatedAt: Date
}

export interface SubscribersFilters {
  search?: string
  isActive?: boolean
  source?: string
  page?: number
  pageSize?: number
}

// ============================================================
// Campaign types
// ============================================================

export type CampaignStatusValue =
  | 'DRAFT'
  | 'QUEUED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'

export interface CampaignRow {
  id: string
  name: string | null
  subject: string
  status: CampaignStatusValue
  audienceCount: number
  sentCount: number
  failedCount: number
  sentAt: Date | null
  createdAt: Date
}

export interface CampaignDeliveryRow {
  id: string
  email: string
  status: string
  isTest: boolean
  sentAt: Date | null
  providerMessageId: string | null
  errorMessage: string | null
}

export interface CampaignDetailFull extends CampaignRow {
  preheader: string | null
  heroImageUrl: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  bodyMarkdown: string
  /** Prisma JsonValue — raw audience filter object. */
  audienceFilter: Prisma.JsonValue | null
  createdByAdminId: string
  updatedAt: Date
  recentTestDeliveries: CampaignDeliveryRow[]
}

export interface CampaignsFilters {
  status?: CampaignStatusValue
  page?: number
  pageSize?: number
}

// ============================================================
// Abandoned cart types
// ============================================================

export interface AbandonedCartRow {
  id: string
  customerEmail: string
  customerName: string | null
  itemCount: number
  totalValue: number
  recovered: boolean
  recoveryEmailSent: boolean
  abandonedAt: Date
  expiresAt: Date
  discountCode: string | null
}

/** A parsed item from AbandonedCart.items (JSON string). */
export type AbandonedCartItem = Record<string, unknown>

export interface AbandonedCartDetailFull extends AbandonedCartRow {
  customerId: string | null
  recoveryEmailSentAt: Date | null
  recoveredAt: Date | null
  recoveryOrderId: string | null
  /** Parsed from AbandonedCart.items JSON string. Falls back to [] on parse error. */
  items: AbandonedCartItem[]
}

export interface AbandonedCartsFilters {
  recovered?: boolean
  page?: number
  pageSize?: number
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_PAGE_SIZE = 25

// ============================================================
// KPIs
// ============================================================

export async function loadMarketingKpis(): Promise<MarketingKpiData> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [
    activePromotions,
    popupConversionsAgg,
    subscriberCount,
    thisWeekSubs,
    lastWeekSubs,
    cartsToRecover,
  ] = await Promise.all([
    prisma.promotion.count({ where: { isActive: true } }),
    prisma.popupAnalytics.aggregate({
      where: { date: { gte: sevenDaysAgo } },
      _sum: { conversions: true },
    }),
    prisma.newsletterSubscriber.count({ where: { isActive: true } }),
    prisma.newsletterSubscriber.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.newsletterSubscriber.count({
      where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
    }),
    prisma.abandonedCart.count({
      where: { recovered: false, expiresAt: { gt: now } },
    }),
  ])

  const popupConversions7d = popupConversionsAgg._sum.conversions ?? 0

  // subscriberDeltaPct: (thisWeek - lastWeek) / lastWeek * 100, zero-divide → 0
  const subscriberDeltaPct =
    lastWeekSubs === 0 ? 0 : ((thisWeekSubs - lastWeekSubs) / lastWeekSubs) * 100

  return {
    activePromotions,
    popupConversions7d,
    subscriberCount,
    subscriberDeltaPct,
    cartsToRecover,
  }
}

// ============================================================
// Promotions tab
// ============================================================

export async function loadPromotionsTab(
  filters: PromotionsFilters = {},
): Promise<PaginatedResult<PromotionRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Prisma.PromotionWhereInput = {}

  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.type) where.type = filters.type
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { code: { contains: filters.search, mode: 'insensitive' } },
    ]
  }

  const [raw, total] = await Promise.all([
    prisma.promotion.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.promotion.count({ where }),
  ])

  const items: PromotionRow[] = raw.map((p) => ({
    id: p.id,
    name: p.name,
    code: p.code ?? null,
    type: p.type as PromotionTypeValue,
    value: Number(p.value),
    isActive: p.isActive,
    usedCount: p.usedCount,
    maxUsesTotal: p.maxUsesTotal ?? null,
    startDate: p.startDate,
    endDate: p.endDate ?? null,
    totalDiscountGiven: Number(p.totalDiscountGiven),
    autoApply: p.autoApply,
    stackable: p.stackable,
    createdAt: p.createdAt,
  }))

  return { items, total, page, pageSize }
}

export async function loadPromotionDetail(id: string): Promise<PromotionDetailFull | null> {
  const p = await prisma.promotion.findUnique({ where: { id } })
  if (!p) return null

  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    code: p.code ?? null,
    type: p.type as PromotionTypeValue,
    value: Number(p.value),
    isActive: p.isActive,
    usedCount: p.usedCount,
    maxUsesTotal: p.maxUsesTotal ?? null,
    startDate: p.startDate,
    endDate: p.endDate ?? null,
    totalDiscountGiven: Number(p.totalDiscountGiven),
    autoApply: p.autoApply,
    stackable: p.stackable,
    createdAt: p.createdAt,
    minimumPurchase: p.minimumPurchase != null ? Number(p.minimumPurchase) : null,
    maxUsesPerCustomer: p.maxUsesPerCustomer ?? null,
    productIds: p.productIds ?? null,
    collectionIds: p.collectionIds ?? null,
    customerEmails: p.customerEmails ?? null,
    maxDiscountPercent: p.maxDiscountPercent != null ? Number(p.maxDiscountPercent) : null,
    excludeFromLoyalty: p.excludeFromLoyalty,
    updatedAt: p.updatedAt,
  }
}

// ============================================================
// Popups tab
// ============================================================

export async function loadPopupsTab(
  filters: PopupsFilters = {},
): Promise<PaginatedResult<PopupRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const where: Prisma.MarketingPopupWhereInput = {}

  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.template) where.template = filters.template
  if (filters.search) {
    where.name = { contains: filters.search, mode: 'insensitive' }
  }

  const [raw, total] = await Promise.all([
    prisma.marketingPopup.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        analytics: {
          where: { date: { gte: sevenDaysAgo } },
          select: { impressions: true, clicks: true, conversions: true, dismissals: true },
        },
      },
    }),
    prisma.marketingPopup.count({ where }),
  ])

  const items: PopupRow[] = raw.map((popup) => {
    const impressions7d = popup.analytics.reduce((s, a) => s + a.impressions, 0)
    const conversions7d = popup.analytics.reduce((s, a) => s + a.conversions, 0)
    return {
      id: popup.id,
      name: popup.name,
      template: popup.template as PopupTemplateValue,
      position: popup.position as PopupPositionValue,
      triggerType: popup.triggerType as PopupTriggerValue,
      isActive: popup.isActive,
      priority: popup.priority,
      startDate: popup.startDate ?? null,
      endDate: popup.endDate ?? null,
      createdAt: popup.createdAt,
      impressions7d,
      conversions7d,
    }
  })

  return { items, total, page, pageSize }
}

export async function loadPopupDetail(id: string): Promise<PopupDetailFull | null> {
  const popup = await prisma.marketingPopup.findUnique({
    where: { id },
    include: {
      variants: true,
      analytics: {
        select: { impressions: true, clicks: true, conversions: true, dismissals: true },
      },
    },
  })
  if (!popup) return null

  const analytics7d: PopupAnalytics7d = popup.analytics.reduce(
    (acc, a) => ({
      impressions: acc.impressions + a.impressions,
      clicks: acc.clicks + a.clicks,
      dismissals: acc.dismissals + a.dismissals,
      conversions: acc.conversions + a.conversions,
    }),
    { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
  )

  return {
    id: popup.id,
    name: popup.name,
    template: popup.template as PopupTemplateValue,
    position: popup.position as PopupPositionValue,
    triggerType: popup.triggerType as PopupTriggerValue,
    isActive: popup.isActive,
    priority: popup.priority,
    startDate: popup.startDate ?? null,
    endDate: popup.endDate ?? null,
    createdAt: popup.createdAt,
    content: popup.content,
    triggerValue: popup.triggerValue,
    showOnPages: popup.showOnPages,
    showToNewVisitors: popup.showToNewVisitors,
    showToReturning: popup.showToReturning,
    frequency: popup.frequency as PopupFrequencyValue,
    promotionId: popup.promotionId ?? null,
    updatedAt: popup.updatedAt,
    variants: popup.variants.map((v) => ({
      id: v.id,
      popupId: v.popupId,
      name: v.name,
      content: v.content ?? null,
      weight: v.weight,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    })),
    analytics7d,
  }
}

// ============================================================
// Subscribers tab
// ============================================================

export async function loadSubscribersTab(
  filters: SubscribersFilters = {},
): Promise<PaginatedResult<SubscriberRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Prisma.NewsletterSubscriberWhereInput = {}

  if (filters.isActive !== undefined) where.isActive = filters.isActive
  if (filters.source) where.source = filters.source
  if (filters.search) {
    where.email = { contains: filters.search, mode: 'insensitive' }
  }

  const [raw, total] = await Promise.all([
    prisma.newsletterSubscriber.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.newsletterSubscriber.count({ where }),
  ])

  const items: SubscriberRow[] = raw.map((s) => ({
    id: s.id,
    email: s.email,
    source: s.source ?? null,
    sourceDetails: s.sourceDetails ?? null,
    isActive: s.isActive,
    isVerified: s.isVerified,
    createdAt: s.createdAt,
    unsubscribedAt: s.unsubscribedAt ?? null,
    utmSource: s.utmSource ?? null,
  }))

  return { items, total, page, pageSize }
}

export async function loadSubscriberDetail(id: string): Promise<SubscriberDetailFull | null> {
  const s = await prisma.newsletterSubscriber.findUnique({ where: { id } })
  if (!s) return null

  return {
    id: s.id,
    email: s.email,
    source: s.source ?? null,
    sourceDetails: s.sourceDetails ?? null,
    isActive: s.isActive,
    isVerified: s.isVerified,
    createdAt: s.createdAt,
    unsubscribedAt: s.unsubscribedAt ?? null,
    utmSource: s.utmSource ?? null,
    verifiedAt: s.verifiedAt ?? null,
    unsubscribeReason: s.unsubscribeReason ?? null,
    utmMedium: s.utmMedium ?? null,
    utmCampaign: s.utmCampaign ?? null,
    updatedAt: s.updatedAt,
  }
}

// ============================================================
// Campaigns tab
// ============================================================

export async function loadCampaignsTab(
  filters: CampaignsFilters = {},
): Promise<PaginatedResult<CampaignRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Prisma.NewsletterCampaignWhereInput = {}

  if (filters.status) where.status = filters.status

  const [raw, total] = await Promise.all([
    prisma.newsletterCampaign.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.newsletterCampaign.count({ where }),
  ])

  const items: CampaignRow[] = raw.map((c) => ({
    id: c.id,
    name: c.name ?? null,
    subject: c.subject,
    status: c.status as CampaignStatusValue,
    audienceCount: c.audienceCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    sentAt: c.sentAt ?? null,
    createdAt: c.createdAt,
  }))

  return { items, total, page, pageSize }
}

export async function loadCampaignDetail(id: string): Promise<CampaignDetailFull | null> {
  const [campaign, deliveries] = await Promise.all([
    prisma.newsletterCampaign.findUnique({ where: { id } }),
    prisma.newsletterCampaignDelivery.findMany({
      where: { campaignId: id, isTest: true },
      orderBy: { sentAt: 'desc' },
      take: 20,
    }),
  ])

  if (!campaign) return null

  return {
    id: campaign.id,
    name: campaign.name ?? null,
    subject: campaign.subject,
    status: campaign.status as CampaignStatusValue,
    audienceCount: campaign.audienceCount,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    sentAt: campaign.sentAt ?? null,
    createdAt: campaign.createdAt,
    preheader: campaign.preheader ?? null,
    heroImageUrl: campaign.heroImageUrl ?? null,
    ctaLabel: campaign.ctaLabel ?? null,
    ctaUrl: campaign.ctaUrl ?? null,
    bodyMarkdown: campaign.bodyMarkdown,
    audienceFilter: campaign.audienceFilter ?? null,
    createdByAdminId: campaign.createdByAdminId,
    updatedAt: campaign.updatedAt,
    recentTestDeliveries: deliveries.map((d) => ({
      id: d.id,
      email: d.email,
      status: d.status,
      isTest: d.isTest,
      sentAt: d.sentAt ?? null,
      providerMessageId: d.providerMessageId ?? null,
      errorMessage: d.errorMessage ?? null,
    })),
  }
}

// ============================================================
// Abandoned carts tab
// ============================================================

export async function loadAbandonedCartsTab(
  filters: AbandonedCartsFilters = {},
): Promise<PaginatedResult<AbandonedCartRow>> {
  const page = filters.page ?? 1
  const pageSize = filters.pageSize ?? DEFAULT_PAGE_SIZE
  const skip = (page - 1) * pageSize

  const where: Prisma.AbandonedCartWhereInput = {
    // Default to showing only non-recovered carts
    recovered: filters.recovered ?? false,
  }

  const [raw, total] = await Promise.all([
    prisma.abandonedCart.findMany({
      where,
      orderBy: { abandonedAt: 'desc' },
      skip,
      take: pageSize,
    }),
    prisma.abandonedCart.count({ where }),
  ])

  const items: AbandonedCartRow[] = raw.map((c) => ({
    id: c.id,
    customerEmail: c.customerEmail,
    customerName: c.customerName ?? null,
    itemCount: c.itemCount,
    totalValue: Number(c.totalValue),
    recovered: c.recovered,
    recoveryEmailSent: c.recoveryEmailSent,
    abandonedAt: c.abandonedAt,
    expiresAt: c.expiresAt,
    discountCode: c.discountCode ?? null,
  }))

  return { items, total, page, pageSize }
}

export async function loadAbandonedCartDetail(id: string): Promise<AbandonedCartDetailFull | null> {
  const c = await prisma.abandonedCart.findUnique({ where: { id } })
  if (!c) return null

  let items: AbandonedCartItem[] = []
  try {
    const parsed = JSON.parse(c.items)
    if (Array.isArray(parsed)) {
      items = parsed as AbandonedCartItem[]
    }
  } catch {
    // malformed JSON — fall back to []
  }

  return {
    id: c.id,
    customerId: c.customerId ?? null,
    customerEmail: c.customerEmail,
    customerName: c.customerName ?? null,
    itemCount: c.itemCount,
    totalValue: Number(c.totalValue),
    recovered: c.recovered,
    recoveryEmailSent: c.recoveryEmailSent,
    abandonedAt: c.abandonedAt,
    expiresAt: c.expiresAt,
    discountCode: c.discountCode ?? null,
    recoveryEmailSentAt: c.recoveryEmailSentAt ?? null,
    recoveredAt: c.recoveredAt ?? null,
    recoveryOrderId: c.recoveryOrderId ?? null,
    items,
  }
}
