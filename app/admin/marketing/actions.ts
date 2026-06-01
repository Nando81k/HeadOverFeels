// app/admin/marketing/actions.ts
'use server'

/**
 * Phase 5 — Admin Marketing Server Actions (~40 actions across 5 domains).
 *
 * All actions go through requireAdmin() (no-arg overload, returns userId string).
 * deleteSubscriber + bulkDeleteSubscribers use requireAdminRole('SUPER_ADMIN') (PII gate).
 * All mutations call revalidatePath('/admin/marketing').
 *
 * Schema adaptations:
 *  - Promotion.code is nullable String with UNIQUE constraint.
 *    createPromotion + generateCartRecoveryCode retry up to 5x on P2002.
 *  - AbandonedCart.items is a String (JSON); parseItems() handles malformed JSON.
 *  - NewsletterCampaign.status is an enum: DRAFT | QUEUED | SENDING | SENT | FAILED.
 *    deleteCampaign/bulkDeleteCampaigns guard that status === 'DRAFT'.
 *  - generateCartRecoveryCode creates a PERCENTAGE 10%-off Promotion inside
 *    $transaction (scoped to customerEmails = [cart.email], 7-day expiry, maxUses=1).
 *  - sendCampaignTest wraps sendCampaignTestEmail from lib/newsletter/campaigns.
 *  - queueCampaignSend wraps queueCampaignForSend from lib/newsletter/campaigns.
 *
 * PARALLEL-SAFETY NOTE:
 *   get*ForInspector actions inline their Prisma queries rather than importing
 *   from lib/admin/marketing.ts because Task 1 (which builds that module) is
 *   executing concurrently on a separate branch. After both Wave 1 PRs merge,
 *   a Phase 5.5 follow-up can refactor to import the shared loaders.
 *   — Same pattern as fulfillment PR #94 parallel dispatch.
 */

import { revalidatePath } from 'next/cache'
import type {
  PromotionType,
  PopupTemplate,
  PopupPosition,
  PopupTrigger,
  PopupFrequency,
  NewsletterCampaignStatus,
  NewsletterDeliveryStatus,
} from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAdmin, requireAdminRole } from '@/lib/auth/admin'
import { enqueueEmail } from '@/lib/email/queue'
import {
  sendCampaignTestEmail,
  pickCampaignContent,
  queueCampaignForSend,
} from '@/lib/newsletter/campaigns'
import { resolveAudienceRecipients } from '@/lib/newsletter/audience'

// ============================================================
// Return types (mirror Phase 3/4 shapes)
// ============================================================

export type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string }

export type BulkResult =
  | { ok: true; affected: number }
  | { ok: false; error: string }

// ============================================================
// Inline detail shapes (parallel-safe — do NOT import from lib/admin/marketing.ts)
// These mirror the exact shapes Task 1's load*Detail functions produce.
// ============================================================

export interface PromotionDetailFull {
  id: string
  name: string
  description: string | null
  code: string | null
  type: PromotionType
  value: number
  autoApply: boolean
  stackable: boolean
  minimumPurchase: number
  maxUsesTotal: number | null
  maxUsesPerCustomer: number | null
  usedCount: number
  productIds: string | null
  collectionIds: string | null
  customerEmails: string | null
  startDate: Date
  endDate: Date | null
  isActive: boolean
  maxDiscountPercent: number | null
  excludeFromLoyalty: boolean
  totalDiscountGiven: number
  createdAt: Date
  updatedAt: Date
}

export interface PopupVariantDetail {
  id: string
  popupId: string
  name: string
  content: string | null
  weight: number
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface PopupAnalyticsRollup {
  impressions: number
  clicks: number
  dismissals: number
  conversions: number
}

export interface PopupDetailFull {
  id: string
  name: string
  template: PopupTemplate
  position: PopupPosition
  content: string
  triggerType: PopupTrigger
  triggerValue: number
  showOnPages: string
  showToNewVisitors: boolean
  showToReturning: boolean
  frequency: PopupFrequency
  startDate: Date | null
  endDate: Date | null
  isActive: boolean
  priority: number
  promotionId: string | null
  createdAt: Date
  updatedAt: Date
  variants: PopupVariantDetail[]
  analytics7d: PopupAnalyticsRollup
}

export interface SubscriberDetailFull {
  id: string
  email: string
  source: string | null
  sourceDetails: string | null
  isActive: boolean
  isVerified: boolean
  verifiedAt: Date | null
  unsubscribedAt: Date | null
  unsubscribeReason: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  createdAt: Date
  updatedAt: Date
}

export interface CampaignDeliveryRow {
  id: string
  email: string
  status: NewsletterDeliveryStatus
  isTest: boolean
  sentAt: Date | null
  providerMessageId: string | null
  errorMessage: string | null
}

export interface CampaignDetailFull {
  id: string
  name: string | null
  subject: string
  preheader: string | null
  heroImageUrl: string | null
  ctaLabel: string | null
  ctaUrl: string | null
  bodyMarkdown: string
  status: NewsletterCampaignStatus
  audienceFilter: unknown
  audienceCount: number
  sentCount: number
  failedCount: number
  createdByAdminId: string
  sentAt: Date | null
  createdAt: Date
  updatedAt: Date
  recentTestDeliveries: CampaignDeliveryRow[]
}

export interface AbandonedCartItem {
  productName: string
  quantity: number
  price: number
  productImage?: string | null
  variantDetails?: string | null
}

export interface AbandonedCartDetailFull {
  id: string
  customerId: string | null
  customerEmail: string
  customerName: string | null
  items: AbandonedCartItem[]
  totalValue: number
  itemCount: number
  recoveryEmailSent: boolean
  recoveryEmailSentAt: Date | null
  recovered: boolean
  recoveredAt: Date | null
  recoveryOrderId: string | null
  abandonedAt: Date
  expiresAt: Date
  discountCode: string | null
}

// ============================================================
// Input types
// ============================================================

export interface CreatePromotionInput {
  name: string
  description?: string
  type: PromotionType
  value: number
  code?: string | null
  autoApply?: boolean
  stackable?: boolean
  minimumPurchase?: number
  maxUsesTotal?: number
  maxUsesPerCustomer?: number
  productIds?: string | null
  collectionIds?: string | null
  customerEmails?: string | null
  startDate: Date
  endDate?: Date | null
  isActive: boolean
  maxDiscountPercent?: number | null
  excludeFromLoyalty?: boolean
}

export interface UpdatePromotionInput {
  name?: string
  description?: string | null
  type?: PromotionType
  value?: number
  code?: string | null
  autoApply?: boolean
  stackable?: boolean
  minimumPurchase?: number | null
  maxUsesTotal?: number | null
  maxUsesPerCustomer?: number | null
  productIds?: string | null
  collectionIds?: string | null
  customerEmails?: string | null
  startDate?: Date
  endDate?: Date | null
  isActive?: boolean
  maxDiscountPercent?: number | null
  excludeFromLoyalty?: boolean
}

export interface CreatePopupInput {
  name: string
  template: PopupTemplate
  position?: PopupPosition
  content: string
  triggerType: PopupTrigger
  triggerValue?: number
  showOnPages?: string
  showToNewVisitors?: boolean
  showToReturning?: boolean
  frequency?: PopupFrequency
  startDate?: Date | null
  endDate?: Date | null
  isActive: boolean
  priority?: number
  promotionId?: string | null
}

export interface UpdatePopupInput {
  name?: string
  template?: PopupTemplate
  position?: PopupPosition
  content?: string
  triggerType?: PopupTrigger
  triggerValue?: number
  showOnPages?: string
  showToNewVisitors?: boolean
  showToReturning?: boolean
  frequency?: PopupFrequency
  startDate?: Date | null
  endDate?: Date | null
  isActive?: boolean
  priority?: number
  promotionId?: string | null
}

export interface CreatePopupVariantInput {
  name: string
  content?: string | null
  weight?: number
  isActive?: boolean
}

export interface UpdatePopupVariantInput {
  name?: string
  content?: string | null
  weight?: number
  isActive?: boolean
}

export interface CreateCampaignDraftInput {
  subject: string
  name?: string | null
  preheader?: string | null
  heroImageUrl?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  bodyMarkdown: string
  audienceFilter?: unknown
}

export interface UpdateCampaignDraftInput {
  subject?: string
  name?: string | null
  preheader?: string | null
  heroImageUrl?: string | null
  ctaLabel?: string | null
  ctaUrl?: string | null
  bodyMarkdown?: string
  audienceFilter?: unknown
}

// ============================================================
// Helpers
// ============================================================

const MARKETING_PATH = '/admin/marketing'

function revalidateMarketing() {
  revalidatePath(MARKETING_PATH)
}

function rejectEmpty(ids: string[], noun = 'items'): BulkResult | null {
  if (ids.length === 0) return { ok: false, error: `No ${noun} selected` }
  return null
}

/** Generate a random N-char alphanumeric string (uppercase). */
function randomAlphanumeric(length: number): string {
  const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }
  return result
}

function safeParseItems(raw: string | null | undefined): AbandonedCartItem[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.map((it: Record<string, unknown>) => ({
        productName: String(it.productName ?? it.name ?? 'Item'),
        quantity: Number(it.quantity ?? 1),
        price: Number(it.price ?? 0),
        productImage: (it.productImage as string | undefined) ?? null,
        variantDetails: (it.variantDetails as string | undefined) ?? null,
      }))
    }
    return []
  } catch {
    return []
  }
}

// ============================================================
// PROMOTIONS
// ============================================================

/**
 * Create a promotion. Retries up to 5x on Prisma P2002 (code UNIQUE collision).
 */
export async function createPromotion(
  input: CreatePromotionInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()

  if (!input.name || input.name.trim().length === 0) {
    return { ok: false, error: 'Promotion name is required' }
  }
  if (!Number.isFinite(input.value) || input.value < 0) {
    return { ok: false, error: 'Promotion value must be a non-negative number' }
  }

  const data = {
    name: input.name.trim(),
    description: input.description ?? null,
    type: input.type,
    value: input.value,
    code: input.code ?? null,
    autoApply: input.autoApply ?? false,
    stackable: input.stackable ?? false,
    minimumPurchase: input.minimumPurchase ?? null,
    maxUsesTotal: input.maxUsesTotal ?? null,
    maxUsesPerCustomer: input.maxUsesPerCustomer ?? null,
    productIds: input.productIds ?? null,
    collectionIds: input.collectionIds ?? null,
    customerEmails: input.customerEmails ?? null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    isActive: input.isActive,
    maxDiscountPercent: input.maxDiscountPercent ?? null,
    excludeFromLoyalty: input.excludeFromLoyalty ?? false,
  }

  // Retry on unique code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const promo = await prisma.promotion.create({ data })
      revalidateMarketing()
      return { ok: true, data: { id: promo.id } }
    } catch (err: unknown) {
      const isUniqueError =
        err instanceof Error &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      if (!isUniqueError || attempt === 4) {
        const msg = err instanceof Error ? err.message : 'Failed to create promotion'
        return { ok: false, error: msg }
      }
      // Generate a new random code and retry
      data.code = randomAlphanumeric(8)
    }
  }
  return { ok: false, error: 'Failed to create promotion after retries' }
}

export async function updatePromotion(
  id: string,
  input: UpdatePromotionInput,
): Promise<ActionResult> {
  await requireAdmin()

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.description !== undefined) data.description = input.description
  if (input.type !== undefined) data.type = input.type
  if (input.value !== undefined) data.value = input.value
  if (input.code !== undefined) data.code = input.code
  if (input.autoApply !== undefined) data.autoApply = input.autoApply
  if (input.stackable !== undefined) data.stackable = input.stackable
  if (input.minimumPurchase !== undefined) data.minimumPurchase = input.minimumPurchase
  if (input.maxUsesTotal !== undefined) data.maxUsesTotal = input.maxUsesTotal
  if (input.maxUsesPerCustomer !== undefined) data.maxUsesPerCustomer = input.maxUsesPerCustomer
  if (input.productIds !== undefined) data.productIds = input.productIds
  if (input.collectionIds !== undefined) data.collectionIds = input.collectionIds
  if (input.customerEmails !== undefined) data.customerEmails = input.customerEmails
  if (input.startDate !== undefined) data.startDate = input.startDate
  if (input.endDate !== undefined) data.endDate = input.endDate
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.maxDiscountPercent !== undefined) data.maxDiscountPercent = input.maxDiscountPercent
  if (input.excludeFromLoyalty !== undefined) data.excludeFromLoyalty = input.excludeFromLoyalty

  await prisma.promotion.update({ where: { id }, data })
  revalidateMarketing()
  return { ok: true }
}

export async function deletePromotion(id: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.promotion.delete({ where: { id } })
  revalidateMarketing()
  return { ok: true }
}

export async function togglePromotionActive(
  id: string,
  isActive?: boolean,
): Promise<ActionResult> {
  await requireAdmin()

  let targetState = isActive
  if (targetState === undefined) {
    const promo = await prisma.promotion.findUnique({ where: { id }, select: { isActive: true } })
    if (!promo) return { ok: false, error: 'Promotion not found' }
    targetState = !promo.isActive
  }

  await prisma.promotion.update({ where: { id }, data: { isActive: targetState } })
  revalidateMarketing()
  return { ok: true }
}

/** Returns a random 8-char alphanumeric suggestion without writing to DB. */
export async function suggestPromotionCode(): Promise<ActionResult<{ code: string }>> {
  await requireAdmin()
  const code = randomAlphanumeric(8)
  return { ok: true, data: { code } }
}

/** Checks whether a promotion code is unique (no DB write). */
export async function checkPromotionCodeUnique(
  code: string,
): Promise<ActionResult<{ isUnique: boolean; unique: boolean }>> {
  await requireAdmin()
  const existing = await prisma.promotion.findFirst({ where: { code } })
  const isUnique = existing === null
  return { ok: true, data: { isUnique, unique: isUnique } }
}

export async function bulkActivatePromotions(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'promotions')
  if (r) return r
  const result = await prisma.promotion.updateMany({
    where: { id: { in: ids } },
    data: { isActive: true },
  })
  revalidateMarketing()
  return { ok: true, affected: result.count }
}

export async function bulkDeactivatePromotions(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'promotions')
  if (r) return r
  const result = await prisma.promotion.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false },
  })
  revalidateMarketing()
  return { ok: true, affected: result.count }
}

export async function bulkDeletePromotions(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'promotions')
  if (r) return r
  const result = await prisma.promotion.deleteMany({ where: { id: { in: ids } } })
  revalidateMarketing()
  return { ok: true, affected: result.count }
}

/**
 * getPromotionDetailForInspector
 *
 * PARALLEL-SAFETY: Inlines the Prisma query (mirrors Task 1's loadPromotionDetail)
 * rather than importing from lib/admin/marketing.ts. See file header note.
 */
export async function getPromotionDetailForInspector(
  id: string,
): Promise<PromotionDetailFull | null> {
  await requireAdmin()
  const p = await prisma.promotion.findUnique({ where: { id } })
  if (!p) return null
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    code: p.code ?? null,
    type: p.type,
    value: Number(p.value),
    autoApply: p.autoApply,
    stackable: p.stackable,
    minimumPurchase: Number(p.minimumPurchase ?? 0),
    maxUsesTotal: p.maxUsesTotal ?? null,
    maxUsesPerCustomer: p.maxUsesPerCustomer ?? null,
    usedCount: p.usedCount,
    productIds: p.productIds ?? null,
    collectionIds: p.collectionIds ?? null,
    customerEmails: p.customerEmails ?? null,
    startDate: p.startDate,
    endDate: p.endDate ?? null,
    isActive: p.isActive,
    maxDiscountPercent: p.maxDiscountPercent ?? null,
    excludeFromLoyalty: p.excludeFromLoyalty,
    totalDiscountGiven: Number(p.totalDiscountGiven ?? 0),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }
}

// ============================================================
// POPUPS
// ============================================================

export async function createPopup(
  input: CreatePopupInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()

  if (!input.name || input.name.trim().length === 0) {
    return { ok: false, error: 'Popup name is required' }
  }

  const popup = await prisma.marketingPopup.create({
    data: {
      name: input.name.trim(),
      template: input.template,
      position: input.position ?? 'CENTER',
      content: input.content,
      triggerType: input.triggerType,
      triggerValue: input.triggerValue ?? 3,
      showOnPages: input.showOnPages ?? 'all',
      showToNewVisitors: input.showToNewVisitors ?? true,
      showToReturning: input.showToReturning ?? true,
      frequency: input.frequency ?? 'ONCE_PER_SESSION',
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      isActive: input.isActive,
      priority: input.priority ?? 0,
      promotionId: input.promotionId ?? null,
    },
  })

  revalidateMarketing()
  return { ok: true, data: { id: popup.id } }
}

export async function updatePopup(
  id: string,
  input: UpdatePopupInput,
): Promise<ActionResult> {
  await requireAdmin()

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.template !== undefined) data.template = input.template
  if (input.position !== undefined) data.position = input.position
  if (input.content !== undefined) data.content = input.content
  if (input.triggerType !== undefined) data.triggerType = input.triggerType
  if (input.triggerValue !== undefined) data.triggerValue = input.triggerValue
  if (input.showOnPages !== undefined) data.showOnPages = input.showOnPages
  if (input.showToNewVisitors !== undefined) data.showToNewVisitors = input.showToNewVisitors
  if (input.showToReturning !== undefined) data.showToReturning = input.showToReturning
  if (input.frequency !== undefined) data.frequency = input.frequency
  if (input.startDate !== undefined) data.startDate = input.startDate
  if (input.endDate !== undefined) data.endDate = input.endDate
  if (input.isActive !== undefined) data.isActive = input.isActive
  if (input.priority !== undefined) data.priority = input.priority
  if (input.promotionId !== undefined) data.promotionId = input.promotionId

  await prisma.marketingPopup.update({ where: { id }, data })
  revalidateMarketing()
  return { ok: true }
}

export async function deletePopup(id: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.marketingPopup.delete({ where: { id } })
  revalidateMarketing()
  return { ok: true }
}

export async function togglePopupActive(
  id: string,
  isActive?: boolean,
): Promise<ActionResult> {
  await requireAdmin()

  let targetState = isActive
  if (targetState === undefined) {
    const popup = await prisma.marketingPopup.findUnique({ where: { id }, select: { isActive: true } })
    if (!popup) return { ok: false, error: 'Popup not found' }
    targetState = !popup.isActive
  }

  await prisma.marketingPopup.update({ where: { id }, data: { isActive: targetState } })
  revalidateMarketing()
  return { ok: true }
}

export async function duplicatePopup(id: string): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()

  const popup = await prisma.marketingPopup.findUnique({
    where: { id },
    include: { variants: true },
  })
  if (!popup) return { ok: false, error: 'Popup not found' }

  const created = await prisma.marketingPopup.create({
    data: {
      name: `${popup.name} (Copy)`,
      template: popup.template,
      position: popup.position,
      content: popup.content,
      triggerType: popup.triggerType,
      triggerValue: popup.triggerValue,
      showOnPages: popup.showOnPages,
      showToNewVisitors: popup.showToNewVisitors,
      showToReturning: popup.showToReturning,
      frequency: popup.frequency,
      startDate: popup.startDate,
      endDate: popup.endDate,
      isActive: false, // start inactive
      priority: popup.priority,
      promotionId: popup.promotionId,
      variants: popup.variants.length > 0
        ? {
            create: popup.variants.map((v) => ({
              name: v.name,
              content: v.content ?? null,
              weight: v.weight,
              isActive: v.isActive,
            })),
          }
        : undefined,
    },
  })

  revalidateMarketing()
  return { ok: true, data: { id: created.id } }
}

export async function createPopupVariant(
  popupId: string,
  input: CreatePopupVariantInput,
): Promise<ActionResult<{ id: string }>> {
  await requireAdmin()

  const variant = await prisma.popupVariant.create({
    data: {
      popupId,
      name: input.name,
      content: input.content ?? null,
      weight: input.weight ?? 50,
      isActive: input.isActive ?? true,
    },
  })

  revalidateMarketing()
  return { ok: true, data: { id: variant.id } }
}

export async function updatePopupVariant(
  id: string,
  input: UpdatePopupVariantInput,
): Promise<ActionResult> {
  await requireAdmin()

  const data: Record<string, unknown> = {}
  if (input.name !== undefined) data.name = input.name
  if (input.content !== undefined) data.content = input.content
  if (input.weight !== undefined) data.weight = input.weight
  if (input.isActive !== undefined) data.isActive = input.isActive

  await prisma.popupVariant.update({ where: { id }, data })
  revalidateMarketing()
  return { ok: true }
}

export async function deletePopupVariant(id: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.popupVariant.delete({ where: { id } })
  revalidateMarketing()
  return { ok: true }
}

export async function bulkActivatePopups(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'popups')
  if (r) return r
  const result = await prisma.marketingPopup.updateMany({
    where: { id: { in: ids } },
    data: { isActive: true },
  })
  revalidateMarketing()
  return { ok: true, affected: result.count }
}

export async function bulkDeactivatePopups(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'popups')
  if (r) return r
  const result = await prisma.marketingPopup.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false },
  })
  revalidateMarketing()
  return { ok: true, affected: result.count }
}

export async function bulkDuplicatePopups(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'popups')
  if (r) return r

  let count = 0
  for (const id of ids) {
    const result = await duplicatePopup(id)
    if (result.ok) count++
  }

  revalidateMarketing()
  return { ok: true, affected: count }
}

export async function bulkDeletePopups(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'popups')
  if (r) return r
  const result = await prisma.marketingPopup.deleteMany({ where: { id: { in: ids } } })
  revalidateMarketing()
  return { ok: true, affected: result.count }
}

/**
 * getPopupDetailForInspector
 *
 * PARALLEL-SAFETY: Inlines the Prisma query (mirrors Task 1's loadPopupDetail).
 */
export async function getPopupDetailForInspector(
  id: string,
): Promise<PopupDetailFull | null> {
  await requireAdmin()

  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const p = await prisma.marketingPopup.findUnique({
    where: { id },
    include: {
      variants: { orderBy: { createdAt: 'asc' } },
      analytics: { where: { date: { gte: sevenDaysAgo } } },
    },
  })
  if (!p) return null

  const rollup: PopupAnalyticsRollup = p.analytics.reduce(
    (acc, a) => ({
      impressions: acc.impressions + (a.impressions ?? 0),
      clicks: acc.clicks + (a.clicks ?? 0),
      dismissals: acc.dismissals + (a.dismissals ?? 0),
      conversions: acc.conversions + (a.conversions ?? 0),
    }),
    { impressions: 0, clicks: 0, dismissals: 0, conversions: 0 },
  )

  return {
    id: p.id,
    name: p.name,
    template: p.template,
    position: p.position,
    content: p.content,
    triggerType: p.triggerType,
    triggerValue: p.triggerValue,
    showOnPages: p.showOnPages,
    showToNewVisitors: p.showToNewVisitors,
    showToReturning: p.showToReturning,
    frequency: p.frequency,
    startDate: p.startDate,
    endDate: p.endDate,
    isActive: p.isActive,
    priority: p.priority,
    promotionId: p.promotionId ?? null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    variants: p.variants.map((v) => ({
      id: v.id,
      popupId: v.popupId,
      name: v.name,
      content: v.content ?? null,
      weight: v.weight,
      isActive: v.isActive,
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    })),
    analytics7d: rollup,
  }
}

// ============================================================
// SUBSCRIBERS
// ============================================================

export async function unsubscribeSubscriber(id: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.newsletterSubscriber.update({
    where: { id },
    data: { isActive: false, unsubscribedAt: new Date() },
  })
  revalidateMarketing()
  return { ok: true }
}

/** PII deletion gate — requires SUPER_ADMIN role. */
export async function deleteSubscriber(id: string): Promise<ActionResult> {
  await requireAdminRole('SUPER_ADMIN')
  await prisma.newsletterSubscriber.delete({ where: { id } })
  revalidateMarketing()
  return { ok: true }
}

export async function bulkUnsubscribeSubscribers(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'subscribers')
  if (r) return r
  const result = await prisma.newsletterSubscriber.updateMany({
    where: { id: { in: ids } },
    data: { isActive: false, unsubscribedAt: new Date() },
  })
  revalidateMarketing()
  return { ok: true, affected: result.count }
}

export async function bulkExportSubscribersCsv(
  ids: string[],
): Promise<ActionResult<{ csv: string }>> {
  await requireAdmin()
  if (ids.length === 0) return { ok: false, error: 'No subscribers selected' }

  const subs = await prisma.newsletterSubscriber.findMany({
    where: { id: { in: ids } },
    select: {
      email: true,
      source: true,
      isActive: true,
      isVerified: true,
      createdAt: true,
      utmSource: true,
      utmMedium: true,
    },
  })

  const header = 'email,source,isActive,isVerified,createdAt,utmSource,utmMedium'
  const rows = subs.map((s) =>
    [
      s.email,
      s.source ?? '',
      String(s.isActive),
      String(s.isVerified),
      s.createdAt.toISOString(),
      s.utmSource ?? '',
      s.utmMedium ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  )

  return { ok: true, data: { csv: [header, ...rows].join('\n') } }
}

/** PII deletion gate — requires SUPER_ADMIN role. */
export async function bulkDeleteSubscribers(ids: string[]): Promise<BulkResult> {
  await requireAdminRole('SUPER_ADMIN')
  const r = rejectEmpty(ids, 'subscribers')
  if (r) return r
  const result = await prisma.newsletterSubscriber.deleteMany({ where: { id: { in: ids } } })
  revalidateMarketing()
  return { ok: true, affected: result.count }
}

/**
 * getSubscriberDetailForInspector
 *
 * PARALLEL-SAFETY: Inlines the Prisma query (mirrors Task 1's loadSubscriberDetail).
 */
export async function getSubscriberDetailForInspector(
  id: string,
): Promise<SubscriberDetailFull | null> {
  await requireAdmin()
  const s = await prisma.newsletterSubscriber.findUnique({ where: { id } })
  if (!s) return null
  return {
    id: s.id,
    email: s.email,
    source: s.source ?? null,
    sourceDetails: s.sourceDetails ?? null,
    isActive: s.isActive,
    isVerified: s.isVerified,
    verifiedAt: s.verifiedAt ?? null,
    unsubscribedAt: s.unsubscribedAt ?? null,
    unsubscribeReason: s.unsubscribeReason ?? null,
    utmSource: s.utmSource ?? null,
    utmMedium: s.utmMedium ?? null,
    utmCampaign: s.utmCampaign ?? null,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

// ============================================================
// CAMPAIGNS
// ============================================================

export async function createCampaignDraft(
  input: CreateCampaignDraftInput,
): Promise<ActionResult<{ id: string }>> {
  const adminId = await requireAdmin()

  if (!input.subject || input.subject.trim().length === 0) {
    return { ok: false, error: 'Campaign subject is required' }
  }

  const campaign = await prisma.newsletterCampaign.create({
    data: {
      subject: input.subject.trim(),
      name: input.name ?? null,
      preheader: input.preheader ?? null,
      heroImageUrl: input.heroImageUrl ?? null,
      ctaLabel: input.ctaLabel ?? null,
      ctaUrl: input.ctaUrl ?? null,
      bodyMarkdown: input.bodyMarkdown,
      audienceFilter: (input.audienceFilter as import('@prisma/client').Prisma.InputJsonValue) ?? null,
      status: 'DRAFT',
      createdByAdminId: adminId,
    },
  })

  revalidateMarketing()
  return { ok: true, data: { id: campaign.id } }
}

export async function updateCampaignDraft(
  id: string,
  input: UpdateCampaignDraftInput,
): Promise<ActionResult> {
  await requireAdmin()

  const data: Record<string, unknown> = {}
  if (input.subject !== undefined) data.subject = input.subject.trim()
  if (input.name !== undefined) data.name = input.name
  if (input.preheader !== undefined) data.preheader = input.preheader
  if (input.heroImageUrl !== undefined) data.heroImageUrl = input.heroImageUrl
  if (input.ctaLabel !== undefined) data.ctaLabel = input.ctaLabel
  if (input.ctaUrl !== undefined) data.ctaUrl = input.ctaUrl
  if (input.bodyMarkdown !== undefined) data.bodyMarkdown = input.bodyMarkdown
  if (input.audienceFilter !== undefined) {
    data.audienceFilter = input.audienceFilter as import('@prisma/client').Prisma.InputJsonValue
  }

  await prisma.newsletterCampaign.update({ where: { id }, data })
  revalidateMarketing()
  return { ok: true }
}

/**
 * Duplicate a campaign. Clears status/sentAt/sentCount/failedCount.
 * New name is "Copy of <subject>".
 */
export async function duplicateCampaign(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const adminId = await requireAdmin()

  const orig = await prisma.newsletterCampaign.findUnique({ where: { id } })
  if (!orig) return { ok: false, error: 'Campaign not found' }

  const created = await prisma.newsletterCampaign.create({
    data: {
      name: `Copy of ${orig.subject}`,
      subject: orig.subject,
      preheader: orig.preheader ?? null,
      heroImageUrl: orig.heroImageUrl ?? null,
      ctaLabel: orig.ctaLabel ?? null,
      ctaUrl: orig.ctaUrl ?? null,
      bodyMarkdown: orig.bodyMarkdown,
      audienceFilter: orig.audienceFilter as import('@prisma/client').Prisma.InputJsonValue ?? null,
      status: 'DRAFT',
      sentAt: null,
      sentCount: 0,
      failedCount: 0,
      audienceCount: 0,
      createdByAdminId: adminId,
    },
  })

  revalidateMarketing()
  return { ok: true, data: { id: created.id } }
}

/** Only draft campaigns may be deleted. */
export async function deleteCampaign(id: string): Promise<ActionResult> {
  await requireAdmin()

  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id },
    select: { status: true },
  })
  if (!campaign) return { ok: false, error: 'Campaign not found' }
  if (campaign.status !== 'DRAFT') {
    return { ok: false, error: 'Only draft campaigns can be deleted' }
  }

  await prisma.newsletterCampaign.deleteMany({ where: { id, status: 'DRAFT' } })
  revalidateMarketing()
  return { ok: true }
}

/**
 * Queue a campaign for send. Wraps lib/newsletter/campaigns.queueCampaignForSend.
 *
 * queueCampaignForSend already validates that the campaign is DRAFT and handles
 * the race-safe QUEUED update with atomic updateMany. We just wrap auth + error
 * translation here and avoid duplicating the validation logic.
 */
export async function queueCampaignSend(id: string): Promise<ActionResult> {
  await requireAdmin()

  try {
    await queueCampaignForSend(id)
    revalidateMarketing()
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to queue campaign'
    return { ok: false, error: msg }
  }
}

/**
 * Send a test email for a campaign.
 * Wraps lib/newsletter/campaigns.sendCampaignTestEmail.
 * Only draft campaigns may send test emails.
 */
export async function sendCampaignTest(
  id: string,
  email: string,
): Promise<ActionResult<{ messageId: string | null }>> {
  await requireAdmin()

  const campaign = await prisma.newsletterCampaign.findUnique({ where: { id } })
  if (!campaign) return { ok: false, error: 'Campaign not found' }
  if (campaign.status !== 'DRAFT') {
    return { ok: false, error: 'Only draft campaigns can send test emails' }
  }

  const content = pickCampaignContent(campaign)
  const result = await sendCampaignTestEmail(content, email)

  if (!result.success) {
    return { ok: false, error: result.error || 'Failed to send test email' }
  }

  return { ok: true, data: { messageId: result.messageId } }
}

/** Returns the estimated audience count for a campaign's audienceFilter. */
export async function previewCampaignAudience(
  id: string,
): Promise<ActionResult<{ count: number }>> {
  await requireAdmin()

  const campaign = await prisma.newsletterCampaign.findUnique({
    where: { id },
    select: { audienceFilter: true },
  })
  if (!campaign) return { ok: false, error: 'Campaign not found' }

  const { recipients } = await resolveAudienceRecipients(campaign.audienceFilter)
  return { ok: true, data: { count: recipients.length } }
}

export async function bulkDuplicateCampaigns(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'campaigns')
  if (r) return r

  let count = 0
  for (const id of ids) {
    const result = await duplicateCampaign(id)
    if (result.ok) count++
  }

  revalidateMarketing()
  return { ok: true, affected: count }
}

/** Bulk delete — silently skips non-draft campaigns, reports draft-only count. */
export async function bulkDeleteCampaigns(ids: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(ids, 'campaigns')
  if (r) return r

  const result = await prisma.newsletterCampaign.deleteMany({
    where: { id: { in: ids }, status: 'DRAFT' },
  })
  revalidateMarketing()
  return { ok: true, affected: result.count }
}

/**
 * getCampaignDetailForInspector
 *
 * PARALLEL-SAFETY: Inlines the Prisma query (mirrors Task 1's loadCampaignDetail).
 */
export async function getCampaignDetailForInspector(
  id: string,
): Promise<CampaignDetailFull | null> {
  await requireAdmin()

  const c = await prisma.newsletterCampaign.findUnique({ where: { id } })
  if (!c) return null

  const recent = await prisma.newsletterCampaignDelivery.findMany({
    where: { campaignId: id, isTest: true },
    orderBy: { sentAt: 'desc' },
    take: 10,
  })

  return {
    id: c.id,
    name: c.name ?? null,
    subject: c.subject,
    preheader: c.preheader ?? null,
    heroImageUrl: c.heroImageUrl ?? null,
    ctaLabel: c.ctaLabel ?? null,
    ctaUrl: c.ctaUrl ?? null,
    bodyMarkdown: c.bodyMarkdown,
    status: c.status,
    audienceFilter: c.audienceFilter,
    audienceCount: c.audienceCount,
    sentCount: c.sentCount,
    failedCount: c.failedCount,
    createdByAdminId: c.createdByAdminId,
    sentAt: c.sentAt ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    recentTestDeliveries: recent.map((d) => ({
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
// ABANDONED CARTS
// ============================================================

/**
 * Enqueues a recovery email via the durable EmailQueue and marks recoveryEmailSent.
 * Does NOT call Resend directly — uses enqueueEmail from lib/email/queue.
 */
export async function sendCartRecoveryEmail(cartId: string): Promise<ActionResult> {
  await requireAdmin()

  const cart = await prisma.abandonedCart.findUnique({ where: { id: cartId } })
  if (!cart) return { ok: false, error: 'Cart not found' }
  if (cart.recovered) return { ok: false, error: 'Cart has already been recovered' }

  await enqueueEmail({
    type: 'cart-recovery',
    recipient: cart.customerEmail,
    payload: {
      cartId: cart.id,
      customerName: cart.customerName ?? null,
      items: safeParseItems(cart.items),
      totalValue: Number(cart.totalValue),
      discountCode: cart.discountCode ?? null,
    },
  })

  await prisma.abandonedCart.update({
    where: { id: cartId },
    data: {
      recoveryEmailSent: true,
      recoveryEmailSentAt: new Date(),
    },
  })

  revalidateMarketing()
  return { ok: true }
}

/**
 * Creates a 10%-off Promotion scoped to cart.customerEmail and writes
 * AbandonedCart.discountCode inside a $transaction.
 * Retries on UNIQUE code collision up to 5x.
 */
export async function generateCartRecoveryCode(
  cartId: string,
): Promise<ActionResult<{ code: string; promotionId: string }>> {
  await requireAdmin()

  const cart = await prisma.abandonedCart.findUnique({ where: { id: cartId } })
  if (!cart) return { ok: false, error: 'Cart not found' }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomAlphanumeric(8)

    try {
      const result = await prisma.$transaction(async (tx) => {
        const promo = await (tx as typeof prisma).promotion.create({
          data: {
            name: `Cart Recovery — ${cart.customerEmail}`,
            type: 'PERCENTAGE',
            value: 10,
            code,
            isActive: true,
            customerEmails: cart.customerEmail,
            maxUsesTotal: 1,
            maxUsesPerCustomer: 1,
            startDate: new Date(),
            endDate: expiresAt,
            autoApply: false,
            stackable: false,
          },
        })
        await (tx as typeof prisma).abandonedCart.update({
          where: { id: cartId },
          data: { discountCode: code },
        })
        return { promotionId: promo.id, code }
      })

      revalidateMarketing()
      return { ok: true, data: result }
    } catch (err: unknown) {
      const isUniqueError =
        err instanceof Error &&
        'code' in err &&
        (err as { code?: string }).code === 'P2002'
      if (!isUniqueError || attempt === 4) {
        const msg = err instanceof Error ? err.message : 'Failed to generate recovery code'
        return { ok: false, error: msg }
      }
      // retry with new code
    }
  }

  return { ok: false, error: 'Failed to generate unique recovery code after retries' }
}

export async function markCartRecovered(cartId: string): Promise<ActionResult> {
  await requireAdmin()
  await prisma.abandonedCart.update({
    where: { id: cartId },
    data: { recovered: true, recoveredAt: new Date() },
  })
  revalidateMarketing()
  return { ok: true }
}

export async function bulkSendRecoveryEmails(cartIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(cartIds, 'carts')
  if (r) return r

  let count = 0
  for (const id of cartIds) {
    const result = await sendCartRecoveryEmail(id)
    if (result.ok) count++
  }

  revalidateMarketing()
  return { ok: true, affected: count }
}

export async function bulkGenerateRecoveryCodes(cartIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(cartIds, 'carts')
  if (r) return r

  let count = 0
  for (const id of cartIds) {
    const result = await generateCartRecoveryCode(id)
    if (result.ok) count++
  }

  revalidateMarketing()
  return { ok: true, affected: count }
}

export async function bulkMarkCartsRecovered(cartIds: string[]): Promise<BulkResult> {
  await requireAdmin()
  const r = rejectEmpty(cartIds, 'carts')
  if (r) return r

  const result = await prisma.abandonedCart.updateMany({
    where: { id: { in: cartIds } },
    data: { recovered: true, recoveredAt: new Date() },
  })

  revalidateMarketing()
  return { ok: true, affected: result.count }
}

/**
 * getAbandonedCartDetailForInspector
 *
 * PARALLEL-SAFETY: Inlines the Prisma query (mirrors Task 1's loadAbandonedCartDetail).
 */
export async function getAbandonedCartDetailForInspector(
  id: string,
): Promise<AbandonedCartDetailFull | null> {
  await requireAdmin()
  const c = await prisma.abandonedCart.findUnique({ where: { id } })
  if (!c) return null
  return {
    id: c.id,
    customerId: c.customerId ?? null,
    customerEmail: c.customerEmail,
    customerName: c.customerName ?? null,
    items: safeParseItems(c.items),
    totalValue: Number(c.totalValue),
    itemCount: c.itemCount,
    recoveryEmailSent: c.recoveryEmailSent,
    recoveryEmailSentAt: c.recoveryEmailSentAt ?? null,
    recovered: c.recovered,
    recoveredAt: c.recoveredAt ?? null,
    recoveryOrderId: c.recoveryOrderId ?? null,
    abandonedAt: c.abandonedAt,
    expiresAt: c.expiresAt,
    discountCode: c.discountCode ?? null,
  }
}
