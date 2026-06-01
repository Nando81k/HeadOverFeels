// tests/unit/lib/admin/marketing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const promotionFindMany = vi.fn()
const promotionCount = vi.fn()
const promotionAggregate = vi.fn()
const promotionFindUnique = vi.fn()
const popupFindMany = vi.fn()
const popupCount = vi.fn()
const popupFindUnique = vi.fn()
const popupAnalyticsAggregate = vi.fn()
const subscriberFindMany = vi.fn()
const subscriberCount = vi.fn()
const subscriberFindUnique = vi.fn()
const campaignFindMany = vi.fn()
const campaignCount = vi.fn()
const campaignFindUnique = vi.fn()
const cartFindMany = vi.fn()
const cartCount = vi.fn()
const cartFindUnique = vi.fn()
const deliveryFindMany = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    promotion: { findMany: promotionFindMany, count: promotionCount, aggregate: promotionAggregate, findUnique: promotionFindUnique },
    marketingPopup: { findMany: popupFindMany, count: popupCount, findUnique: popupFindUnique },
    popupAnalytics: { aggregate: popupAnalyticsAggregate },
    newsletterSubscriber: { findMany: subscriberFindMany, count: subscriberCount, findUnique: subscriberFindUnique },
    newsletterCampaign: { findMany: campaignFindMany, count: campaignCount, findUnique: campaignFindUnique },
    newsletterCampaignDelivery: { findMany: deliveryFindMany },
    abandonedCart: { findMany: cartFindMany, count: cartCount, findUnique: cartFindUnique },
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadMarketingKpis', () => {
  it('aggregates active promotions, popup conversions 7d, subscriber count + delta, carts to recover', async () => {
    promotionCount.mockResolvedValueOnce(3) // activePromotions
    popupAnalyticsAggregate.mockResolvedValueOnce({ _sum: { conversions: 42 } })
    subscriberCount
      .mockResolvedValueOnce(1000) // total active
      .mockResolvedValueOnce(50)   // last 7 days
      .mockResolvedValueOnce(40)   // prior 7 days
    cartCount.mockResolvedValueOnce(7) // cartsToRecover

    const { loadMarketingKpis } = await import('@/lib/admin/marketing')
    const k = await loadMarketingKpis()

    expect(k.activePromotions).toBe(3)
    expect(k.popupConversions7d).toBe(42)
    expect(k.subscriberCount).toBe(1000)
    expect(k.subscriberDeltaPct).toBeCloseTo(25, 0) // (50-40)/40 * 100
    expect(k.cartsToRecover).toBe(7)
  })

  it('treats null conversion sum as 0', async () => {
    promotionCount.mockResolvedValue(0)
    popupAnalyticsAggregate.mockResolvedValue({ _sum: { conversions: null } })
    subscriberCount.mockResolvedValue(0)
    cartCount.mockResolvedValue(0)
    const { loadMarketingKpis } = await import('@/lib/admin/marketing')
    const k = await loadMarketingKpis()
    expect(k.popupConversions7d).toBe(0)
    expect(k.subscriberDeltaPct).toBe(0)
  })
})

describe('loadPromotionsTab', () => {
  it('returns paginated promotion rows', async () => {
    promotionFindMany.mockResolvedValue([
      {
        id: 'p1', name: 'Summer 20', code: 'SUMMER20', type: 'PERCENTAGE',
        value: 20, isActive: true, usedCount: 12, maxUsesTotal: 100,
        startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'),
        totalDiscountGiven: 1234.5, autoApply: false, stackable: false,
        createdAt: new Date('2026-05-01'),
      },
    ])
    promotionCount.mockResolvedValue(1)
    const { loadPromotionsTab } = await import('@/lib/admin/marketing')
    const r = await loadPromotionsTab()
    expect(r.items).toHaveLength(1)
    expect(r.items[0]).toMatchObject({
      id: 'p1', name: 'Summer 20', code: 'SUMMER20',
      type: 'PERCENTAGE', value: 20, isActive: true,
      usedCount: 12, totalDiscountGiven: 1234.5,
    })
    expect(r.total).toBe(1)
    expect(r.page).toBe(1)
    expect(r.pageSize).toBe(25)
  })

  it('filters by isActive when provided', async () => {
    promotionFindMany.mockResolvedValue([])
    promotionCount.mockResolvedValue(0)
    const { loadPromotionsTab } = await import('@/lib/admin/marketing')
    await loadPromotionsTab({ isActive: true })
    expect(promotionFindMany.mock.calls[0][0].where.isActive).toBe(true)
  })
})

describe('loadPopupsTab', () => {
  it('returns paginated popup rows with last-7d analytics', async () => {
    popupFindMany.mockResolvedValue([
      {
        id: 'pp1', name: 'Welcome modal', template: 'MODAL', position: 'CENTER',
        triggerType: 'DELAY', isActive: true, priority: 1,
        startDate: null, endDate: null, createdAt: new Date('2026-05-01'),
        analytics: [
          { impressions: 100, clicks: 20, conversions: 5, dismissals: 30 },
          { impressions: 200, clicks: 40, conversions: 10, dismissals: 50 },
        ],
      },
    ])
    popupCount.mockResolvedValue(1)
    const { loadPopupsTab } = await import('@/lib/admin/marketing')
    const r = await loadPopupsTab()
    expect(r.items[0]).toMatchObject({
      id: 'pp1', name: 'Welcome modal', template: 'MODAL',
      impressions7d: 300, conversions7d: 15,
    })
  })
})

describe('loadSubscribersTab', () => {
  it('returns paginated subscriber rows', async () => {
    subscriberFindMany.mockResolvedValue([
      {
        id: 's1', email: 'ada@e.com', source: 'popup', sourceDetails: null,
        isActive: true, isVerified: true, createdAt: new Date('2026-05-01'),
        unsubscribedAt: null, utmSource: 'google',
      },
    ])
    subscriberCount.mockResolvedValue(1)
    const { loadSubscribersTab } = await import('@/lib/admin/marketing')
    const r = await loadSubscribersTab()
    expect(r.items[0]).toMatchObject({
      id: 's1', email: 'ada@e.com', source: 'popup', isActive: true, isVerified: true,
    })
  })
})

describe('loadCampaignsTab', () => {
  it('returns paginated campaign rows', async () => {
    campaignFindMany.mockResolvedValue([
      {
        id: 'c1', name: 'May newsletter', subject: 'Hello May',
        status: 'SENT', audienceCount: 1000, sentCount: 990, failedCount: 10,
        sentAt: new Date('2026-05-15'), createdAt: new Date('2026-05-10'),
      },
    ])
    campaignCount.mockResolvedValue(1)
    const { loadCampaignsTab } = await import('@/lib/admin/marketing')
    const r = await loadCampaignsTab()
    expect(r.items[0]).toMatchObject({
      id: 'c1', subject: 'Hello May', status: 'SENT',
      audienceCount: 1000, sentCount: 990, failedCount: 10,
    })
  })

  it('filters by status when provided', async () => {
    campaignFindMany.mockResolvedValue([])
    campaignCount.mockResolvedValue(0)
    const { loadCampaignsTab } = await import('@/lib/admin/marketing')
    await loadCampaignsTab({ status: 'DRAFT' })
    expect(campaignFindMany.mock.calls[0][0].where.status).toBe('DRAFT')
  })
})

describe('loadAbandonedCartsTab', () => {
  it('returns paginated cart rows with parsed item counts', async () => {
    cartFindMany.mockResolvedValue([
      {
        id: 'ac1', customerEmail: 'lost@e.com', customerName: 'Lost',
        items: JSON.stringify([{ id: 'x', quantity: 2 }]),
        totalValue: 89.99, itemCount: 2,
        recovered: false, recoveryEmailSent: false,
        abandonedAt: new Date('2026-05-20'), expiresAt: new Date('2026-06-20'),
        discountCode: null,
      },
    ])
    cartCount.mockResolvedValue(1)
    const { loadAbandonedCartsTab } = await import('@/lib/admin/marketing')
    const r = await loadAbandonedCartsTab()
    expect(r.items[0]).toMatchObject({
      id: 'ac1', customerEmail: 'lost@e.com', totalValue: 89.99,
      itemCount: 2, recovered: false,
    })
  })

  it('only includes non-recovered carts by default', async () => {
    cartFindMany.mockResolvedValue([])
    cartCount.mockResolvedValue(0)
    const { loadAbandonedCartsTab } = await import('@/lib/admin/marketing')
    await loadAbandonedCartsTab()
    expect(cartFindMany.mock.calls[0][0].where.recovered).toBe(false)
  })
})

describe('loadPromotionDetail', () => {
  it('returns null when not found', async () => {
    promotionFindUnique.mockResolvedValue(null)
    const { loadPromotionDetail } = await import('@/lib/admin/marketing')
    expect(await loadPromotionDetail('missing')).toBeNull()
  })

  it('returns full detail with parsed targeting arrays', async () => {
    promotionFindUnique.mockResolvedValue({
      id: 'p1', name: 'Summer 20', description: 'Summer sale', code: 'SUMMER20',
      type: 'PERCENTAGE', value: 20, autoApply: false, stackable: false,
      minimumPurchase: 50, maxUsesTotal: 100, maxUsesPerCustomer: 1,
      usedCount: 12, productIds: null, collectionIds: null, customerEmails: null,
      startDate: new Date('2026-05-01'), endDate: new Date('2026-06-01'),
      isActive: true, maxDiscountPercent: null, excludeFromLoyalty: false,
      totalDiscountGiven: 1234.5, createdAt: new Date('2026-05-01'),
      updatedAt: new Date('2026-05-01'),
    })
    const { loadPromotionDetail } = await import('@/lib/admin/marketing')
    const d = await loadPromotionDetail('p1')
    expect(d?.id).toBe('p1')
    expect(d?.code).toBe('SUMMER20')
    expect(d?.value).toBe(20)
  })
})

describe('loadPopupDetail', () => {
  it('returns full detail with variants and 7-day analytics rollup', async () => {
    popupFindUnique.mockResolvedValue({
      id: 'pp1', name: 'Welcome', template: 'MODAL', position: 'CENTER',
      content: '{}', triggerType: 'DELAY', triggerValue: 3,
      showOnPages: 'all', showToNewVisitors: true, showToReturning: false,
      frequency: 'ONCE_PER_SESSION', startDate: null, endDate: null,
      isActive: true, priority: 1, promotionId: null,
      createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
      variants: [
        { id: 'v1', popupId: 'pp1', name: 'A', content: '{}', weight: 50, isActive: true,
          createdAt: new Date(), updatedAt: new Date() },
      ],
      analytics: [
        { impressions: 100, clicks: 20, dismissals: 30, conversions: 5 },
      ],
    })
    const { loadPopupDetail } = await import('@/lib/admin/marketing')
    const d = await loadPopupDetail('pp1')
    expect(d?.id).toBe('pp1')
    expect(d?.variants).toHaveLength(1)
    expect(d?.analytics7d).toMatchObject({ impressions: 100, conversions: 5 })
  })
})

describe('loadSubscriberDetail', () => {
  it('returns full subscriber detail', async () => {
    subscriberFindUnique.mockResolvedValue({
      id: 's1', email: 'ada@e.com', source: 'popup', sourceDetails: 'modal-A',
      isActive: true, isVerified: true, verifiedAt: new Date('2026-05-01'),
      unsubscribedAt: null, unsubscribeReason: null,
      utmSource: 'google', utmMedium: 'cpc', utmCampaign: 'spring',
      createdAt: new Date('2026-05-01'), updatedAt: new Date('2026-05-01'),
    })
    const { loadSubscriberDetail } = await import('@/lib/admin/marketing')
    const d = await loadSubscriberDetail('s1')
    expect(d?.email).toBe('ada@e.com')
    expect(d?.utmSource).toBe('google')
  })
})

describe('loadCampaignDetail', () => {
  it('returns campaign detail with delivery rollup', async () => {
    campaignFindUnique.mockResolvedValue({
      id: 'c1', name: 'May', subject: 'Hello May', preheader: 'Hi',
      heroImageUrl: null, ctaLabel: 'Shop', ctaUrl: '/shop',
      bodyMarkdown: 'Body', status: 'SENT',
      audienceFilter: { activeOnly: true }, audienceCount: 1000,
      sentCount: 990, failedCount: 10, createdByAdminId: 'a1',
      sentAt: new Date('2026-05-15'), createdAt: new Date('2026-05-10'),
      updatedAt: new Date('2026-05-15'),
    })
    deliveryFindMany.mockResolvedValue([
      { id: 'd1', email: 'a@e.com', status: 'SENT', isTest: true, sentAt: new Date(),
        providerMessageId: 'm1', errorMessage: null },
    ])
    const { loadCampaignDetail } = await import('@/lib/admin/marketing')
    const d = await loadCampaignDetail('c1')
    expect(d?.subject).toBe('Hello May')
    expect(d?.recentTestDeliveries).toHaveLength(1)
  })
})

describe('loadAbandonedCartDetail', () => {
  it('returns cart detail with parsed items', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac1', customerId: null, customerEmail: 'lost@e.com', customerName: 'Lost',
      items: JSON.stringify([{ productName: 'Tee', quantity: 2, price: 25 }]),
      totalValue: 50, itemCount: 2,
      recoveryEmailSent: false, recoveryEmailSentAt: null,
      recovered: false, recoveredAt: null, recoveryOrderId: null,
      abandonedAt: new Date('2026-05-20'), expiresAt: new Date('2026-06-20'),
      discountCode: null,
    })
    const { loadAbandonedCartDetail } = await import('@/lib/admin/marketing')
    const d = await loadAbandonedCartDetail('ac1')
    expect(d?.items).toHaveLength(1)
    expect(d?.items[0]).toMatchObject({ productName: 'Tee', quantity: 2, price: 25 })
  })

  it('tolerates malformed items JSON', async () => {
    cartFindUnique.mockResolvedValue({
      id: 'ac2', customerId: null, customerEmail: 'x@e.com', customerName: null,
      items: 'not-json',
      totalValue: 0, itemCount: 0,
      recoveryEmailSent: false, recoveryEmailSentAt: null,
      recovered: false, recoveredAt: null, recoveryOrderId: null,
      abandonedAt: new Date(), expiresAt: new Date(),
      discountCode: null,
    })
    const { loadAbandonedCartDetail } = await import('@/lib/admin/marketing')
    const d = await loadAbandonedCartDetail('ac2')
    expect(d?.items).toEqual([])
  })
})
