// tests/unit/app/admin/marketing/actions.test.ts
//
// Phase 5 Wave 1 Task 2 — Marketing server actions test suite.
//
// NOTE on get*ForInspector wrappers:
//   These inline Prisma queries rather than importing from lib/admin/marketing.ts
//   because Task 1 (data layer) is executing in parallel on a separate branch.
//   The tests exercise them via the same Prisma mocks — identical to the
//   fulfillment PR #94 parallel dispatch pattern.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/auth/admin', () => ({
  requireAdmin: vi.fn(async () => 'admin-123'),
  requireAdminRole: vi.fn(async () => 'super-456'),
}))

// ── Prisma mocks ─────────────────────────────────────────────────────────────
const promotionCreate = vi.fn()
const promotionUpdate = vi.fn()
const promotionUpdateMany = vi.fn()
const promotionDelete = vi.fn()
const promotionDeleteMany = vi.fn()
const promotionFindUnique = vi.fn()
const promotionFindFirst = vi.fn()

const popupCreate = vi.fn()
const popupUpdate = vi.fn()
const popupUpdateMany = vi.fn()
const popupDelete = vi.fn()
const popupDeleteMany = vi.fn()
const popupFindUnique = vi.fn()

const popupVariantCreate = vi.fn()
const popupVariantUpdate = vi.fn()
const popupVariantDelete = vi.fn()

const subscriberUpdate = vi.fn()
const subscriberUpdateMany = vi.fn()
const subscriberDelete = vi.fn()
const subscriberDeleteMany = vi.fn()
const subscriberFindMany = vi.fn()
const subscriberFindUnique = vi.fn()

const campaignCreate = vi.fn()
const campaignUpdate = vi.fn()
const campaignUpdateMany = vi.fn()
const campaignDeleteMany = vi.fn()
const campaignFindUnique = vi.fn()
const campaignFindMany = vi.fn()
const deliveryFindMany = vi.fn()

const cartUpdate = vi.fn()
const cartUpdateMany = vi.fn()
const cartFindUnique = vi.fn()
const cartFindMany = vi.fn()

const txPromoCreate = vi.fn()
const txCartUpdate = vi.fn()

const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    promotion: { create: txPromoCreate },
    abandonedCart: { update: txCartUpdate },
  })
)

vi.mock('@/lib/prisma', () => ({
  prisma: {
    promotion: {
      create: promotionCreate,
      update: promotionUpdate,
      updateMany: promotionUpdateMany,
      delete: promotionDelete,
      deleteMany: promotionDeleteMany,
      findUnique: promotionFindUnique,
      findFirst: promotionFindFirst,
    },
    marketingPopup: {
      create: popupCreate,
      update: popupUpdate,
      updateMany: popupUpdateMany,
      delete: popupDelete,
      deleteMany: popupDeleteMany,
      findUnique: popupFindUnique,
    },
    popupVariant: {
      create: popupVariantCreate,
      update: popupVariantUpdate,
      delete: popupVariantDelete,
    },
    newsletterSubscriber: {
      update: subscriberUpdate,
      updateMany: subscriberUpdateMany,
      delete: subscriberDelete,
      deleteMany: subscriberDeleteMany,
      findMany: subscriberFindMany,
      findUnique: subscriberFindUnique,
    },
    newsletterCampaign: {
      create: campaignCreate,
      update: campaignUpdate,
      updateMany: campaignUpdateMany,
      deleteMany: campaignDeleteMany,
      findUnique: campaignFindUnique,
      findMany: campaignFindMany,
    },
    newsletterCampaignDelivery: {
      findMany: deliveryFindMany,
    },
    abandonedCart: {
      update: cartUpdate,
      updateMany: cartUpdateMany,
      findUnique: cartFindUnique,
      findMany: cartFindMany,
    },
    $transaction: transaction,
  },
}))

// ── Email mocks ───────────────────────────────────────────────────────────────
const enqueueEmail = vi.fn()
vi.mock('@/lib/email/queue', () => ({ enqueueEmail }))

const sendNewsletterEmail = vi.fn()
vi.mock('@/lib/email/newsletter', () => ({ sendNewsletterEmail }))

const sendCampaignTestEmail = vi.fn()
const pickCampaignContent = vi.fn()
const queueCampaignForSend = vi.fn()
vi.mock('@/lib/newsletter/campaigns', () => ({
  sendCampaignTestEmail,
  pickCampaignContent,
  queueCampaignForSend,
}))

const resolveAudienceRecipients = vi.fn()
vi.mock('@/lib/newsletter/audience', () => ({ resolveAudienceRecipients }))

// ── Helpers ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks()
})

// =============================================================================
// PROMOTIONS
// =============================================================================

describe('createPromotion', () => {
  it('creates a promotion and returns ok', async () => {
    promotionCreate.mockResolvedValue({ id: 'promo1' })
    const { createPromotion } = await import('@/app/admin/marketing/actions')
    const r = await createPromotion({
      name: 'Summer 20', type: 'PERCENTAGE', value: 20,
      isActive: true, startDate: new Date('2026-05-01'),
    })
    expect(r.ok).toBe(true)
    expect(promotionCreate).toHaveBeenCalledOnce()
  })

  it('returns error if name is empty', async () => {
    const { createPromotion } = await import('@/app/admin/marketing/actions')
    const r = await createPromotion({ name: '  ', type: 'PERCENTAGE', value: 20, isActive: true, startDate: new Date() })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/name/i)
  })

  it('returns error if value is negative', async () => {
    const { createPromotion } = await import('@/app/admin/marketing/actions')
    const r = await createPromotion({ name: 'Bad', type: 'PERCENTAGE', value: -5, isActive: true, startDate: new Date() })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/value/i)
  })
})

describe('updatePromotion', () => {
  it('updates a promotion', async () => {
    promotionUpdate.mockResolvedValue({ id: 'promo1' })
    const { updatePromotion } = await import('@/app/admin/marketing/actions')
    const r = await updatePromotion('promo1', { name: 'New Name', value: 15 })
    expect(r.ok).toBe(true)
    expect(promotionUpdate).toHaveBeenCalledWith({
      where: { id: 'promo1' },
      data: expect.objectContaining({ name: 'New Name', value: 15 }),
    })
  })
})

describe('deletePromotion', () => {
  it('deletes a promotion', async () => {
    promotionDelete.mockResolvedValue({ id: 'promo1' })
    const { deletePromotion } = await import('@/app/admin/marketing/actions')
    const r = await deletePromotion('promo1')
    expect(r.ok).toBe(true)
    expect(promotionDelete).toHaveBeenCalledWith({ where: { id: 'promo1' } })
  })
})

describe('togglePromotionActive', () => {
  it('sets isActive true', async () => {
    promotionUpdate.mockResolvedValue({ id: 'promo1' })
    const { togglePromotionActive } = await import('@/app/admin/marketing/actions')
    const r = await togglePromotionActive('promo1', true)
    expect(r.ok).toBe(true)
    expect(promotionUpdate).toHaveBeenCalledWith({
      where: { id: 'promo1' },
      data: { isActive: true },
    })
  })
})

describe('suggestPromotionCode', () => {
  it('returns an 8-char alphanumeric code without touching the DB', async () => {
    const { suggestPromotionCode } = await import('@/app/admin/marketing/actions')
    const r = await suggestPromotionCode()
    expect(r.ok).toBe(true)
    if (r.ok && r.data) {
      expect(r.data.code).toMatch(/^[A-Z0-9]{8}$/)
    }
    expect(promotionFindFirst).not.toHaveBeenCalled()
    expect(promotionCreate).not.toHaveBeenCalled()
  })
})

describe('checkPromotionCodeUnique', () => {
  it('returns isUnique true when no existing code', async () => {
    promotionFindFirst.mockResolvedValue(null)
    const { checkPromotionCodeUnique } = await import('@/app/admin/marketing/actions')
    const r = await checkPromotionCodeUnique('NEWCODE1')
    expect(r.ok).toBe(true)
    if (r.ok && r.data) expect(r.data.isUnique).toBe(true)
  })

  it('returns isUnique false when code already exists', async () => {
    promotionFindFirst.mockResolvedValue({ id: 'existing' })
    const { checkPromotionCodeUnique } = await import('@/app/admin/marketing/actions')
    const r = await checkPromotionCodeUnique('EXISTING')
    expect(r.ok).toBe(true)
    if (r.ok && r.data) expect(r.data.isUnique).toBe(false)
  })
})

describe('bulkActivatePromotions', () => {
  it('bulk activates promotions', async () => {
    promotionUpdateMany.mockResolvedValue({ count: 3 })
    const { bulkActivatePromotions } = await import('@/app/admin/marketing/actions')
    const r = await bulkActivatePromotions(['a', 'b', 'c'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(3)
  })

  it('rejects empty ids', async () => {
    const { bulkActivatePromotions } = await import('@/app/admin/marketing/actions')
    const r = await bulkActivatePromotions([])
    expect(r.ok).toBe(false)
  })
})

describe('bulkDeactivatePromotions', () => {
  it('bulk deactivates promotions', async () => {
    promotionUpdateMany.mockResolvedValue({ count: 2 })
    const { bulkDeactivatePromotions } = await import('@/app/admin/marketing/actions')
    const r = await bulkDeactivatePromotions(['a', 'b'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })
})

describe('bulkDeletePromotions', () => {
  it('bulk deletes promotions', async () => {
    promotionDeleteMany.mockResolvedValue({ count: 2 })
    const { bulkDeletePromotions } = await import('@/app/admin/marketing/actions')
    const r = await bulkDeletePromotions(['a', 'b'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })
})

describe('getPromotionDetailForInspector', () => {
  it('returns null when not found', async () => {
    promotionFindUnique.mockResolvedValue(null)
    const { getPromotionDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getPromotionDetailForInspector('missing')
    expect(r).toBeNull()
  })

  it('returns promotion detail', async () => {
    promotionFindUnique.mockResolvedValue({
      id: 'p1', name: 'Summer 20', description: null, code: 'SUMMER20',
      type: 'PERCENTAGE', value: 20, autoApply: false, stackable: false,
      minimumPurchase: null, maxUsesTotal: 100, maxUsesPerCustomer: 1,
      usedCount: 12, productIds: null, collectionIds: null, customerEmails: null,
      startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'),
      isActive: true, maxDiscountPercent: null, excludeFromLoyalty: false,
      totalDiscountGiven: 1234.5, createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
    })
    const { getPromotionDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getPromotionDetailForInspector('p1')
    expect(r?.id).toBe('p1')
    expect(r?.code).toBe('SUMMER20')
  })
})

// =============================================================================
// POPUPS
// =============================================================================

describe('createPopup', () => {
  it('creates a popup and returns ok', async () => {
    popupCreate.mockResolvedValue({ id: 'pp1' })
    const { createPopup } = await import('@/app/admin/marketing/actions')
    const r = await createPopup({
      name: 'Welcome', template: 'MODAL', content: '{}',
      triggerType: 'DELAY', isActive: true,
    })
    expect(r.ok).toBe(true)
    expect(popupCreate).toHaveBeenCalledOnce()
  })

  it('returns error if name is empty', async () => {
    const { createPopup } = await import('@/app/admin/marketing/actions')
    const r = await createPopup({ name: '  ', template: 'MODAL', content: '{}', triggerType: 'DELAY', isActive: true })
    expect(r.ok).toBe(false)
  })
})

describe('updatePopup', () => {
  it('updates popup fields', async () => {
    popupUpdate.mockResolvedValue({ id: 'pp1' })
    const { updatePopup } = await import('@/app/admin/marketing/actions')
    const r = await updatePopup('pp1', { name: 'Updated' })
    expect(r.ok).toBe(true)
  })
})

describe('deletePopup', () => {
  it('deletes popup', async () => {
    popupDelete.mockResolvedValue({ id: 'pp1' })
    const { deletePopup } = await import('@/app/admin/marketing/actions')
    const r = await deletePopup('pp1')
    expect(r.ok).toBe(true)
  })
})

describe('togglePopupActive', () => {
  it('toggles popup isActive', async () => {
    popupUpdate.mockResolvedValue({ id: 'pp1' })
    const { togglePopupActive } = await import('@/app/admin/marketing/actions')
    const r = await togglePopupActive('pp1', false)
    expect(r.ok).toBe(true)
    expect(popupUpdate).toHaveBeenCalledWith({ where: { id: 'pp1' }, data: { isActive: false } })
  })
})

describe('duplicatePopup', () => {
  it('duplicates popup with variants', async () => {
    const now = new Date()
    popupFindUnique.mockResolvedValue({
      id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
      content: '{}', triggerType: 'DELAY', triggerValue: 3,
      showOnPages: 'all', showToNewVisitors: true, showToReturning: true,
      frequency: 'ONCE_PER_SESSION', startDate: null, endDate: null,
      isActive: true, priority: 1, promotionId: null,
      createdAt: now, updatedAt: now,
      variants: [
        { id: 'v1', name: 'A', content: '{}', weight: 50, isActive: true },
      ],
    })
    popupCreate.mockResolvedValue({ id: 'pp2' })
    const { duplicatePopup } = await import('@/app/admin/marketing/actions')
    const r = await duplicatePopup('pp1')
    expect(r.ok).toBe(true)
    expect(popupCreate).toHaveBeenCalledOnce()
    const createArg = popupCreate.mock.calls[0][0].data
    expect(createArg.name).toBe('Welcome (Copy)')
    expect(createArg.isActive).toBe(false)
  })

  it('returns error when popup not found', async () => {
    popupFindUnique.mockResolvedValue(null)
    const { duplicatePopup } = await import('@/app/admin/marketing/actions')
    const r = await duplicatePopup('missing')
    expect(r.ok).toBe(false)
  })
})

describe('createPopupVariant', () => {
  it('creates a variant', async () => {
    popupVariantCreate.mockResolvedValue({ id: 'v1' })
    const { createPopupVariant } = await import('@/app/admin/marketing/actions')
    const r = await createPopupVariant('pp1', { name: 'Variant A', weight: 50 })
    expect(r.ok).toBe(true)
    expect(popupVariantCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ popupId: 'pp1', name: 'Variant A', weight: 50 }),
    })
  })
})

describe('updatePopupVariant', () => {
  it('updates a variant', async () => {
    popupVariantUpdate.mockResolvedValue({ id: 'v1' })
    const { updatePopupVariant } = await import('@/app/admin/marketing/actions')
    const r = await updatePopupVariant('v1', { weight: 75 })
    expect(r.ok).toBe(true)
  })
})

describe('deletePopupVariant', () => {
  it('deletes a variant', async () => {
    popupVariantDelete.mockResolvedValue({ id: 'v1' })
    const { deletePopupVariant } = await import('@/app/admin/marketing/actions')
    const r = await deletePopupVariant('v1')
    expect(r.ok).toBe(true)
  })
})

describe('bulkActivatePopups', () => {
  it('bulk activates popups', async () => {
    popupUpdateMany.mockResolvedValue({ count: 3 })
    const { bulkActivatePopups } = await import('@/app/admin/marketing/actions')
    const r = await bulkActivatePopups(['a', 'b', 'c'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(3)
  })
})

describe('bulkDeactivatePopups', () => {
  it('bulk deactivates popups', async () => {
    popupUpdateMany.mockResolvedValue({ count: 2 })
    const { bulkDeactivatePopups } = await import('@/app/admin/marketing/actions')
    const r = await bulkDeactivatePopups(['a', 'b'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })
})

describe('bulkDuplicatePopups', () => {
  it('duplicates multiple popups', async () => {
    const now = new Date()
    const basePopup = {
      id: 'pp1', name: 'Pop', template: 'MODAL', position: 'CENTER',
      content: '{}', triggerType: 'DELAY', triggerValue: 3,
      showOnPages: 'all', showToNewVisitors: true, showToReturning: true,
      frequency: 'ONCE_PER_SESSION', startDate: null, endDate: null,
      isActive: true, priority: 1, promotionId: null,
      createdAt: now, updatedAt: now, variants: [],
    }
    popupFindUnique
      .mockResolvedValueOnce({ ...basePopup, id: 'pp1' })
      .mockResolvedValueOnce({ ...basePopup, id: 'pp2' })
    popupCreate.mockResolvedValue({ id: 'new' })
    const { bulkDuplicatePopups } = await import('@/app/admin/marketing/actions')
    const r = await bulkDuplicatePopups(['pp1', 'pp2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })
})

describe('bulkDeletePopups', () => {
  it('bulk deletes popups', async () => {
    popupDeleteMany.mockResolvedValue({ count: 2 })
    const { bulkDeletePopups } = await import('@/app/admin/marketing/actions')
    const r = await bulkDeletePopups(['a', 'b'])
    expect(r.ok).toBe(true)
  })
})

describe('getPopupDetailForInspector', () => {
  it('returns null for missing popup', async () => {
    popupFindUnique.mockResolvedValue(null)
    const { getPopupDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getPopupDetailForInspector('missing')
    expect(r).toBeNull()
  })

  it('returns popup detail with analytics rollup', async () => {
    const now = new Date()
    popupFindUnique.mockResolvedValue({
      id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
      content: '{}', triggerType: 'DELAY', triggerValue: 3,
      showOnPages: 'all', showToNewVisitors: true, showToReturning: false,
      frequency: 'ONCE_PER_SESSION', startDate: null, endDate: null,
      isActive: true, priority: 1, promotionId: null,
      createdAt: now, updatedAt: now,
      variants: [{ id: 'v1', popupId: 'pp1', name: 'A', content: '{}', weight: 50, isActive: true, createdAt: now, updatedAt: now }],
      analytics: [
        { impressions: 100, clicks: 20, dismissals: 30, conversions: 5 },
        { impressions: 200, clicks: 40, dismissals: 50, conversions: 10 },
      ],
    })
    const { getPopupDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getPopupDetailForInspector('pp1')
    expect(r?.id).toBe('pp1')
    expect(r?.analytics7d).toMatchObject({ impressions: 300, clicks: 60, conversions: 15 })
    expect(r?.variants).toHaveLength(1)
  })
})

// =============================================================================
// SUBSCRIBERS
// =============================================================================

describe('unsubscribeSubscriber', () => {
  it('sets isActive=false and records unsubscribedAt', async () => {
    subscriberUpdate.mockResolvedValue({ id: 's1' })
    const { unsubscribeSubscriber } = await import('@/app/admin/marketing/actions')
    const r = await unsubscribeSubscriber('s1')
    expect(r.ok).toBe(true)
    expect(subscriberUpdate).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: expect.objectContaining({ isActive: false, unsubscribedAt: expect.any(Date) }),
    })
  })
})

describe('deleteSubscriber', () => {
  it('permanently deletes subscriber (SUPER_ADMIN)', async () => {
    subscriberDelete.mockResolvedValue({ id: 's1' })
    const { deleteSubscriber } = await import('@/app/admin/marketing/actions')
    const r = await deleteSubscriber('s1')
    expect(r.ok).toBe(true)
    expect(subscriberDelete).toHaveBeenCalledWith({ where: { id: 's1' } })
  })
})

describe('bulkUnsubscribeSubscribers', () => {
  it('bulk unsubscribes', async () => {
    subscriberUpdateMany.mockResolvedValue({ count: 3 })
    const { bulkUnsubscribeSubscribers } = await import('@/app/admin/marketing/actions')
    const r = await bulkUnsubscribeSubscribers(['a', 'b', 'c'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(3)
  })
})

describe('bulkExportSubscribersCsv', () => {
  it('returns CSV string with header row', async () => {
    subscriberFindMany.mockResolvedValue([
      { email: 'ada@e.com', source: 'popup', isActive: true, isVerified: true, createdAt: new Date('2026-05-01'), utmSource: null, utmMedium: null },
    ])
    const { bulkExportSubscribersCsv } = await import('@/app/admin/marketing/actions')
    const r = await bulkExportSubscribersCsv(['s1'])
    expect(r.ok).toBe(true)
    if (r.ok && r.data) {
      expect(r.data.csv).toContain('email')
      expect(r.data.csv).toContain('ada@e.com')
    }
  })

  it('returns error for empty ids', async () => {
    const { bulkExportSubscribersCsv } = await import('@/app/admin/marketing/actions')
    const r = await bulkExportSubscribersCsv([])
    expect(r.ok).toBe(false)
  })
})

describe('bulkDeleteSubscribers', () => {
  it('permanently deletes subscribers (SUPER_ADMIN)', async () => {
    subscriberDeleteMany.mockResolvedValue({ count: 2 })
    const { bulkDeleteSubscribers } = await import('@/app/admin/marketing/actions')
    const r = await bulkDeleteSubscribers(['a', 'b'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })
})

describe('getSubscriberDetailForInspector', () => {
  it('returns null when not found', async () => {
    subscriberFindUnique.mockResolvedValue(null)
    const { getSubscriberDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getSubscriberDetailForInspector('missing')
    expect(r).toBeNull()
  })

  it('returns subscriber detail', async () => {
    subscriberFindUnique.mockResolvedValue({
      id: 's1', email: 'ada@e.com', source: 'popup', sourceDetails: 'modal-A',
      isActive: true, isVerified: true, verifiedAt: new Date('2026-05-01'),
      unsubscribedAt: null, unsubscribeReason: null,
      utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'spring',
      createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
    })
    const { getSubscriberDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getSubscriberDetailForInspector('s1')
    expect(r?.email).toBe('ada@e.com')
    expect(r?.utmSource).toBe('google')
  })
})

// =============================================================================
// CAMPAIGNS
// =============================================================================

describe('createCampaignDraft', () => {
  it('creates a draft campaign', async () => {
    campaignCreate.mockResolvedValue({ id: 'c1' })
    const { createCampaignDraft } = await import('@/app/admin/marketing/actions')
    const r = await createCampaignDraft({ subject: 'Hello', bodyMarkdown: 'Body' })
    expect(r.ok).toBe(true)
    expect(campaignCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ subject: 'Hello', status: 'DRAFT', bodyMarkdown: 'Body' }),
    })
  })

  it('returns error if subject is empty', async () => {
    const { createCampaignDraft } = await import('@/app/admin/marketing/actions')
    const r = await createCampaignDraft({ subject: '   ', bodyMarkdown: 'Body' })
    expect(r.ok).toBe(false)
  })
})

describe('updateCampaignDraft', () => {
  it('updates a campaign draft', async () => {
    campaignUpdate.mockResolvedValue({ id: 'c1' })
    const { updateCampaignDraft } = await import('@/app/admin/marketing/actions')
    const r = await updateCampaignDraft('c1', { subject: 'Updated' })
    expect(r.ok).toBe(true)
  })
})

describe('duplicateCampaign', () => {
  it('duplicates campaign clearing sentAt/status/counts', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1', name: 'May', subject: 'Hello', preheader: null,
      heroImageUrl: null, ctaLabel: null, ctaUrl: null,
      bodyMarkdown: 'Body', audienceFilter: null, createdByAdminId: 'admin-123',
      status: 'SENT', sentCount: 990, failedCount: 10, sentAt: new Date(),
    })
    campaignCreate.mockResolvedValue({ id: 'c2' })
    const { duplicateCampaign } = await import('@/app/admin/marketing/actions')
    const r = await duplicateCampaign('c1')
    expect(r.ok).toBe(true)
    const createArg = campaignCreate.mock.calls[0][0].data
    expect(createArg.status).toBe('DRAFT')
    expect(createArg.sentAt).toBeNull()
    expect(createArg.sentCount).toBe(0)
    expect(createArg.failedCount).toBe(0)
  })

  it('returns error when campaign not found', async () => {
    campaignFindUnique.mockResolvedValue(null)
    const { duplicateCampaign } = await import('@/app/admin/marketing/actions')
    const r = await duplicateCampaign('missing')
    expect(r.ok).toBe(false)
  })
})

describe('deleteCampaign', () => {
  it('deletes a draft campaign', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', status: 'DRAFT' })
    campaignDeleteMany.mockResolvedValue({ count: 1 })
    const { deleteCampaign } = await import('@/app/admin/marketing/actions')
    const r = await deleteCampaign('c1')
    expect(r.ok).toBe(true)
  })

  it('rejects delete of non-draft campaign', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', status: 'SENT' })
    const { deleteCampaign } = await import('@/app/admin/marketing/actions')
    const r = await deleteCampaign('c1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/draft/i)
  })
})

describe('queueCampaignSend', () => {
  it('calls queueCampaignForSend and returns ok', async () => {
    queueCampaignForSend.mockResolvedValue({ campaignId: 'c1', status: 'QUEUED' })
    const { queueCampaignSend } = await import('@/app/admin/marketing/actions')
    const r = await queueCampaignSend('c1')
    expect(r.ok).toBe(true)
    expect(queueCampaignForSend).toHaveBeenCalledWith('c1')
  })

  it('returns error if queueCampaignForSend throws', async () => {
    queueCampaignForSend.mockRejectedValue(new Error('Only draft campaigns can be queued'))
    const { queueCampaignSend } = await import('@/app/admin/marketing/actions')
    const r = await queueCampaignSend('c1')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toContain('Only draft')
  })
})

describe('sendCampaignTest', () => {
  it('sends a test email and returns ok', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1', status: 'DRAFT', name: 'Test', subject: 'Hi', preheader: null,
      heroImageUrl: null, ctaLabel: null, ctaUrl: null, bodyMarkdown: 'Body', audienceFilter: null,
    })
    pickCampaignContent.mockReturnValue({ subject: 'Hi', bodyMarkdown: 'Body' })
    sendCampaignTestEmail.mockResolvedValue({ success: true, messageId: 'msg1', error: null })
    const { sendCampaignTest } = await import('@/app/admin/marketing/actions')
    const r = await sendCampaignTest('c1', 'test@example.com')
    expect(r.ok).toBe(true)
    expect(sendCampaignTestEmail).toHaveBeenCalledOnce()
  })

  it('returns error when campaign not found', async () => {
    campaignFindUnique.mockResolvedValue(null)
    const { sendCampaignTest } = await import('@/app/admin/marketing/actions')
    const r = await sendCampaignTest('missing', 'test@e.com')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/not found/i)
  })

  it('returns error when campaign is not a draft', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', status: 'SENT' })
    const { sendCampaignTest } = await import('@/app/admin/marketing/actions')
    const r = await sendCampaignTest('c1', 'test@e.com')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/draft/i)
  })
})

describe('previewCampaignAudience', () => {
  it('returns audience count', async () => {
    campaignFindUnique.mockResolvedValue({ id: 'c1', audienceFilter: { activeOnly: true } })
    resolveAudienceRecipients.mockResolvedValue({
      filter: { activeOnly: true },
      recipients: [{ email: 'a@e.com' }, { email: 'b@e.com' }],
    })
    const { previewCampaignAudience } = await import('@/app/admin/marketing/actions')
    const r = await previewCampaignAudience('c1')
    expect(r.ok).toBe(true)
    if (r.ok && r.data) expect(r.data.count).toBe(2)
  })

  it('returns error when campaign not found', async () => {
    campaignFindUnique.mockResolvedValue(null)
    const { previewCampaignAudience } = await import('@/app/admin/marketing/actions')
    const r = await previewCampaignAudience('missing')
    expect(r.ok).toBe(false)
  })
})

describe('bulkDuplicateCampaigns', () => {
  it('duplicates multiple draft campaigns', async () => {
    campaignFindUnique
      .mockResolvedValueOnce({
        id: 'c1', name: 'May', subject: 'Hi', preheader: null,
        heroImageUrl: null, ctaLabel: null, ctaUrl: null,
        bodyMarkdown: 'Body', audienceFilter: null, createdByAdminId: 'admin-123',
        status: 'DRAFT', sentCount: 0, failedCount: 0, sentAt: null,
      })
      .mockResolvedValueOnce({
        id: 'c2', name: 'June', subject: 'Hey', preheader: null,
        heroImageUrl: null, ctaLabel: null, ctaUrl: null,
        bodyMarkdown: 'Body 2', audienceFilter: null, createdByAdminId: 'admin-123',
        status: 'SENT', sentCount: 100, failedCount: 5, sentAt: new Date(),
      })
    campaignCreate.mockResolvedValue({ id: 'new' })
    const { bulkDuplicateCampaigns } = await import('@/app/admin/marketing/actions')
    const r = await bulkDuplicateCampaigns(['c1', 'c2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })
})

describe('bulkDeleteCampaigns', () => {
  it('deletes only draft campaigns', async () => {
    campaignDeleteMany.mockResolvedValue({ count: 2 })
    const { bulkDeleteCampaigns } = await import('@/app/admin/marketing/actions')
    const r = await bulkDeleteCampaigns(['a', 'b', 'c'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
    expect(campaignDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['a', 'b', 'c'] }, status: 'DRAFT' },
    })
  })
})

describe('getCampaignDetailForInspector', () => {
  it('returns null when not found', async () => {
    campaignFindUnique.mockResolvedValue(null)
    const { getCampaignDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getCampaignDetailForInspector('missing')
    expect(r).toBeNull()
  })

  it('returns campaign detail with test deliveries', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1', name: 'May', subject: 'Hello May', preheader: 'Hi',
      heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/shop',
      bodyMarkdown: 'Body', status: 'SENT', audienceFilter: { activeOnly: true },
      audienceCount: 1000, sentCount: 990, failedCount: 10,
      createdByAdminId: 'a1', sentAt: new Date('2026-05-15'),
      createdAt: new Date('2026-05-10'), updatedAt: new Date('2026-05-15'),
    })
    deliveryFindMany.mockResolvedValue([
      {
        id: 'd1', email: 'a@e.com', status: 'SENT', isTest: true,
        sentAt: new Date(), providerMessageId: 'm1', errorMessage: null,
      },
    ])
    const { getCampaignDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getCampaignDetailForInspector('c1')
    expect(r?.subject).toBe('Hello May')
    expect(r?.recentTestDeliveries).toHaveLength(1)
    expect(r?.sentCount).toBe(990)
  })
})

// =============================================================================
// ABANDONED CARTS
// =============================================================================

describe('sendCartRecoveryEmail', () => {
  it('enqueues a recovery email and marks recoveryEmailSent', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac1', customerEmail: 'lost@e.com', customerName: 'Lost',
      items: JSON.stringify([{ productName: 'Tee', quantity: 1 }]),
      totalValue: 49.99, recoveryEmailSent: false, recovered: false,
      discountCode: null,
    })
    enqueueEmail.mockResolvedValue({ id: 'q1' })
    cartUpdate.mockResolvedValue({ id: 'ac1' })
    const { sendCartRecoveryEmail } = await import('@/app/admin/marketing/actions')
    const r = await sendCartRecoveryEmail('ac1')
    expect(r.ok).toBe(true)
    expect(enqueueEmail).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'cart-recovery', recipient: 'lost@e.com' })
    )
    expect(cartUpdate).toHaveBeenCalledWith({
      where: { id: 'ac1' },
      data: expect.objectContaining({ recoveryEmailSent: true }),
    })
  })

  it('returns error when cart not found', async () => {
    cartFindUnique.mockResolvedValue(null)
    const { sendCartRecoveryEmail } = await import('@/app/admin/marketing/actions')
    const r = await sendCartRecoveryEmail('missing')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/not found/i)
  })

  it('returns error when cart already recovered', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac1', customerEmail: 'x@e.com', recovered: true,
      recoveryEmailSent: false, totalValue: 50,
    })
    const { sendCartRecoveryEmail } = await import('@/app/admin/marketing/actions')
    const r = await sendCartRecoveryEmail('ac1')
    expect(r.ok).toBe(false)
  })
})

describe('generateCartRecoveryCode', () => {
  it('creates a 10%-off Promotion and writes code to cart in $transaction', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac1', customerEmail: 'lost@e.com', totalValue: 100,
      recovered: false, discountCode: null,
    })
    txPromoCreate.mockResolvedValue({ id: 'promo1', code: 'CART1234' })
    txCartUpdate.mockResolvedValue({ id: 'ac1' })
    const { generateCartRecoveryCode } = await import('@/app/admin/marketing/actions')
    const r = await generateCartRecoveryCode('ac1')
    expect(r.ok).toBe(true)
    if (r.ok && r.data) expect(r.data.code).toBeTruthy()
    expect(transaction).toHaveBeenCalledOnce()
    expect(txPromoCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'PERCENTAGE',
          value: 10,
        }),
      })
    )
    expect(txCartUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'ac1' } })
    )
  })

  it('returns error when cart not found', async () => {
    cartFindUnique.mockResolvedValue(null)
    const { generateCartRecoveryCode } = await import('@/app/admin/marketing/actions')
    const r = await generateCartRecoveryCode('missing')
    expect(r.ok).toBe(false)
  })
})

describe('markCartRecovered', () => {
  it('marks cart as recovered with recoveredAt', async () => {
    cartUpdate.mockResolvedValue({ id: 'ac1' })
    const { markCartRecovered } = await import('@/app/admin/marketing/actions')
    const r = await markCartRecovered('ac1')
    expect(r.ok).toBe(true)
    expect(cartUpdate).toHaveBeenCalledWith({
      where: { id: 'ac1' },
      data: expect.objectContaining({ recovered: true, recoveredAt: expect.any(Date) }),
    })
  })
})

describe('bulkSendRecoveryEmails', () => {
  it('sends recovery emails to multiple carts', async () => {
    const cart = {
      id: 'ac1', customerEmail: 'x@e.com', customerName: 'X',
      items: '[]', totalValue: 30, recoveryEmailSent: false, recovered: false, discountCode: null,
    }
    cartFindUnique
      .mockResolvedValueOnce({ ...cart, id: 'ac1' })
      .mockResolvedValueOnce({ ...cart, id: 'ac2' })
    enqueueEmail.mockResolvedValue({ id: 'q1' })
    cartUpdate.mockResolvedValue({})
    const { bulkSendRecoveryEmails } = await import('@/app/admin/marketing/actions')
    const r = await bulkSendRecoveryEmails(['ac1', 'ac2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })

  it('rejects empty ids', async () => {
    const { bulkSendRecoveryEmails } = await import('@/app/admin/marketing/actions')
    const r = await bulkSendRecoveryEmails([])
    expect(r.ok).toBe(false)
  })
})

describe('bulkGenerateRecoveryCodes', () => {
  it('generates codes for multiple carts', async () => {
    const cart = {
      id: 'ac1', customerEmail: 'x@e.com', totalValue: 50,
      recovered: false, discountCode: null,
    }
    cartFindUnique
      .mockResolvedValueOnce({ ...cart, id: 'ac1' })
      .mockResolvedValueOnce({ ...cart, id: 'ac2' })
    txPromoCreate.mockResolvedValue({ id: 'promo', code: 'CODE1234' })
    txCartUpdate.mockResolvedValue({})
    const { bulkGenerateRecoveryCodes } = await import('@/app/admin/marketing/actions')
    const r = await bulkGenerateRecoveryCodes(['ac1', 'ac2'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(2)
  })
})

describe('bulkMarkCartsRecovered', () => {
  it('marks multiple carts as recovered', async () => {
    cartUpdateMany.mockResolvedValue({ count: 3 })
    const { bulkMarkCartsRecovered } = await import('@/app/admin/marketing/actions')
    const r = await bulkMarkCartsRecovered(['a', 'b', 'c'])
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.affected).toBe(3)
  })

  it('rejects empty ids', async () => {
    const { bulkMarkCartsRecovered } = await import('@/app/admin/marketing/actions')
    const r = await bulkMarkCartsRecovered([])
    expect(r.ok).toBe(false)
  })
})

describe('getAbandonedCartDetailForInspector', () => {
  it('returns null when not found', async () => {
    cartFindUnique.mockResolvedValue(null)
    const { getAbandonedCartDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getAbandonedCartDetailForInspector('missing')
    expect(r).toBeNull()
  })

  it('returns cart detail with parsed items', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac1', customerId: null, customerEmail: 'lost@e.com', customerName: 'Lost',
      items: JSON.stringify([{ productName: 'Tee', quantity: 2, price: 25 }]),
      totalValue: 50, itemCount: 2,
      recoveryEmailSent: false, recoveryEmailSentAt: null,
      recovered: false, recoveredAt: null, recoveryOrderId: null,
      abandonedAt: new Date('2026-05-20'), expiresAt: new Date('2026-06-20'),
      discountCode: null, discountAmount: null,
      createdAt: new Date('2026-05-20'), updatedAt: new Date('2026-05-20'),
    })
    const { getAbandonedCartDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getAbandonedCartDetailForInspector('ac1')
    expect(r?.items).toHaveLength(1)
    expect(r?.items[0]).toMatchObject({ productName: 'Tee', quantity: 2, price: 25 })
  })

  it('tolerates malformed items JSON', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac2', customerId: null, customerEmail: 'x@e.com', customerName: null,
      items: 'not-json',
      totalValue: 0, itemCount: 0,
      recoveryEmailSent: false, recoveryEmailSentAt: null,
      recovered: false, recoveredAt: null, recoveryOrderId: null,
      abandonedAt: new Date(), expiresAt: new Date(),
      discountCode: null, discountAmount: null,
      createdAt: new Date(), updatedAt: new Date(),
    })
    const { getAbandonedCartDetailForInspector } = await import('@/app/admin/marketing/actions')
    const r = await getAbandonedCartDetailForInspector('ac2')
    expect(r?.items).toEqual([])
  })
})
